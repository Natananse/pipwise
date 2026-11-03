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
