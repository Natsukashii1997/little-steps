import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { stripTypeScriptTypes } from 'node:module';

// 执行真实生产函数，仅替换浏览器存储、React 状态出口和提示这些系统边界。
const source = readFileSync('src/Prototype.tsx', 'utf8');
function section(from, to) { return source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from))); }
function fixture() {
  return {
    baby: {}, demoRecordIds: [], memories: [{ id: 'photo', assetId: 'blob' }],
    feedings: [], sleeps: [], diapers: [], supplements: [], todos: [], growthRecords: [],
    vaccines: [], abilities: [], checkups: [], musicTracks: [], stories: [], learningItems: [],
  };
}
function storage(initial) {
  const values = new Map([['app', JSON.stringify(initial)]]);
  const blobs = new Set(['blob']);
  let failDelete = false;
  let tail = Promise.resolve();
  const db = {
    transaction() {
      const previous = tail;
      let release;
      tail = new Promise(resolve => { release = resolve; });
      return {
        store: { get: () => previous, delete: async (id) => { if (failDelete) throw Error("synthetic-idb-delete-failure"); blobs.delete(id); } },
        get done() { release(); return Promise.resolve(); },
        abort() { release(); },
      };
    },
  };
  return {
    fail: false, blobs, db,
    set failDelete(value) { failDelete = value; },
    get length() { return values.size; },
    key(i) { return [...values.keys()][i] ?? null; },
    getItem(k) { return values.get(k) ?? null; },
    setItem(k, v) { if (this.fail && k === 'app') throw Error('synthetic-quota'); values.set(k, String(v)); },
    removeItem(k) { values.delete(k); },
  };
}
function client(localStorage, options = {}) {
  const context = {
    localStorage, APP_STORAGE_KEY: 'app', ASSET_STORE: 'uploads',
    data: JSON.parse(localStorage.getItem('app')), snapshot: localStorage.getItem('app'),
    blobs: localStorage.blobs, notices: [], assetDb: Promise.resolve(localStorage.db),
    setStoredState(next) { context.data = next.data; context.snapshot = next.snapshot; },
    setData(next) { context.data = typeof next === 'function' ? next(context.data) : next; },
    notify(message) { context.notices.push(message); },
    deleteAsset: async (id) => { context.blobs.delete(id); },
    recordAssetId: (kind, id) => context.data.memories.find(x => x.id === id)?.assetId,
    ...options,
  };
  const helpers = source.includes('async function withStorageLock')
    ? section('async function withStorageLock', 'function useAssetUrls(') : section('function assetReferenceCount(', 'function useAssetUrls(');
  const code = `${helpers}\n${section('  const persistEditorData =', '  const saveEditor =')}\n${section('  const performRemoveItem =', '  const toggleTodo =')}\nglobalThis.api = { persistEditorData, performRemoveItem, flushAssetCleanup };`;
  vm.createContext(context);
  vm.runInContext(stripTypeScriptTypes(code), context);
  return context;
}

test('metadata failure leaves the photo and record recoverable and reports no delete success', async () => {
  const disk = storage(fixture());
  const app = client(disk);
  disk.fail = true;
  assert.equal(await app.api.performRemoveItem('memory', 'photo'), false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.blobs.has('blob'), true, 'Blob must remain after metadata failure');
  assert.equal(app.data.memories.length, 1, 'visible record must remain');
  assert.equal(JSON.parse(disk.getItem('app')).memories.length, 1);
  assert.equal(app.notices.some(x => x.includes('记录已删除')), false);
  assert.ok(app.notices.includes('记录未能删除，请检查浏览器存储空间后重试'));
});

test('a stale second tab cannot erase the first tab saved memory', async () => {
  const disk = storage(fixture());
  const a = client(disk);
  const b = client(disk);
  await a.api.persistEditorData(current => ({ ...current, memories: [...current.memories, { id: 'memory-A' }] }));
  await assert.rejects(async () => b.api.persistEditorData(current => ({ ...current, todos: [{ id: 'todo-B' }] })), /其他窗口|更新|过期/);
  assert.deepEqual(JSON.parse(disk.getItem('app')).memories.map(x => x.id), ['photo', 'memory-A']);
  assert.deepEqual(JSON.parse(disk.getItem('app')).todos, []);
});

test('simultaneous tabs serialize the compare-and-write and exactly one stale save is refused', async () => {
  const disk = storage(fixture());
  const a = client(disk);
  const b = client(disk);
  const results = await Promise.allSettled([
    a.api.persistEditorData(current => ({ ...current, todos: [{ id: 'A' }] })),
    b.api.persistEditorData(current => ({ ...current, todos: [{ id: 'B' }] })),
  ]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.filter(x => x.status === 'rejected').length, 1);
  assert.equal(JSON.parse(disk.getItem('app')).todos[0].id, 'A');
});

test('successful delete removes metadata before Blob cleanup and retries failed cleanup after reopening', async () => {
  const disk = storage(fixture());
  disk.failDelete = true;
  const app = client(disk);
  assert.equal(await app.api.performRemoveItem('memory', 'photo'), true);
  await assert.rejects(app.api.flushAssetCleanup(), /synthetic-idb-delete-failure/);
  assert.equal(JSON.parse(disk.getItem('app')).memories.length, 0);
  assert.equal(disk.blobs.has('blob'), true);
  assert.equal(disk.getItem('app-cleanup:blob'), 'blob');
  disk.failDelete = false;
  const reopened = client(disk);
  await reopened.api.flushAssetCleanup();
  assert.equal(disk.blobs.has('blob'), false);
  assert.equal(disk.getItem('app-cleanup:blob'), null);
});

test('a shared photo remains available to the surviving record', async () => {
  const data = fixture();
  data.abilities = [{ id: 'ability', imageId: 'blob' }];
  const disk = storage(data);
  const app = client(disk);
  assert.equal(await app.api.performRemoveItem('memory', 'photo'), true);
  await app.api.flushAssetCleanup();
  assert.equal(disk.blobs.has('blob'), true);
  assert.equal(JSON.parse(disk.getItem('app')).abilities[0].imageId, 'blob');
});

test('a failed metadata readback never triggers physical deletion', async () => {
  const disk = storage(fixture());
  const write = disk.setItem;
  disk.setItem = function (key, value) {
    if (key !== 'app') write.call(this, key, value); // 模拟静默未落盘
  };
  const app = client(disk);
  assert.equal(await app.api.performRemoveItem('memory', 'photo'), false);
  await app.api.flushAssetCleanup();
  assert.equal(disk.blobs.has('blob'), true);
  assert.equal(app.data.memories[0].id, 'photo');
});
