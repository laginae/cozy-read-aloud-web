# Cozy Read Aloud Web 0.4.1

- Add a default-on **Repeat table headers for each row** checkbox, independently of Smart / All / Skip policy. Disable it to announce headings once, followed by row numbers and values; blank cells retain a placeholder.
- Preserve simple Markdown/HTML table structure in the reading queue, using shared Core 0.3.1. Captions and row order stay intact. Nested/merged tables and partial selections fall back conservatively, without invented headers or expanded scope.
- Refresh embedded core/mobile modules with pinned source hashes. Table preferences may be remembered only through existing opt-in preference storage; content, keys and online consent are excluded.
- Browser regression uses public fixtures and intercepted mock audio, including table controls, smart omission, PDF selections and narrow layouts. No paid requests or personal documents are used. Physical mobile/background playback remains unverified.

The Pages app and downloadable static build use the same reviewed source. No private prose, PDFs, credentials, installed settings or diagnostics are published.

## 中文摘要

新增默认开启的“每行重复表头”，关闭后开头读一次表头，再逐行读数据，智能跳过规则不变。可靠的 Markdown／HTML 表格共用核心库 0.3.1；复杂表格和部分选区保守处理，不擅自补表头。偏好保存仍需主动开启，不含正文、密钥或授权。真实语音费用为零，移动后台播放仍未真机验证。
