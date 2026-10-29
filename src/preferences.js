export const PREFERENCE_KEY = 'cozy-reading-preferences-v1';
const enums = { language: ['zh-CN', 'en'], mathMode: ['smart', 'skip', 'all'],
  mathLanguage: ['auto', 'chinese', 'english'], footnoteMode: ['body', 'inline', 'footnotes'] };
const booleans = ['academic', 'skipHeaders', 'highlight', 'follow', 'dark', 'contextMenu'];
export function safePreferences(input = {}) {
  const out = {};
  for (const [key, options] of Object.entries(enums)) if (options.includes(input[key])) out[key] = input[key];
  for (const key of booleans) if (typeof input[key] === 'boolean') out[key] = input[key];
  for (const [key, min, max] of [['speed', .75, 2], ['volume', 0, 1], ['fontSize', 14, 28]])
    if (typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= min && input[key] <= max) out[key] = input[key];
  return out;
}
export function readPreferences(storage) {
  try {
    const saved = JSON.parse(storage.getItem(PREFERENCE_KEY));
    return saved?.enabled === true ? { enabled: true, ...safePreferences(saved.values) } : {};
  } catch { return {}; }
}
export function writePreferences(storage, enabled, values) {
  try {
    if (enabled) storage.setItem(PREFERENCE_KEY, JSON.stringify({ enabled: true, values: safePreferences(values) }));
    else storage.removeItem(PREFERENCE_KEY);
    return true;
  } catch { return false; }
}
