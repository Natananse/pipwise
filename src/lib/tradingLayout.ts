type Insets = { top: number; bottom: number; left: number; right: number };

/** IME resizing must not turn a portrait order into a landscape layout. */
export function tradingLandscape(width: number, height: number, keyboard: boolean, previous: { width: number; height: number }) {
  if (!keyboard) return width > height;
  if (Math.abs(width - previous.width) < 2) return previous.width > previous.height;
  return width > previous.width;
}

export function tradingLayout({ width, height, insets, landscape, fontScale = 1, fullScreen = false }: {
  width: number; height: number; insets: Insets; landscape: boolean; fontScale?: number; fullScreen?: boolean;
}) {
  const usableWidth = Math.max(0, width - insets.left - insets.right);
  const usableHeight = Math.max(0, height - insets.top - insets.bottom);
  const panelWidth = landscape && !fullScreen
    ? Math.min(usableWidth * 0.45, Math.max(usableWidth * 0.35, 240 * Math.min(1.25, Math.max(1, fontScale)))) : usableWidth;
  return { usableWidth, usableHeight, panelWidth, chartWidth: landscape && !fullScreen ? usableWidth - panelWidth : usableWidth,
    compact: landscape && usableHeight <= 480 };
}
