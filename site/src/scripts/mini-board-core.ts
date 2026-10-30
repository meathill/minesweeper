export const MINI_BOARD_ROWS = 9;
export const MINI_BOARD_COLS = 9;
export const MINI_BOARD_MINES = 10;

export type MiniBoardStatus = 'idle' | 'playing' | 'won' | 'lost';
export type MiniActionOutcome = 'noop' | 'started' | 'updated' | 'won' | 'lost';

export interface MiniCell {
  index: number;
  isMine: boolean;
  adjacentMines: number;
  isOpen: boolean;
  isFlag: boolean;
}

export interface MiniBoardState {
  rows: number;
  cols: number;
  mineCount: number;
  status: MiniBoardStatus;
  isFlagMode: boolean;
  flaggedCount: number;
  openedCount: number;
  explodedIndex: number | null;
  cells: MiniCell[];
}

export function createMiniBoard(
  rows = MINI_BOARD_ROWS,
  cols = MINI_BOARD_COLS,
  mineCount = MINI_BOARD_MINES,
): MiniBoardState {
  const total = rows * cols;
  const clampedMines = Math.max(1, Math.min(mineCount, total - 1));
  const cells: MiniCell[] = Array.from({ length: total }, (_, index) => ({
    index,
    isMine: false,
    adjacentMines: 0,
    isOpen: false,
    isFlag: false,
  }));
  return {
    rows,
    cols,
    mineCount: clampedMines,
    status: 'idle',
    isFlagMode: false,
    flaggedCount: 0,
    openedCount: 0,
    explodedIndex: null,
    cells,
  };
}

function getNeighborIndices(
  index: number,
  rows: number,
  cols: number,
): number[] {
  const cx = index % cols;
  const cy = Math.floor(index / cols);
  const neighbors: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        neighbors.push(ny * cols + nx);
      }
    }
  }
  return neighbors;
}

function populateMines(
  state: MiniBoardState,
  firstIndex: number,
  randomFn: () => number,
): void {
  const total = state.rows * state.cols;
  const forbidden = new Set<number>([
    firstIndex,
    ...getNeighborIndices(firstIndex, state.rows, state.cols),
  ]);
  const excludeSet =
    total - forbidden.size >= state.mineCount
      ? forbidden
      : new Set<number>([firstIndex]);

  const candidates: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!excludeSet.has(i)) {
      candidates.push(i);
    }
  }

  for (
    let picked = 0;
    picked < state.mineCount && candidates.length > 0;
    picked++
  ) {
    const swapIdx =
      picked + Math.floor(randomFn() * (candidates.length - picked));
    const chosen = candidates[swapIdx];
    candidates[swapIdx] = candidates[picked];
    state.cells[chosen].isMine = true;
  }

  for (const cell of state.cells) {
    if (cell.isMine) continue;
    let count = 0;
    for (const neighborIdx of getNeighborIndices(
      cell.index,
      state.rows,
      state.cols,
    )) {
      if (state.cells[neighborIdx].isMine) {
        count += 1;
      }
    }
    cell.adjacentMines = count;
  }
}

function checkWin(state: MiniBoardState): void {
  const safeTarget = state.rows * state.cols - state.mineCount;
  if (state.openedCount < safeTarget) return;
  state.status = 'won';
  for (const cell of state.cells) {
    if (cell.isMine && !cell.isFlag) {
      cell.isFlag = true;
    }
  }
  state.flaggedCount = state.mineCount;
}

function revealLoss(state: MiniBoardState, explodedIndex: number): void {
  state.status = 'lost';
  state.explodedIndex = explodedIndex;
  for (const cell of state.cells) {
    if (cell.isMine) {
      cell.isOpen = true;
    }
  }
}

export function openMiniCell(
  state: MiniBoardState,
  index: number,
  randomFn: () => number = Math.random,
): boolean {
  if (state.status === 'won' || state.status === 'lost') return false;
  const target = state.cells[index];
  if (!target || target.isOpen || target.isFlag) return false;

  if (state.status === 'idle') {
    // 若玩家开局前预标了旗子，清掉落入首击禁雷区的旗子以防卡死空白格
    populateMines(state, index, randomFn);
    state.status = 'playing';
  }

  if (target.isMine) {
    revealLoss(state, index);
    return true;
  }

  const queue: number[] = [index];
  while (queue.length > 0) {
    const currentIdx = queue.shift();
    if (currentIdx === undefined) continue;
    const cell = state.cells[currentIdx];
    if (cell.isOpen || cell.isMine) continue;
    if (cell.isFlag) {
      cell.isFlag = false;
      state.flaggedCount -= 1;
    }
    cell.isOpen = true;
    state.openedCount += 1;

    if (cell.adjacentMines === 0) {
      for (const neighborIdx of getNeighborIndices(
        currentIdx,
        state.rows,
        state.cols,
      )) {
        const neighbor = state.cells[neighborIdx];
        if (!neighbor.isOpen && !neighbor.isMine && !neighbor.isFlag) {
          queue.push(neighborIdx);
        }
      }
    }
  }

  checkWin(state);
  return true;
}

export function toggleMiniFlag(state: MiniBoardState, index: number): boolean {
  if (state.status === 'won' || state.status === 'lost') return false;
  const cell = state.cells[index];
  if (!cell || cell.isOpen) return false;

  if (cell.isFlag) {
    cell.isFlag = false;
    state.flaggedCount -= 1;
    return true;
  }
  if (state.flaggedCount >= state.mineCount) return false;
  cell.isFlag = true;
  state.flaggedCount += 1;
  return true;
}

export function chordMiniCell(state: MiniBoardState, index: number): boolean {
  if (state.status !== 'playing') return false;
  const cell = state.cells[index];
  if (!cell || !cell.isOpen || cell.adjacentMines <= 0) return false;

  const neighbors = getNeighborIndices(index, state.rows, state.cols);
  const flaggedNeighbors = neighbors.filter(
    (idx) => state.cells[idx].isFlag,
  ).length;
  if (flaggedNeighbors !== cell.adjacentMines) return false;

  let changed = false;
  for (const neighborIdx of neighbors) {
    const neighbor = state.cells[neighborIdx];
    if (neighbor.isOpen || neighbor.isFlag) continue;
    if (neighbor.isMine) {
      revealLoss(state, neighborIdx);
      return true;
    }
    openMiniCell(state, neighborIdx);
    changed = true;
  }
  return changed;
}

function readBoardStatus(state: MiniBoardState): MiniBoardStatus {
  return state.status;
}

export function handlePrimaryCellAction(
  state: MiniBoardState,
  index: number,
  randomFn: () => number = Math.random,
): MiniActionOutcome {
  if (state.status === 'won' || state.status === 'lost') return 'noop';
  const cell = state.cells[index];
  if (!cell) return 'noop';

  if (state.isFlagMode && !cell.isOpen) {
    return toggleMiniFlag(state, index) ? 'updated' : 'noop';
  }
  const wasIdle = state.status === 'idle';
  const changed = openMiniCell(state, index, randomFn);
  if (!changed) return 'noop';
  const nextStatus = readBoardStatus(state);
  if (nextStatus === 'won') return 'won';
  if (nextStatus === 'lost') return 'lost';
  return wasIdle ? 'started' : 'updated';
}
