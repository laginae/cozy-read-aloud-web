'use strict';
const { sanitizeAcademicTextForSpeech: cleanMarkdown } = require('@laginae/note-reader-core');
const { academicLatex, academicOptions } = require('./pdf-speech/academic-speech');

function sanitizeAcademicTextForSpeech(text, settings = {}) {
  const options = academicOptions(settings);
  // Use the same formula reader as PDF before the shared Markdown cleanup.
  return cleanMarkdown(academicLatex(String(text ?? ''), options), options);
}

module.exports = { sanitizeAcademicTextForSpeech };
