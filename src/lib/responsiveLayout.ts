type Insets = { top?: number; right?: number; bottom?: number; left?: number };

const nonnegative = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, value!) : 0;

/** Window dimensions stay reactive at the call site; this helper stores no screen state. */
export function responsiveLayout({ width, height, insets = {} }: { width: number; height: number; insets?: Insets }) {
  const usableWidth = Math.max(0, nonnegative(width) - nonnegative(insets.left) - nonnegative(insets.right));
  const usableHeight = Math.max(0, nonnegative(height) - nonnegative(insets.top) - nonnegative(insets.bottom));
  return { usableWidth, usableHeight, landscape: width > height, compactHeight: usableHeight < 500 };
}

/** A preferred minimum must never force a chart beyond its available space. */
export function fitChartHeight(availableHeight: number, preferred: number, minimum = 160) {
  const available = nonnegative(availableHeight);
  return Math.min(available, Math.max(Math.min(nonnegative(minimum), available), nonnegative(preferred)));
}

/** Keep a focused field inside the measured scroll viewport after keyboard/rotation layout. */
export function focusedFieldScrollOffset({ offset, viewportTop, viewportHeight, fieldTop, fieldHeight, gap = 8 }: {
  offset: number; viewportTop: number; viewportHeight: number; fieldTop: number; fieldHeight: number; gap?: number;
}) {
  if (![offset, viewportTop, viewportHeight, fieldTop, fieldHeight, gap].every(Number.isFinite) || viewportHeight <= 0) return nonnegative(offset);
  const top = viewportTop + gap;
  const bottom = viewportTop + viewportHeight - gap;
  const delta = fieldHeight > bottom - top || fieldTop < top ? fieldTop - top : Math.max(0, fieldTop + fieldHeight - bottom);
  return Math.max(0, offset + delta);
}
