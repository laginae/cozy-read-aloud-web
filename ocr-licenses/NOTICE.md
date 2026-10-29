# Optional OCR resources

Tesseract.js 7.0.0 and tesseract.js-core retain their included Apache-2.0 licenses. English and Simplified Chinese traineddata are from `@tesseract.js-data/eng` and `@tesseract.js-data/chi_sim` 1.0.0 (`4.0.0_best_int`), published by the naptha/tessdata project. Its upstream traineddata license is included as tessdata-LICENSE.txt; npm package wrappers declare MIT. Upstream: https://github.com/naptha/tessdata and https://github.com/tesseract-ocr/tessdata_best.

The offline worker packaging approach was informed by the MIT-licensed PaperMark project (https://github.com/laginae/papermark). This reader implementation uses its own lifecycle and user interface. No OCR cloud service or automatic image upload is used.
