// 扫雷概率计算器交互岛：还原盘面 → 调用与游戏一致的求解器 → 每格显示是雷概率。
// 所有文案由 Calculator.astro 渲染在 DOM 里，本脚本只写数字与状态类，zh/en 共用。
import { computeProbabilities } from '../../../src/solver/probability.js';

const root = document.querySelector('[data-calculator]');
if (root) {
  const boardEl = root.querySelector('[data-slot="board"]');
  const flagsEl = root.querySelector('[data-slot="flags"]');
  const remainingEl = root.querySelector('[data-slot="remaining"]');
  const warnEl = root.querySelector('[data-slot="warn"]');
  const approxEl = root.querySelector('[data-slot="approx"]');
  const rowInput = root.querySelector('[data-slot="rows"]');
  const colInput = root.querySelector('[data-slot="cols"]');
  const mineInput = root.querySelector('[data-slot="mines"]');
  const labelTemplate = root.dataset.labelTemplate ?? '{x},{y}';

  // 状态序列：hidden → flag → 1..8 → hidden，正反向循环
  const SEQ = ['hidden', 'flag', '1', '2', '3', '4', '5', '6', '7', '8'];
  const PROB_CLASS = (p) =>
    p <= 0.2 ? 'prob-low' : p <= 0.5 ? 'prob-mid' : p <= 0.8 ? 'prob-high' : 'prob-certain';

  let grid = [];
  let cellEls = [];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readConfig() {
    const row = clamp(parseInt(rowInput.value, 10) || 9, 5, 30);
    const column = clamp(parseInt(colInput.value, 10) || 9, 5, 40);
    const mines = clamp(parseInt(mineInput.value, 10) || 10, 1, row * column - 1);
    rowInput.value = String(row);
    colInput.value = String(column);
    mineInput.value = String(mines);
    return { row, column, mines };
  }

  function stateOf(cell) {
    if (cell.isFlag) return 'flag';
    if (cell.isOpen) return String(cell.count || 1);
    return 'hidden';
  }

  function cycle(cell, forward) {
    const current = SEQ.indexOf(stateOf(cell));
    const next = SEQ[(current + (forward ? 1 : SEQ.length - 1)) % SEQ.length];
    cell.isFlag = next === 'flag';
    cell.isOpen = next !== 'hidden' && next !== 'flag';
    cell.count = cell.isOpen ? parseInt(next, 10) || 0 : 0;
  }

  function renderCell(i) {
    const cell = grid[i];
    const el = cellEls[i];
    el.className = 'calc-cell';
    el.textContent = '';
    if (cell.isFlag) {
      el.classList.add('is-flag');
      el.textContent = '🚩';
    } else if (cell.isOpen) {
      el.classList.add('open');
      if (cell.count) {
        el.classList.add(`count-${cell.count}`);
        el.textContent = String(cell.count);
      }
    }
  }

  function update() {
    grid.forEach((_, i) => renderCell(i));
    const { row, column, mines } = readConfig();
    const flagged = grid.filter((c) => c.isFlag).length;
    const remaining = mines - flagged;
    flagsEl.textContent = String(flagged);
    remainingEl.textContent = String(remaining);
    warnEl.hidden = remaining >= 0;

    let result = null;
    if (remaining >= 0) {
      result = computeProbabilities(grid, row, column, mines);
    }
    approxEl.hidden = !(result && result.isApproximate);

    grid.forEach((cell, i) => {
      if (cell.isOpen || cell.isFlag || !result) return;
      const p = result.map.get(i);
      if (p == null) return;
      const el = cellEls[i];
      el.textContent = String(Math.round(p * 100));
      el.classList.add(PROB_CLASS(p));
    });
  }

  function rebuild() {
    const { row, column } = readConfig();
    grid = Array.from({ length: row * column }, () => ({ isOpen: false, isFlag: false, count: 0 }));
    boardEl.style.setProperty('--calc-column', String(column));
    boardEl.replaceChildren(
      ...grid.map((_, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'calc-cell';
        btn.dataset.index = String(i);
        btn.setAttribute(
          'aria-label',
          labelTemplate.replace('{x}', String((i % column) + 1)).replace('{y}', String(((i / column) | 0) + 1)),
        );
        return btn;
      }),
    );
    cellEls = [...boardEl.children];
    update();
  }

  boardEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.calc-cell');
    if (!btn) return;
    cycle(grid[Number(btn.dataset.index)], true);
    update();
  });
  boardEl.addEventListener('contextmenu', (event) => {
    const btn = event.target.closest('.calc-cell');
    if (!btn) return;
    event.preventDefault();
    cycle(grid[Number(btn.dataset.index)], false);
    update();
  });
  for (const button of root.querySelectorAll('[data-preset]')) {
    button.addEventListener('click', () => {
      const [row, column, mines] = button.dataset.preset.split('x').map(Number);
      rowInput.value = String(row);
      colInput.value = String(column);
      mineInput.value = String(mines);
      rebuild();
    });
  }
  rowInput.addEventListener('change', rebuild);
  colInput.addEventListener('change', rebuild);
  mineInput.addEventListener('change', update);
  root.querySelector('[data-slot="reset"]').addEventListener('click', rebuild);

  rebuild();
}
