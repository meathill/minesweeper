import {
  chordMiniCell,
  createMiniBoard,
  handlePrimaryCellAction,
  toggleMiniFlag,
} from './mini-board-core';
import type { MiniBoardState } from './mini-board-core';

declare global {
  interface Window {
    gtag?: (
      command: 'event',
      eventName: string,
      params?: Record<string, string | number | boolean>,
    ) => void;
  }
}

const LONG_PRESS_MS = 380;

export function trackGuideEvent(
  eventName: string,
  params: Record<string, string | number | boolean>,
): void {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  } catch {
    // 忽略广告拦截或隐私模式异常
  }
}

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.min(seconds, 5999));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function mountSingleMiniBoard(root: HTMLElement): void {
  const gridEl = root.querySelector<HTMLElement>('[data-mb-slot="grid"]');
  const minesEl = root.querySelector<HTMLElement>('[data-mb-slot="mines"]');
  const timerEl = root.querySelector<HTMLElement>('[data-mb-slot="timer"]');
  const resetBtn = root.querySelector<HTMLButtonElement>(
    '[data-mb-slot="reset"]',
  );
  const modeBtn = root.querySelector<HTMLButtonElement>(
    '[data-mb-slot="mode"]',
  );
  const bannerEl = root.querySelector<HTMLElement>('[data-mb-slot="banner"]');
  const bannerTextEl = root.querySelector<HTMLElement>(
    '[data-mb-slot="banner-text"]',
  );
  const fullGameLinks = root.querySelectorAll<HTMLAnchorElement>(
    '[data-mb-slot="full-link"]',
  );

  if (!gridEl || !minesEl || !timerEl || !resetBtn || !modeBtn) return;
  const boardGrid = gridEl;
  const minesDisplay = minesEl;
  const timerDisplay = timerEl;
  const resetButton = resetBtn;
  const modeButton = modeBtn;

  const lang = root.dataset.lang ?? 'en';
  const pagePath = root.dataset.path ?? '/';
  const cellLabelTpl = root.dataset.cellLabel ?? 'Cell {x},{y}';
  const digLabel = root.dataset.digLabel ?? '⛏️ Dig';
  const flagLabel = root.dataset.flagLabel ?? '🚩 Flag';
  const winText = root.dataset.winText ?? '';
  const loseText = root.dataset.loseText ?? '';

  let state: MiniBoardState = createMiniBoard();
  let cellButtons: HTMLButtonElement[] = [];
  let elapsedSeconds = 0;
  let timerId: number | null = null;
  let longPressTimer: number | null = null;
  let isLongPressTriggered = false;

  function stopTimer(): void {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer(): void {
    stopTimer();
    timerId = window.setInterval(function tickTimer() {
      elapsedSeconds += 1;
      timerDisplay.textContent = formatClock(elapsedSeconds);
    }, 1000);
  }

  function clearLongPress(): void {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function renderBoard(): void {
    const remaining = Math.max(0, state.mineCount - state.flaggedCount);
    minesDisplay.textContent = String(remaining);
    timerDisplay.textContent = formatClock(elapsedSeconds);

    resetButton.textContent =
      state.status === 'won' ? '😎' : state.status === 'lost' ? '😵' : '😊';

    modeButton.setAttribute(
      'aria-pressed',
      state.isFlagMode ? 'true' : 'false',
    );
    modeButton.classList.toggle('is-active', state.isFlagMode);
    modeButton.textContent = state.isFlagMode ? flagLabel : digLabel;

    boardGrid.classList.toggle(
      'is-finished',
      state.status === 'won' || state.status === 'lost',
    );

    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      const btn = cellButtons[i];
      if (!btn) continue;

      btn.className = 'mb-cell';
      btn.textContent = '';

      if (cell.isOpen) {
        btn.classList.add('is-open');
        if (cell.isMine) {
          btn.classList.add('is-mine');
          if (state.explodedIndex === i) {
            btn.classList.add('is-exploded');
            btn.textContent = '💥';
          } else {
            btn.textContent = '💣';
          }
        } else if (cell.adjacentMines > 0) {
          btn.classList.add(`count-${cell.adjacentMines}`);
          btn.textContent = String(cell.adjacentMines);
        }
      } else if (cell.isFlag) {
        btn.classList.add('is-flag');
        btn.textContent = '🚩';
      }
    }

    if (bannerEl && bannerTextEl) {
      const isFinished = state.status === 'won' || state.status === 'lost';
      bannerEl.hidden = !isFinished;
      bannerTextEl.textContent =
        state.status === 'won'
          ? winText
          : state.status === 'lost'
            ? loseText
            : '';
    }
  }

  function buildCellsDom(): void {
    const fragment = document.createDocumentFragment();
    cellButtons = [];
    for (let i = 0; i < state.cells.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mb-cell';
      btn.dataset.index = String(i);
      const x = (i % state.cols) + 1;
      const y = Math.floor(i / state.cols) + 1;
      btn.setAttribute(
        'aria-label',
        cellLabelTpl.replace('{x}', String(x)).replace('{y}', String(y)),
      );
      cellButtons.push(btn);
      fragment.appendChild(btn);
    }
    boardGrid.replaceChildren(fragment);
    boardGrid.dataset.ready = 'true';
    renderBoard();
  }

  function handleReset(): void {
    stopTimer();
    elapsedSeconds = 0;
    const keepFlagMode = state.isFlagMode;
    state = createMiniBoard();
    state.isFlagMode = keepFlagMode;
    renderBoard();
  }

  function handleModeToggle(): void {
    state.isFlagMode = !state.isFlagMode;
    renderBoard();
  }

  function checkPostAction(wasPlaying: boolean): void {
    if (!wasPlaying && state.status === 'playing') {
      startTimer();
      trackGuideEvent('guide_miniboard_start', { lang, page_path: pagePath });
    }
    if (
      (state.status === 'won' || state.status === 'lost') &&
      timerId !== null
    ) {
      stopTimer();
      trackGuideEvent('guide_miniboard_finish', {
        lang,
        page_path: pagePath,
        result: state.status === 'won' ? 'win' : 'lose',
        seconds: elapsedSeconds,
      });
    } else if (
      (state.status === 'won' || state.status === 'lost') &&
      !wasPlaying
    ) {
      trackGuideEvent('guide_miniboard_finish', {
        lang,
        page_path: pagePath,
        result: state.status === 'won' ? 'win' : 'lose',
        seconds: elapsedSeconds,
      });
    }
    renderBoard();
  }

  function findCellIndex(target: EventTarget | null): number | null {
    if (!(target instanceof Element)) return null;
    const btn = target.closest<HTMLButtonElement>('.mb-cell');
    if (!btn || btn.dataset.index === undefined) return null;
    return Number(btn.dataset.index);
  }

  function handleGridClick(event: MouseEvent): void {
    if (isLongPressTriggered) {
      isLongPressTriggered = false;
      return;
    }
    const index = findCellIndex(event.target);
    if (index === null) return;
    const wasPlaying = state.status === 'playing';
    const outcome = handlePrimaryCellAction(state, index);
    if (outcome !== 'noop') {
      checkPostAction(wasPlaying);
    }
  }

  function handleGridContextMenu(event: MouseEvent): void {
    const index = findCellIndex(event.target);
    if (index === null) return;
    event.preventDefault();
    if (toggleMiniFlag(state, index)) {
      renderBoard();
    }
  }

  function handleGridDoubleClick(event: MouseEvent): void {
    const index = findCellIndex(event.target);
    if (index === null) return;
    const wasPlaying = state.status === 'playing';
    if (chordMiniCell(state, index)) {
      checkPostAction(wasPlaying);
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return;
    const index = findCellIndex(event.target);
    if (index === null) return;
    isLongPressTriggered = false;
    clearLongPress();
    longPressTimer = window.setTimeout(function onLongPress() {
      if (toggleMiniFlag(state, index)) {
        isLongPressTriggered = true;
        renderBoard();
      }
    }, LONG_PRESS_MS);
  }

  boardGrid.addEventListener('click', handleGridClick);
  boardGrid.addEventListener('contextmenu', handleGridContextMenu);
  boardGrid.addEventListener('dblclick', handleGridDoubleClick);
  boardGrid.addEventListener('pointerdown', handlePointerDown);
  boardGrid.addEventListener('pointerup', clearLongPress);
  boardGrid.addEventListener('pointercancel', clearLongPress);
  boardGrid.addEventListener('pointermove', clearLongPress);

  resetButton.addEventListener('click', handleReset);
  modeButton.addEventListener('click', handleModeToggle);

  for (const link of fullGameLinks) {
    link.addEventListener('click', function handleFullGameClick() {
      trackGuideEvent('guide_miniboard_fullgame_click', {
        lang,
        page_path: pagePath,
        status: state.status,
      });
    });
  }

  // 双 rAF 延后挂载 81 个格子按钮，确保文章 H1 与导语稳定成为 LCP，同时容器已预留精确尺寸避免 CLS
  window.requestAnimationFrame(function firstFrame() {
    window.requestAnimationFrame(function secondFrame() {
      buildCellsDom();
    });
  });
}

for (const el of document.querySelectorAll<HTMLElement>('[data-mini-board]')) {
  mountSingleMiniBoard(el);
}
