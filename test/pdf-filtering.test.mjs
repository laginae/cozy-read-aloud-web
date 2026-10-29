import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue, queueBlocks } from '../src/speech-queue.js';
const settings = { academic: false, mathLanguage: 'english', mathMode: 'smart', skipHeaders: true, footnoteMode: 'body' };
function fixture() {
  const lines = [
    { text: 'Public sample running header.', runningHeader: true },
    { text: 'The garden path is open today.' },
    { text: '1 Public sample footnote.', footnote: true },
  ];
  const pageData = { layout: { lines } };
  return { blocks: lines.map((line, i) => ({ raw: line.text, lines: [line], pageData, rects: [[0, i * 20, 200, i * 20 + 10]] })) };
}
test('full PDF uses header and footnote choices, but explicit selection keeps chosen text', () => {
  const doc = fixture();
  assert.equal(buildQueue(doc, settings).map(i => i.text).join(' '), 'The garden path is open today.');
  assert.equal(buildQueue(doc, { ...settings, footnoteMode: 'footnotes' })[0].text, '1 Public sample footnote.');
  assert.equal(buildQueue(doc, { ...settings, skipHeaders: false, footnoteMode: 'inline' }).length, 3);
  const selected = doc.blocks.map((b, index) => ({ ...b, index, explicitSelection: true }));
  assert.equal(queueBlocks(doc, selected, settings).length, 3);
});
test('partial PDF is not offered as a complete reading queue', () => {
  assert.deepEqual(buildQueue({ ...fixture(), complete: false }, settings), []);
});
