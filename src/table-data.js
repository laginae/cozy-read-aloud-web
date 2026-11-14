export function normalizeTableData(value) {
  if (!value || !Array.isArray(value.headers) || !Array.isArray(value.rows)
    || value.headers.length > 200 || value.rows.length > 10000) return null;
  let count = 0, length = 0;
  for (const row of [value.headers, ...value.rows]) {
    if (!Array.isArray(row) || row.length > 200) return null;
    for (const cell of row) {
      if (typeof cell !== 'string' || ++count > 50000 || (length += cell.length) > 250000) return null;
    }
  }
  const caption = typeof value.caption === 'string' ? value.caption : '';
  if (caption.length > 2000) return null;
  return { headers: value.headers.slice(), rows: value.rows.map(row => row.slice()), caption };
}

export function readTableData(table, { readText = node => node.textContent.trim(), isVisible = () => true } = {}) {
  if (table.querySelector('table')) return null;
  const rows = [...table.querySelectorAll('tr')].filter(isVisible);
  if (!rows.length) return null;
  const cells = rows.map(row => [...row.children].filter(cell => ['TH', 'TD'].includes(cell.tagName)));
  if (cells.some(row => row.some(cell => ['colspan', 'rowspan'].some(name => cell.hasAttribute(name) && cell.getAttribute(name) !== '1')))) return null;
  const headers = cells[0].length > 0 && cells[0].every(cell => cell.tagName === 'TH');
  const values = cells.map(row => row.map(cell => isVisible(cell) ? readText(cell) : ''));
  const caption = table.querySelector(':scope > caption');
  return normalizeTableData({ headers: headers ? values[0] : [], rows: headers ? values.slice(1) : values,
    caption: caption && isVisible(caption) ? readText(caption) : '' });
}

export function rangeReadingText(range) {
  const fragment = range.cloneContents(), rows = [...fragment.querySelectorAll('tr')];
  return rows.length ? rows.map(row => [...row.children].filter(cell => ['TH', 'TD'].includes(cell.tagName))
    .map(cell => cell.textContent.trim()).join('; ')).join('\n') : range.toString();
}
