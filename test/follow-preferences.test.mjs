import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followTarget, followDelta } from '../src/follow.js';
import { safePreferences, readPreferences, writePreferences } from '../src/preferences.js';
test('following respects source order across columns and page boundaries', () => {
  const lines = [{ left: 20, right: 200, top: 900, bottom: 920 }, { left: 320, right: 500, top: 20, bottom: 40 }, { left: 20, right: 200, top: 1300, bottom: 1320 }];
  assert.equal(followTarget(lines, 0).top, 900);
  assert.equal(followTarget(lines, .5).top, 20);
  assert.equal(followTarget(lines, 1).top, 1300);
  assert.deepEqual(followDelta(lines[0], { top: 0, bottom: 700, left: 0, right: 700 }), { x: -8, y: 872 });
});
test('preferences never include content, credentials, online consent or speculative requests', () => {
  const result = safePreferences({ language: 'en', key: 'fake-key', text: 'private fixture', consent: true, prefetch: true, model: 'x', speed: 1.5, volume: 99, highlight: false });
  assert.deepEqual(result, { language: 'en', highlight: false, speed: 1.5 });
  let value = null;
  const store = { getItem: () => value, setItem: (key, v) => value = v, removeItem: () => value = null };
  assert.deepEqual(readPreferences(store), {});
  writePreferences(store, true, result); assert.equal(readPreferences(store).language, 'en');
  writePreferences(store, false, result); assert.equal(value, null);
  value = '{broken'; assert.deepEqual(readPreferences(store), {});
});
