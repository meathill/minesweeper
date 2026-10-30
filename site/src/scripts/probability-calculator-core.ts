import { computeProbabilities } from '../../../src/solver/probability.js';

export type CellVisualState =
  | 'hidden'
  | 'flag'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8';

export interface CalculatorCell {
  isOpen: boolean;
  isFlag: boolean;
  count: number;
}

export interface CalculatorConfig {
  row: number;
  column: number;
  mines: number;
}

export interface RenderedCellView {
  state: CellVisualState;
  text: string;
  probClass: string | null;
}

export interface CalculatorEvaluation {
  flagged: number;
  remaining: number;
  isApproximate: boolean;
  warningKind: 'none' | 'exceed' | 'contradiction';
  cells: RenderedCellView[];
}

export const CELL_STATE_SEQ: readonly CellVisualState[] = [
  'hidden',
  'flag',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
];

export const PRESET_CONFIGS: Record<string, CalculatorConfig> = {
  '9x9x10': { row: 9, column: 9, mines: 10 },
  '16x16x40': { row: 16, column: 16, mines: 40 },
  '16x30x99': { row: 16, column: 30, mines: 99 },
};

export function clampConfig(
  rawRow: number,
  rawColumn: number,
  rawMines: number,
): CalculatorConfig {
  const row = Math.max(5, Math.min(30, Math.trunc(rawRow) || 9));
  const column = Math.max(5, Math.min(40, Math.trunc(rawColumn) || 9));
  const mines = Math.max(
    1,
    Math.min(row * column - 1, Math.trunc(rawMines) || 10),
  );
  return { row, column, mines };
}

export function matchPresetKey(config: CalculatorConfig): string {
  const key = `${config.row}x${config.column}x${config.mines}`;
  return key in PRESET_CONFIGS ? key : 'custom';
}

export function createEmptyGrid(row: number, column: number): CalculatorCell[] {
  return Array.from({ length: row * column }, () => ({
    isOpen: false,
    isFlag: false,
    count: 0,
  }));
}

export function getCellState(cell: CalculatorCell): CellVisualState {
  if (cell.isFlag) return 'flag';
  if (cell.isOpen) {
    const count = Math.max(0, Math.min(8, cell.count));
    return String(count) as CellVisualState;
  }
  return 'hidden';
}

export function applyCellState(
  cell: CalculatorCell,
  next: CellVisualState,
): void {
  cell.isFlag = next === 'flag';
  cell.isOpen = next !== 'hidden' && next !== 'flag';
  cell.count = cell.isOpen ? Number.parseInt(next, 10) || 0 : 0;
}

export function cycleCellState(cell: CalculatorCell, isForward: boolean): void {
  const current = CELL_STATE_SEQ.indexOf(getCellState(cell));
  const step = isForward ? 1 : CELL_STATE_SEQ.length - 1;
  const next = CELL_STATE_SEQ[(current + step) % CELL_STATE_SEQ.length];
  applyCellState(cell, next);
}

export function classifyProbability(prob: number): string {
  if (prob <= 0.2) return 'prob-low';
  if (prob <= 0.5) return 'prob-mid';
  if (prob <= 0.8) return 'prob-high';
  return 'prob-certain';
}

export function evaluateCalculatorBoard(
  grid: CalculatorCell[],
  config: CalculatorConfig,
  isTrustingFlags: boolean,
): CalculatorEvaluation {
  const { row, column, mines } = config;
  const flagged = grid.filter((cell) => cell.isFlag).length;
  const remaining = mines - flagged;
  const solverResult = computeProbabilities(grid, row, column, mines, {
    trustFlags: isTrustingFlags,
    constrainZeroCells: true,
  });

  let warningKind: 'none' | 'exceed' | 'contradiction' = 'none';
  if (remaining < 0) {
    warningKind = 'exceed';
  } else if (solverResult.hasContradiction) {
    warningKind = 'contradiction';
  }

  const cells: RenderedCellView[] = grid.map((cell, index) => {
    const state = getCellState(cell);
    if (cell.isOpen) {
      return {
        state,
        text: cell.count > 0 ? String(cell.count) : '',
        probClass: null,
      };
    }
    if (cell.isFlag && isTrustingFlags) {
      return {
        state: 'flag',
        text: '🚩',
        probClass: null,
      };
    }
    const prob = solverResult.map.get(index);
    if (prob === undefined) {
      return {
        state,
        text: cell.isFlag ? '🚩' : '',
        probClass: null,
      };
    }
    const percentText = String(Math.round(prob * 100));
    return {
      state,
      text: cell.isFlag ? `🚩${percentText}` : percentText,
      probClass: classifyProbability(prob),
    };
  });

  return {
    flagged,
    remaining,
    isApproximate: solverResult.isApproximate,
    warningKind,
    cells,
  };
}
