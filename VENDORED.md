# Shared reader source

The browser prototype reuses the platform-neutral reader core and selected browser-compatible speech modules. Update them together from upstream; do not patch the snapshots independently. `shared-source-lock.json` records each source and hash, including unreleased synchronized changes; `npm test` checks integrity. With sibling repositories available, run `node scripts/check-shared.mjs --upstream` to detect local drift. Refresh the lock only after reviewing and synchronizing the changes.

- `vendor/core`: `@laginae/note-reader-core` 0.2.3, public commit `e2f9b110f85377cce59f6bb5727dc836e0f5fd4b`, MIT. Includes its license and invented regression corpus.
- `vendor/mobile`: speech cleanup, sentence chunking, PDF formula normalization, header/footer and footnote rules, bounded preparation pool and numeric playback timings from `laginae/note-reader-mobile` 0.4.2, commit `dc1923cbeaba25f6e45d622ec3bc381eb8237f9f`, MIT. Includes its license.
- `public/assets/cozy-cat.png`: existing Cozy Read Aloud project mark, reused from the public desktop plugin. No private document or screenshot assets are used.

The web adapter owns local file import, safe DOM rendering, browser playback and explicit online consent. Obsidian APIs, saved credentials, vault content and desktop executables are not bundled.

All bundled shared changes are tied to the source revisions above. Formula/source-range patches are included in the mobile revision, not represented as part of an older release. The lock also records the exact hashes checked during build validation.
