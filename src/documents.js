import { marked } from "marked";
import DOMPurify from "dompurify";
import { getDocument, GlobalWorkerOptions, TextLayer } from "pdfjs-dist";
import core from "@laginae/note-reader-core";
import speechText from "../vendor/mobile/speech-text.js";
import chunker from "../vendor/mobile/sentence-chunker.js";
import pdfSpeech from "../vendor/mobile/pdf-speech.js";
import pdfMath from "../vendor/mobile/pdf-speech/pdf-math.js";
import { mapPdfItems, selectedPdfBlocks } from "./pdf-selection.js";
GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.mjs", location.href).href;
const tags = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "div",
  "section",
  "article",
  "span",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "sub",
  "sup",
  "blockquote",
  "ul",
  "ol",
  "li",
  "pre",
  "code",
  "hr",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "a",
];
let serial = 0;
export function viewportRectangle(viewport, rect) {
  return [
    ...viewport.convertToViewportPoint(rect[0], rect[1]),
    ...viewport.convertToViewportPoint(rect[2], rect[3]),
  ];
}
export const SAMPLE = `# 清晨散步\n\n把脚步放慢一些，日常也会露出新的轮廓。\n\n## 出门之前\n\n清晨的街道还很安静。窗外的光落在桌面上，一杯热茶正慢慢散去水汽。今天没有需要赶上的车，也没有必须走完的路线。穿上一双舒服的鞋，就可以出门了。\n\n沿着熟悉的小路走，先不急着寻找目的地。看看路边的树影，听听远处传来的声音。有时候，注意一件很小的事，就足以让心情发生变化。\n\n## 在河边停一会儿\n\n河水把天空的颜色带到桥下。有人扶着栏杆看水，有人坐在长椅上读书。每个人都拥有自己的速度，我们不必把一天走成同一种节奏。\n\n> 停下来并不是错过，而是给正在发生的事留一点空间。\n\n继续向前时，可以换一条没走过的路。一家刚开门的小店，一扇贴着手写便签的窗，都可能成为今天记住的片段。\n\n## 带着发现回家\n\n回程的路并不比来时更短，但熟悉的景色似乎有了不同的层次。把刚才看到的一两件事写下来，不必写得完整，也不必找到结论。\n\n日子里的片刻安静，不需要特别的准备。下次走出门时，也许可以把手机留在口袋里，再多看一眼身边的世界。`;
export function formulaOptions(settings, text) {
  return {
    academicMathMode: settings.academic ? settings.mathMode : "all",
    academicMathStyle: settings.mathMode === "all" ? "verbose" : "concise",
    academicSkipNotice: true,
    mathReadingLanguage:
      settings.mathLanguage === "auto"
        ? /[\u3400-\u9fff]/.test(text)
          ? "chinese"
          : "english"
        : settings.mathLanguage,
  };
}
export function sanitizedFragment(source, markdown = false) {
  return DOMPurify.sanitize(
    markdown ? marked.parse(source, { gfm: true, breaks: false }) : source,
    {
      ALLOWED_TAGS: tags,
      ALLOWED_ATTR: [],
      FORBID_CONTENTS: [
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "svg",
        "math",
        "nav",
        "footer",
        "form",
        "button",
        "select",
        "textarea",
        "template",
        "noscript",
      ],
      RETURN_DOM_FRAGMENT: true,
    },
  );
}
export function textDocument(source, name = "未命名文字", kind = "md") {
  if (source.length > 250000)
    throw new Error("文本超过 250,000 字符，请分成较小文件。");
  const root = document.createElement("article");
  root.className = "prose";
  if (kind === "txt") {
    for (const text of source.split(/\n\s*\n/)) {
      const p = document.createElement("p");
      p.textContent = text;
      root.append(p);
    }
  } else root.append(sanitizedFragment(source, kind === "md"));
  const selector =
    "h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,td,th,div,section,article";
  // Preserve text beside nested blocks, such as a list label before a child list.
  for (const container of [
    root,
    ...root.querySelectorAll("div,section,article,li,blockquote,td,th"),
  ].reverse()) {
    let inline = [];
    const flush = () => {
      if (inline.some((n) => n.textContent.trim())) {
        const p = document.createElement("p");
        container.insertBefore(p, inline[0]);
        p.append(...inline);
      }
      inline = [];
    };
    for (const node of [...container.childNodes]) {
      if (node.nodeType === 1 && node.matches(selector + ",ul,ol,table,hr"))
        flush();
      else inline.push(node);
    }
    flush();
  }
  let elements = [...root.querySelectorAll(selector)].filter(
    (el) => !el.querySelector(selector) && el.textContent.trim(),
  );
  if (!elements.length && root.textContent.trim()) {
    const p = document.createElement("p");
    p.textContent = root.textContent;
    root.replaceChildren(p);
    elements = [p];
  }
  const id = "doc-" + ++serial,
    blocks = elements.map((el, i) => {
      el.classList.add("read-block");
      el.dataset.block = String(i);
      return {
        raw: el.textContent.trim(),
        el,
        kind: el.tagName === "PRE" ? "code" : "text",
      };
    });
  const outline = blocks.flatMap((b, i) =>
    /^H[1-6]$/.test(b.el.tagName)
      ? [{ title: b.raw, level: Number(b.el.tagName[1]), block: i, el: b.el }]
      : [],
  );
  return {
    id,
    name,
    kind,
    root,
    blocks,
    outline,
    dispose() {
      root.remove();
    },
  };
}
export function buildQueue(doc, settings) {
  return queueBlocks(
    doc,
    doc.blocks.map((block, index) => ({ ...block, index })),
    settings,
  );
}
function queueBlocks(doc, blocks, settings) {
  const pageOptions = new Map();
  return blocks.flatMap((block) => {
    const index = block.index;
    if (settings.academic && block.kind === "code") return [];
    let raw = block.raw;
    const options = formulaOptions(settings, doc.languageText || raw);
    if (block.pageData && settings.academic) {
      const p = block.pageData;
      if (!pageOptions.has(p))
        pageOptions.set(p, {
          ...p,
          mathChanges: pdfMath.pdfMathChanges(
            p.layout,
            p.items,
            options,
            p.fonts,
          ),
        });
      raw = pdfSpeech.preparePdfSpeech(raw, pageOptions.get(p));
    }
    const clean = speechText.sanitizeAcademicTextForSpeech(raw, options);
    return chunker
      .splitTextForSpeechChunks(clean, [240])
      .filter(Boolean)
      .map((text) => ({
        text,
        block: index,
        targets: [index],
        rects: block.rects,
      }));
  });
}
export function selectionQueue(doc, snapshot, settings, from = false) {
  if (!snapshot?.text?.trim()) throw new Error("请先在正文中选中文字。");
  if (doc.kind === "pdf")
    return queueBlocks(doc, selectedPdfBlocks(doc, snapshot, from), settings);
  const range = snapshot.range,
    indices = doc.blocks.flatMap((b, i) =>
      range.intersectsNode(b.el) ? [i] : [],
    );
  if (!indices.length) throw new Error("选区已失效，请重新选择。");
  const selected = [];
  for (const i of indices) {
    const b = doc.blocks[i],
      part = document.createRange();
    part.selectNodeContents(b.el);
    if (b.el.contains(range.startContainer))
      part.setStart(range.startContainer, range.startOffset);
    if (b.el.contains(range.endContainer))
      part.setEnd(range.endContainer, range.endOffset);
    selected.push({ raw: part.toString(), index: i });
  }
  if (from) {
    const first = indices[0],
      b = doc.blocks[first],
      part = document.createRange();
    part.selectNodeContents(b.el);
    if (b.el.contains(range.startContainer))
      part.setStart(range.startContainer, range.startOffset);
    selected.splice(
      0,
      selected.length,
      { raw: part.toString(), index: first },
      ...doc.blocks
        .slice(first + 1)
        .map((b, j) => ({ raw: b.raw, index: first + 1 + j })),
    );
  }
  return selected.flatMap((b) =>
    chunker
      .splitTextForSpeechChunks(
        speechText.sanitizeAcademicTextForSpeech(
          b.raw,
          formulaOptions(settings, b.raw),
        ),
        [240],
      )
      .filter(Boolean)
      .map((text) => ({ text, block: b.index, targets: [b.index] })),
  );
}
export async function readFile(file, signal, onprogress = () => {}) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["md", "markdown", "txt", "html", "htm", "pdf"].includes(ext))
    throw new Error("仅支持 Markdown、PDF、HTML 和 TXT 文件。");
  if (file.size > (ext === "pdf" ? 30 * 1024 * 1024 : 1024 * 1024))
    throw new Error("文件过大。PDF 上限 30 MiB，文本文件上限 1 MiB。");
  if (ext !== "pdf")
    return textDocument(
      await file.text(),
      file.name,
      ["html", "htm"].includes(ext) ? "html" : ext === "txt" ? "txt" : "md",
    );
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    cMapUrl: new URL("./cmaps/", location.href).href,
    cMapPacked: true,
    standardFontDataUrl: new URL("./standard_fonts/", location.href).href,
    wasmUrl: new URL("./wasm/", location.href).href,
  });
  const abort = () => {
    void task.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  let pdf;
  try {
    pdf = await task.promise;
    if (pdf.numPages > 120) throw new Error("PDF 超过 120 页，请先拆分。");
    const root = document.createElement("article");
    root.className = "pdf-pages";
    const doc = {
      id: "doc-" + ++serial,
      name: file.name,
      kind: "pdf",
      root,
      blocks: [],
      outline: [],
      pages: [],
      pdf,
      languageText: "",
      observer: null,
    };
    for (let number = 1; number <= pdf.numPages; number++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      onprogress(number, pdf.numPages);
      const page = await pdf.getPage(number),
        content = await page.getTextContent(),
        viewport = page.getViewport({ scale: 1 });
      const layout = core.extractPdfTextLayout(content.items, { viewport });
      const fonts = pdfMath.pdfFontNames(page, content.items);
      const pageData = {
        pageNumber: number,
        text: layout.text,
        layout,
        items: content.items,
        fonts,
      };
      doc.pages.push(pageData);
      const box = document.createElement("section");
      box.className = "pdf-page";
      box.style.aspectRatio = `${viewport.width}/${viewport.height}`;
      box.style.width = `${viewport.width}px`;
      box.setAttribute("aria-label", `第 ${number} 页`);
      const loading = document.createElement("div");
      loading.className = "pdf-loading";
      loading.textContent = `第 ${number} 页`;
      box.append(loading);
      root.append(box);
      const label = document.createElement("p");
      label.className = "pdf-label";
      label.textContent = `${number} / ${pdf.numPages}`;
      root.append(label);
      const sizes = content.items
          .map((i) => Math.abs(i.height || 0))
          .filter((n) => n > 0)
          .sort((a, b) => a - b),
        lineHeight = sizes[Math.floor(sizes.length / 2)] || 12;
      let group = [];
      const flush = () => {
        if (!group.length) return;
        const lines = group;
        group = [];
        doc.blocks.push({
          raw: lines
            .map((l) => l.text)
            .join("\n")
            .replace(/([a-z])-\n(?=[a-z])/g, "$1")
            .replace(/\n/g, " "),
          pageData,
          page: number,
          el: box,
          lines,
          rects: lines.map((l) => [
            l.xMin,
            l.y - lineHeight * 0.2,
            l.xMax,
            l.y + lineHeight,
          ]),
        });
      };
      for (const line of layout.lines) {
        const previous = group.at(-1);
        if (
          previous &&
          (Math.abs(previous.xMin - line.xMin) > 50 ||
            previous.y - line.y > lineHeight * 2 ||
            line.y > previous.y + lineHeight)
        )
          flush();
        group.push(line);
        if (
          /[。.!?！？]$/.test(line.text) ||
          group.map((l) => l.text).join("").length > 420
        )
          flush();
      }
      flush();
      mapPdfItems(doc, pageData);
      if (!doc.languageText) doc.languageText = layout.text;
      pageData.box = box;
      pageData.content = content;
      pageData.page = page;
      doc.outline.push({
        title: `第 ${number} 页`,
        level: 1,
        block: Math.max(
          0,
          doc.blocks.findIndex((b) => b.page === number),
        ),
        el: box,
      });
    }
    if (!doc.blocks.some((b) => b.raw.trim()))
      throw new Error("此 PDF 没有可提取文字，可能需要先进行 OCR。");
    const bookmarks = await pdf.getOutline();
    if (bookmarks?.length) {
      const items = [];
      const visit = async (nodes, level = 1) => {
        for (const node of nodes.slice(0, 300)) {
          try {
            const dest =
              typeof node.dest === "string"
                ? await pdf.getDestination(node.dest)
                : node.dest;
            if (dest) {
              const pageIndex =
                typeof dest[0] === "object"
                  ? await pdf.getPageIndex(dest[0])
                  : dest[0];
              const data = doc.pages[pageIndex];
              if (data)
                items.push({
                  title: node.title,
                  level: Math.min(level, 4),
                  block: Math.max(
                    0,
                    doc.blocks.findIndex((b) => b.page === pageIndex + 1),
                  ),
                  el: data.box,
                });
            }
          } catch {}
          if (node.items?.length && level < 4)
            await visit(node.items, level + 1);
        }
      };
      await visit(bookmarks);
      if (items.length) doc.outline = items;
    }
    doc.dispose = () => {
      doc.epoch = (doc.epoch || 0) + 1;
      doc.observer?.disconnect();
      for (const p of doc.pages) {
        p.renderTask?.cancel();
        p.textLayer?.cancel();
      }
      root.remove();
      void task.destroy();
    };
    return doc;
  } catch (error) {
    await task.destroy();
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
export function renderPdf(doc, reader, onrender, onerror) {
  if (doc.width !== reader.clientWidth || doc.renderZoom !== (doc.zoom || 1)) {
    doc.width = reader.clientWidth;
    doc.renderZoom = doc.zoom || 1;
    doc.epoch = (doc.epoch || 0) + 1;
    doc.renderedPages = [];
    for (const p of doc.pages) {
      p.renderTask?.cancel();
      p.textLayer?.cancel();
      p.rendered = false;
      p.rendering = false;
      p.viewport = null;
      p.overlay = null;
      p.box.replaceChildren();
      p.box.style.width = `${p.page.getViewport({ scale: 1 }).width}px`;
      p.box.style.height = "";
    }
  }
  const draw = async (p) => {
    if (p.rendering || p.rendered) return;
    p.rendering = true;
    const epoch = doc.epoch;
    try {
      const padding = getComputedStyle(doc.root),
        available =
          reader.clientWidth -
          parseFloat(padding.paddingLeft) -
          parseFloat(padding.paddingRight);
      const scale =
          Math.min(1.5, available / p.page.getViewport({ scale: 1 }).width) *
          (doc.zoom || 1),
        viewport = p.page.getViewport({ scale: Math.max(0.2, scale) }),
        ratio = Math.min(2, devicePixelRatio || 1);
      p.viewport = viewport;
      p.box.style.width = `${viewport.width}px`;
      p.box.style.height = `${viewport.height}px`;
      p.box.style.setProperty("--total-scale-factor", viewport.scale);
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      const text = document.createElement("div");
      text.className = "textLayer";
      text.style.setProperty("--scale-factor", viewport.scale);
      const overlay = document.createElement("div");
      overlay.className = "pdf-overlay";
      overlay.setAttribute("aria-hidden", "true");
      p.box.replaceChildren(canvas, text, overlay);
      p.overlay = overlay;
      p.renderTask = p.page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
        transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
      });
      await p.renderTask.promise;
      if (epoch !== doc.epoch) return;
      p.textLayer = new TextLayer({
        textContentSource: p.content,
        container: text,
        viewport,
      });
      await p.textLayer.render();
      if (epoch !== doc.epoch) return;
      const textItems = p.items
        .map((item, index) => ({ item, index }))
        .filter((r) => typeof r.item.str === "string");
      p.textLayer.textDivs.forEach((span, index) => {
        if (textItems[index])
          span.dataset.pdfItem = String(textItems[index].index);
      });
      p.rendered = true;
      doc.renderedPages.push(p);
      // Retain only a small page window; long PDFs must not accumulate canvases.
      while (doc.renderedPages.length > 4) {
        const old = doc.renderedPages.shift();
        old.textLayer?.cancel();
        old.box.replaceChildren();
        old.rendered = false;
        old.overlay = null;
      }
      onrender();
    } catch (error) {
      if (
        epoch === doc.epoch &&
        error.name !== "RenderingCancelledException" &&
        doc.root.isConnected
      )
        onerror("PDF 页面渲染失败，请重新打开该文件。");
    } finally {
      if (epoch === doc.epoch) p.rendering = false;
    }
  };
  doc.observer?.disconnect();
  doc.observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          const p = doc.pages.find((p) => p.box === e.target);
          if (p) void draw(p);
        }
    },
    { root: reader, rootMargin: "300px" },
  );
  for (const p of doc.pages) doc.observer.observe(p.box);
}
