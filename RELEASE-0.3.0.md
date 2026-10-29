# 0.3.0

- Load PDF code only when needed, show the first page while later pages are extracted, and bound extraction resources. Playback/export require the complete document. Cancelled or superseded imports release their resources and cannot replace a newer file.
- Add conservative PDF header/footer and footnote choices without silently dropping explicitly selected material.
- Follow long passages in source order, including column/page transitions. Audio timing is approximate, not word-level alignment. Manual scrolling temporarily suspends following.
- Add bounded, optional next-passage preparation, stale-event guards, stage-specific waiting messages, manual current-passage retry and numeric-only local timing summaries.
- Add English/Chinese UI and opt-in non-sensitive reading preferences. Documents, keys and online authorization are never restored.
- Lock reviewed shared source revisions and the public regression corpus. Add browser checks for progressive preview/cancellation, selection, zoom, export, preferences and responsive layouts.

This remains an early browser edition. No real paid API calls were added in this release. Browser tests use invented public fixtures and mocked audio; they do not validate every provider's CORS behavior or physical iOS/iPad/Android compatibility. Background and lock-screen continuity are not guaranteed.
