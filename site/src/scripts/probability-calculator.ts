import {
  applyCellState,
  type CalculatorCell,
  type CalculatorConfig,
  type CellVisualState,
  clampConfig,
  createEmptyGrid,
  cycleCellState,
  evaluateCalculatorBoard,
  getCellState,
  matchPresetKey,
  PRESET_CONFIGS,
} from './probability-calculator-core';

function initProbabilityCalculator(root: HTMLElement): void {
  const boardEl = root.querySelector<HTMLElement>('[data-slot="board"]');
  const flagsEl = root.querySelector<HTMLElement>('[data-slot="flags"]');
  const remainingEl = root.querySelector<HTMLElement>(
    '[data-slot="remaining"]',
  );
  const warnEl = root.querySelector<HTMLElement>('[data-slot="warn"]');
  const approxEl = root.querySelector<HTMLElement>('[data-slot="approx"]');
  const presetSelect = root.querySelector<HTMLSelectElement>(
    '[data-slot="preset"]',
  );
  const rowInput = root.querySelector<HTMLInputElement>('[data-slot="rows"]');
  const colInput = root.querySelector<HTMLInputElement>('[data-slot="cols"]');
  const mineInput = root.querySelector<HTMLInputElement>('[data-slot="mines"]');
  const trustFlagsInput = root.querySelector<HTMLInputElement>(
    '[data-slot="trust-flags"]',
  );
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-slot="reset"]');

  if (
    !boardEl ||
    !flagsEl ||
    !remainingEl ||
    !warnEl ||
    !approxEl ||
    !presetSelect ||
    !rowInput ||
    !colInput ||
    !mineInput ||
    !trustFlagsInput ||
    !resetBtn
  ) {
    return;
  }

  const dom = {
    boardEl,
    flagsEl,
    remainingEl,
    warnEl,
    approxEl,
    presetSelect,
    rowInput,
    colInput,
    mineInput,
    trustFlagsInput,
    resetBtn,
  };

  const labelTemplate = root.dataset.labelTemplate ?? '{x},{y}';
  const warnExceedText = root.dataset.warnExceed ?? '';
  const warnContradictionText = root.dataset.warnContradiction ?? '';

  let grid: CalculatorCell[] = [];
  let cellEls: HTMLButtonElement[] = [];

  function readAndSyncConfig(): CalculatorConfig {
    const config = clampConfig(
      Number.parseInt(dom.rowInput.value, 10),
      Number.parseInt(dom.colInput.value, 10),
      Number.parseInt(dom.mineInput.value, 10),
    );
    dom.rowInput.value = String(config.row);
    dom.colInput.value = String(config.column);
    dom.mineInput.value = String(config.mines);
    dom.presetSelect.value = matchPresetKey(config);
    return config;
  }

  function updateBoardView(): void {
    const config = readAndSyncConfig();
    const evaluation = evaluateCalculatorBoard(
      grid,
      config,
      dom.trustFlagsInput.checked,
    );

    dom.flagsEl.textContent = String(evaluation.flagged);
    dom.remainingEl.textContent = String(evaluation.remaining);
    dom.approxEl.hidden = !evaluation.isApproximate;

    if (evaluation.warningKind === 'exceed') {
      dom.warnEl.textContent = warnExceedText;
      dom.warnEl.hidden = false;
    } else if (evaluation.warningKind === 'contradiction') {
      dom.warnEl.textContent = warnContradictionText;
      dom.warnEl.hidden = false;
    } else {
      dom.warnEl.textContent = '';
      dom.warnEl.hidden = true;
    }

    evaluation.cells.forEach((view, index) => {
      const el = cellEls[index];
      if (!el) return;
      el.className = 'calc-cell';
      if (view.state === 'flag') {
        el.classList.add('is-flag');
      } else if (view.state !== 'hidden') {
        el.classList.add('open', `count-${view.state}`);
      }
      if (view.probClass) {
        el.classList.add(view.probClass);
      }
      el.textContent = view.text;
    });
  }

  function rebuildBoard(): void {
    const { row, column } = readAndSyncConfig();
    grid = createEmptyGrid(row, column);
    dom.boardEl.style.setProperty('--calc-column', String(column));
    const buttons = grid.map((_, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calc-cell';
      btn.dataset.index = String(index);
      btn.setAttribute(
        'aria-label',
        labelTemplate
          .replace('{x}', String((index % column) + 1))
          .replace('{y}', String(Math.trunc(index / column) + 1)),
      );
      return btn;
    });
    dom.boardEl.replaceChildren(...buttons);
    cellEls = buttons;
    updateBoardView();
  }

  function handleBoardClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLButtonElement>('.calc-cell');
    if (!btn) return;
    const cell = grid[Number(btn.dataset.index)];
    if (!cell) return;
    cycleCellState(cell, true);
    updateBoardView();
  }

  function handleBoardContextMenu(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLButtonElement>('.calc-cell');
    if (!btn) return;
    event.preventDefault();
    const cell = grid[Number(btn.dataset.index)];
    if (!cell) return;
    cycleCellState(cell, false);
    updateBoardView();
  }

  function handleBoardKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (!target.classList.contains('calc-cell')) return;
    const cell = grid[Number(target.dataset.index)];
    if (!cell) return;

    const key = event.key;
    if (key >= '0' && key <= '8') {
      event.preventDefault();
      applyCellState(cell, key as CellVisualState);
      updateBoardView();
      return;
    }
    if (key === 'f' || key === 'F') {
      event.preventDefault();
      applyCellState(cell, getCellState(cell) === 'flag' ? 'hidden' : 'flag');
      updateBoardView();
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      applyCellState(cell, 'hidden');
      updateBoardView();
    }
  }

  function handlePresetChange(): void {
    const preset = PRESET_CONFIGS[dom.presetSelect.value];
    if (!preset) return;
    dom.rowInput.value = String(preset.row);
    dom.colInput.value = String(preset.column);
    dom.mineInput.value = String(preset.mines);
    rebuildBoard();
  }

  function handleDimensionChange(): void {
    rebuildBoard();
  }

  function handleMineOrModeChange(): void {
    updateBoardView();
  }

  dom.boardEl.addEventListener('click', handleBoardClick);
  dom.boardEl.addEventListener('contextmenu', handleBoardContextMenu);
  dom.boardEl.addEventListener('keydown', handleBoardKeyDown);
  dom.presetSelect.addEventListener('change', handlePresetChange);
  dom.rowInput.addEventListener('change', handleDimensionChange);
  dom.colInput.addEventListener('change', handleDimensionChange);
  dom.mineInput.addEventListener('change', handleMineOrModeChange);
  dom.trustFlagsInput.addEventListener('change', handleMineOrModeChange);
  dom.resetBtn.addEventListener('click', rebuildBoard);

  rebuildBoard();
}

const calculatorRoot = document.querySelector<HTMLElement>('[data-calculator]');
if (calculatorRoot) {
  initProbabilityCalculator(calculatorRoot);
}
