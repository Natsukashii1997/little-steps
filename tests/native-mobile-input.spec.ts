import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const STORAGE_KEY = "little-steps-baby-workbench-v1";
const MOBILE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test.describe("real mobile input and local uploads", () => {
  test.use({
    viewport: { width: 393, height: 852 },
    userAgent: MOBILE_USER_AGENT,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
  });

  test("uses native fields without opening the illustrated keyboard and persists growth edits", async ({ page }) => {
    await page.getByTestId("final-nav-growth").click();
    await page.getByRole("button", { name: "新增成长记录" }).click();

    const editor = page.getByTestId("bottom-sheet");
    const date = editor.getByLabel(/测量日期/);
    const height = editor.getByLabel("身长 cm（可选）");
    const weight = editor.getByLabel("体重 kg（可选）");
    const note = editor.getByLabel("成长备注（可选）");

    await height.click();
    await expect(height).toBeFocused();
    await expect(height).toHaveAttribute("data-native-input", "true");
    await expect(page.locator('[data-testid="keyboard-dock"][data-visible="true"]')).toHaveCount(0);

    await date.fill("2026-08-05");
    await height.fill("50.5");
    await weight.fill("3.1");
    await note.fill("原生输入回归记录");
    await editor.getByRole("button", { name: "保存记录" }).click();

    await expect(page.getByRole("status")).toHaveText("已经记下来了");
    await expect.poll(() => page.evaluate(({ key, dateValue }) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const record = JSON.parse(raw).growthRecords?.find((item: { date?: string }) => item.date === dateValue);
      return record ? { height: record.height, weight: record.weight, note: record.note } : null;
    }, { key: STORAGE_KEY, dateValue: "2026-08-05" })).toEqual({
      height: 50.5,
      weight: 3.1,
      note: "原生输入回归记录",
    });

    await page.reload();
    await page.getByTestId("final-nav-growth").click();
    await expect(page.getByText("原生输入回归记录")).toBeVisible();
  });

  test("accepts an empty-MIME phone photo, previews it, saves it, and restores it after reload", async ({ page }) => {
    await page.getByTestId("final-nav-health").click();
    await page.getByRole("tab", { name: "发育" }).click();
    await page.getByRole("button", { name: "新增发育里程碑" }).click();

    const editor = page.getByTestId("bottom-sheet");
    await editor.getByLabel("记录日期").fill("2026-08-10");
    await editor.getByLabel("大运动能力").fill("手机上传测试");
    await editor.getByLabel("表现说明").fill("选图、保存和刷新都要可用。");

    const photo = await readFile("public/assets/app-icons/icon-192.png");
    await editor.getByLabel("示意图（可选）").setInputFiles({
      name: "iphone-photo.jpg",
      mimeType: "",
      buffer: photo,
    });
    await expect(editor.getByText(/iphone-photo\.jpg/)).toBeVisible();
    await expect(editor.getByAltText("发育里程碑图片预览")).toBeVisible();

    await editor.getByRole("button", { name: "保存记录" }).click();
    await expect(page.getByText("手机上传测试")).toBeVisible();

    const savedAsset = await page.evaluate(async (key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const item = JSON.parse(raw).abilities?.find((entry: { name?: string }) => entry.name === "手机上传测试");
      if (!item?.imageId) return null;
      return await new Promise<{ type: string; size: number } | null>((resolve, reject) => {
        const request = indexedDB.open("little-steps-assets", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const get = db.transaction("uploads", "readonly").objectStore("uploads").get(item.imageId);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            const blob = get.result as Blob | undefined;
            resolve(blob ? { type: blob.type, size: blob.size } : null);
          };
        };
      });
    }, STORAGE_KEY);
    expect(savedAsset).toEqual({ type: "image/jpeg", size: photo.byteLength });

    await page.reload();
    await page.getByTestId("final-nav-health").click();
    await page.getByRole("tab", { name: "发育" }).click();
    await expect(page.getByText("手机上传测试")).toBeVisible();
    const restored = page.getByRole("button", { name: /编辑发育里程碑.*手机上传测试/ }).locator("img");
    await expect(restored).toHaveAttribute("src", /^blob:/);
  });
});
