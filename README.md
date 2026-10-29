# Cozy Read Aloud Web

<img src="public/assets/cozy-cat.png" alt="Cozy Read Aloud" width="88">

Read Markdown, text-based PDFs, local HTML and plain text in your browser, without installing Obsidian. Select a passage, listen, and follow its highlight in the original reading view.

**[Open the web app](https://laginae.github.io/cozy-read-aloud-web/)** · [简体中文](README.zh-CN.md) · [Privacy](PRIVACY.md)

## Start Reading

1. Open a file or paste text. The built-in sample is fictional and safe to try.
2. Press Play for the whole document. To read a passage, select text and choose **只读选中内容** (selection only) or **从选中位置继续** (continue from selection).
3. Use the outline to navigate or start at a heading/page. On desktop, the optional reading context menu provides the same selection actions.

Choose English or Chinese in Reading settings. System speech works with voices exposed by your browser/operating system; voice availability and network use vary. No API key is needed for system speech.

## Reading Controls

- Markdown, PDF, HTML and TXT import; paste, drag-and-drop and up to eight open documents.
- PDF text selection and continuation use original text-item positions, including repeated passages. Selections survive zoom changes. No OCR is performed.
- Paragraph/selection highlighting, optional automatic following, outline search and chapter/page playback.
- PDF first-page preview while later pages are extracted. Reading and export wait for the complete document; Stop discards the unfinished import.
- Conservative repeated-header/footer filtering and body/footnotes/both modes. Explicit selection-only reading retains chosen headers and footnotes.
- Source-ordered following within long passages and across columns/pages. Online audio uses approximate position from elapsed audio, not word timestamps; browser speech uses boundary events when available. Manual scrolling suspends following for four seconds.
- Pause, resume, stop, previous/next segment, speed, volume and a sleep timer.
- PDF zoom, text size and dark appearance. Responsive desktop, tablet and phone layouts.
- Academic formula cleanup reuses the existing plugin algorithms. Complex PDF fonts/layouts can still require correction.
- Optional OpenRouter speech with explicit consent, in-memory credentials, mandatory ZDR routing and bounded session audio caching.
- Five-second backward/forward controls for online audio. Native system speech does not expose a seekable audio timeline.
- WAV audio export from the current reading scope, with separate cost confirmation, progress and cancellation. System speech cannot export audio.

## Online Speech and Export

Choose OpenRouter in settings, provide your own model ID, compatible voice ID and API key, then authorize online processing. The displayed example is not a guarantee of provider availability. The browser must be allowed to call the API using CORS. The app does not use a relay server and never embeds a shared key.

Requests include `provider.zdr: true` and `provider.data_collection: deny`. There is no weaker fallback or automatic retry. Account-level logging/sharing settings and provider policies still matter; see [Privacy](PRIVACY.md).

Optional **prepare the next segment** is off by default. When enabled, it prepares only the next segment within your chosen reading scope (at most 500 characters), with at most two requests in flight. It may reduce gaps but can incur charges for text you never listen to. Pausing, backgrounding, changing settings or stopping cancels pending work; requests already received may still be billed. Returning to the foreground does not resume automatically.

The player distinguishes waiting for a request slot, synthesis, receiving audio and preparing playback. After failure, Retry targets the current passage and reuses prepared audio where possible; a new request may incur charges. Settings also provide a local waiting-time summary: playback-event timings and request/cache counters, without text, filenames, model IDs or credentials. These are browser-event measurements, not a recording of audible speaker output.

Export is limited to **40 segments, 8,000 characters and five minutes** per operation. It reuses cached audio where available, otherwise makes sequential speech requests after confirmation. Output is a 1x, mono, 22.05 kHz PCM WAV. Canceling cannot undo charges for requests already sent. The downloaded file stays on your device.

## Current Boundaries

- This is an early web release, not full feature parity with the Obsidian plugins.
- Text files: at most 1 MiB / 250,000 characters. PDFs: at most 30 MiB / 120 pages.
- PDF code loads only when you open a PDF. Extraction is limited to 1,000,000 text characters across the document and 50,000 text-content items on one page. Over-limit documents are refused rather than partially narrated. These are post-extraction bounds, not a guarantee against every resource-heavy file.
- Stop cancels the current import and remaining files in its batch. Opening another file, switching to an existing document, or confirming pasted text prevents an older import from replacing the new document. Preview does not enable incomplete full-document reading or export.
- Scanned/password-protected PDFs, OCR, PDF forms, webpage-URL fetching, direct Copilot access, SAPI/OneCore/Edge executables and offline installation are not included.
- HTML is sanitized into a readable document; scripts, frames, forms, images, styling and external link targets are removed.
- Highlighting is passage-level, not word-synchronized. Complex columns, mathematical fonts and rotated text still need broader testing.
- Backgrounding the page pauses playback. Uninterrupted lock-screen playback is not promised.
- Documents, credentials and audio caches are kept in page memory. Reloading closes the session. Clear the audio cache in settings when needed.
- Remember reading preferences is optional and off by default. Only language, speed/volume, appearance, highlighting/following and reading filters are saved. Keys, documents, online permission, provider/model choices and speculative prefetch are never restored. Uncheck it to delete the saved preferences.

## Run Locally

Node.js 24 or later:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm start
```

Open `http://127.0.0.1:5186`. The server listens only on this computer. Set `PORT` to use another port. PDF workers require HTTP(S), so do not open `index.html` using a `file:` URL.

Browser verification uses only generated public fixtures and mocked online speech:

```sh
npx playwright install chromium
npm run test:browser
```

The test expects the local server to be running. `BASE_URL` selects another deployment; `BROWSER_CHANNEL=msedge` uses installed Edge. GitHub Actions runs tests, builds and deploys only `dist/` to Pages. Test output, documents and credentials are never deployment inputs.

## Related Projects

- [Cozy Read Aloud for Obsidian desktop](https://github.com/laginae/note-reader-cosyvoice)
- [Obsidian mobile reader](https://github.com/laginae/note-reader-mobile)
- [Platform-neutral reader core](https://github.com/laginae/note-reader-core)

Shared source provenance is listed in [VENDORED.md](VENDORED.md). The web adapter is MIT-licensed; bundled third-party code retains its respective licenses. See [validation](VALIDATION.md) for tested and untested boundaries. Report bugs using non-sensitive examples, never private documents or API keys.
