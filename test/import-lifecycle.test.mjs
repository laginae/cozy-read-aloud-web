import test from "node:test";
import assert from "node:assert/strict";
import { awaitActive, countPdfText, PDF_TEXT_LIMIT, PDF_ITEMS_PER_PAGE_LIMIT } from "../src/import-lifecycle.js";
import { readFile } from "../src/documents.js";

test("pre-cancelled imports never read the file or start the operation", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  assert.throws(() => awaitActive(controller.signal, () => calls++), { name: "AbortError" });
  await assert.rejects(readFile({ name: "public.pdf", size: 1, arrayBuffer() { calls++; } }, controller.signal), { name: "AbortError" });
  assert.equal(calls, 0);
});

test("cancellation stops waiting for a file read and ignores its late result", async () => {
  const controller = new AbortController();
  let finish;
  const pending = readFile({ name: "public.md", size: 30, text: () => new Promise(resolve => { finish = resolve; }) }, controller.signal);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  finish("A public sentence that must never become a document.");
  await new Promise(resolve => setImmediate(resolve));
});

test("cancelled operation rejection is handled; cancellation before its microtask starts no work", async () => {
  const controller = new AbortController();
  let rejectWork;
  const pending = awaitActive(controller.signal, () => new Promise((resolve, reject) => { rejectWork = reject; }));
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  rejectWork(new Error("late public failure"));
  const second = new AbortController();
  let called = false;
  const stopped = awaitActive(second.signal, () => { called = true; });
  second.abort();
  await assert.rejects(stopped, { name: "AbortError" });
  assert.equal(called, false);
});

test("PDF extraction bounds count all pages before layout, without trimming away over-limit content", () => {
  assert.equal(countPdfText([{ str: "Public words." }, { type: "endMarkedContent" }], 20), 33);
  assert.equal(countPdfText([{ str: "word" }], PDF_TEXT_LIMIT - 4), PDF_TEXT_LIMIT);
  assert.throws(() => countPdfText([{ str: "words" }], PDF_TEXT_LIMIT - 4), /1,000,000/);
  assert.throws(() => countPdfText(new Array(PDF_ITEMS_PER_PAGE_LIMIT + 1)), /单页/);
  assert.equal(countPdfText(Array.from({ length: PDF_ITEMS_PER_PAGE_LIMIT }, () => ({ str: "" }))), 0);
});
