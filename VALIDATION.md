# Validation: 0.3.0

Date: 2026-10-29. Repository tests use public fixtures and mocked services only. A deployment is current only when its Pages workflow succeeds.

- Public-fixture tests cover partial-document playback refusal, selected header/footnote retention, source-ordered follow targets and strict preference allowlisting.
- Browser tests hold the second PDF page: the first page and its text layer render while playback, outline playback and export remain disabled. Cancelling restores the previous document. Import replacement, worker cleanup and subsequent import continue to work.
- Browser checks exercise automatic left-column-bottom to right-column-top following, PDF selection after zoom, mocked audio/export, five responsive sizes, English settings and opt-in preference reload. Online consent and credentials are not restored.
- System-speech following depends on boundary events. Online following uses elapsed-audio estimates, not forced word alignment. Header/footer and footnote recognition is conservative, not guaranteed for every layout.

- 37 unit tests cover request consent, ZDR, payload/response bounds, generic HTTP errors, stale callback cancellation, pause/resume races, cache behavior, PDF source-item identity, selection continuation, export bounds and WAV encoding. This includes seven shared PDF golden cases, import cancellation/resource limits, and 100 seeded playback sequences (2,000 transitions), not 2,000 independent real-device sessions.
- Edge browser checks cover partial PDF selection, exact highlight geometry, selected text after zoom, continuation in the right column, context-menu reading, outline search, online audio seeking, cached WAV export with separate confirmation, cache/key clearing and five viewport sizes (1440, 1024, 768, 390 and 320 pixels wide).
- The online service is intercepted locally with a fake credential and generated silent WAV. Playback/export tests verify the request body without contacting OpenRouter.
- New browser checks cover single-item PDF pages, default-off bounded prefetch and reuse, numeric-only timing download, scrollable settings at 320px, and emulated touch controls. Screenshots were inspected for mobile/desktop layout; touch emulation is not physical iOS validation.
- Import checks hold the PDF module response or a public file read open, then stop or replace the import. Cancelled batches do not read their next file; an old result cannot replace the new document. Opening ordinary text requests neither the PDF runtime nor its worker; the runtime is reused after its first load.
- Browser checks also observe PDF worker termination after closing a document and after a malformed public PDF fails to load, followed by a successful import.
- The build walks the initial static import graph and rejects accidental PDF-runtime inclusion. It writes byte counts to ignored `output/build-summary.json`. This is a resource-size check, not a network, full startup or first-audio benchmark. Full PDF extraction still precedes playback.
- Prefetch tests cover the two-request ceiling under rapid jumps and ignored cancellation, late response rejection after permission changes, hidden-page pausing, and no automatic retry after a failed speculative request.
- `shared-source-lock.json` pins 24 shared files. `npm test` checks their hashes; `node scripts/check-shared.mjs --upstream` also compares local sibling repositories. Refresh the lock only after reviewing an upstream change; this is not an automatic remote-version updater.
- The earlier 0.1.0 checks also covered Markdown selection, HTML resource sanitization, nonblank PDF canvas, dark appearance and system speech. One browser-reported local voice completed a muted public-sentence test. This is not an audio-quality evaluation.
- `npm test`, `npm run build`, and `npm run test:browser` are reproducible entry points. CI executes them before Pages deployment. Browser screenshots and generated fixtures go to ignored `output/`.

An authorized, separate local acceptance run used six real ZDR requests for 837 public English characters through the shared preparation pool and foreground HTMLAudio in Obsidian. It was not a browser CORS or complete web-app end-to-end test. First-play events took 4.578-6.262 seconds (n=3); two prefetched transitions were 15/24 ms; cached jumps were 25-63 ms (n=3). These very small samples do not establish service-level latency or acoustic speaker timing. Credentials and audio from that run are not repository artifacts.

Not established: physical iPhone/iPad/Android behavior, uninterrupted background playback, real web-provider CORS/voice availability/cost, arbitrary complex PDF layout/font correctness, OCR, or word-level synchronization. Public simple fixtures do not prove universal PDF compatibility.
