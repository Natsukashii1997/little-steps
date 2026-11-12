import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { stripTypeScriptTypes } from 'node:module';

// 执行真实生产函数，仅替换浏览器存储、React 状态出口和提示这些系统边界。
const source = readFileSync(process.env.WEB_STORAGE_TEST_SOURCE || 'src/Prototype.tsx', 'utf8');
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
    async delete(_store, id) { if (failDelete) throw Error("synthetic-idb-delete-failure"); blobs.delete(id); },
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

test('same-thread overlapping saves refuse one stale snapshot (does not prove cross-context locking)', async () => {
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

// 使用生产规范化、迁移和 React 初始化/刷新入口；不以测试副本重写读取协议。
function reader(localStorage) {
  const context = { localStorage, crypto: { randomUUID }, APP_STORAGE_KEY: 'app' };
  vm.createContext(context);
  const code = section('type JsonRecord', 'const APP_STORAGE_KEY')
    + section('const DAY =', 'const assetDb =')
    + section('const uid =', 'async function saveAsset');
  vm.runInContext(stripTypeScriptTypes(code), context);
  return context;
}

for (const entry of ['startup', 'refresh']) {
  test(`${entry} derives data and its snapshot from the same storage read`, async () => {
    const original = fixture();
    original.memories = [{ id: 'photo', type: 'note', title: '原记录', date: '2026-11-01' }];
    const concurrent = structuredClone(original);
    concurrent.memories.push({ id: 'saved-by-A', type: 'note', title: '窗口A保存', date: '2026-11-02' });
    let raw = JSON.stringify(original);
    let reads = 0;
    const disk = {
      getItem() {
        reads++;
        const captured = raw;
        raw = JSON.stringify(concurrent); // A 在 B 第一次读取之后保存。
        return captured;
      },
    };
    const context = reader(disk);
    if (entry === 'startup') {
      context.useState = init => [init(), () => {}];
      vm.runInContext(stripTypeScriptTypes(section('  const [{ data, snapshot }', '  const [overlay')
        + '\nglobalThis.loaded = { data, snapshot };'), context);
    } else {
      Object.assign(context, { editor: null, pendingDelete: null, savingEditor: false, snapshot: 'older',
        setStoredState(next) { context.loaded = next; }, notify() {} });
      vm.runInContext(stripTypeScriptTypes(section('    const refresh = () =>', '    const onStorage =') + '\nrefresh();'), context);
    }
    assert.deepEqual(Array.from(context.loaded.data.memories, x => x.id), ['photo']);
    assert.equal(context.loaded.snapshot, JSON.stringify(original), 'snapshot must describe the data actually loaded');
    assert.equal(reads, 1, 'one raw read per load prevents a mismatched data/snapshot pair');
    const committed = storage(concurrent);
    const stale = client(committed, context.loaded);
    await assert.rejects(stale.api.persistEditorData(context.loaded.data), /其他窗口/);
    assert.deepEqual(JSON.parse(committed.getItem('app')).memories.map(x => x.id), ['photo', 'saved-by-A']);
  });
}

function webLocks() {
  let tail = Promise.resolve();
  return {
    request(_name, action) {
      const result = tail.then(() => action({}));
      tail = result.catch(() => {});
      return result;
    },
  };
}

for (const failure of ['rejected', 'blocked']) {
  test(`text metadata saves when the media database is ${failure} without losing cross-tab protection`, async () => {
    const disk = storage(fixture());
    disk.setItem('app-cleanup:blob', 'blob'); // 未完成清理也不能让数据库阻塞元数据锁。
    const assetDb = failure === 'rejected' ? Promise.reject(Error('synthetic-media-open-failure')) : new Promise(() => {});
    void assetDb.catch(() => {});
    const navigator = { locks: webLocks() };
    const a = client(disk, { assetDb, navigator });
    const b = client(disk, { assetDb, navigator });
    let timeout;
    try {
      await Promise.race([
        a.api.persistEditorData(current => ({ ...current, todos: [{ id: 'A' }] })),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('metadata waited for media database')), 200); }),
      ]);
      await assert.rejects(b.api.persistEditorData(current => ({ ...current, todos: [{ id: 'B' }] })), /其他窗口/);
      assert.deepEqual(JSON.parse(disk.getItem('app')).todos, [{ id: 'A' }]);
      await a.api.persistEditorData(current => ({ ...current, todos: [...current.todos, { id: 'A2' }] }));
      assert.deepEqual(JSON.parse(disk.getItem('app')).todos.map(x => x.id), ['A', 'A2']);
      assert.equal(disk.blobs.has('blob'), true);
    } finally { clearTimeout(timeout); }
  });
}


