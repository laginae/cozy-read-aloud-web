import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue, formulaOptions } from '../src/speech-queue.js';
import { normalizeTableData } from '../src/table-data.js';
import { safePreferences } from '../src/preferences.js';
const table = { headers: ['Item', 'Count'], rows: [['Apples', '2'], ['Pears', '3']], caption: 'Public fruit' };
const doc = { blocks: [{ raw: 'Public fruit', kind: 'table', table }] };
const settings = { academic: true, mathMode: 'smart', mathLanguage: 'english', tableMode: 'smart' };
test('web tables repeat by default and announce only one header with the option off', () => {
  assert.equal(formulaOptions(settings, '').academicTableRepeatHeaders, true);
  const normal = buildQueue(doc, settings).map(item => item.text).join(' ');
  const once = buildQueue(doc, { ...settings, academicTableRepeatHeaders: false }).map(item => item.text).join(' ');
  assert.match(normal, /Item: Apples/); assert.doesNotMatch(once, /Item: Apples/);
  assert.match(once, /Table columns: Item; Count/); assert.match(once, /Row 2\. Pears; 3/);
});
test('header switch does not bypass smart skipping or explicit selection bounds', () => {
  const long = { ...table, rows: Array.from({ length: 8 }, (_, i) => ['R' + i, '' + i, '' + (i + 10)]) };
  for (const academicTableRepeatHeaders of [true, false]) {
    assert.doesNotMatch(buildQueue({ blocks: [{ raw: '', table: long }] }, { ...settings, academicTableRepeatHeaders }).map(x => x.text).join(' '), /R7/);
    assert.match(buildQueue({ blocks: [{ raw: '', table: long }] }, { ...settings, tableMode: 'all', academicTableRepeatHeaders }).map(x => x.text).join(' '), /R7/);
    const selected = buildQueue({ blocks: [{ raw: 'Apples', table, explicitSelection: true }] }, { ...settings, academicTableRepeatHeaders });
    assert.equal(selected.map(x => x.text).join(' '), 'Apples');
  }
});
test('table metadata is bounded, copied and excludes unknown fields', () => {
  const copy = normalizeTableData({ ...table, key: 'synthetic-placeholder' });
  assert.deepEqual(copy, table); assert.notEqual(copy.rows, table.rows);
  assert.equal(normalizeTableData({ headers: ['x'], rows: [[{}]] }), null);
  assert.equal(normalizeTableData({ headers: ['x'], rows: [['x'.repeat(250001)]] }), null);
  assert.equal(normalizeTableData({ headers: Array(201).fill('x'), rows: [] }), null);
});
test('only harmless table preferences can persist', () => {
  assert.deepEqual(safePreferences({ academicTableRepeatHeaders: false, tableMode: 'all', key: 'synthetic-placeholder', text: 'Never save this' }),
    { tableMode: 'all', academicTableRepeatHeaders: false });
});
