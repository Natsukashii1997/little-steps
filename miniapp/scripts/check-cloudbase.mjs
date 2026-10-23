#!/usr/bin/env node

// Offline structural check.  It deliberately does not contact WeChat CloudBase
// because an AppID and cloud environment are created by the account owner.
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const required = [
  'cloudfunctions/familyApi/index.js',
  'cloudfunctions/familyApi/package.json',
  'cloudfunctions/familyApi/package-lock.json',
  'cloudbase/database.rules.json',
  'cloudbase/storage.rules.json',
  'cloudbase/README.md',
  'tests/family-api.test.js',
];

for (const relativePath of required) {
  await access(resolve(root, relativePath));
}

const databaseRules = JSON.parse(await readFile(resolve(root, 'cloudbase/database.rules.json'), 'utf8'));
if (databaseRules.read !== false || databaseRules.write !== false) {
  throw new Error('database rules must reject direct client read/write access');
}

const storageRules = JSON.parse(await readFile(resolve(root, 'cloudbase/storage.rules.json'), 'utf8'));
for (const key of ['read', 'write']) {
  if (typeof storageRules[key] !== 'string') throw new Error(`storage rule ${key} must be an expression string`);
  if (!storageRules[key].includes('auth != null')) throw new Error(`storage rule ${key} must require WeChat login`);
  if (!storageRules[key].includes('/^family-media\\//.test(resource.path) == true')) {
    throw new Error(`storage rule ${key} must be limited to family-media/`);
  }
  if (storageRules[key].includes('auth.uid')) throw new Error(`storage rule ${key} must use auth.openid for WeChat`);
}
for (const key of ['read', 'write']) {
  if (!storageRules[key].includes('resource.openid == auth.openid')) {
    throw new Error(`storage ${key} must be limited to the file owner`);
  }
}

const source = await readFile(resolve(root, 'cloudfunctions/familyApi/index.js'), 'utf8');
for (const action of [
  'bootstrap', 'createFamily', 'join', 'load', 'save', 'getStatus',
  'createBackup', 'listBackups', 'restoreBackup', 'exportFamily',
  'getProtectedMediaReferences',
]) {
  if (!source.includes(`case '${action}'`)) throw new Error(`familyApi is missing ${action}`);
}
for (const collection of [
  'families', 'family_snapshots', 'family_backups', 'family_manifests',
  'family_partitions', 'family_operations', 'family_conflicts',
]) {
  if (!source.includes(`collection('${collection}')`)) {
    throw new Error(`familyApi is missing collection ${collection}`);
  }
}
if (!source.includes('MAX_MEMBERS = 6')) throw new Error('family member limit must remain 6');
if (!source.includes('MAX_BACKUPS = 30')) throw new Error('family backup retention must remain explicit');
if (!source.includes("collection('family_backups')")) throw new Error('familyApi must persist recoverable backups');

const packageJson = JSON.parse(await readFile(resolve(root, 'cloudfunctions/familyApi/package.json'), 'utf8'));
if (packageJson.dependencies?.['wx-server-sdk'] !== '4.0.2') {
  throw new Error('wx-server-sdk must remain exactly pinned to the audited version');
}
if (packageJson.overrides?.axios !== '1.19.0'
  || packageJson.overrides?.['@cloudbase/database'] !== '1.5.0') {
  throw new Error('audited CloudBase transitive dependency overrides are missing');
}

const packageLock = JSON.parse(await readFile(resolve(root, 'cloudfunctions/familyApi/package-lock.json'), 'utf8'));
const locked = packageLock.packages || {};
if (locked['node_modules/wx-server-sdk']?.version !== '4.0.2'
  || locked['node_modules/axios']?.version !== '1.19.0'
  || locked['node_modules/@cloudbase/database']?.version !== '1.5.0') {
  throw new Error('familyApi package lock does not match the audited dependency set');
}

const readme = await readFile(resolve(root, 'cloudbase/README.md'), 'utf8');
for (const requiredText of [
  'family_backups', 'family_manifests', 'family_partitions', 'family_operations',
  'family_conflicts', 'createBackup', 'restoreBackup', 'exportFamily',
]) {
  if (!readme.includes(requiredText)) throw new Error(`CloudBase README is missing ${requiredText}`);
}

const familyGuide = await readFile(resolve(root, '微信体验版使用说明.md'), 'utf8');
for (const collection of [
  'families', 'family_snapshots', 'family_backups', 'family_manifests',
  'family_partitions', 'family_operations', 'family_conflicts',
]) {
  if (!familyGuide.includes(`\`${collection}\``)) {
    throw new Error(`family guide is missing collection ${collection}`);
  }
}

console.log('CloudBase family backend structure: OK');
