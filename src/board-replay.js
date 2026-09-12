// 棋盘快照序列化与恢复：位串 <-> 格子状态
// 快照在 App.vue 每次玩家动作完成后记录，用于图表点击后彻底回到当时的棋盘情景

// grid -> { openedBits, flagBits, questionBits }，位串长度 = 格数，'1' 表示是
export function encodeGridState(grid) {
  let openedBits = '';
  let flagBits = '';
  let questionBits = '';
  for (const cell of grid) {
    openedBits += cell.isOpen ? '1' : '0';
    flagBits += cell.isFlag ? '1' : '0';
    questionBits += cell.isQuestion ? '1' : '0';
  }
  return { openedBits, flagBits, questionBits };
}

export function decodeBits(bits) {
  return [...bits].map((c) => c === '1');
}

// 将快照应用到 grid 数据与 grid-item 组件实例，棋盘完整回到当时
export function applySnapshot(grid, gridItems, snap) {
  const opened = decodeBits(snap.openedBits);
  const flags = decodeBits(snap.flagBits);
  const questions = decodeBits(snap.questionBits);
  grid.forEach((cell, i) => {
    cell.isOpen = opened[i];
    cell.isFlag = flags[i];
    cell.isQuestion = questions[i];
    cell.isUncovered = false;
    const item = gridItems?.[i];
    if (item && typeof item.restore === 'function') {
      item.restore({
        isOpen: opened[i],
        isFlag: flags[i],
        isQuestion: questions[i],
      });
    }
  });
}
