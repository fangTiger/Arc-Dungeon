export function initialPanelSelection(rows, preferredIndex = 0) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  if (normalizedRows.length === 0) {
    return -1;
  }

  const preferred = clampIndex(preferredIndex, normalizedRows.length);
  if (isSelectable(normalizedRows[preferred])) {
    return preferred;
  }

  return findNextSelectable(normalizedRows, preferred, 1) ?? 0;
}

export function movePanelSelection(rows, selectedIndex, direction) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  if (normalizedRows.length === 0) {
    return -1;
  }

  const start = clampIndex(selectedIndex, normalizedRows.length);
  const step = direction < 0 ? -1 : 1;
  return findNextSelectable(normalizedRows, start, step) ?? start;
}

export function adjustPanelValue(rows, selectedIndex, direction) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const row = normalizedRows[selectedIndex];

  if (!row || row.kind !== "value" || row.disabled === true) {
    return { rows, changed: false, value: undefined };
  }

  const step = Number.isFinite(row.step) ? row.step : 1;
  const min = Number.isFinite(row.min) ? row.min : Number.NEGATIVE_INFINITY;
  const max = Number.isFinite(row.max) ? row.max : Number.POSITIVE_INFINITY;
  const current = Number.isFinite(row.value) ? row.value : min;
  const nextValue = clamp(current + (direction < 0 ? -step : step), min, max);

  if (nextValue === current) {
    return { rows, changed: false, value: current };
  }

  const nextRows = normalizedRows.map((candidate, index) =>
    index === selectedIndex ? { ...candidate, value: nextValue } : candidate,
  );

  return { rows: nextRows, changed: true, value: nextValue };
}

export function getShortcutRowIndex(rows, shortcut) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const index = normalizedRows.findIndex((row) => row.shortcut === shortcut);
  return index >= 0 ? index : null;
}

export function isSelectable(row) {
  return Boolean(row) && row.selectable !== false && row.disabled !== true;
}

function findNextSelectable(rows, selectedIndex, direction) {
  for (let offset = 1; offset <= rows.length; offset += 1) {
    const index = modulo(selectedIndex + direction * offset, rows.length);
    if (isSelectable(rows[index])) {
      return index;
    }
  }

  return null;
}

function clampIndex(index, length) {
  return Math.max(0, Math.min(length - 1, Math.floor(Number(index) || 0)));
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
