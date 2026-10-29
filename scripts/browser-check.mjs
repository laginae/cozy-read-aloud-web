import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:5186/";
await mkdir("output", { recursive: true });
const pdf = await PDFDocument.create(),
  font = await pdf.embedFont(StandardFonts.Helvetica);
for (let p = 0; p < 2; p++) {
  const page = pdf.addPage([595, 842]);
  for (const [i, line] of [
    "First left column sentence.",
    "Second left column sentence.",
    "A repeated public sentence.",
    "Last left column sentence.",
  ].entries())
    page.drawText(line, { x: 42, y: 740 - i * 30, size: 10, font });
  for (const [i, line] of [
    "First right column sentence.",
    "Second right column sentence.",
    "A repeated public sentence.",
    "Last right column sentence.",
  ].entries())
    page.drawText(line, { x: 320, y: 740 - i * 30, size: 10, font });
}
const bytes = Buffer.from(await pdf.save());
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
});
const errors = [],
  requests = [],
  audioRequests = [];
const wav = () => {
  const b = Buffer.alloc(44 + 8000 * 8 * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  return b;
};
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (
      url.startsWith(new URL(base).origin) ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    )
      return route.continue();
    requests.push(url);
    return route.abort();
  });
  await context.route("https://openrouter.ai/api/v1/audio/speech", (route) => {
    const request = route.request();
    audioRequests.push(request.postDataJSON());
    assert.equal(
      request.headers().authorization,
      "Bearer public-test-placeholder",
    );
    return route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: wav(),
    });
  });
  await context.addInitScript(() => {
    const state = (window.__speech = { utterances: [] });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [],
        addEventListener() {},
        cancel() {},
        pause() {},
        resume() {},
        speak(u) {
          state.utterances.push(u);
          u.onstart?.();
        },
      },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {
        constructor(text) {
          this.text = text;
        }
      },
    });
  });
  await page.goto(base);
  await page.locator("body").ariaSnapshot();
  await page
    .getByRole("heading", { name: "清晨散步", exact: true })
    .first()
    .waitFor();
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "public-columns.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
  await page.waitForSelector("[data-pdf-item]");
  async function select(text, start, end, pageIndex = 0) {
    await page.evaluate(
      ({ text, start, end, pageIndex }) => {
        const span = [...document.querySelectorAll(".pdf-page")][
          pageIndex
        ].querySelectorAll("[data-pdf-item]");
        const target = [...span].find((s) => s.textContent === text);
        if (!target) throw new Error("Fixture text not rendered");
        const range = document.createRange();
        range.setStart(target.firstChild, start);
        range.setEnd(target.firstChild, end);
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      },
      { text, start, end, pageIndex },
    );
    await page.waitForTimeout(80);
  }
  await select("First right column sentence.", 6, 18);
  await page
    .getByRole("combobox", { name: "朗读范围", exact: true })
    .selectOption("selection");
  await page.getByRole("button", { name: "开始朗读", exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__speech.utterances.at(-1).text),
    "right column",
  );
  await page.waitForSelector(".pdf-overlay>div");
  const precision = await page.evaluate(() => {
    const mark = document
        .querySelector(".pdf-overlay>div")
        .getBoundingClientRect(),
      span = [...document.querySelectorAll("[data-pdf-item]")]
        .find((s) => s.textContent === "First right column sentence.")
        .getBoundingClientRect();
    return {
      within: mark.left >= span.left - 2 && mark.right <= span.right + 2,
      width: mark.width,
      fullWidth: span.width,
    };
  });
  assert.ok(precision.within && precision.width < precision.fullWidth);
  await page.getByRole("button", { name: "停止朗读", exact: true }).click();
  await page.getByRole("button", { name: "放大 PDF", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "开始朗读", exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__speech.utterances.at(-1).text),
    "right column",
  );
  await page.getByRole("button", { name: "停止朗读", exact: true }).click();
  await page
    .getByRole("combobox", { name: "朗读范围", exact: true })
    .selectOption("from");
  await page.getByRole("button", { name: "开始朗读", exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__speech.utterances.at(-1).text),
    "right column sentence.",
  );
  await page.getByRole("button", { name: "下一段", exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__speech.utterances.at(-1).text),
    "Second right column sentence.",
  );
  await page.getByRole("button", { name: "停止朗读", exact: true }).click();
  await select("Second right column sentence.", 0, 29);
  await page
    .locator("[data-pdf-item]")
    .filter({ hasText: "Second right column sentence." })
    .first()
    .click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "朗读选中内容", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => window.__speech.utterances.at(-1).text),
    "Second right column sentence.",
  );
  await page.getByRole("button", { name: "停止朗读", exact: true }).click();
  await page.screenshot({ path: "output/pdf-selection.png" });
  await page.getByRole("searchbox", { name: "搜索大纲标题" }).fill("第 2 页");
  assert.equal(await page.locator(".outline-row").count(), 1);
  await page.getByRole("searchbox", { name: "搜索大纲标题" }).fill("");
  await page.getByRole("button", { name: "粘贴文字", exact: true }).click();
  await page
    .getByRole("textbox", { name: "标题", exact: true })
    .fill("Public export sample");
  await page
    .getByRole("textbox", { name: "正文", exact: true })
    .fill("A quiet public morning.");
  await page.getByRole("button", { name: "开始阅读", exact: true }).click();
  await page.getByRole("button", { name: "朗读设置", exact: true }).click();
  await page
    .getByRole("combobox", { name: "朗读方式", exact: true })
    .selectOption("openrouter");
  await page
    .getByRole("textbox", { name: "API 密钥", exact: true })
    .fill("public-test-placeholder");
  await page.locator("#online-consent").check();
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.getByRole("button", { name: "开始朗读", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#play-status").textContent === "正在朗读",
  );
  await page.getByRole("button", { name: "暂停朗读", exact: true }).click();
  await page.getByRole("button", { name: "前进 5 秒", exact: true }).click();
  assert.match(await page.locator("#audio-time").textContent(), /^0:05/);
  await page.getByRole("button", { name: "停止朗读", exact: true }).click();
  await page.getByRole("button", { name: "导出音频", exact: true }).click();
  await page.getByRole("button", { name: "合成并下载", exact: true }).click();
  assert.equal(audioRequests.length, 1);
  await page.locator("#export-consent").check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "合成并下载", exact: true }).click();
  await (await download).saveAs("output/public-audio.wav");
  assert.equal(audioRequests.length, 1);
  assert.equal(
    (await readFile("output/public-audio.wav")).subarray(0, 4).toString(),
    "RIFF",
  );
  await page.getByRole("button", { name: "朗读设置", exact: true }).click();
  await page
    .getByRole("button", { name: "停止并清理播放缓存", exact: true })
    .click();
  assert.match(await page.locator("#cache-size").textContent(), /^0 段/);
  await page
    .getByRole("button", { name: "清除密钥与授权", exact: true })
    .click();
  assert.equal(await page.locator("#api-key").inputValue(), "");
  await page
    .getByRole("combobox", { name: "朗读方式", exact: true })
    .selectOption("system");
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.getByRole("button", { name: "打开示例", exact: true }).click();
  const layouts = [];
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [320, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      bottom: document.querySelector(".player").getBoundingClientRect().bottom,
    }));
    assert.equal(m.overflow, false);
    assert.ok(m.bottom <= height + 1);
    layouts.push(m);
    await page.screenshot({ path: `output/web-${width}.png` });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  for (const request of audioRequests)
    assert.deepEqual(request.provider, { zdr: true, data_collection: "deny" });
  await writeFile(
    "output/browser-check.json",
    JSON.stringify(
      {
        passed: true,
        pdfSelection: true,
        partialHighlight: precision,
        afterZoom: true,
        rightColumnContinuation: true,
        contextMenu: true,
        outlineSearch: true,
        audioSeek: true,
        wavExport: true,
        paidRequests: 0,
        mockRequests: audioRequests.length,
        layouts,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Browser verification passed; public fixtures and mock online audio only.",
  );
} finally {
  await browser.close();
}
