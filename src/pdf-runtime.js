let runtime;

export function loadPdfRuntime() {
  if (!runtime) {
    runtime = import("pdfjs-dist").then(module => {
      module.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.mjs", location.href).href;
      return module;
    }).catch(() => {
      runtime = null;
      throw new Error("PDF 组件无法加载，请检查连接并刷新页面后重试。");
    });
  }
  return runtime;
}
