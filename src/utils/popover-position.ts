export interface TriggerRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface PopoverCoordinates {
  left: number;
  top: number;
}

const DEFAULT_GAP = 6;
const VIEWPORT_EDGE_PADDING = 8;

export function toAnchorIdent(rawId: string): string {
  const safe = rawId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `--coss-anchor-${safe}`;
}

export function computePopoverPosition(
  triggerRect: TriggerRect,
  panelSize: PanelSize,
  viewport: ViewportSize,
  gap: number = DEFAULT_GAP,
): PopoverCoordinates {
  const maxLeft = Math.max(
    VIEWPORT_EDGE_PADDING,
    viewport.width - panelSize.width - VIEWPORT_EDGE_PADDING,
  );
  const left = Math.min(
    maxLeft,
    Math.max(VIEWPORT_EDGE_PADDING, triggerRect.right - panelSize.width),
  );

  let top = triggerRect.bottom + gap;
  const overflowsBottom =
    top + panelSize.height > viewport.height - VIEWPORT_EDGE_PADDING;
  const fitsAbove =
    triggerRect.top - gap - panelSize.height >= VIEWPORT_EDGE_PADDING;

  if (overflowsBottom && fitsAbove) {
    top = triggerRect.top - gap - panelSize.height;
  }

  return {
    left: Math.round(left),
    top: Math.round(Math.max(VIEWPORT_EDGE_PADDING, top)),
  };
}

export function syncDropdownPopover(
  trigger: HTMLElement | null,
  panel: HTMLElement | null,
): boolean {
  if (!trigger || !panel) return false;
  const isOpen = panel.matches(':popover-open');
  trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

  if (
    isOpen &&
    typeof CSS !== 'undefined' &&
    !CSS.supports('position-area: block-end')
  ) {
    const rect = trigger.getBoundingClientRect();
    const coords = computePopoverPosition(
      rect,
      { width: panel.offsetWidth, height: panel.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    panel.style.left = `${coords.left}px`;
    panel.style.top = `${coords.top}px`;
  }

  return isOpen;
}
