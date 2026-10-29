import test from "node:test";
import assert from "node:assert/strict";
import { mapPdfItems, selectedPdfBlocks, singleItemLayout } from "../src/pdf-selection.js";
function fixture() {
  const items = [
      "Repeated public line.",
      "Repeated public line.",
      "Later public line.",
    ].map((str, i) => ({
      str,
      width: 100,
      height: 12,
      transform: [12, 0, 0, 12, 40, 700 - i * 30],
    })),
    page = { items },
    doc = {
      id: "sample",
      blocks: items.map((item, i) => ({
        raw: item.str,
        pageData: page,
        lines: [{ text: item.str, xMin: 40, xMax: 140, y: 700 - i * 30 }],
      })),
    };
  mapPdfItems(doc, page);
  return doc;
}
test("single-item pages retain source mapping without guessing rotated or ambiguous layouts", () => {
  const item = { str: "One public sentence.", width: 130, height: 12, transform: [12, 0, 0, 12, 40, 700] };
  const original = { text: item.str, lines: [] }, layout = singleItemLayout(original, [item]);
  assert.equal(original.lines.length, 0);
  const page = { items: [item] }, doc = { id: "single", blocks: [{ raw: layout.text, lines: layout.lines, pageData: page }] };
  mapPdfItems(doc, page);
  assert.equal(page.itemBlocks.get(0), 0);
  assert.equal(selectedPdfBlocks(doc, { docId: doc.id, parts: [{ block: 0, itemIndex: 0, start: 4, end: 10 }] })[0].raw, "public");
  assert.equal(singleItemLayout(original, [item, item]), original);
  assert.equal(singleItemLayout(original, [{ ...item, transform: [0, 12, -12, 0, 40, 700] }]), original);
});
test("PDF selection uses source item identity, not duplicate text matching", () => {
  const doc = fixture(),
    snapshot = {
      docId: "sample",
      parts: [{ block: 1, itemIndex: 1, start: 9, end: 15, rects: [] }],
    };
  const result = selectedPdfBlocks(doc, snapshot);
  assert.equal(result.length, 1);
  assert.equal(result[0].index, 1);
  assert.equal(result[0].raw, "public");
});
test("read from PDF selection retains only the suffix then later blocks", () => {
  const doc = fixture(),
    snapshot = {
      docId: "sample",
      parts: [{ block: 1, itemIndex: 1, start: 9, end: 15 }],
    };
  assert.deepEqual(
    selectedPdfBlocks(doc, snapshot, true).map((b) => b.raw),
    ["public line.", "Later public line."],
  );
  assert.throws(() =>
    selectedPdfBlocks(doc, { docId: "other", parts: snapshot.parts }),
  );
});
