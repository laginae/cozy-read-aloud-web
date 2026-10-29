'use strict';

// Mirrors the desktop edge bands, with conservative title/size guards.
function edgeCandidates(layout, items, viewport) {
  if (!layout?.lines?.length || (Number(viewport?.rotation) || 0) % 360 !== 0) return [];
  const box = viewport?.viewBox;
  const x0 = box?.length === 4 ? Number(box[0]) : 0;
  const y0 = box?.length === 4 ? Number(box[1]) : 0;
  const width = box?.length === 4 ? Number(box[2]) - x0 : Number(viewport?.width);
  const height = box?.length === 4 ? Number(box[3]) - y0 : Number(viewport?.height);
  if (![x0, y0, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return [];
  const positioned = (items || []).map((item) => ({
    x: Number(item.x ?? item.transform?.[4]), y: Number(item.y ?? item.transform?.[5]),
    size: Math.max(Math.abs(Number(item.height) || 0), Math.abs(Number(item.transform?.[3]) || 0)),
  })).filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y) && item.size > 0);
  const sizes = positioned.filter((item) => item.y > y0 + height * .1 && item.y < y0 + height * .9)
    .map((item) => item.size).sort((a, b) => a - b);
  const bodySize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const result = [];
  layout.lines.forEach((line, index) => {
    const y = (line.y - y0) / height;
    const band = y > .93 && y <= 1 ? 'top' : y >= 0 && y < .045 ? 'bottom' : '';
    const text = String(line.text || '').replace(/\s+/g, ' ').trim();
    if (!band || !text || text.length > 180) return;
    const ownSizes = positioned.filter((item) => Math.abs(item.y - line.y) <= 2 && item.x >= line.xMin - 1 && item.x <= line.xMax + 1).map((item) => item.size);
    if (bodySize && ownSizes.some((size) => size > bodySize * 1.1)) return;
    const pageNumber = /^(?:\d{1,4}|page\s+\d{1,4}(?:\s+(?:of|\/)\s*\d{1,4})?|第\s*\d{1,4}\s*页)$/i.test(text);
    // Do not infer a numbered heading or equation/table row as a running header.
    if (!pageNumber && /^(?:(?:\d+(?:\.\d+)*\.?|[IVX]+\.)\s+|chapter\b|section\b|appendix\b|第.+[章节])/i.test(text)) return;
    if (!pageNumber && !/[A-Za-z\u00c0-\uffff]/.test(text)) return;
    const key = `${band}:${Math.round((line.xMin - x0) / width * 10)}:${text.toLowerCase().replace(/\d+/g, '#')}`;
    result.push({ index, key, pageNumber });
  });
  return result;
}

function recurringEdges(pages) {
  const counts = new Map();
  for (const page of pages) {
    for (const candidate of page.edgeCandidates || []) {
      if (!counts.has(candidate.key)) counts.set(candidate.key, new Set());
      counts.get(candidate.key).add(page.pageNumber);
    }
  }
  return new Set([...counts].filter(([, numbers]) => numbers.size >= 2).map(([key]) => key));
}

function filterPageHeaders(page, repeated) {
  const omitted = new Set((page.edgeCandidates || [])
    .filter((candidate) => candidate.pageNumber || repeated.has(candidate.key)).map((candidate) => candidate.index));
  if (!omitted.size) return page;
  const lines = page.layout.lines.filter((_line, index) => !omitted.has(index));
  // If nothing resembling body text remains, preserve the original rather than blanking the page.
  if (!lines.length) return page;
  const text = lines.map((line) => line.text.trim()).filter(Boolean).join('\n')
    .replace(/([A-Za-z])-\n(?=[a-z])/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
  return { ...page, unfilteredText: page.text, text, omittedHeaderLines: omitted.size,
    layout: { ...page.layout, lines, text } };
}

module.exports = { edgeCandidates, recurringEdges, filterPageHeaders };
