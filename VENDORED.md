# Shared reader source

The browser prototype reuses the platform-neutral reader core and selected browser-compatible speech modules. These snapshots are copied unchanged, not separate reimplementations. Update them together from upstream; do not patch the snapshots independently.

- `vendor/core`: `@laginae/note-reader-core`, public commit `42ab4760e88fd745bc239c1086d453bde89b1017`, MIT. Includes its license.
- `vendor/mobile`: speech cleanup, sentence chunking and PDF formula normalization from `laginae/note-reader-mobile`, public commit `8078185e375fcd298fead377353108cbc7865bd4`, MIT. Includes its license.
- `public/assets/cozy-cat.png`: existing Cozy Read Aloud project mark, reused from the public desktop plugin. No private document or screenshot assets are used.

The web adapter owns local file import, safe DOM rendering, browser playback and explicit online consent. Obsidian APIs, saved credentials, vault content and desktop executables are not bundled.
