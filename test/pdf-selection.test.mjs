import test from "node:test";
import assert from "node:assert/strict";
import { mapPdfItems, selectedPdfBlocks } from "../src/pdf-selection.js";
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
