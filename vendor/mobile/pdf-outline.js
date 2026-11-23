'use strict';
const { outlineTypography, detectPdfHeadings } = require('./pdf-outline-detection');

const NUMBERED = /^(\d+(?:\.\d+)*\.?|[IVXLC]+[.)]|第[一二三四五六七八九十\d]+[章节])\s+(.+)/;
const normalize = (text) => String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function outlineLayout(layout, items, styles = {}, viewport = {}) {
  return outlineTypography(layout, items, styles, viewport);
}

function indexedPages(pages) {
  return pages.map((page) => {
    let cursor = 0;
    const lines = page.layout.lines.map((line) => {
      const needle = line.text.trim().replace(/-$/, '');
      const offset = page.text.indexOf(needle, cursor);
      if (offset >= 0) cursor = offset + needle.length;
      return { ...line, offset };
    });
    return { ...page, layout: { ...page.layout, lines } };
  });
}

async function resolvePdfBookmarks(pdf, isCancelled = () => false) {
  const entries = [];
  let visited = 0;
  const check = () => { if (isCancelled()) throw new Error('Cancelled'); };
  async function visit(nodes, level) {
    if (!Array.isArray(nodes) || level > 20) return;
    for (const node of nodes) {
      check();
      if (++visited > 2000) throw new Error('PDF bookmark tree exceeds the 2,000-entry limit.');
      if (!node || typeof node !== 'object') continue;
      try {
        let dest = node.dest;
        if (typeof dest === 'string') dest = await pdf.getDestination(dest);
        if (Array.isArray(dest) && dest[0] != null) {
          const index = Number.isInteger(dest[0]) ? dest[0] : await pdf.getPageIndex(dest[0]);
          const title = String(node.title || '').trim().slice(0, 500);
          if (title && Number.isInteger(index) && index >= 0 && index < pdf.numPages) {
            const kind = dest[1]?.name;
            entries.push({ title, level: Math.min(6, level), page: index + 1,
              x: kind === 'XYZ' && Number.isFinite(dest[2]) ? dest[2] : null,
              y: kind === 'XYZ' && Number.isFinite(dest[3]) ? dest[3]
                : /^(FitH|FitBH)$/.test(kind) && Number.isFinite(dest[2]) ? dest[2] : null });
          }
        }
      } catch { /* A malformed destination must not hide other valid bookmarks. */ }
      check();
      await visit(node.items, level + 1);
    }
  }
  let roots;
  try { roots = await pdf.getOutline?.(); } catch { check(); return []; }
  await visit(roots, 1);
  return entries;
}

function inferEntries(pages) {
  return detectPdfHeadings(pages.map(page => ({ ...page.layout, number: page.pageNumber })));
}

function buildPdfOutline(rawPages, bookmarks = []) {
  const pages = indexedPages(rawPages);
  const entries = bookmarks.flatMap((entry) => {
    const page = pages.find((candidate) => candidate.pageNumber === entry.page);
    if (!page) return [];
    const lines = page.layout.lines.filter((line) => line.offset >= 0);
    const title = normalize(entry.title);
    const matches = title.length >= 3 ? lines.filter((line) => normalize(line.text.replace(NUMBERED, '$2')).startsWith(title)
      || normalize(line.text).startsWith(title)) : [];
    let line = matches.length === 1 ? matches[0] : null;
    if (!line && Number.isFinite(entry.y) && !page.layout.rotated) {
      const distance = (candidate) => Math.abs(candidate.y - entry.y)
        + (Number.isFinite(entry.x) ? Math.abs(candidate.xMin - entry.x) * .35 : 0);
      line = [...lines].sort((a, b) => distance(a) - distance(b))[0];
    }
    const prefix = line?.text.match(NUMBERED)?.[1];
    return [{ ...entry, title: prefix && !NUMBERED.test(entry.title) && matches.length === 1 ? `${prefix} ${entry.title}` : entry.title,
      offset: line?.offset || 0, approximate: !line, inferred: false }];
  });
  return { pages, entries: entries.length ? entries : inferEntries(pages), source: entries.length ? 'bookmarks' : 'inferred' };
}

function sectionPages(data, index, remaining = false) {
  const start = data.entries[index];
  if (!start) throw new Error('Choose a PDF section.');
  const after = (entry) => entry.page > start.page || (entry.page === start.page && entry.offset > start.offset);
  // Bookmark trees can contain duplicate destinations or be out of page order.
  const end = remaining ? null : data.entries.filter((entry) => entry.level <= start.level && after(entry))
    .sort((a, b) => a.page - b.page || a.offset - b.offset)[0];
  return data.pages.filter((page) => page.pageNumber >= start.page && (!end || page.pageNumber <= end.page))
    .map((page) => ({ ...page, text: page.text.slice(page.pageNumber === start.page ? start.offset : 0,
      end && page.pageNumber === end.page ? end.offset : page.text.length) })).filter((page) => page.text.trim());
}

function outlineKey(file, skipHeaders) {
  return JSON.stringify([file.path, file.stat?.mtime, file.stat?.size, skipHeaders !== false]);
}

module.exports = { outlineLayout, resolvePdfBookmarks, buildPdfOutline, sectionPages, outlineKey };
