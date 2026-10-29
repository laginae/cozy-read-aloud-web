import speechText from "../vendor/mobile/speech-text.js";
import chunker from "../vendor/mobile/sentence-chunker.js";
import pdfSpeech from "../vendor/mobile/pdf-speech.js";
import pdfMath from "../vendor/mobile/pdf-speech/pdf-math.js";

export function formulaOptions(settings, text) {
  return {
    academicMathMode: settings.academic ? settings.mathMode : "all",
    academicMathStyle: settings.mathMode === "all" ? "verbose" : "concise",
    academicSkipNotice: true,
    mathReadingLanguage: settings.mathLanguage === "auto"
      ? /[\u3400-\u9fff]/.test(text) ? "chinese" : "english"
      : settings.mathLanguage,
  };
}
export function buildQueue(doc, settings) {
  if (doc.complete === false) return [];
  return queueBlocks(doc, doc.blocks.map((block, index) => ({ ...block, index })), settings);
}
export function queueBlocks(doc, blocks, settings) {
  const pageOptions = new Map();
  return blocks.flatMap(block => {
    if (settings.academic && block.kind === "code") return [];
    let raw = block.raw, rects = block.rects;
    if (block.pageData && !block.explicitSelection && block.lines?.length) {
      const lines = block.lines.filter(line => !(settings.skipHeaders !== false && line.runningHeader)
        && (settings.footnoteMode === "inline" || (settings.footnoteMode === "footnotes" ? line.footnote : !line.footnote)));
      if (!lines.length) return [];
      if (lines.length !== block.lines.length) {
        raw = lines.map(line => line.text).join("\n").replace(/([A-Za-z])-\n(?=[a-z])/g, "$1");
        rects = lines.map(line => block.rects[block.lines.indexOf(line)]);
      }
    }
    const options = formulaOptions(settings, doc.languageText || raw);
    if (block.pageData && settings.academic) {
      const p = block.pageData;
      if (!pageOptions.has(p)) pageOptions.set(p, { ...p, mathChanges: pdfMath.pdfMathChanges(p.layout, p.items, options, p.fonts) });
      raw = pdfSpeech.preparePdfSpeech(raw, pageOptions.get(p));
    }
    const clean = speechText.sanitizeAcademicTextForSpeech(raw, options);
    const chunks = chunker.splitTextForSpeechChunks(clean, [240]).filter(Boolean);
    let offset = 0;
    return chunks.map(text => {
      const start = offset / Math.max(1, clean.length);
      offset += text.length;
      const end = Math.min(1, offset / Math.max(1, clean.length));
      // Geometry remains source ordered; transformed formulas do not provide word timestamps.
      const partRects = rects?.slice(Math.floor(start * rects.length), Math.max(Math.floor(start * rects.length) + 1, Math.ceil(end * rects.length)));
      return { text, block: block.index, targets: [block.index], rects: partRects,
        sourceStart: start, sourceEnd: end };
    });
  });
}
