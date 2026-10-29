'use strict';

function normalizeFootnoteMode(value) { return ['body', 'inline', 'footnotes'].includes(value) ? value : 'body'; }

// Require both smaller type and a clear gap; ambiguous bottom-page text stays in the body.
function markFootnotes(layout, items, viewport, pageNumber) {
  const box = viewport?.viewBox;
  const x0 = Number(box?.[0]) || 0, y0 = Number(box?.[1]) || 0;
  const width = box ? box[2] - x0 : Number(viewport?.width);
  const height = box ? box[3] - y0 : Number(viewport?.height);
  if (!(width > 0 && height > 0) || (Number(viewport?.rotation) || 0) % 360 || !layout.lines.length) return layout;
  const positioned = (items || []).filter((item) => item.str?.trim() && item.transform?.length >= 6)
    .map((item) => ({ x: item.transform[4], y: item.transform[5], size: Math.abs(item.height || item.transform[3]), weight: item.str.trim().length }));
  const sizes = new Map();
  for (const item of positioned.filter((item) => item.y > y0 + height * .22 && item.y < y0 + height * .92)) {
    const size = Math.round(item.size * 10) / 10;
    if (size > 0) sizes.set(size, (sizes.get(size) || 0) + item.weight);
  }
  const bodySize = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!bodySize) return layout;
  const notes = new Set();
  const lower = y0 + height * .035;
  const spansOf = (line) => positioned.filter((item) => Math.abs(item.y - line.y) <= bodySize * .6
    && item.x >= line.xMin - 2 && item.x <= line.xMax + 2 && item.weight > 2);
  const consistent = (lines) => lines.every((line) => spansOf(line).every((item) => item.size <= bodySize * .96));
  if (pageNumber === 1) {
    const ordered = [...layout.lines].sort((a, b) => b.y - a.y);
    for (const line of ordered) {
      if (line.y > y0 + height * .28 || line.y < lower
        || !/^[*\u2217\u2020\u2021\s]*(?:corresponding author|correspondence|e[-\s]?mail address)\b/i.test(line.text)) continue;
      const below = ordered.filter((candidate) => candidate.y <= line.y && candidate.y > lower);
      const above = ordered.filter((candidate) => candidate.y > line.y + bodySize * .5);
      const gap = above.length ? Math.min(...above.map((candidate) => candidate.y)) - line.y : 0;
      const metadata = below.some((candidate) => candidate !== line
        && /e[-\s]?mail address|doi\.org|received\b|accepted\b|available\s*online|copyright|\u00a9/i.test(candidate.text));
      if (!metadata || gap < bodySize * 2 || !spansOf(line).length || !consistent(below)) continue;
      below.forEach((candidate) => notes.add(candidate));
      break;
    }
  }
  for (const left of layout.twoColumn ? [true, false] : [true]) {
    const column = layout.lines.filter((line) => !layout.twoColumn || (line.xMin < x0 + width / 2) === left).sort((a, b) => b.y - a.y);
    for (let i = 0; i < column.length; i++) {
      const line = column[i];
      if (notes.has(line) || line.y > y0 + height * .28 || line.y < lower
        || !/^(?:\d{1,3}|[*\u2217\u2020\u2021])\s+\S/.test(line.text)) continue;
      if (!/\p{L}/u.test(line.text)) continue;
      const spans = spansOf(line);
      if (!spans.length || !i) continue;
      const size = spans.reduce((sum, item) => sum + item.size * item.weight, 0) / spans.reduce((sum, item) => sum + item.weight, 0);
      if (size > bodySize * .91 || column[i - 1].y - line.y < bodySize * 1.7) continue;
      const below = column.slice(i).filter((candidate) => candidate.y > lower);
      if (!consistent(below)) continue;
      below.forEach((candidate) => notes.add(candidate));
      break;
    }
  }
  return { ...layout, lines: layout.lines.map((line) => ({ ...line, footnote: notes.has(line) })) };
}

function splitFootnotesInRange(text, lines = []) {
  let body = text;
  const notes = [];
  for (let i = 0; i < lines.length; i++) {
    const value = /[A-Za-z]-$/.test(lines[i].text) && /^[a-z]/.test(lines[i + 1]?.text || '') ? lines[i].text.slice(0, -1) : lines[i].text;
    const pattern = value.trim().split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    if (!pattern) continue;
    const matches = [...body.matchAll(new RegExp(pattern, 'g'))];
    if (matches.length !== 1) continue;
    notes.push(matches[0][0]);
    body = body.slice(0, matches[0].index) + '\n' + body.slice(matches[0].index + matches[0][0].length);
  }
  return { body: body.trim(), notes: notes.join('\n') };
}

module.exports = { normalizeFootnoteMode, markFootnotes, splitFootnotesInRange };
