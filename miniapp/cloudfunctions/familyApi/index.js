'use strict';

// The only database gateway used by the family mini program.  Keep the data
// model intentionally small: one family document and one versioned snapshot.
const crypto = require('node:crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_MEMBERS = 6;
const MAX_SNAPSHOT_BYTES = 850000;
const MAX_BACKUPS = 30;
const BACKUP_QUERY_LIMIT = 100;
const CAPACITY_WARNING_RATIO = 0.8;
const EXPORT_FORMAT = 'baby-care-family-export-v1';
const PARTITION_BACKUP_FORMAT = 'partitioned-family-backup-v1';
const FAMILY_RELATIONS = new Set(['父亲', '母亲', '外公', '外婆', '爷爷', '奶奶']);
const PARTITION_COLLECTIONS = new Set([
  'feedings', 'sleeps', 'diapers', 'diaperChanges', 'poops', 'supplements', 'todos', 'memories',
  'growthRecords', 'vaccines', 'abilities', 'checkups', 'trashEntries', 'recordHistory',
]);
const RETIRED_PARTITION_COLLECTIONS = new Set(['musicTracks', 'stories', 'learningItems']);
const RETIRED_SNAPSHOT_KEYS = new Set([
  ...RETIRED_PARTITION_COLLECTIONS,
  'studySeedVersion',
]);
const MAX_PARTITION_OPERATIONS = 100;

function createFamilyApi(options) {
  const db = options.database;
  const _ = db.command;
  const getWXContext = options.getWXContext;
  const logger = options.logger || console;
  const now = options.now || (() => new Date().toISOString());
  const uniqueId = options.uniqueId || (() => crypto.randomBytes(8).toString('hex'));

function response(ok, payload) {
  return { ok, ...payload };
}

function failure(code, message) {
  return response(false, { error: { code, message } });
}

function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function inviteCode() {
  // Unambiguous six-character code: easy to share in a family chat.
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function cleanMemberText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, 20) : fallback;
}

function familyMembers(family) {
  const memberOpenIds = Array.isArray(family.memberOpenIds) ? family.memberOpenIds : [];
  const storedMembers = Array.isArray(family.members) ? family.members : [];
  return memberOpenIds.map((memberOpenId, index) => {
    const stored = storedMembers.find((item) => item && item.openId === memberOpenId) || {};
    const role = family.ownerOpenId === memberOpenId
      ? 'owner'
      : family.backupAdminOpenId === memberOpenId ? 'backup-admin' : 'member';
    return {
      openId: memberOpenId,
      nickname: cleanMemberText(
        stored.nickname,
        role === 'owner' ? '家庭所有者' : `家庭成员${index + 1}`,
      ),
      relation: cleanMemberText(stored.relation),
      role,
      status: stored.status === 'inactive' ? 'inactive' : 'active',
    };
  });
}

function publicMember(member) {
  return {
    memberId: member.openId,
    nickname: member.nickname,
    relation: member.relation,
    role: member.role,
    status: member.status,
  };
}

async function ensureFamilyIdentityShape(family) {
  const memberOpenIds = Array.isArray(family.memberOpenIds) ? family.memberOpenIds : [];
  const backupAdminOpenId = memberOpenIds.includes(family.backupAdminOpenId)
    && family.backupAdminOpenId !== family.ownerOpenId
    ? family.backupAdminOpenId
    : null;
  const normalizedFamily = { ...family, backupAdminOpenId };
  const members = familyMembers(normalizedFamily);
  const storedMembers = Array.isArray(family.members) ? family.members : [];
  const needsUpgrade = family.maxMembers !== MAX_MEMBERS
    || family.backupAdminOpenId !== backupAdminOpenId
    || JSON.stringify(storedMembers) !== JSON.stringify(members);
  if (!needsUpgrade) return normalizedFamily;
  await db.collection('families').doc(family._id).update({
    data: {
      maxMembers: MAX_MEMBERS,
      backupAdminOpenId,
      members,
      updatedAt: db.serverDate(),
    },
  });
  return { ...normalizedFamily, maxMembers: MAX_MEMBERS, members };
}

function publicFamily(family, openId) {
  const memberOpenIds = Array.isArray(family.memberOpenIds) ? family.memberOpenIds : [];
  const members = familyMembers(family);
  const me = members.find((member) => member.openId === openId) || null;
  return {
    familyId: family._id,
    owner: family.ownerOpenId === openId,
    role: me ? me.role : null,
    me: me ? publicMember(me) : null,
    members: members.map(publicMember),
    memberCount: memberOpenIds.length,
    maxMembers: MAX_MEMBERS,
    // Only the owner can reveal the invite code.  Members never receive it.
    inviteCode: family.ownerOpenId === openId ? family.inviteCode : undefined,
  };
}

function canManageFamily(family, openId) {
  const member = familyMembers(family).find((item) => item.openId === openId);
  return Boolean(member && member.status === 'active'
    && (member.role === 'owner' || member.role === 'backup-admin'));
}

function isActiveFamilyMember(family, openId) {
  const member = familyMembers(family).find((item) => item.openId === openId);
  return Boolean(member && member.status === 'active');
}

function asPlainSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_SNAPSHOT');
  }

  const json = JSON.stringify(value);
  if (!json || Buffer.byteLength(json, 'utf8') > MAX_SNAPSHOT_BYTES) {
    throw new Error('SNAPSHOT_TOO_LARGE');
  }

  return JSON.parse(json);
}

function snapshotDetails(value) {
  const data = asPlainSnapshot(value);
  const json = JSON.stringify(data);
  const byteLength = Buffer.byteLength(json, 'utf8');
  return {
    data,
    byteLength,
    checksumSha256: crypto.createHash('sha256').update(json).digest('hex'),
  };
}

function capacityStatus(byteLength) {
  const snapshotBytes = Number.isInteger(byteLength) && byteLength >= 0 ? byteLength : 0;
  return {
    storageFormat: 'legacy-snapshot-v1',
    snapshotBytes,
    snapshotLimitBytes: MAX_SNAPSHOT_BYTES,
    usageRatio: Number((snapshotBytes / MAX_SNAPSHOT_BYTES).toFixed(4)),
    warning: snapshotBytes >= MAX_SNAPSHOT_BYTES * CAPACITY_WARNING_RATIO,
    partitionMigrationAvailable: false,
  };
}

