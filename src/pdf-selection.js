export function itemRect(item, start = 0, end = item.str.length) {
  const x = item.transform[4],
    y = item.transform[5];
  const height = Math.max(1, Math.abs(item.height || item.transform[3] || 12));
  const width = Math.abs(item.width || 0),
    length = Math.max(1, item.str.length);
  return [
    x + (width * start) / length,
    y - height * 0.2,
    x + (width * end) / length,
    y + height,
  ];
}

export function mapPdfItems(doc, page) {
  page.itemBlocks = new Map();
  const blocks = doc.blocks
    .map((block, index) => ({ block, index }))
    .filter((b) => b.block.pageData === page);
  for (const { block } of blocks) block.runs = [];
  page.items.forEach((item, itemIndex) => {
    if (!item.str?.trim() || !item.transform) return;
    const x = item.transform[4],
      y = item.transform[5],
      middle = x + (item.width || 0) / 2;
    let closest = null,
      score = Infinity;
    for (const b of blocks)
      for (const [lineIndex, line] of b.block.lines.entries()) {
        const distance =
          Math.abs(y - line.y) +
          Math.max(0, line.xMin - middle, middle - line.xMax) * 2;
        if (distance < score) {
          score = distance;
          closest = { ...b, lineIndex };
        }
      }
    if (closest) {
      closest.block.runs.push({
        itemIndex,
        item,
        lineIndex: closest.lineIndex,
      });
      page.itemBlocks.set(itemIndex, closest.index);
    }
  });
  for (const { block } of blocks)
    block.runs.sort(
      (a, b) =>
        a.lineIndex - b.lineIndex || a.item.transform[4] - b.item.transform[4],
    );
}

// Freeze source offsets, not a live DOM Range: zooming and page eviction replace text nodes.
export function capturePdfSelection(doc, range) {
  const parts = [];
  for (const page of doc.pages)
    for (const span of page.box.querySelectorAll("[data-pdf-item]")) {
      if (!range.intersectsNode(span)) continue;
      const selected = document.createRange();
      selected.selectNodeContents(span);
      let start = 0,
        end = span.textContent.length;
      if (span.contains(range.startContainer)) {
        const prefix = selected.cloneRange();
        prefix.setEnd(range.startContainer, range.startOffset);
        start = prefix.toString().length;
        selected.setStart(range.startContainer, range.startOffset);
      }
      if (span.contains(range.endContainer)) {
        const prefix = document.createRange();
        prefix.selectNodeContents(span);
        prefix.setEnd(range.endContainer, range.endOffset);
        end = prefix.toString().length;
        selected.setEnd(range.endContainer, range.endOffset);
      }
      if (end <= start || !selected.toString().trim()) continue;
      const itemIndex = Number(span.dataset.pdfItem),
        block = page.itemBlocks.get(itemIndex);
      if (block === undefined)
        throw new Error("无法可靠定位此 PDF 选区，请重新选择较小范围。");
      const box = page.box.getBoundingClientRect();
      const rects = [...selected.getClientRects()]
        .filter((r) => r.width && r.height)
        .map((r) => {
          const a = page.viewport.convertToPdfPoint(
              r.left - box.left,
              r.top - box.top,
            ),
            b = page.viewport.convertToPdfPoint(
              r.right - box.left,
              r.bottom - box.top,
            );
          return [
            Math.min(a[0], b[0]),
            Math.min(a[1], b[1]),
            Math.max(a[0], b[0]),
            Math.max(a[1], b[1]),
          ];
        });
      parts.push({ block, itemIndex, start, end, rects });
    }
  if (!parts.length) throw new Error("选区没有可识别的 PDF 文字。");
  const pages = parts.map((p) => doc.blocks[p.block].page);
  for (let n = Math.min(...pages); n <= Math.max(...pages); n++)
    if (!doc.pages[n - 1].rendered)
      throw new Error("跨页选区包含尚未显示的页面，请分次选择。");
  parts.sort(
    (a, b) =>
      a.block - b.block ||
      doc.blocks[a.block].runs.findIndex((r) => r.itemIndex === a.itemIndex) -
        doc.blocks[b.block].runs.findIndex((r) => r.itemIndex === b.itemIndex),
  );
  return {
    docId: doc.id,
    parts,
    text: parts
      .map((p) =>
        doc.blocks[p.block].pageData.items[p.itemIndex].str.slice(
          p.start,
          p.end,
        ),
      )
      .join(" "),
  };
}

export function selectedPdfBlocks(doc, snapshot, from = false) {
  if (snapshot?.docId !== doc.id || !snapshot.parts?.length)
    throw new Error("PDF 选区已失效，请重新选择。");
  const first = snapshot.parts[0],
    chosen = new Map();
  for (const part of snapshot.parts)
    chosen.set(`${part.block}:${part.itemIndex}`, part);
  return doc.blocks.flatMap((block, index) => {
    if (from && index < first.block) return [];
    const runs = [];
    let reached = index > first.block;
    for (const run of block.runs) {
      const selected = chosen.get(`${index}:${run.itemIndex}`);
      if (from && index === first.block && run.itemIndex === first.itemIndex)
        reached = true;
      if (from ? !reached : !selected) continue;
      const start = from
        ? index === first.block && run.itemIndex === first.itemIndex
          ? first.start
          : 0
        : selected.start;
      const end = from ? run.item.str.length : selected.end;
      if (end <= start) continue;
      runs.push({
        ...run,
        start,
        end,
        rects:
          !from && selected.rects?.length
            ? selected.rects
            : [itemRect(run.item, start, end)],
      });
    }
    if (!runs.length) return [];
    let raw = "",
      lastLine = -1;
    for (const run of runs) {
      raw +=
        (raw ? (run.lineIndex !== lastLine ? "\n" : " ") : "") +
        run.item.str.slice(run.start, run.end);
      lastLine = run.lineIndex;
    }
    return [{ ...block, index, raw, rects: runs.flatMap((r) => r.rects) }];
  });
}
