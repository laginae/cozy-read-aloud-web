export const PDF_TEXT_LIMIT = 1_000_000;
export const PDF_ITEMS_PER_PAGE_LIMIT = 50_000;

export function throwIfAborted(signal) {
  if (signal.aborted) throw new DOMException("Import cancelled", "AbortError");
}

// File reads and module imports cannot themselves be aborted. Stop awaiting them
// immediately, but still handle their eventual rejection without continuing work.
export function awaitActive(signal, operation) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Import cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => {
      throwIfAborted(signal);
      return operation();
    }).then(value => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) abort();
      else resolve(value);
    }, error => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) abort();
      else reject(error);
    });
  });
}

export function countPdfText(items, previous = 0) {
  if (!Array.isArray(items) || items.length > PDF_ITEMS_PER_PAGE_LIMIT)
    throw new Error("PDF 单页文字项过多，请先拆分或简化文件。");
  let count = previous;
  for (const item of items) {
    if (typeof item?.str === "string") count += item.str.length;
    if (count > PDF_TEXT_LIMIT)
      throw new Error("PDF 提取文字超过 1,000,000 字符，请先拆分文件。");
  }
  return count;
}