function safeDocumentId(prefix, value) {
  return `${prefix}_${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

async function optionalDocument(collection, id) {
  try {
    const result = await collection.doc(id).get();
    return result && result.data || null;
  } catch (_) {
    return null;
  }
}

function plainValue(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function isRetiredPartitionKey(partitionKey) {
  const collection = String(partitionKey || '').split('/')[0];
  return RETIRED_PARTITION_COLLECTIONS.has(collection);
}

function isRetiredPartition(partition) {
  return Boolean(partition
    && RETIRED_PARTITION_COLLECTIONS.has(String(partition.collection || '')));
}

function activeCoreMap(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.keys(source).reduce((result, key) => {
    if (!RETIRED_SNAPSHOT_KEYS.has(key)) result[key] = plainValue(source[key]);
    return result;
  }, {});
}

function partitionForActiveUse(partition) {
  const copy = plainValue(partition || {});
  if (copy.collection === '__core__') {
    copy.records = activeCoreMap(copy.records);
    copy.tombstones = activeCoreMap(copy.tombstones);
  }
  return copy;
}

function activePartitionList(partitions) {
  return (Array.isArray(partitions) ? partitions : [])
    .filter((partition) => !isRetiredPartition(partition))
    .map(partitionForActiveUse)
    .filter((partition) => partition.collection !== '__core__'
      || Object.keys(partition.records || {}).length
      || Object.keys(partition.tombstones || {}).length);
}

function activePartitionRevisions(value) {
  const revisions = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.keys(revisions).reduce((result, partitionKey) => {
    if (!isRetiredPartitionKey(partitionKey)) result[partitionKey] = plainValue(revisions[partitionKey]);
    return result;
  }, {});
}

function isRetiredConflict(conflict) {
  if (!conflict || typeof conflict !== 'object') return false;
  if (RETIRED_PARTITION_COLLECTIONS.has(String(conflict.collection || ''))) return true;
  return conflict.collection === '__core__' && RETIRED_SNAPSHOT_KEYS.has(String(conflict.recordId || ''));
}

function cloudMediaReferences(value) {
  const references = new Set();
  const visited = new Set();
  function collect(candidate) {
    if (typeof candidate === 'string') {
      if (/^cloud:\/\//i.test(candidate)) references.add(candidate);
      return;
    }
    if (!candidate || typeof candidate !== 'object' || visited.has(candidate)) return;
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      candidate.forEach(collect);
      return;
    }
    Object.keys(candidate).forEach((key) => collect(candidate[key]));
  }
  collect(value);
  return [...references].sort();
}

function operationConflict(field, baseValue, losingValue, winningValue) {
  return {
    field,
    baseValue: plainValue(baseValue),
    losingValue: plainValue(losingValue),
    winningValue: plainValue(winningValue),
  };
}

function validPartitionOperation(operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) return false;
  if (!operation.operationId || typeof operation.operationId !== 'string' || operation.operationId.length > 100) return false;
  if (!operation.partitionKey || typeof operation.partitionKey !== 'string' || operation.partitionKey.length > 100) return false;
  if (!operation.collection || typeof operation.collection !== 'string') return false;
  if (!operation.recordId || typeof operation.recordId !== 'string' || operation.recordId.length > 150) return false;
  if (isRetiredPartitionKey(operation.partitionKey)) return false;
  if (operation.collection !== '__core__' && !PARTITION_COLLECTIONS.has(operation.collection)) return false;
  if (operation.collection === '__core__' && RETIRED_SNAPSHOT_KEYS.has(operation.recordId)) return false;
  if (operation.kind !== 'upsert' && operation.kind !== 'delete') return false;
  if (operation.kind === 'upsert' && (!operation.changes || typeof operation.changes !== 'object' || Array.isArray(operation.changes))) return false;
  return true;
}

async function ensureManifest(familyId, openId, transaction = db) {
  const collection = transaction.collection('family_manifests');
  const current = await optionalDocument(collection, familyId);
  if (current) return current;
  const manifest = {
    familyId,
    revision: 0,
    partitionRevisions: {},
    legacySnapshotVersion: 0,
    updatedAt: db.serverDate(),
    updatedBy: openId,
  };
  await collection.doc(familyId).set({ data: manifest });
  return { _id: familyId, ...manifest };
}

function publicPartition(partition) {
  const visiblePartition = partitionForActiveUse(partition);
  const storedRecords = visiblePartition.records && typeof visiblePartition.records === 'object'
    ? visiblePartition.records
    : {};
  const recordIds = Object.keys(storedRecords).sort();
  const records = recordIds.map((id) => plainValue(storedRecords[id]));
  return {
    partitionKey: visiblePartition.partitionKey,
    collection: visiblePartition.collection,
    revision: Number.isInteger(visiblePartition.revision) ? visiblePartition.revision : 0,
    records,
    // Keep the legacy array above for older clients, while exposing stable IDs
    // so the core partition can be reconstructed without baking keys into data.
    recordEntries: recordIds.map((recordId) => ({ recordId, value: plainValue(storedRecords[recordId]) })),
    tombstones: plainValue(visiblePartition.tombstones || {}),
  };
}

async function applyPartitionOperation(family, openId, operation) {
  const operationDocId = safeDocumentId('op', `${family._id}:${operation.operationId}`);
  return db.runTransaction(async (transaction) => {
    const operationCollection = transaction.collection('family_operations');
    const existingOperation = await optionalDocument(operationCollection, operationDocId);
    if (existingOperation) {
      return {
        operationId: operation.operationId,
        duplicate: true,
        partitionKey: existingOperation.partitionKey,
        partitionRevision: existingOperation.partitionRevision,
        manifestRevision: existingOperation.manifestRevision,
        conflicts: plainValue(existingOperation.conflicts || []),
      };
    }

    const manifest = await ensureManifest(family._id, openId, transaction);
    const partitionDocId = safeDocumentId('partition', `${family._id}:${operation.partitionKey}`);
    const partitionCollection = transaction.collection('family_partitions');
    const storedPartition = await optionalDocument(partitionCollection, partitionDocId);
    const partition = storedPartition || {
      familyId: family._id,
      partitionKey: operation.partitionKey,
      collection: operation.collection,
      revision: 0,
      records: {},
      tombstones: {},
    };
    if (partition.collection !== operation.collection) {
      return { invalidPartition: true, operationId: operation.operationId };
    }

    const records = { ...(partition.records || {}) };
    const tombstones = { ...(partition.tombstones || {}) };
    const currentRecord = records[operation.recordId] ? plainValue(records[operation.recordId]) : null;
    const baseRecord = operation.baseRecord && typeof operation.baseRecord === 'object'
      ? operation.baseRecord
      : null;
    const conflicts = [];

    if (operation.kind === 'delete') {
      if (currentRecord && baseRecord && JSON.stringify(currentRecord) !== JSON.stringify(baseRecord)) {
        conflicts.push(operationConflict('$record', baseRecord, currentRecord, null));
      }
      delete records[operation.recordId];
      tombstones[operation.recordId] = {
        operationId: operation.operationId,
        deletedBy: openId,
        deletedAt: db.serverDate(),
      };
    } else {
      const nextRecord = { ...(currentRecord || {}) };
      Object.keys(operation.changes).forEach((field) => {
        const currentValue = currentRecord ? currentRecord[field] : undefined;
        const baseValue = baseRecord ? baseRecord[field] : undefined;
        if (currentRecord && baseRecord && JSON.stringify(currentValue) !== JSON.stringify(baseValue)) {
          conflicts.push(operationConflict(field, baseValue, currentValue, operation.changes[field]));
        }
        nextRecord[field] = plainValue(operation.changes[field]);
      });
      records[operation.recordId] = nextRecord;
      delete tombstones[operation.recordId];
    }

    const partitionRevision = (Number.isInteger(partition.revision) ? partition.revision : 0) + 1;
    const manifestRevision = (Number.isInteger(manifest.revision) ? manifest.revision : 0) + 1;
    const partitionRevisions = { ...(manifest.partitionRevisions || {}), [operation.partitionKey]: partitionRevision };
    const partitionData = {
      familyId: family._id,
      partitionKey: operation.partitionKey,
      collection: operation.collection,
      revision: partitionRevision,
      records,
      tombstones,
      updatedAt: db.serverDate(),
      updatedBy: openId,
    };
    await partitionCollection.doc(partitionDocId).set({ data: partitionData });
    await transaction.collection('family_manifests').doc(family._id).set({
      data: {
        familyId: family._id,
        revision: manifestRevision,
        partitionRevisions,
        legacySnapshotVersion: Number(manifest.legacySnapshotVersion || 0),
        partitionedAt: manifest.partitionedAt || db.serverDate(),
        updatedAt: db.serverDate(),
        updatedBy: openId,
      },
    });

    for (let index = 0; index < conflicts.length; index += 1) {
      const conflict = conflicts[index];
      const conflictId = safeDocumentId('conflict', `${family._id}:${operation.operationId}:${conflict.field}`);
      await transaction.collection('family_conflicts').doc(conflictId).set({
        data: {
          familyId: family._id,
          operationId: operation.operationId,
          partitionKey: operation.partitionKey,
          collection: operation.collection,
          recordId: operation.recordId,
          ...conflict,
          resolvedValue: conflict.winningValue,
          createdAt: db.serverDate(),
          createdBy: openId,
        },
      });
    }

    const operationResult = {
      familyId: family._id,
      operationId: operation.operationId,
      partitionKey: operation.partitionKey,
      partitionRevision,
      manifestRevision,
      conflicts,
      appliedAt: db.serverDate(),
      appliedBy: openId,
    };
    await operationCollection.doc(operationDocId).set({ data: operationResult });
    return { ...operationResult, duplicate: false };
  });
}

async function syncPartitions(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权同步此家庭数据。');
  if (!Array.isArray(event.operations) || !event.operations.length || event.operations.length > MAX_PARTITION_OPERATIONS) {
    return failure('INVALID_OPERATIONS', '同步操作为空或超过单次上限。');
  }
  if (!event.operations.every(validPartitionOperation)) {
    return failure('INVALID_OPERATION', '同步操作格式无效。');
  }
  const results = [];
  for (const operation of event.operations) {
    const result = await applyPartitionOperation(family, openId, operation);
    if (result.invalidPartition) return failure('PARTITION_MISMATCH', '记录分区与已有数据不一致。');
    results.push(result);
  }
  const manifest = await ensureManifest(family._id, openId);
  return response(true, {
    synced: true,
    results,
    manifestRevision: Number(manifest.revision || 0),
    partitionRevisions: activePartitionRevisions(manifest.partitionRevisions),
  });
}

async function loadPartitions(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权读取此家庭分区数据。');
  const manifest = await ensureManifest(family._id, openId);
  const partitionResult = await db.collection('family_partitions').where({ familyId: family._id }).limit(1000).get();
  const conflictResult = await db.collection('family_conflicts').where({ familyId: family._id }).limit(1000).get();
  const partitions = activePartitionList(partitionResult.data).sort((left, right) => {
    return String(left.partitionKey || '').localeCompare(String(right.partitionKey || ''));
  }).map(publicPartition);
  const partitionRevisions = activePartitionRevisions(manifest.partitionRevisions);
  return response(true, {
    openId,
    family: publicFamily(family, openId),
    partitioned: Boolean(partitions.length),
    manifestRevision: Number(manifest.revision || 0),
    partitionRevisions,
    legacySnapshotVersion: Number(manifest.legacySnapshotVersion || 0),
    partitions,
    conflicts: (conflictResult.data || []).filter((item) => !isRetiredConflict(item)).map((item) => ({
      conflictId: item._id,
      operationId: item.operationId,
      partitionKey: item.partitionKey,
      collection: item.collection,
      recordId: item.recordId,
      field: item.field,
      baseValue: plainValue(item.baseValue),
      losingValue: plainValue(item.losingValue),
      winningValue: plainValue(item.winningValue),
      createdAt: item.createdAt || null,
    })),
  });
}

function recordMonth(record) {
  const candidates = ['date', 'time', 'start', 'end', 'completedDate', 'deletedAt', 'changedAt', '_updatedAt'];
  for (const key of candidates) {
    const match = String(record && record[key] || '').match(/^(\d{4}-\d{2})/);
    if (match) return match[1];
  }
  return 'undated';
}

async function migrateLegacySnapshot(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权迁移此家庭数据。');
  let snapshot;
  try { snapshot = asPlainSnapshot(event.data); } catch (_) { return failure('INVALID_SNAPSHOT', '旧家庭记录格式无效。'); }
  const legacyVersion = Number.isInteger(event.legacyVersion) && event.legacyVersion >= 0 ? event.legacyVersion : 0;
  const result = await db.runTransaction(async (transaction) => {
    const manifest = await ensureManifest(family._id, openId, transaction);
    const existing = await transaction.collection('family_partitions').where({ familyId: family._id }).limit(1000).get();
    const activeExisting = activePartitionList(existing.data).filter((partition) => {
      if (partition.collection !== '__core__') return true;
      return Object.keys(partition.records || {}).length || Object.keys(partition.tombstones || {}).length;
    });
    if (activeExisting.length) {
      return { migrated: false, reason: 'partition-data-exists', revision: Number(manifest.revision || 0) };
    }
    // Empty collections are materialized too. Without this marker, a second
    // device could not distinguish “the family has no records” from “this
    // collection was omitted”, and might keep stale local rows.
    const groups = new Map(Array.from(PARTITION_COLLECTIONS).map((collection) => [
      `${collection}/undated`,
      { collection, records: {} },
    ]));
    const core = {};
    Object.keys(snapshot).forEach((key) => {
      if (RETIRED_SNAPSHOT_KEYS.has(key)) return;
      if (!PARTITION_COLLECTIONS.has(key)) {
        core[key] = plainValue(snapshot[key]);
        return;
      }
      (Array.isArray(snapshot[key]) ? snapshot[key] : []).forEach((record) => {
        if (!record || typeof record !== 'object' || !record.id) return;
        const partitionKey = `${key}/${recordMonth(record)}`;
        if (!groups.has(partitionKey)) groups.set(partitionKey, { collection: key, records: {} });
        groups.get(partitionKey).records[record.id] = plainValue(record);
      });
    });
    if (Object.keys(core).length) {
      groups.set('core', {
        collection: '__core__',
        records: Object.keys(core).reduce((records, key) => {
          records[key] = { value: core[key] };
          return records;
        }, {}),
      });
    }
    const partitionRevisions = {};
    for (const [partitionKey, group] of groups.entries()) {
      partitionRevisions[partitionKey] = 1;
      await transaction.collection('family_partitions').doc(safeDocumentId('partition', `${family._id}:${partitionKey}`)).set({
        data: {
          familyId: family._id,
          partitionKey,
          collection: group.collection,
          revision: 1,
          records: group.records,
          tombstones: {},
          updatedAt: db.serverDate(),
          updatedBy: openId,
        },
      });
    }
    await transaction.collection('family_manifests').doc(family._id).set({
      data: {
        familyId: family._id,
        revision: 1,
        partitionRevisions,
        legacySnapshotVersion: legacyVersion,
        partitionedAt: db.serverDate(),
        updatedAt: db.serverDate(),
        updatedBy: openId,
      },
    });
    return { migrated: true, reason: 'migrated', revision: 1 };
  });
  return response(true, result);
}

function backupId(familyId, version, suffix = '') {
  const paddedVersion = String(version).padStart(12, '0');
  return `${familyId}__v${paddedVersion}${suffix ? `__${suffix}` : ''}`;
}

function backupDocument(familyId, version, details, reason, openId) {
  return {
    familyId,
    version,
    data: details.data,
    byteLength: details.byteLength,
    checksumSha256: details.checksumSha256,
    reason,
    createdAt: db.serverDate(),
    createdBy: openId,
  };
}

function normalizedPartition(partition) {
  return {
    partitionKey: String(partition.partitionKey || ''),
    collection: String(partition.collection || ''),
    revision: Number.isInteger(partition.revision) ? partition.revision : 0,
    records: plainValue(partition.records || {}),
    tombstones: plainValue(partition.tombstones || {}),
  };
}

function partitionsWithPreservedRetiredCore(targetPartitions, currentPartitions) {
  const writable = activePartitionList(targetPartitions).map(normalizedPartition);
  (Array.isArray(currentPartitions) ? currentPartitions : []).forEach((current) => {
    if (!current || current.collection !== '__core__') return;
    const retiredRecords = Object.keys(current.records || {}).reduce((result, key) => {
      if (RETIRED_SNAPSHOT_KEYS.has(key)) result[key] = plainValue(current.records[key]);
      return result;
    }, {});
    const retiredTombstones = Object.keys(current.tombstones || {}).reduce((result, key) => {
      if (RETIRED_SNAPSHOT_KEYS.has(key)) result[key] = plainValue(current.tombstones[key]);
      return result;
    }, {});
    if (!Object.keys(retiredRecords).length && !Object.keys(retiredTombstones).length) return;
    const partitionKey = String(current.partitionKey || 'core');
    let target = writable.find((partition) => (
      partition.collection === '__core__' && partition.partitionKey === partitionKey
    ));
    if (!target) {
      target = {
        partitionKey,
        collection: '__core__',
        revision: Number.isInteger(current.revision) ? current.revision : 0,
        records: {},
        tombstones: {},
      };
      writable.push(target);
    }
    target.records = { ...retiredRecords, ...target.records };
    target.tombstones = { ...retiredTombstones, ...target.tombstones };
  });
  return writable;
}

function partitionBackupDetails(manifest, partitions) {
  const visiblePartitions = activePartitionList(partitions);
  const payload = {
    format: PARTITION_BACKUP_FORMAT,
    manifest: {
      revision: Number.isInteger(manifest && manifest.revision) ? manifest.revision : 0,
      partitionRevisions: activePartitionRevisions(manifest && manifest.partitionRevisions),
      legacySnapshotVersion: Number(manifest && manifest.legacySnapshotVersion || 0),
    },
    partitions: visiblePartitions.map(normalizedPartition).sort((left, right) => {
      return left.partitionKey.localeCompare(right.partitionKey);
    }),
  };
  const details = snapshotDetails(payload);
  return { payload: details.data, byteLength: details.byteLength, checksumSha256: details.checksumSha256 };
}

function assembledPartitionData(partitions) {
  const result = {};
  const collections = {};
  activePartitionList(partitions).map(normalizedPartition).forEach((partition) => {
    if (partition.collection === '__core__' && partition.partitionKey === 'core') {
      Object.keys(partition.records).sort().forEach((key) => {
        if (RETIRED_SNAPSHOT_KEYS.has(key)) return;
        const entry = partition.records[key];
        result[key] = plainValue(entry && Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : entry);
      });
      return;
    }
    if (!PARTITION_COLLECTIONS.has(partition.collection)) return;
    if (!collections[partition.collection]) collections[partition.collection] = [];
    Object.keys(partition.records).sort().forEach((recordId) => {
      collections[partition.collection].push(plainValue(partition.records[recordId]));
    });
  });
  PARTITION_COLLECTIONS.forEach((collection) => {
    result[collection] = collections[collection] || [];
  });
  return result;
}

async function readPartitionState(source, familyId) {
  const manifest = await optionalDocument(source.collection('family_manifests'), familyId);
  const result = await source.collection('family_partitions').where({ familyId }).limit(1000).get();
  const partitions = result.data || [];
  const visiblePartitions = activePartitionList(partitions);
  return {
    manifest: manifest || { familyId, revision: 0, partitionRevisions: {}, legacySnapshotVersion: 0 },
    partitions,
    partitioned: Boolean(visiblePartitions.length),
  };
}

function partitionBackupDocument(familyId, state, reason, openId) {
  const details = partitionBackupDetails(state.manifest, state.partitions);
  return {
    familyId,
    version: details.payload.manifest.revision,
    format: PARTITION_BACKUP_FORMAT,
    partitioned: true,
    payload: details.payload,
    byteLength: details.byteLength,
    checksumSha256: details.checksumSha256,
    reason,
    createdAt: db.serverDate(),
    createdBy: openId,
  };
}

function partitionStateFromSnapshot(data, legacyVersion) {
  const snapshot = asPlainSnapshot(data);
  const groups = new Map(Array.from(PARTITION_COLLECTIONS).map((collection) => [
    `${collection}/undated`,
    { partitionKey: `${collection}/undated`, collection, revision: 0, records: {}, tombstones: {} },
  ]));
  const core = {};
  Object.keys(snapshot).forEach((key) => {
    if (RETIRED_SNAPSHOT_KEYS.has(key)) return;
    if (!PARTITION_COLLECTIONS.has(key)) {
      core[key] = { value: plainValue(snapshot[key]) };
      return;
    }
    (Array.isArray(snapshot[key]) ? snapshot[key] : []).forEach((record) => {
      if (!record || typeof record !== 'object' || !record.id) return;
      const partitionKey = `${key}/${recordMonth(record)}`;
      if (!groups.has(partitionKey)) {
        groups.set(partitionKey, { partitionKey, collection: key, revision: 0, records: {}, tombstones: {} });
      }
      groups.get(partitionKey).records[record.id] = plainValue(record);
    });
  });
  if (Object.keys(core).length) {
    groups.set('core', { partitionKey: 'core', collection: '__core__', revision: 0, records: core, tombstones: {} });
  }
  return {
    manifest: { revision: 0, partitionRevisions: {}, legacySnapshotVersion: Number(legacyVersion || 0) },
    partitions: [...groups.values()],
    partitioned: true,
  };
}

function validStoredPartitionBackup(candidate) {
  return candidate && candidate.partitioned === true
    && candidate.format === PARTITION_BACKUP_FORMAT
    && candidate.payload && candidate.payload.format === PARTITION_BACKUP_FORMAT
    && candidate.payload.manifest && typeof candidate.payload.manifest === 'object'
    && Array.isArray(candidate.payload.partitions);
}

async function pruneBackups(familyId) {
  try {
    const result = await db.collection('family_backups')
      .where({ familyId })
      .limit(BACKUP_QUERY_LIMIT)
      .get();
    const stale = (result.data || [])
      .slice()
      .sort((left, right) => {
        const byVersion = (Number(right.version) || 0) - (Number(left.version) || 0);
        if (byVersion) return byVersion;
        return String(right._id || '').localeCompare(String(left._id || ''));
      })
      .slice(MAX_BACKUPS);
    await Promise.all(stale.map((item) => db.collection('family_backups').doc(item._id).remove()));
  } catch (error) {
    // A cleanup failure must never turn an already committed save into a false
    // failure.  The next successful write retries the bounded cleanup.
    logger.error('family backup cleanup failed', error);
  }
}

function publicBackup(item) {
  return {
    backupId: item._id,
    version: item.version,
    byteLength: item.byteLength,
    checksumSha256: item.checksumSha256,
    reason: item.reason,
    partitioned: item.partitioned === true && item.format === PARTITION_BACKUP_FORMAT,
    format: item.format || 'legacy-snapshot-v1',
    createdAt: item.createdAt || null,
  };
}

async function findFamilyFor(openId) {
  const result = await db.collection('families')
    .where({ memberOpenIds: _.in([openId]) })
    .limit(1)
    .get();
  const family = result.data.find((item) => item.status !== 'dissolved') || null;
  return family ? ensureFamilyIdentityShape(family) : null;
}

async function getFamilyMembership(familyId, openId) {
  if (!familyId || typeof familyId !== 'string') {
    return null;
  }
  try {
    const result = await db.collection('families').doc(familyId).get();
    const family = result.data;
    return family.status !== 'dissolved'
      && Array.isArray(family.memberOpenIds) && family.memberOpenIds.includes(openId)
      ? ensureFamilyIdentityShape(family)
      : null;
  } catch (_) {
    return null;
  }
}

async function getOwnedFamily(familyId, openId) {
  const family = await getFamilyMembership(familyId, openId);
  return family && isActiveFamilyMember(family, openId) ? family : null;
}

async function ensureSnapshot(familyId, openId) {
  try {
    const result = await db.collection('family_snapshots').doc(familyId).get();
    if (result.data) return result.data;
  } catch (_) {
    // The first family load creates the empty snapshot below.
  }
  await db.collection('family_snapshots').doc(familyId).set({
    data: {
      familyId,
      data: {},
      version: 0,
      updatedAt: db.serverDate(),
      updatedBy: openId,
    },
  });
  return {
    _id: familyId,
    familyId,
    data: {},
    version: 0,
    updatedBy: openId,
  };
}

async function bootstrap(openId) {
  const family = await findFamilyFor(openId);
  return response(true, {
    openId,
    joined: Boolean(family),
    family: family ? publicFamily(family, openId) : null,
  });
}

async function createFamily(openId, event) {
  const existing = await findFamilyFor(openId);
  if (existing) {
    return response(true, {
      openId,
      created: false,
      family: publicFamily(existing, openId),
    });
  }

  // Retry a few times in the extremely unlikely event of a code collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = inviteCode();
    const collision = await db.collection('families').where({ inviteCode: code }).limit(1).get();
    if (collision.data.length) continue;

    const ownerMember = {
      openId,
      nickname: cleanMemberText(event.nickname, '家庭所有者'),
      relation: cleanMemberText(event.relation),
      role: 'owner',
      status: 'active',
    };
    const familyData = {
      ownerOpenId: openId,
      backupAdminOpenId: null,
      memberOpenIds: [openId],
      members: [ownerMember],
      inviteCode: code,
      maxMembers: MAX_MEMBERS,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    };
    const created = await db.collection('families').add({
      data: {
        ...familyData,
      },
    });
    await db.collection('family_snapshots').doc(created._id).set({
      data: {
        familyId: created._id,
        data: {},
        version: 0,
        updatedAt: db.serverDate(),
        updatedBy: openId,
      },
    });
    return response(true, {
      openId,
      created: true,
      family: publicFamily({ _id: created._id, ...familyData }, openId),
    });
  }
  return failure('INVITE_CODE_RETRY_EXHAUSTED', '邀请码生成失败，请重试。');
}

async function joinFamily(openId, event) {
  const code = normalizeInviteCode(event.inviteCode);
  if (code.length !== 6) {
    return failure('INVALID_INVITE_CODE', '请输入六位家庭邀请码。');
  }

  const current = await findFamilyFor(openId);
  if (current) {
    return failure('ALREADY_IN_FAMILY', '当前微信已加入一个家庭工作台。');
  }

  const found = await db.collection('families').where({ inviteCode: code }).limit(1).get();
  const family = found.data[0];
  if (!family) return failure('INVITE_CODE_NOT_FOUND', '邀请码无效或已失效。');

  try {
    const joined = await db.runTransaction(async (transaction) => {
      const fresh = await transaction.collection('families').doc(family._id).get();
      const members = Array.isArray(fresh.data.memberOpenIds) ? fresh.data.memberOpenIds : [];
      if (members.includes(openId)) return { status: 'already', family: fresh.data };
      if (members.length >= MAX_MEMBERS) return { status: 'full' };
      const nextMembers = [...members, openId];
      const currentMemberProfiles = familyMembers(fresh.data);
      const nextMemberProfiles = [...currentMemberProfiles, {
        openId,
        nickname: cleanMemberText(event.nickname, `家庭成员${nextMembers.length}`),
        relation: cleanMemberText(event.relation),
        role: 'member',
        status: 'active',
      }];
      await transaction.collection('families').doc(family._id).update({
        data: {
          memberOpenIds: nextMembers,
          members: nextMemberProfiles,
          maxMembers: MAX_MEMBERS,
          updatedAt: db.serverDate(),
        },
      });
      return {
        status: 'joined',
        family: { ...fresh.data, memberOpenIds: nextMembers, members: nextMemberProfiles },
      };
    });

    if (joined.status === 'full') return failure('FAMILY_FULL', '此家庭已达到 6 人上限。');
    return response(true, {
      openId,
      joined: true,
      family: publicFamily(joined.family, openId),
    });
  } catch (error) {
    console.error('joinFamily failed', error);
    return failure('JOIN_FAILED', '加入家庭失败，请稍后重试。');
  }
}

async function load(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权读取此家庭数据。');
  const snapshot = await ensureSnapshot(family._id, openId);
  const details = snapshotDetails(snapshot.data || {});
  return response(true, {
    openId,
    family: publicFamily(family, openId),
    snapshot: {
      data: details.data,
      version: Number.isInteger(snapshot.version) ? snapshot.version : 0,
      updatedAt: snapshot.updatedAt || null,
      updatedBy: snapshot.updatedBy || null,
      capacity: capacityStatus(details.byteLength),
    },
  });
}

async function save(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权保存此家庭数据。');
  if (!Number.isInteger(event.expectedVersion) || event.expectedVersion < 0) {
    return failure('INVALID_VERSION', '保存版本无效，请重新加载后再试。');
  }

  let details;
  try {
    details = snapshotDetails(event.data);
  } catch (error) {
    return error.message === 'SNAPSHOT_TOO_LARGE'
      ? failure('SNAPSHOT_TOO_LARGE', '家庭记录过大，请先删除不需要的内容或媒体。')
      : failure('INVALID_SNAPSHOT', '家庭记录格式无效。');
  }

  await ensureSnapshot(family._id, openId);
  const transactionResult = await db.runTransaction(async (transaction) => {
    const current = await transaction.collection('family_snapshots').doc(family._id).get();
    const currentVersion = Number.isInteger(current.data.version) ? current.data.version : 0;
    if (currentVersion !== event.expectedVersion) return { conflict: true, currentVersion };
    const nextVersion = currentVersion + 1;
    await transaction.collection('family_backups').doc(backupId(family._id, nextVersion)).set({
      data: backupDocument(family._id, nextVersion, details, 'save', openId),
    });
    await transaction.collection('family_snapshots').doc(family._id).update({
      data: {
        data: details.data,
        version: nextVersion,
        updatedAt: db.serverDate(),
        updatedBy: openId,
      },
    });
    return { conflict: false, version: nextVersion };
  });
  if (transactionResult.conflict) {
    return failure('VERSION_CONFLICT', '家人刚刚保存过新数据，请重新加载后再保存。');
  }
  await pruneBackups(family._id);
  return response(true, {
    saved: true,
    version: transactionResult.version,
    updatedBy: openId,
    capacity: capacityStatus(details.byteLength),
  });
}

async function listBackups(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权查看此家庭备份。');
  const requestedLimit = Number.isInteger(event.limit) ? event.limit : MAX_BACKUPS;
  const limit = Math.max(1, Math.min(requestedLimit, MAX_BACKUPS));
  const result = await db.collection('family_backups')
    .where({ familyId: family._id })
    .limit(BACKUP_QUERY_LIMIT)
    .get();
  const backups = (result.data || [])
    .filter((item) => Number.isInteger(item.version) && item.version >= 0)
    .sort((left, right) => {
      const byVersion = right.version - left.version;
      if (byVersion) return byVersion;
      return String(right._id || '').localeCompare(String(left._id || ''));
    })
    .slice(0, limit)
    .map(publicBackup);
  return response(true, { backups, retentionLimit: MAX_BACKUPS });
}

async function getProtectedMediaReferences(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权核对此家庭的媒体引用。');

  const state = await readPartitionState(db, family._id);
  const sources = [];
  if (state.partitioned) {
    sources.push(state.partitions);
  } else {
    const snapshot = await ensureSnapshot(family._id, openId);
    sources.push(snapshot.data || {});
  }

  const backupResult = await db.collection('family_backups')
    .where({ familyId: family._id })
    .limit(BACKUP_QUERY_LIMIT)
    .get();
  (backupResult.data || []).forEach((backup) => {
    if (backup && backup.payload) sources.push(backup.payload);
    if (backup && backup.data) sources.push(backup.data);
  });

  return response(true, { references: cloudMediaReferences(sources) });
}

async function createBackup(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权创建此家庭备份。');
  if (family.ownerOpenId !== openId) {
    return failure('OWNER_REQUIRED', '只有家庭所有者可以手动创建完整备份。');
  }
  const created = await db.runTransaction(async (transaction) => {
    const currentFamily = await transaction.collection('families').doc(family._id).get();
    if (!currentFamily.data || currentFamily.data.ownerOpenId !== openId) return { forbidden: true };
    const state = await readPartitionState(transaction, family._id);
    if (!state.partitioned) return { legacy: true };
    const document = partitionBackupDocument(family._id, state, 'manual', openId);
    const finalId = backupId(family._id, document.version, `manual_${uniqueId()}`);
    await transaction.collection('family_backups').doc(finalId).set({ data: document });
    return { backup: { _id: finalId, ...document } };
  });
  if (created.forbidden) return failure('OWNER_REQUIRED', '家庭权限已变化，请刷新后再试。');
  if (created.legacy) {
    const snapshot = await ensureSnapshot(family._id, openId);
    const details = snapshotDetails(snapshot.data || {});
    const version = Number.isInteger(snapshot.version) ? snapshot.version : 0;
    const legacyId = backupId(family._id, version, `manual_${uniqueId()}`);
    const document = backupDocument(family._id, version, details, 'manual', openId);
    await db.collection('family_backups').doc(legacyId).set({ data: document });
    await pruneBackups(family._id);
    return response(true, { backup: publicBackup({ _id: legacyId, ...document }) });
  }
  await pruneBackups(family._id);
  return response(true, { backup: publicBackup(created.backup) });
}

async function exportFamily(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权导出此家庭数据。');
  const partitionState = await db.runTransaction((transaction) => readPartitionState(transaction, family._id));
  if (partitionState.partitioned) {
    const partitionDetails = partitionBackupDetails(partitionState.manifest, partitionState.partitions);
    const assembled = assembledPartitionData(partitionState.partitions);
    const snapshot = snapshotDetails(assembled);
    return response(true, {
      export: {
        format: EXPORT_FORMAT,
        exportedAt: now(),
        family: {
          familyId: family._id,
          memberCount: Array.isArray(family.memberOpenIds) ? family.memberOpenIds.length : 0,
          maxMembers: MAX_MEMBERS,
        },
        snapshot: {
          data: snapshot.data,
          version: partitionDetails.payload.manifest.revision,
          updatedAt: partitionState.manifest.updatedAt || null,
          checksumSha256: snapshot.checksumSha256,
          byteLength: snapshot.byteLength,
        },
        partitionBackup: {
          format: PARTITION_BACKUP_FORMAT,
          payload: partitionDetails.payload,
          checksumSha256: partitionDetails.checksumSha256,
          byteLength: partitionDetails.byteLength,
        },
      },
      capacity: capacityStatus(partitionDetails.byteLength),
    });
  }
  const snapshot = await ensureSnapshot(family._id, openId);
  const details = snapshotDetails(snapshot.data || {});
  const version = Number.isInteger(snapshot.version) ? snapshot.version : 0;
  return response(true, {
    export: {
      format: EXPORT_FORMAT,
      exportedAt: now(),
      family: {
        familyId: family._id,
        memberCount: Array.isArray(family.memberOpenIds) ? family.memberOpenIds.length : 0,
        maxMembers: MAX_MEMBERS,
      },
      snapshot: {
        data: details.data,
        version,
        updatedAt: snapshot.updatedAt || null,
        checksumSha256: details.checksumSha256,
        byteLength: details.byteLength,
      },
    },
    capacity: capacityStatus(details.byteLength),
  });
}

async function setBackupAdmin(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权管理此家庭。');
  if (family.ownerOpenId !== openId) {
    return failure('OWNER_REQUIRED', '只有家庭所有者可以指定备用管理员。');
  }
  const revoking = event.memberId === null;
  if (!revoking && (!event.memberId || typeof event.memberId !== 'string' || event.memberId === openId)) {
    return failure('INVALID_MEMBER', '请选择一位其他有效家庭成员。');
  }

  const transactionResult = await db.runTransaction(async (transaction) => {
    const current = await transaction.collection('families').doc(family._id).get();
    if (!current.data || current.data.ownerOpenId !== openId) return { forbidden: true };
    const members = familyMembers(current.data);
    const target = revoking ? null : members.find((item) => item.openId === event.memberId);
    if (!revoking && (!target || target.status !== 'active')) return { invalidMember: true };
    const nextFamily = { ...current.data, backupAdminOpenId: revoking ? null : event.memberId };
    const nextMembers = familyMembers(nextFamily);
    await transaction.collection('families').doc(family._id).update({
      data: {
        backupAdminOpenId: revoking ? null : event.memberId,
        members: nextMembers,
        updatedAt: db.serverDate(),
      },
    });
    return { family: { ...nextFamily, _id: family._id, members: nextMembers } };
  });
  if (transactionResult.forbidden) {
    return failure('OWNER_REQUIRED', '家庭权限已变化，只有当前所有者可执行此操作。');
  }
  if (transactionResult.invalidMember) {
    return failure('INVALID_MEMBER', '该成员不存在或当前不可管理。');
  }
  return response(true, {
    updated: true,
    family: publicFamily(transactionResult.family, openId),
  });
}

async function updateMember(openId, event) {
  const family = await getFamilyMembership(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权管理此家庭成员。');
  if (!event.memberId || typeof event.memberId !== 'string') {
    return failure('INVALID_MEMBER', '请选择有效家庭成员。');
  }
  const hasNickname = Object.prototype.hasOwnProperty.call(event, 'nickname');
  const hasRelation = Object.prototype.hasOwnProperty.call(event, 'relation');
  const hasStatus = Object.prototype.hasOwnProperty.call(event, 'status');
  const nickname = hasNickname ? cleanMemberText(event.nickname) : null;
  const relation = hasRelation ? cleanMemberText(event.relation) : null;
  if (hasNickname && !nickname) return failure('INVALID_NICKNAME', '成员昵称不能为空。');
  if (hasRelation && relation && !FAMILY_RELATIONS.has(relation)) {
    return failure('INVALID_RELATION', '请选择父亲、母亲、外公、外婆、爷爷或奶奶。');
  }
  if (hasStatus && event.status !== 'active' && event.status !== 'inactive') {
    return failure('INVALID_STATUS', '成员状态无效。');
  }

  const transactionResult = await db.runTransaction(async (transaction) => {
    const current = await transaction.collection('families').doc(family._id).get();
    if (!current.data || !Array.isArray(current.data.memberOpenIds)
      || !current.data.memberOpenIds.includes(openId)) return { forbidden: true };
    const members = familyMembers(current.data);
    const actor = members.find((item) => item.openId === openId);
    const targetIndex = members.findIndex((item) => item.openId === event.memberId);
    if (!actor || actor.status !== 'active') return { managerRequired: true };
    if (targetIndex < 0) return { invalidMember: true };
    const selfEdit = event.memberId === openId && !hasStatus;
    const manager = actor.role === 'owner' || actor.role === 'backup-admin';
    if (!selfEdit && !manager) return { managerRequired: true };
    if (hasStatus && actor.role !== 'owner') return { statusOwnerRequired: true };
    if (members[targetIndex].role === 'owner' && openId !== current.data.ownerOpenId) {
      return { ownerProtected: true };
    }
    if (members[targetIndex].role === 'owner' && hasStatus && event.status !== 'active') {
      return { ownerProtected: true };
    }
    const nextMembers = members.map((member, index) => index === targetIndex ? {
      ...member,
      nickname: hasNickname ? nickname : member.nickname,
      relation: hasRelation ? relation : member.relation,
      status: hasStatus ? event.status : member.status,
    } : member);
    await transaction.collection('families').doc(family._id).update({
      data: { members: nextMembers, updatedAt: db.serverDate() },
    });
    return { family: { ...current.data, _id: family._id, members: nextMembers } };
  });
  if (transactionResult.forbidden) return failure('FORBIDDEN', '当前身份已不在此家庭。');
  if (transactionResult.managerRequired) {
    return failure('MANAGER_REQUIRED', '只有家庭所有者或备用管理员可以修改其他成员。');
  }
  if (transactionResult.statusOwnerRequired) {
    return failure('OWNER_REQUIRED', '只有家庭所有者可以停用或重新启用成员。');
  }
  if (transactionResult.invalidMember) return failure('INVALID_MEMBER', '该家庭成员不存在。');
  if (transactionResult.ownerProtected) return failure('OWNER_PROTECTED', '备用管理员不能修改家庭所有者状态。');
  return response(true, {
    updated: true,
    family: publicFamily(transactionResult.family, openId),
  });
}

async function transferOwnership(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权管理此家庭。');
  if (family.ownerOpenId !== openId) {
    return failure('OWNER_REQUIRED', '只有当前家庭所有者可以转移所有权。');
  }
  if (!event.memberId || typeof event.memberId !== 'string' || event.memberId === openId) {
    return failure('INVALID_MEMBER', '请选择一位其他有效家庭成员。');
  }
  const transactionResult = await db.runTransaction(async (transaction) => {
    const current = await transaction.collection('families').doc(family._id).get();
    if (!current.data || current.data.status === 'dissolved' || current.data.ownerOpenId !== openId) {
      return { forbidden: true };
    }
    const members = familyMembers(current.data);
    const target = members.find((item) => item.openId === event.memberId);
    if (!target || target.status !== 'active') return { invalidMember: true };
    const nextFamily = {
      ...current.data,
      ownerOpenId: event.memberId,
      backupAdminOpenId: openId,
    };
    const nextMembers = familyMembers(nextFamily);
    await transaction.collection('families').doc(family._id).update({
      data: {
        ownerOpenId: event.memberId,
        backupAdminOpenId: openId,
        members: nextMembers,
        updatedAt: db.serverDate(),
      },
    });
    return { family: { ...nextFamily, _id: family._id, members: nextMembers } };
  });
  if (transactionResult.forbidden) {
    return failure('OWNER_REQUIRED', '家庭所有权已变化，请刷新后再试。');
  }
  if (transactionResult.invalidMember) return failure('INVALID_MEMBER', '目标成员不存在或未启用。');
  return response(true, {
    transferred: true,
    family: publicFamily(transactionResult.family, openId),
  });
}

async function dissolveFamily(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权管理此家庭。');
  if (family.ownerOpenId !== openId) {
    return failure('OWNER_REQUIRED', '只有当前家庭所有者可以解散家庭。');
  }
  const transactionResult = await db.runTransaction(async (transaction) => {
    const current = await transaction.collection('families').doc(family._id).get();
    if (!current.data || current.data.status === 'dissolved' || current.data.ownerOpenId !== openId) {
      return { forbidden: true };
    }
    await transaction.collection('families').doc(family._id).update({
      data: {
        status: 'dissolved',
        dissolvedAt: db.serverDate(),
        dissolvedBy: openId,
        updatedAt: db.serverDate(),
      },
    });
    return { dissolved: true };
  });
  if (transactionResult.forbidden) {
    return failure('OWNER_REQUIRED', '家庭所有权已变化，解散操作未执行。');
  }
  return response(true, { dissolved: true, familyId: family._id });
}

async function restorePartitionedBackup(family, openId, event) {
  const preRestoreId = backupId(family._id, event.expectedVersion, `pre_restore_${uniqueId()}`);
  const transactionResult = await db.runTransaction(async (transaction) => {
    const currentFamily = await transaction.collection('families').doc(family._id).get();
    if (!currentFamily.data || !canManageFamily(currentFamily.data, openId)) return { forbidden: true };
    const currentState = await readPartitionState(transaction, family._id);
    const currentVersion = Number.isInteger(currentState.manifest.revision) ? currentState.manifest.revision : 0;
    if (currentVersion !== event.expectedVersion) return { conflict: true, currentVersion };

    const candidate = await optionalDocument(transaction.collection('family_backups'), event.backupId);
    if (!candidate || candidate.familyId !== family._id) return { missing: true };

    let targetState;
    let restoredFromVersion;
    if (validStoredPartitionBackup(candidate)) {
      let verified;
      try { verified = snapshotDetails(candidate.payload); } catch (error) {
        return error.message === 'SNAPSHOT_TOO_LARGE' ? { tooLarge: true } : { invalid: true };
      }
      if (candidate.byteLength !== verified.byteLength || candidate.checksumSha256 !== verified.checksumSha256) {
        return { integrityFailure: true };
      }
      targetState = {
        manifest: plainValue(candidate.payload.manifest),
        partitions: plainValue(candidate.payload.partitions),
        partitioned: true,
      };
      restoredFromVersion = Number(candidate.payload.manifest.revision || candidate.version || 0);
    } else {
      let verified;
      try { verified = snapshotDetails(candidate.data); } catch (error) {
        return error.message === 'SNAPSHOT_TOO_LARGE' ? { tooLarge: true } : { invalid: true };
      }
      if (candidate.byteLength !== verified.byteLength || candidate.checksumSha256 !== verified.checksumSha256) {
        return { integrityFailure: true };
      }
      try {
        targetState = partitionStateFromSnapshot(verified.data, candidate.version);
      } catch (_) {
        return { invalid: true };
      }
      restoredFromVersion = Number(candidate.version || 0);
    }

    targetState = {
      ...targetState,
      manifest: {
        ...plainValue(targetState.manifest || {}),
        partitionRevisions: activePartitionRevisions(targetState.manifest && targetState.manifest.partitionRevisions),
      },
      partitions: activePartitionList(targetState.partitions),
    };
    if (!targetState.partitions.every((partition) => partition && typeof partition.partitionKey === 'string'
      && typeof partition.collection === 'string'
      && (partition.collection === '__core__' || PARTITION_COLLECTIONS.has(partition.collection)))) {
      return { invalid: true };
    }

    let targetBackupDetails;
    try {
      targetBackupDetails = partitionBackupDetails(targetState.manifest, targetState.partitions);
    } catch (error) {
      return error.message === 'SNAPSHOT_TOO_LARGE' ? { tooLarge: true } : { invalid: true };
    }

    const currentProtection = partitionBackupDocument(family._id, currentState, 'pre_restore', openId);
    await transaction.collection('family_backups').doc(preRestoreId).set({ data: currentProtection });

    const currentByKey = new Map(currentState.partitions.map((partition) => [partition.partitionKey, partition]));
    for (const partition of currentState.partitions) {
      if (isRetiredPartition(partition)) continue;
      await transaction.collection('family_partitions')
        .doc(safeDocumentId('partition', `${family._id}:${partition.partitionKey}`))
        .remove();
    }
    const writablePartitions = partitionsWithPreservedRetiredCore(
      targetState.partitions,
      currentState.partitions,
    );
    const nextPartitionRevisions = {};
    for (const rawPartition of writablePartitions) {
      const partition = normalizedPartition(rawPartition);
      const previous = currentByKey.get(partition.partitionKey);
      const nextRevision = Math.max(
        Number(previous && previous.revision || 0),
        Number(partition.revision || 0),
      ) + 1;
      nextPartitionRevisions[partition.partitionKey] = nextRevision;
      await transaction.collection('family_partitions')
        .doc(safeDocumentId('partition', `${family._id}:${partition.partitionKey}`))
        .set({
          data: {
            familyId: family._id,
            ...partition,
            revision: nextRevision,
            updatedAt: db.serverDate(),
            updatedBy: openId,
          },
        });
    }
    const nextVersion = currentVersion + 1;
    await transaction.collection('family_manifests').doc(family._id).set({
      data: {
        familyId: family._id,
        revision: nextVersion,
        partitionRevisions: nextPartitionRevisions,
        legacySnapshotVersion: Number(targetState.manifest.legacySnapshotVersion || 0),
        partitionedAt: db.serverDate(),
        updatedAt: db.serverDate(),
        updatedBy: openId,
      },
    });
    return {
      version: nextVersion,
      restoredFromVersion,
      byteLength: targetBackupDetails.byteLength,
    };
  });

  if (transactionResult.conflict) return failure('VERSION_CONFLICT', '家人刚刚保存过新数据，请重新加载后再恢复。');
  if (transactionResult.forbidden) return failure('OWNER_REQUIRED', '家庭权限已变化，请刷新后再试。');
  if (transactionResult.missing) return failure('BACKUP_NOT_FOUND', '备份不存在或已超过保留期。');
  if (transactionResult.tooLarge) return failure('BACKUP_TOO_LARGE', '备份超过当前版本可恢复的容量上限。');
  if (transactionResult.integrityFailure) return failure('BACKUP_INTEGRITY_FAILED', '备份校验失败，未更改当前数据。');
  if (transactionResult.invalid) return failure('INVALID_BACKUP', '备份格式或版本无效。');

  await pruneBackups(family._id);
  return response(true, {
    restored: true,
    partitioned: true,
    version: transactionResult.version,
    restoredFromVersion: transactionResult.restoredFromVersion,
    capacity: capacityStatus(transactionResult.byteLength),
  });
}

async function restoreBackup(openId, event) {
  const family = await getOwnedFamily(event.familyId, openId);
  if (!family) return failure('FORBIDDEN', '无权恢复此家庭备份。');
  if (!canManageFamily(family, openId)) {
    return failure('OWNER_REQUIRED', '只有家庭所有者或备用管理员可以恢复备份。');
  }
  if (!Number.isInteger(event.expectedVersion) || event.expectedVersion < 0) {
    return failure('INVALID_VERSION', '恢复版本无效，请重新加载后再试。');
  }
  if (!event.backupId || typeof event.backupId !== 'string') {
    return failure('INVALID_BACKUP', '请选择有效的家庭备份。');
  }

  const currentPartitionState = await readPartitionState(db, family._id);
  const selectedBackup = await optionalDocument(db.collection('family_backups'), event.backupId);
  if (currentPartitionState.partitioned || validStoredPartitionBackup(selectedBackup)) {
    return restorePartitionedBackup(family, openId, event);
  }

  await ensureSnapshot(family._id, openId);
  const preRestoreId = backupId(
    family._id,
    event.expectedVersion,
    `pre_restore_${uniqueId()}`,
  );
  const transactionResult = await db.runTransaction(async (transaction) => {
    const currentFamily = await transaction.collection('families').doc(family._id).get();
    if (!currentFamily.data || !canManageFamily(currentFamily.data, openId)) {
      return { forbidden: true };
    }
    const current = await transaction.collection('family_snapshots').doc(family._id).get();
    const currentVersion = Number.isInteger(current.data.version) ? current.data.version : -1;
    if (currentVersion !== event.expectedVersion) return { conflict: true, currentVersion };

    let storedBackup;
    try {
      storedBackup = await transaction.collection('family_backups').doc(event.backupId).get();
    } catch (_) {
      return { missing: true };
    }
    const candidate = storedBackup.data;
    if (!candidate || candidate.familyId !== family._id
      || !Number.isInteger(candidate.version) || candidate.version < 0) {
      return { invalid: true };
    }

    let targetDetails;
    let currentDetails;
    try {
      targetDetails = snapshotDetails(candidate.data);
      currentDetails = snapshotDetails(current.data.data || {});
    } catch (error) {
      if (error.message === 'SNAPSHOT_TOO_LARGE') return { tooLarge: true };
      return { invalid: true };
    }
    if (candidate.byteLength !== targetDetails.byteLength
      || candidate.checksumSha256 !== targetDetails.checksumSha256) {
      return { integrityFailure: true };
    }

    const nextVersion = currentVersion + 1;
    await transaction.collection('family_backups').doc(preRestoreId).set({
      data: backupDocument(family._id, currentVersion, currentDetails, 'pre_restore', openId),
    });
    await transaction.collection('family_backups').doc(backupId(family._id, nextVersion)).set({
      data: backupDocument(family._id, nextVersion, targetDetails, 'restore', openId),
    });
    await transaction.collection('family_snapshots').doc(family._id).update({
      data: {
        data: targetDetails.data,
        version: nextVersion,
        updatedAt: db.serverDate(),
        updatedBy: openId,
      },
    });
    return {
      conflict: false,
      version: nextVersion,
      restoredFromVersion: candidate.version,
      byteLength: targetDetails.byteLength,
    };
  });

  if (transactionResult.conflict) {
    return failure('VERSION_CONFLICT', '家人刚刚保存过新数据，请重新加载后再恢复。');
  }
  if (transactionResult.forbidden) {
    return failure('OWNER_REQUIRED', '家庭权限已变化，请刷新后再试。');
  }
  if (transactionResult.missing) return failure('BACKUP_NOT_FOUND', '备份不存在或已超过保留期。');
  if (transactionResult.tooLarge) return failure('BACKUP_TOO_LARGE', '备份超过当前版本可恢复的容量上限。');
  if (transactionResult.integrityFailure) return failure('BACKUP_INTEGRITY_FAILED', '备份校验失败，未更改当前数据。');
  if (transactionResult.invalid) return failure('INVALID_BACKUP', '备份格式或版本无效。');

  await pruneBackups(family._id);
  return response(true, {
    restored: true,
    version: transactionResult.version,
    restoredFromVersion: transactionResult.restoredFromVersion,
    capacity: capacityStatus(transactionResult.byteLength),
  });
}

async function getStatus(openId, event) {
  const family = event.familyId
    ? await getFamilyMembership(event.familyId, openId)
    : await findFamilyFor(openId);
  if (!family) return response(true, { openId, joined: false, family: null });
  return response(true, {
    openId,
    joined: true,
    family: publicFamily(family, openId),
  });
}

async function main(event = {}) {
  const { OPENID } = getWXContext();
  if (!OPENID) return failure('UNAUTHENTICATED', '未获取到微信用户身份，请重新进入小程序。');

  try {
    switch (event.action) {
      case 'bootstrap': return await bootstrap(OPENID);
      case 'createFamily': return await createFamily(OPENID, event);
      case 'join': return await joinFamily(OPENID, event);
      case 'load': return await load(OPENID, event);
      case 'save': return await save(OPENID, event);
      case 'loadPartitions': return await loadPartitions(OPENID, event);
      case 'syncPartitions': return await syncPartitions(OPENID, event);
      case 'migrateLegacySnapshot': return await migrateLegacySnapshot(OPENID, event);
      case 'getStatus': return await getStatus(OPENID, event);
      case 'createBackup': return await createBackup(OPENID, event);
      case 'listBackups': return await listBackups(OPENID, event);
      case 'getProtectedMediaReferences': return await getProtectedMediaReferences(OPENID, event);
      case 'exportFamily': return await exportFamily(OPENID, event);
      case 'setBackupAdmin': return await setBackupAdmin(OPENID, event);
      case 'updateMember': return await updateMember(OPENID, event);
      case 'transferOwnership': return await transferOwnership(OPENID, event);
      case 'dissolveFamily': return await dissolveFamily(OPENID, event);
      case 'restoreBackup': return await restoreBackup(OPENID, event);
      default: return failure('UNKNOWN_ACTION', '不支持的家庭数据操作。');
    }
  } catch (error) {
    logger.error('familyApi failed', error);
    return failure('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。');
  }
}

  return main;
}

exports.createFamilyApi = createFamilyApi;
exports.main = createFamilyApi({
  database: cloud.database(),
  getWXContext: () => cloud.getWXContext(),
  logger: console,
});
