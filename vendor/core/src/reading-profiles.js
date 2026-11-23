'use strict';

const LEGACY = Object.freeze({
  academicMathMode: 'smart', academicMathStyle: 'concise', academicIntervalStyle: 'precise',
  academicFunctionStyle: 'of', academicTableMode: 'smart', academicTableRepeatHeaders: true,
});
const EVERYDAY = Object.freeze({ ...LEGACY, academicIntervalStyle: 'natural', academicFunctionStyle: 'auto', academicTableRepeatHeaders: false });
const STUDY = Object.freeze({ ...LEGACY, academicMathStyle: 'verbose' });
const ACADEMIC_DEFAULTS = Object.freeze({ ...EVERYDAY, academicSkipNotice: true });
const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

function readingFields(s, base) {
  return {
    academicMathMode: choice(s.academicMathMode, ['smart','all','skip'], base.academicMathMode),
    academicMathStyle: choice(s.academicMathStyle, ['concise','verbose'], base.academicMathStyle),
    academicIntervalStyle: choice(s.academicIntervalStyle, ['natural','precise','range'], base.academicIntervalStyle),
    academicFunctionStyle: choice(s.academicFunctionStyle, ['auto','of','compact'], base.academicFunctionStyle),
    academicTableMode: choice(s.academicTableMode, ['smart','all','skip'], base.academicTableMode),
    academicTableRepeatHeaders: typeof s.academicTableRepeatHeaders === 'boolean' ? s.academicTableRepeatHeaders : base.academicTableRepeatHeaders,
  };
}

// A saved, unversioned configuration is custom, even when only unrelated fields exist.
// Keep its stored values separate from the effective preset so switching back is lossless.
function storedReadingPreferences(source) {
  const s = source || {};
  const fresh = Object.keys(s).length === 0;
  const readingProfile = choice(s.readingProfile, ['everyday','study','custom'], fresh ? 'everyday' : 'custom');
  return { readingProfile, ...readingFields(s, readingProfile === 'custom' ? LEGACY : EVERYDAY) };
}

function academicOptions(s = {}) {
  const preset = s.readingProfile === 'everyday' ? EVERYDAY : s.readingProfile === 'study' ? STUDY : null;
  const custom = s.readingProfile === 'custom';
  const fields = preset || readingFields(s, custom ? LEGACY : EVERYDAY);
  return {
    ...fields,
    academicTableAdaptiveHeaders: preset ? preset === EVERYDAY : !custom && (s.academicTableAdaptiveHeaders === true
      || (s.academicTableAdaptiveHeaders !== false && typeof s.academicTableRepeatHeaders !== 'boolean')),
    academicSkipNotice: s.academicSkipNotice !== false,
    mathReadingLanguage: choice(s.mathReadingLanguage, ['english','chinese','skip'], 'english'),
  };
}

module.exports = { ACADEMIC_DEFAULTS, storedReadingPreferences, academicOptions };
