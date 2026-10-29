# 0.4.0 - On-demand local OCR

- Recognize printed Chinese and English text from PNG/JPEG/WebP images or one scanned PDF page, edit the preview, then read the result or selected text through the existing player.
- OCR is off by default for each browser session. The recognition module and separate OCR resources load only when requested; models are not part of the initial application load.
- Recognition runs in a local worker, with input/raster limits, manual rotation, cancellation and worker cleanup. Backgrounding or closing cancels recognition.
- Keep normal native-text PDF reading, selection controls and audio-export confirmation unchanged.

OCR resources are downloaded from this site's own origin on first use and verified against the build's SHA-256 hash. Images and recognized text are not uploaded by OCR. Online voices still transmit selected recognized text under the existing confirmation. Models can consume substantial memory while running. Formulas, tables, handwriting and complex layouts need manual review; source-image highlighting and searchable-PDF creation are not provided.

Public generated image and scanned-PDF browser checks passed, including narrow-layout and cancellation checks. This is not physical iPhone/iPad/Android certification. No private documents, API keys or captured provider responses are included, and no new paid speech test was performed.

[OCR guide](https://github.com/laginae/cozy-read-aloud-web/blob/0.4.0/docs/local-ocr.md)
