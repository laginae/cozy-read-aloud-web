# Validation: 0.2.0

Date: 2026-10-29. Public test fixtures only; no personal documents or paid API calls.

- 16 unit tests cover request consent, ZDR, payload/response bounds, generic HTTP errors, stale callback cancellation, pause/resume races, cache behavior, PDF source-item identity, selection continuation, export bounds and WAV encoding.
- Edge browser checks cover partial PDF selection, exact highlight geometry, selected text after zoom, continuation in the right column, context-menu reading, outline search, online audio seeking, cached WAV export with separate confirmation, cache/key clearing and five viewport sizes (1440, 1024, 768, 390 and 320 pixels wide).
- The online service is intercepted locally with a fake credential and generated silent WAV. Playback/export tests verify the request body without contacting OpenRouter.
- The earlier 0.1.0 checks also covered Markdown selection, HTML resource sanitization, nonblank PDF canvas, dark appearance and system speech. One browser-reported local voice completed a muted public-sentence test. This is not an audio-quality evaluation.
- `npm test`, `npm run build`, and `npm run test:browser` are reproducible entry points. CI executes them before Pages deployment. Browser screenshots and generated fixtures go to ignored `output/`.

Not established: physical iPhone/iPad/Android behavior, uninterrupted background playback, real provider CORS/voice availability/cost, arbitrary complex PDF layout/font correctness, OCR, or word-level synchronization. Public simple fixtures do not prove universal PDF compatibility.
