# Shared reader source

The browser prototype reuses the platform-neutral reader core and selected browser-compatible speech modules. Update them together from upstream; do not patch the snapshots independently. `shared-source-lock.json` records each source and hash, including unreleased synchronized changes; `npm test` checks integrity. With sibling repositories available, run `node scripts/check-shared.mjs --upstream` to detect local drift. Refresh the lock only after reviewing and synchronizing the changes.

- `vendor/core`: `@laginae/note-reader-core` 0.4.1, commit `5c34f7518db51a5899f65a213e44b209103fcc94` (MIT). Includes its license and public regression fixtures.
- `vendor/mobile`: PDF outline detection, math reading, footnote and header rules, and speech preparation from `laginae/note-reader-mobile` 0.9.1, commit `6198b94e2c636658f915fb0bf66423ec0a1dd63d` (MIT).
- `public/assets/cozy-cat.png`: existing Cozy Read Aloud project mark, reused from the public desktop plugin. No private document or screenshot assets are used.

The web adapter owns local file import, safe DOM rendering, browser playback and explicit online consent. Obsidian APIs, saved credentials, vault content and desktop executables are not bundled.

All bundled shared changes are tied to the source revisions above. Formula/source-range patches are included in the mobile revision, not represented as part of an older release. The lock also records the exact hashes checked during build validation.
