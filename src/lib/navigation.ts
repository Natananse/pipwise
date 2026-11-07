/** Shared clearance keeps floating navigation away from screen actions. */
export const navigationLayout = {
  wideBreakpoint: 1050,
  railWidth: 108,
  dockHeight: 70,
  dockBottomGap: 12,
  dockSideGap: 16,
};

export const tabBarClearance = (bottomInset: number) =>
  navigationLayout.dockHeight + navigationLayout.dockBottomGap + bottomInset;

type BottomClearance = {
  bottomInset: number;
  wide: boolean;
  tabRoute: boolean;
};

function bottomObstruction({ bottomInset, wide, tabRoute }: BottomClearance) {
  return tabRoute && !wide ? tabBarClearance(bottomInset) : bottomInset;
}

/** Standalone screens and wide side rails reserve only the system bottom inset. */
export function contentBottomPadding({ bottomInset, wide, tabRoute, contentGap = 20, footerHeight = 0, footerGap = 10 }: BottomClearance & {
  contentGap?: number;
  footerHeight?: number;
  footerGap?: number;
}) {
  return bottomObstruction({ bottomInset, wide, tabRoute }) + contentGap
    + (footerHeight > 0 ? footerHeight + footerGap : 0);
}

/** A floating action stays above whichever bottom obstruction is actually shown. */
export function floatingFooterBottom({ bottomInset, wide, tabRoute, gap = 10 }: BottomClearance & { gap?: number }) {
  return bottomObstruction({ bottomInset, wide, tabRoute }) + gap;
}

/** Change icon contrast after the new surface covers the entire top icon band. */
export function scrolledSurfaceAtTop({ scrollOffset, surfaceTop }: { scrollOffset: number; surfaceTop: number }) {
  return scrollOffset >= Math.max(0, surfaceTop);
}
