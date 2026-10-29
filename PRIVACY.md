# Privacy

The app processes imported files and pasted text in browser memory. It does not upload documents to a project server, store them in browser databases, or include analytics. Files, API keys and audio caches are not persisted across reloads.

GitHub serves the public application and may process normal website request metadata. A local development server is available when you do not want to load the application from GitHub Pages. Importing a document does not send that document to GitHub.

System speech uses voices supplied by the browser/operating system. Some voices may use a network service. A voice marked local is reported as local by that browser; this app cannot independently certify the provider's behavior.

Optional OpenRouter speech sends the requested reading segments to OpenRouter and an upstream provider after explicit permission. Requests always include `provider.zdr: true` and `provider.data_collection: deny`. The app does not weaken routing, retry with another provider, or automatically prefetch future text. Account-level logging/sharing settings and provider policy still matter. Secrets are entered by the user and kept in memory; none are distributed with the app.

Audio export requires a second confirmation of the scope and potential cost. Previously cached audio can be reused; other segments require new requests. Canceling aborts remaining work but cannot undo a request already received or its charges. Exported audio is downloaded to your device and is not uploaded by this project.

HTML import removes scripts, forms, images, frames, styling and external targets. PDF files are rendered without interactive scripting or forms. Do not treat content filtering as a guarantee that every untrusted document is safe. Use current browsers and trusted files.

Do not include API keys, private documents, or sensitive screenshots in bug reports. Prefer invented examples; provide browser/device versions and non-sensitive reproduction steps.
