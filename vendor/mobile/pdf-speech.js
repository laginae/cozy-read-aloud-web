'use strict';

const { applyPdfMathChanges, normalizePdfReferenceRows } = require('./pdf-speech/pdf-math');

// Match only a unique, complete selection. Whitespace differences from the PDF
// text layer are harmless; uncertain matches must never expand the read scope.
function indexed(text) {
  const chars = [], offsets = [];
  const softWraps = new Set();
  for (const match of text.matchAll(/[A-Za-z]{2,}(-)[ \t]*\r?\n[ \t]*(?=[a-z])/g)) {
    softWraps.add(match.index + match[0].indexOf('-'));
  }
  for (let i = 0; i < text.length;) {
    const char = String.fromCodePoint(text.codePointAt(i));
    if (!/[\s\u00ad]/u.test(char) && !softWraps.has(i)) {
      const normalized = char.normalize('NFKC');
      for (let j = 0; j < normalized.length; j++) { chars.push(normalized[j]); offsets.push(i); }
    }
    i += char.length;
  }
  offsets.push(text.length);
  return { text: chars.join(''), offsets };
}

function uniqueRange(source, text) {
  const full = indexed(source), needle = indexed(text).text;
  if (!needle) return null;
  const start = full.text.indexOf(needle);
  if (start < 0 || full.text.indexOf(needle, start + 1) >= 0) return null;
  return { start: full.offsets[start], end: full.offsets[start + needle.length] };
}

function applyRange(text, page) {
  const source = page.unfilteredText || page.text;
  if (typeof source !== 'string') return null;
  const range = uniqueRange(source, text);
  if (!range) return null;
  const edits = [];
  for (const change of page.mathChanges || []) {
    // An isolated formula row such as "a" must not match letters inside prose.
    const exactLines = [];
    let offset = 0;
    for (const row of source.split('\n')) {
      if (indexed(row).text === indexed(change.source).text) exactLines.push({ start: offset, end: offset + row.length });
      offset += row.length + 1;
    }
    // Repeated limits or indices can be identical complete rows. Use their
    // original layout order only when all occurrences survived text filtering.
    let exact = exactLines.length === 1 ? exactLines[0] : null;
    if (!exact && exactLines.length > 1) {
      const same = page.layout?.lines?.filter(l=>l.text === change.source) || [];
      const which = same.findIndex(l=>l.y === change.y && l.xMin === change.xMin);
      if (which >= 0 && same.length === exactLines.length) exact = exactLines[which];
    }
    const line = exact || uniqueRange(source, change.source)
      || (change.joinedSource && /[A-Za-z]-$/.test(change.source)
        ? uniqueRange(source, change.source.slice(0, -1)) : null);
    if (!line) continue;
    // Each run maps back to the original PDF text, not the spoken expansion.
    for (const edit of change.edits || []) {
      const fragment = change.source.slice(edit.start, edit.end);
      const raw = source.slice(line.start, line.end);
      const local = raw === change.source ? {start:edit.start,end:edit.end} : uniqueRange(raw, fragment);
      if (!local) continue;
      const start = line.start + local.start, end = line.start + local.end;
      if (start >= range.end || end <= range.start) continue;
      const complete = start >= range.start && end <= range.end;
      edits.push({ start: Math.max(start, range.start), end: Math.min(end, range.end),
        text: complete ? edit.text : (edit.notice ? ` ${edit.notice} ` : '') });
    }
  }
  edits.sort((a, b) => a.start - b.start);
  let result = '', cursor = range.start;
  for (const edit of edits) {
    if (edit.start < cursor) continue;
    result += source.slice(cursor, edit.start);
    let spoken = edit.text;
    if (/^\s*[.。]/.test(spoken)) {
      result = result.trimEnd();
      if (!result) spoken = spoken.replace(/^\s*[.。]\s*/, '');
    }
    result += spoken;
    cursor = edit.end;
  }
  return (result + source.slice(cursor, range.end)).replace(/[ \t]+/g, ' ').trim();
}

function speechText(text) {
  // Normalize styled letters only after locating the original UTF-16 offsets.
  return normalizePdfReferenceRows(String(text)).replace(/[\u{1d400}-\u{1d7ff}]/gu,c=>c.normalize('NFKC'));
}

function preparePdfSpeech(text, page) {
  if (!page?.mathChanges?.length) return speechText(text);
  const result = applyRange(text, page);
  if (result !== null) return speechText(result);
  // Header/footnote/outline filtering may produce disjoint ranges.
  return speechText(String(text).split('\n').map(line => applyRange(line, page)
    ?? applyPdfMathChanges(line, page.mathChanges)).join('\n').trim());
}

function preparePdfSelection(text, pages) {
  const source = pages.map(page => page.text).join('\n');
  const range = uniqueRange(source, text);
  if (!range) return null;
  let offset = 0;
  return pages.flatMap(page => {
    const start = Math.max(0, range.start - offset), end = Math.min(page.text.length, range.end - offset);
    offset += page.text.length + 1;
    return end > start ? [preparePdfSpeech(page.text.slice(start, end), page)] : [];
  }).join('\n').trim();
}

module.exports = { preparePdfSpeech, preparePdfSelection, uniquePdfRange: uniqueRange };
