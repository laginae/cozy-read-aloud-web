import assert from "node:assert/strict";
import { readFile, writeFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const metadata = JSON.parse(await readFile("output/build-meta.json", "utf8"));
const initial = new Set();
function visit(name) {
  if (initial.has(name)) return;
  const entry = metadata.outputs[name];
  assert.ok(entry, "Missing generated module " + name);
  initial.add(name);
  for (const edge of entry.imports) {
    assert.notEqual(edge.external, true, "Runtime modules must be bundled locally");
    if (edge.kind !== "dynamic-import") visit(edge.path);
  }
}
visit("dist/app.js");
for (const name of initial) {
  assert.ok(!Object.keys(metadata.outputs[name].inputs).some(input => /portable-ocr|ocr-dialog|tesseract/.test(input)), 'OCR implementation leaked into initial modules');
  assert.ok(!Object.keys(metadata.outputs[name].inputs).some(input => input.startsWith("node_modules/pdfjs-dist/")), "PDF runtime leaked into initial modules");
}
assert.ok(Object.keys(metadata.outputs).some(name => !initial.has(name) && Object.keys(metadata.outputs[name].inputs).some(input => input.startsWith("node_modules/pdfjs-dist/"))));
let initialBytes = 0, initialGzipBytes = 0;
for (const name of initial) {
  const data = await readFile(name);
  initialBytes += data.length;
  initialGzipBytes += gzipSync(data).length;
}
const summary = {
  initialModules: [...initial], initialBytes, initialGzipBytes,
  deferredBytes: Object.entries(metadata.outputs).filter(([name]) => !initial.has(name)).reduce((n, [, output]) => n + output.bytes, 0),
  workerBytes: (await stat("dist/pdf.worker.mjs")).size,
  scope: "Build bytes, not download time or first-audio latency",
};
await writeFile("output/build-summary.json", JSON.stringify(summary, null, 2));
console.log(`Initial JS: ${initialBytes} bytes; PDF runtime deferred. Build boundary verified.`);
