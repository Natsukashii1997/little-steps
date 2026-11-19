// 独立执行上下文：共享存储的单次读写是原子的，比较与写入之间允许交错。
import { parentPort, workerData } from 'node:worker_threads';
import vm from 'node:vm';
const { index, initial, bytes, control, code, lockKind } = workerData;
const state = new Int32Array(control);
const buffer = new Uint8Array(bytes);
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function atomicStorage(action) {
  while (Atomics.compareExchange(state, 6, 0, 1) !== 0) Atomics.wait(state, 6, 1);
  try { return action(); }
  finally { Atomics.store(state, 6, 0); Atomics.notify(state, 6); }
}
let reads = 0;
const localStorage = {
  length: 0,
  getItem() {
    const value = atomicStorage(() => decoder.decode(buffer.slice(0, Atomics.load(state, 7))));
    if (++reads === 1) {
      parentPort.postMessage({ type: 'compare' });
      // 真实同步读取已经返回的值被截住，另一线程此时仍能运行。
      Atomics.wait(state, 3 + index, 0, 5000);
    }
    return value;
  },
  setItem(_key, value) {
    atomicStorage(() => {
      const encoded = encoder.encode(value);
      buffer.set(encoded);
      Atomics.store(state, 7, encoded.length);
    });
  },
};
async function acquire() {
  while (Atomics.compareExchange(state, 0, 0, 1) !== 0) {
    parentPort.postMessage({ type: 'lock-wait' });
    await Atomics.waitAsync(state, 0, 1).value;
  }
}
function release() { Atomics.store(state, 0, 0); Atomics.notify(state, 0); }
const navigator = lockKind === 'web' ? { locks: {
  async request(_name, action) {
    await acquire();
    try { return await action(); } finally { release(); }
  },
} } : {};
const assetDb = Promise.resolve({
  transaction() {
    let held = false;
    return {
      store: { async get() { await acquire(); held = true; } },
      get done() { if (held) { held = false; release(); } return Promise.resolve(); },
      abort() { if (held) { held = false; release(); } },
    };
  },
});
const context = { localStorage, navigator, assetDb, APP_STORAGE_KEY: 'app', ASSET_STORE: 'uploads',
  data: JSON.parse(initial), snapshot: initial, setStoredState() {}, notify() {} };
vm.createContext(context);
vm.runInContext(code, context);
parentPort.on('message', async () => {
  try {
    await context.persist(current => ({ ...current, todos: [{ id: String(index) }] }));
    parentPort.postMessage({ type: 'done', status: 'fulfilled' });
  } catch (error) {
    parentPort.postMessage({ type: 'done', status: 'rejected', error: error.message });
  }
  parentPort.close();
});
parentPort.postMessage({ type: 'ready' });
