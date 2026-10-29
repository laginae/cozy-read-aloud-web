'use strict';
const { parseChunkLimits } = require('@laginae/note-reader-core');
const normalize = (value) => String(value || '').replace(/\r\n?/g, '\n').trim();

function sentenceEnds(text) {
  const parts = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text)]
    : [...text.matchAll(/[\s\S]+?(?:[。！？!?]|\.(?=\s|$)|$)/g)].map((m) => ({ index: m.index, segment: m[0] }));
  return parts.filter(({ segment }) => !/\b(?:Dr|Mr|Mrs|Prof|Fig|Figs|Eq|Eqs|Sec|No|vs|e\.g|i\.e|et al)\.$/i.test(segment.trim()))
    .map(({ index, segment }) => index + segment.trimEnd().length);
}
function cut(text, limit) {
  if (text.length <= limit) return text.length;
  const ends = sentenceEnds(text.slice(0, limit + 256)).filter((end) => end <= limit);
  if (ends.length) return ends[ends.length - 1];
  const prefix = text.slice(0, limit + 1);
  for (const pattern of [/[，,；;：:]\s*/g, /\s+/g]) {
    const ends = [...prefix.matchAll(pattern)].map((m) => m.index + m[0].length).filter((n) => n <= limit);
    if (ends.length) return ends[ends.length - 1];
  }
  // Never split a UTF-16 surrogate pair at a provider's hard limit.
  return /[\uD800-\uDBFF]/.test(text[limit - 1]) && limit > 1 ? limit - 1 : limit;
}
function splitDetailed(text, limits, spans = []) {
  const result = []; let offset = 0;
  while (offset < text.length) {
    const leading = /^\s*/.exec(text.slice(offset))[0].length; offset += leading;
    if (offset >= text.length) break;
    const length = cut(text.slice(offset), limits[Math.min(result.length, limits.length - 1)]);
    result.push({ text: text.slice(offset, offset + length).trim(), metadata: spans.find((s) => s.end > offset)?.metadata });
    offset += length;
  }
  return result;
}
function splitTextForSpeechChunks(text, limits) {
  return splitDetailed(normalize(text), parseChunkLimits(limits)).map((part) => part.text);
}
function continuesSentence(left, right) {
  return left && right && !/[。！？!?。.]["'”’）)]*$/.test(left.trimEnd())
    && !/^(?:#{1,6}\s|\d+(?:\.\d+)*[.)]?\s+[A-Z]|[A-Z][A-Z\s]{5,})/.test(right)
    && /^[a-z\u3400-\u9fff]/.test(right);
}
function createIncrementalSpeechChunker(limits, options = {}) {
  let text = ''; const spans = [];
  return {
    push(value, metadata) {
      const next = normalize(value); if (!next) return [];
      if (text) text += continuesSentence(text, next) ? ' ' : '\n\n';
      text += next; spans.push({ end: text.length, metadata });
      return [];
    },
    finish() {
      const result = splitDetailed(text, parseChunkLimits(limits), spans);
      text = ''; spans.length = 0;
      return options.detailed ? result : result.map((part) => part.text);
    },
  };
}
module.exports = { splitTextForSpeechChunks, createIncrementalSpeechChunker, continuesSentence };