for (const lockKind of ['web', 'idb']) {
  test(`independent contexts with ${lockKind} lock cannot both compare the old snapshot then overwrite`, { timeout: 8000 }, async () => {
    const initial = JSON.stringify(fixture());
    const bytes = new SharedArrayBuffer(65536);
    const control = new SharedArrayBuffer(8 * 4);
    const state = new Int32Array(control);
    new Uint8Array(bytes).set(new TextEncoder().encode(initial));
    state[7] = new TextEncoder().encode(initial).length;
    const code = stripTypeScriptTypes(section('async function withStorageLock', 'function useAssetUrls(')
      + section('  const persistEditorData =', '  const saveEditor =') + '\nglobalThis.persist = persistEditorData;');
    let released = false;
    let waiting = false;
    let comparisons = 0;
    const workers = [0, 1].map(index => new Worker(new URL('./helpers/storage-concurrency-worker.mjs', import.meta.url), {
      workerData: { index, initial, bytes, control, code, lockKind },
    }));
    try {
      const ready = [];
      const done = workers.map(worker => new Promise((resolve, reject) => {
        ready.push(new Promise(readyResolve => {
          worker.on('message', message => {
            if (message.type === 'ready') readyResolve();
            if (message.type === 'compare') comparisons++;
            if (message.type === 'lock-wait') waiting = true;
            // 有锁时等第二线程真正争锁；无锁时等两者都捕获旧值，避免靠时间猜测交错。
            if (!released && comparisons > 0 && (waiting || comparisons === 2)) {
              released = true;
              for (const index of [0, 1]) { Atomics.store(state, 3 + index, 1); Atomics.notify(state, 3 + index); }
            }
            if (message.type === 'done') resolve(message);
          });
        }));
        worker.once('error', reject);
        worker.once('exit', code => { if (code !== 0) reject(Error(`worker exit ${code}`)); });
      }));
      await Promise.all(ready);
      workers.forEach(worker => worker.postMessage('save'));
      const results = await Promise.all(done);
      assert.equal(comparisons, 2);
      assert.equal(results.filter(x => x.status === 'fulfilled').length, 1, 'only one writer may commit from the shared old snapshot');
      const rejected = results.find(x => x.status === 'rejected');
      assert.match(rejected?.error ?? '', /其他窗口/);
      const stored = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes).slice(0, state[7])));
      assert.equal(stored.todos.length, 1);
      assert.equal(stored.todos[0].id, String(results.findIndex(x => x.status === 'fulfilled')));
    } finally {
      await Promise.all(workers.map(worker => worker.terminate()));
    }
  });
}


test('Web Lock cleanup keeps shared media and removes only unreferenced committed media', async () => {
  const original = fixture();
  original.abilities = [{ id: 'ability', imageId: 'blob' }];
  const disk = storage(original);
  const app = client(disk, { navigator: { locks: webLocks() } });
  assert.equal(await app.api.performRemoveItem('memory', 'photo'), true);
  await app.api.flushAssetCleanup();
  assert.equal(disk.blobs.has('blob'), true);
  await app.api.persistEditorData(current => ({ ...current, abilities: [] }), ['blob']);
  await app.api.flushAssetCleanup();
  assert.equal(disk.blobs.has('blob'), false);
});
