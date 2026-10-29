import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:5186/";
const deadline = setTimeout(() => { console.error('Browser check exceeded eight minutes.'); process.exitCode = 1; void browser.close(); }, 480000);
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
  audioRequests = [],
  localRequests = [];
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
  page.on("request", request => {
    if (request.url().startsWith(new URL(base).origin)) localRequests.push(request.url());
  });
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
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message, ...rest) {
      if (window.__holdSecondPage && message?.action === 'GetTextContent' && message?.data?.pageIndex === 1) {
        window.__releaseSecondPage = () => { window.__holdSecondPage = false; post.call(this, message, ...rest); };
        return;
      }
      return post.call(this, message, ...rest);
    };
    window.__workersTerminated = 0;
    const terminate = Worker.prototype.terminate;
    Worker.prototype.terminate = function(...args) {
      window.__workersTerminated++;
      return terminate.apply(this, args);
    };
    window.__fileReads = [];
    window.__heldReads = {};
    for (const method of ["text", "arrayBuffer"]) {
      const original = File.prototype[method];
      File.prototype[method] = function(...args) {
        window.__fileReads.push(this.name);
        const result = original.apply(this, args);
        if (this.name === "delayed-public.md") {
          return new Promise((resolve, reject) => {
            window.__heldReads[this.name] = () => result.then(resolve, reject);
          });
        }
        return result;
      };
    }
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
  console.log('Loaded app');
  await page.locator("body").ariaSnapshot();
  await page
    .getByRole("heading", { name: "清晨散步", exact: true })
    .first()
    .waitFor();
  assert.equal(localRequests.some(url => /\/chunks\/pdf-|pdf\.worker/.test(url)), false);
  let releaseRuntime, runtimeArrived;
  const runtimeRequest = new Promise(resolve => { runtimeArrived = resolve; });
  const runtimeGate = new Promise(resolve => { releaseRuntime = resolve; });
  await page.route("**/chunks/pdf-*.js", async route => {
    runtimeArrived();
    await runtimeGate;
    await route.continue();
  });
  await page.locator("#file-input").setInputFiles({ name: "cancelled-public.pdf", mimeType: "application/pdf", buffer: bytes });
  await Promise.race([runtimeRequest, new Promise((_, reject) => setTimeout(() => reject(Error('PDF runtime request did not arrive')), 15000))]);
  await page.getByRole("button", { name: "停止朗读", exact: true }).click();
  const runtimeResponse = page.waitForResponse(response => /\/chunks\/pdf-/.test(response.url()));
  releaseRuntime();
  await runtimeResponse;
  await page.waitForTimeout(100);
  assert.equal(localRequests.some(url => /pdf\.worker/.test(url)), false);
  assert.deepEqual(await page.evaluate(() => window.__fileReads), []);
  await page.unroute("**/chunks/pdf-*.js");
  console.log('Deferred PDF import cancellation verified');

  const delayed = { name: "delayed-public.md", mimeType: "text/markdown", buffer: Buffer.from("A delayed public sentence.") };
  const unread = { name: "unread-public.md", mimeType: "text/markdown", buffer: Buffer.from("This file must never be read after cancellation.") };
  await page.locator("#file-input").setInputFiles([delayed, unread]);
  await page.waitForFunction(() => !!window.__heldReads['delayed-public.md']);
  await page.getByRole("button", { name: "停止朗读", exact: true }).click();
  await page.evaluate(() => { window.__heldReads['delayed-public.md'](); window.__heldReads = {}; });
  await page.waitForTimeout(50);
  assert.equal(await page.locator('.document-button').filter({ hasText: 'delayed-public.md' }).count(), 0);
  assert.equal(await page.evaluate(() => window.__fileReads.includes('unread-public.md')), false);

  await page.locator("#file-input").setInputFiles(delayed);
  await page.waitForFunction(() => !!window.__heldReads['delayed-public.md']);
  await page.locator("#file-input").setInputFiles({ name: "replacement-public.md", mimeType: "text/markdown", buffer: Buffer.from("The replacement public document stays active.") });
  await page.waitForFunction(() => document.querySelector('#document-title').textContent === 'replacement-public.md');
  await page.evaluate(() => { window.__heldReads['delayed-public.md'](); window.__heldReads = {}; });
  await page.waitForTimeout(50);
  assert.equal(await page.locator('#document-title').textContent(), 'replacement-public.md');
  assert.equal(await page.locator('#import').isDisabled(), false);
  await page.evaluate(() => { window.__holdSecondPage = true; });
  await page.locator('#file-input').setInputFiles({ name: 'preview-public.pdf', mimeType: 'application/pdf', buffer: bytes });
  await page.waitForFunction(() => !!window.__releaseSecondPage);
  console.log('Second PDF page held for preview check');
  await page.waitForSelector('.pdf-page canvas');
  await page.waitForSelector('[data-pdf-item]');
  assert.equal(await page.locator('#play').isDisabled(), true);
  assert.equal(await page.locator('#export-open').isDisabled(), true);
  assert.equal(await page.locator('.outline-play').first().isDisabled(), true);
  await page.screenshot({ path: 'output/pdf-progressive-preview.png' });
  await page.locator('#stop').click();
  assert.equal(await page.locator('#document-title').textContent(), 'replacement-public.md');
  await page.evaluate(() => { window.__holdSecondPage = false; window.__releaseSecondPage = null; });
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "public-columns.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
  await page.waitForSelector("[data-pdf-item]");
  await page.waitForFunction(() => !document.querySelector('#play').disabled);
  assert.equal(localRequests.filter(url => /\/chunks\/pdf-/.test(url)).length, 1);
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
  const closedWorkers = await page.evaluate(() => window.__workersTerminated);
  await page.getByRole("button", { name: "关闭 public-columns.pdf", exact: true }).click();
  await page.waitForFunction(count => window.__workersTerminated > count, closedWorkers);
  const failedWorkers = await page.evaluate(() => window.__workersTerminated);
  await page.locator("#file-input").setInputFiles({ name: "invalid-public.pdf", mimeType: "application/pdf", buffer: Buffer.from("Invalid public fixture, not a PDF.") });
  await page.waitForFunction(count => window.__workersTerminated > count, failedWorkers);
  assert.equal(await page.locator('.document-button').filter({ hasText: 'invalid-public.pdf' }).count(), 0);
  const single = await PDFDocument.create(), singleFont = await single.embedFont(StandardFonts.Helvetica);
  single.addPage([595, 842]).drawText("One public sentence.", { x: 42, y: 740, size: 12, font: singleFont });
  await page.locator("#file-input").setInputFiles({ name: "public-single.pdf", mimeType: "application/pdf", buffer: Buffer.from(await single.save()) });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-pdf-item]')].some(s => s.textContent === 'One public sentence.'));
  await select("One public sentence.", 4, 10);
  await page.getByRole("combobox", { name: "朗读范围", exact: true }).selectOption("selection");
  await page.getByRole("button", { name: "开始朗读", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__speech.utterances.at(-1).text), "public");
  await page.getByRole("button", { name: "停止朗读", exact: true }).click();
  const followPdf = await PDFDocument.create(), followFont = await followPdf.embedFont(StandardFonts.Helvetica);
  const followPage = followPdf.addPage([595, 842]);
  for (const [column, x] of [['Left', 42], ['Right', 320]])
    for (const [index, y] of [735, 430, 100].entries())
      followPage.drawText(`${column} public passage ${index + 1}.`, { x, y, size: 11, font: followFont });
  await page.setViewportSize({ width: 1000, height: 640 });
  await page.locator('#file-input').setInputFiles({ name: 'follow-public.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await followPdf.save()) });
  await page.waitForFunction(() => !document.querySelector('#play').disabled);
  await page.waitForSelector('[data-pdf-item]');
  await page.locator('#play').click();
  await page.evaluate(() => { window.__speech.utterances.at(-1).onend(); });
  await page.evaluate(() => { window.__speech.utterances.at(-1).onend(); });
  assert.match(await page.evaluate(() => window.__speech.utterances.at(-1).text), /Left public passage 3/);
  const columnBottom = await page.locator('#reader').evaluate(el => el.scrollTop);
  await page.evaluate(() => { window.__speech.utterances.at(-1).onend(); });
  assert.match(await page.evaluate(() => window.__speech.utterances.at(-1).text), /Right public passage 1/);
  const columnTop = await page.locator('#reader').evaluate(el => el.scrollTop);
  await page.screenshot({ path: 'output/pdf-column-follow.png' });
  assert.ok(columnBottom > columnTop + 100, `Following must move from left-column bottom to right-column top: ${columnBottom} -> ${columnTop}`);
  await page.locator('#stop').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
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
  assert.equal(await page.locator("#prefetch").isChecked(), false);
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
  await page.locator("#prefetch").check();
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.getByRole("button", { name: "粘贴文字", exact: true }).click();
  await page.getByRole("textbox", { name: "标题", exact: true }).fill("Public prefetch sample");
  await page.getByRole("textbox", { name: "正文", exact: true }).fill("First public paragraph.\n\nSecond public paragraph.");
  await page.getByRole("button", { name: "开始阅读", exact: true }).click();
  await page.getByRole("button", { name: "开始朗读", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#play-status").textContent === "正在朗读");
  await page.waitForTimeout(150);
  assert.equal(audioRequests.length, 3);
  assert.deepEqual(audioRequests.slice(-2).map(r => r.input), ["First public paragraph.", "Second public paragraph."]);
  await page.getByRole("button", { name: "下一段", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#play-status").textContent === "正在朗读");
  assert.equal(audioRequests.length, 3);
  await page.getByRole("button", { name: "暂停朗读", exact: true }).click();
  await page.getByRole("button", { name: "朗读设置", exact: true }).click();
  const timingDownload = page.waitForEvent("download");
  await page.locator("#timings-download").click();
  await (await timingDownload).saveAs("output/public-timings.json");
  const timingText = await readFile("output/public-timings.json", "utf8");
  assert.doesNotMatch(timingText, /public-test-placeholder|public paragraph|Public prefetch sample/);
  assert.equal(JSON.parse(timingText).counts.prefetchUsed, 1);
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
  await page.getByRole("button", { name: "朗读设置", exact: true }).click();
  await page.locator("#timings-download").scrollIntoViewIfNeeded();
  const settingsBounds = await page.locator("#timings-download").boundingBox();
  assert.ok(settingsBounds.y >= 0 && settingsBounds.y + settingsBounds.height <= 640);
  await page.screenshot({ path: "output/web-settings-320.png" });
  await page.getByRole("button", { name: "关闭设置" }).click();
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await touch.route("**/*", route => route.request().url().startsWith(new URL(base).origin) ? route.continue() : route.abort());
  const touchPage = await touch.newPage();
  await touchPage.goto(base);
  await touchPage.getByRole("button", { name: "朗读设置", exact: true }).tap();
  await touchPage.locator("#prefetch").tap();
  assert.equal(await touchPage.locator("#prefetch").isChecked(), true);
  await touchPage.getByRole("button", { name: "关闭设置" }).tap();
  await touch.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  await page.locator('#settings-open').click();
  await page.locator('#interface-language').selectOption('en');
  await page.getByRole('heading', { name: 'Reading settings', exact: true }).waitFor();
  await page.locator('#remember-preferences').check();
  await page.locator('#math-mode').selectOption('skip');
  const preferences = await page.evaluate(() => JSON.parse(localStorage.getItem('cozy-reading-preferences-v1')));
  assert.equal(preferences.values.language, 'en');
  assert.equal(preferences.values.mathMode, 'skip');
  assert.ok(!JSON.stringify(preferences).includes('public-test-placeholder'));
  assert.equal(preferences.values.consent, undefined);
  await page.screenshot({ path: 'output/web-english-320.png' });
  await page.reload();
  await page.locator('#settings-open').click();
  await page.getByRole('heading', { name: 'Reading settings', exact: true }).waitFor();
  assert.equal(await page.locator('#math-mode').inputValue(), 'skip');
  assert.equal(await page.locator('#online-consent').isChecked(), false);
  assert.equal(await page.locator('#api-key').inputValue(), '');
  await page.locator('#remember-preferences').uncheck();
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  for (const request of audioRequests)
    assert.deepEqual(request.provider, { zdr: true, data_collection: "deny" });
  await writeFile(
    "output/browser-check.json",
    JSON.stringify(
      {
        passed: true,
        pdfSelection: true,
        progressivePreviewAndCancel: true,
        englishAndOptInPreferences: true,
        partialHighlight: precision,
        afterZoom: true,
        rightColumnContinuation: true,
        automaticColumnTransition: true,
        contextMenu: true,
        singleItemPdf: true,
        optionalPrefetchReused: true,
        numericTimingDownload: true,
        smallSettingsScrollable: true,
        touchControlsEmulated: true,
        physicalMobileVerified: false,
        pdfRuntimeDeferred: true,
        cancelledRuntimeStartsNoWorker: true,
        cancelledBatchStopsBeforeNextFile: true,
        staleImportCannotReplaceNewDocument: true,
        closedAndFailedPdfReleaseWorker: true,
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
  await context.close();
} finally {
  clearTimeout(deadline);
  await browser.close();
}
