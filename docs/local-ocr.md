# Optional Local OCR / 可选本机 OCR

OCR is off by default. Enable it in settings, use the scan icon, and open a PDF, PNG, JPEG or WebP. Recognize one page, edit the result, then read all or selected text. Importing an image through Open file also uses this window. OCR results become a normal text reading document, supporting text selection, text-view highlighting and existing online audio export after its usual consent/limits. This does not add a PDF text layer or source-image highlighting.

OCR 默认关闭。在设置中启用，点击扫描图标并打开 PDF、PNG、JPEG 或 WebP。每次只识别指定单页，校对后朗读全部结果或选中文字。识别后的文本进入普通文字阅读视图，可选中、高亮；音频导出仍需使用支持导出的在线引擎并确认范围与费用，不会生成带文字层的 PDF 或原图高亮。

## Resources and Privacy

- Tesseract.js 7.0.0; English and Simplified Chinese integer models. One worker, maximum 3 million raster pixels. Supported image files: 12 MB / 16 megapixels before decoding; PDFs: 30 MB; OCR output: 100,000 characters. Animated images use the first frame only.
- Worker/model pack is a separate approximately 10 MB same-origin static asset, not initial page JavaScript. SHA-256 is pinned in the build before any worker code runs. The worker accepts bundled models only and rejects network/script downloads.
- Recognition starts only after the user clicks Recognize. Closing, cancellation or backgrounding cancels work; workers and page canvases are released. No disk OCR cache is written by the app. The browser may cache downloaded **public model assets**, not recognized text.
- Images and PDFs stay local. Online speech is separate and sends the selected OCR text with existing consent/ZDR settings. No OCR API or fallback upload is used. Original files remain untouched.
- OCR may corrupt formulas, dense text, handwriting, tables and column order. Review results. It is not image description, chart interpretation, equation reconstruction or an accuracy guarantee. Rotated pages can be adjusted in the form.
- Browser real-recognition tests use invented public text. A narrow viewport simulation is **not** an iPhone/iPad/Android physical-device test.

`npm run build` creates `dist/ocr-assets` from locked development dependencies. Preserve its `licenses/` and manifest in distribution. The main page does not fetch this pack until OCR is requested. On mobile Obsidian, the same recognition implementation uses a manually installed local resource pack, defaults off, is limited to one page and 1.5 million raster pixels, and remains experimental.
