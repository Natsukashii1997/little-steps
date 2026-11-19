import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

const KEY = "little-steps-baby-workbench-v1";
const MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
test.use({ userAgent: MOBILE, viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ context, page }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (!process.env.AUDIT_STATIC_ROOT) return route.continue();
    const root = resolve(process.env.AUDIT_STATIC_ROOT);
    const file = resolve(root, `.${url.pathname === "/" ? "/index.html" : url.pathname}`);
    if (!file.startsWith(`${root}/`)) return route.abort();
    const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json" };
    try { return await route.fulfill({ body: await readFile(file), contentType: types[extname(file)] || "application/octet-stream" }); }
    catch { return route.fulfill({ status: 404, body: "missing synthetic test asset" }); }
  });
  await page.goto("/");
  await expect(page.getByTestId("final-nav-home")).toBeVisible();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), KEY)).not.toBeNull();
});

async function seedPhoto(page: Page) {
  await page.evaluate(async (key) => {
    const data = JSON.parse(localStorage.getItem(key)!);
    data.demoMode = false;
    data.demoRecordIds = [];
    data.memories = [{ id: "test-photo", type: "photo", title: "合成照片", date: "2026-08-10", description: "隔离测试", assetId: "test-blob" }];
    localStorage.setItem(key, JSON.stringify(data));
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("little-steps-assets", 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("uploads", "readwrite");
        tx.objectStore("uploads").put(new Blob(["synthetic-photo"], { type: "image/png" }), "test-blob");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, KEY);
  await page.reload();
}

async function photoExists(page: Page) {
  return page.evaluate(() => new Promise<boolean>((resolve, reject) => {
    const req = indexedDB.open("little-steps-assets", 1);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("uploads", "readonly");
      const get = tx.objectStore("uploads").get("test-blob");
      get.onsuccess = () => resolve(get.result instanceof Blob);
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => db.close();
    };
  }));
}

async function deletePhoto(page: Page) {
  await page.getByTestId("final-nav-memory").click();
  await page.getByTestId("screen-action-memory-all").click();
  await page.getByRole("button", { name: "删除 合成照片" }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
}

test("metadata quota failure retains the record, Blob and delete confirmation", async ({ page }) => {
  await seedPhoto(page);
  await page.evaluate((key) => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("synthetic quota", "QuotaExceededError");
      return write.call(this, name, value);
    };
  }, KEY);
  await deletePhoto(page);
  // 弹窗外的现有 toast 可能被模态层从无障碍树隔离，仍需验证页面上的可见失败提示。
  const notice = page.locator('.toast[role="status"]');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("记录未能删除，请检查浏览器存储空间后重试");
  await expect(page.getByRole("button", { name: "确认删除", exact: true })).toBeVisible();
  expect(await photoExists(page)).toBe(true);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).memories[0].id, KEY)).toBe("test-photo");
  await page.reload();
  expect(await photoExists(page)).toBe(true);
});


test("a stale editor in another tab is refused and both saved collections remain intact", async ({ context, page }) => {
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByTestId("final-nav-home")).toBeVisible();
  await other.getByTestId("final-nav-growth").click();
  await other.getByRole("button", { name: "新增成长记录" }).click();
  const editor = other.getByTestId("bottom-sheet");
  await editor.getByLabel(/测量日期/).fill("2026-08-05");
  await editor.getByLabel("体重 kg（可选）").fill("3.1");
  await editor.getByLabel("成长备注（可选）").fill("尚未保存的旧窗口记录");
  await page.getByRole("button", { name: /记录现在便便/ }).click();
  await expect(page.getByRole("status")).toContainText("已记录今天第");
  const before = await page.evaluate(key => localStorage.getItem(key), KEY);
  await editor.getByRole("button", { name: "保存记录" }).click();
  await expect(other.getByRole("status")).toContainText("其他窗口已更新");
  await expect(editor.getByLabel("成长备注（可选）")).toHaveValue("尚未保存的旧窗口记录");
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(before);
});
