import { defineStore } from 'pinia';
import { computed, nextTick, ref } from 'vue';
import JsConfetti from 'js-confetti';
import { Levels } from '../data/index.js';
import { scoreForAction } from '../solver/probability.js';
import { encodeGridState, applySnapshot } from '../board-replay.js';
import { buildReplayJson, downloadReplayJson } from '../replay-export.js';
import { trackEvent } from '../analytics.js';
import { useOperationRecordsStore } from './operationRecords.js';
import { useProbabilityStore } from './probabilityStore.js';

// 棋盘状态 + 对局流程：布雷、点开/插旗/双击、计时、快照、结算。
// 概率读数经 useProbabilityStore 懒获取（action 内调用，避免与 probabilityStore 循环初始化）。
// gridItems 是子组件实例数组（模板 ref），由 App.vue 持有并作为参数传入需要操作 UI 的 action。
export const REVEAL_STEP_MS = 25; // 批量展开时每层涟漪的延迟

let interval = null;
let jsConfetti = null;
function getConfetti() {
  if (!jsConfetti) jsConfetti = new JsConfetti();
  return jsConfetti;
}

export const useGameStore = defineStore('game', () => {
  const operationStore = useOperationRecordsStore();

  const isStart = ref(false); // 是否处于游戏状态
  const isRealStart = ref(false); // 是否真正开始游戏
  const isFailed = ref(null); // 失败了？
  const isSuccess = ref(null); // 成功了？
  const level = ref(localStorage.getItem('level') || 'Easy');
  const row = ref(Levels[level.value].row);
  const column = ref(Levels[level.value].column);
  const flagged = ref(0); // 标记的数量
  const opened = ref(0); // 点开的数量
  const timeCount = ref(0);

  // 格子总数
  const total = computed(() => {
    return row.value * column.value;
  });
  // 炸弹总数
  const bombNumber = computed(() => {
    return level.value === 'Custom'
      ? (total.value / 8) >> 0
      : Levels[level.value].bomb;
  });
  // 地图阵列
  const gridStyle = computed(() => {
    return `--row:${row.value};--column:${column.value}`;
  });
  const grid = ref(null);

  function getRowCol(index) {
    return { row: Math.floor(index / column.value), col: index % column.value };
  }

  // 玩家动作完成后记录棋盘快照（setTimeout 确保同步连开链已结束）
  function scheduleSnapshot(action, cellIndex = null, extra = {}) {
    setTimeout(() => {
      if (!grid.value) return;
      operationStore.appendSnapshot({
        action,
        cellIndex,
        ...encodeGridState(grid.value),
        flaggedCount: flagged.value,
        openedCount: opened.value,
        clockSec: timeCount.value,
        row: row.value,
        column: column.value,
        bombNumber: bombNumber.value,
        ...extra,
      });
    }, 0);
  }
  // 回放：棋盘完整回到快照时刻（含旗数/开格数/计时器显示）
  function restoreToSnapshot(snap, gridItems) {
    if (!snap || !grid.value) return;
    applySnapshot(grid.value, gridItems?.value, snap);
    if (snap.result === 'lose') {
      for (const gridItem of gridItems.value) {
        gridItem.uncover();
      }
    }
    flagged.value = snap.flaggedCount;
    opened.value = snap.openedCount;
    timeCount.value = snap.clockSec;
    useProbabilityStore().bumpBoardVersion(); // 回放跳格：旧精算作废（终局后 isRealStart 为 false，不会重排）
  }
  // 导出本局完整数据（雷区 + 事件流 + 快照），便于复盘与 debug
  // version 由调用方（App.vue，Vite 可直引 package.json）传入，避免 store 直引 JSON 导致 node --test 失败
  function handleDownloadReplay(version) {
    const final = operationStore.findFinalSnapshot();
    const data = buildReplayJson({
      version,
      level: level.value,
      grid: grid.value,
      row: row.value,
      column: column.value,
      bombNumber: bombNumber.value,
      result: isSuccess.value ? 'win' : 'lose',
      startTimeStamp: operationStore.operationRecords.startTimeStamp,
      endTimeStamp: final?.clickTimestamp ?? Date.now(),
      operationEvents: operationStore.operationRecords.operationEvents,
      efficiencyEvents: operationStore.efficiencyEvents,
      snapshots: operationStore.snapshots,
    });
    downloadReplayJson(data);
    trackEvent('replay_download', {
      ops: operationStore.operationRecords.operationEvents.length,
      level: level.value,
    });
  }

  function doStart(event, gridItems) {
    clearInterval(interval);
    isRealStart.value = false;
    isFailed.value = isSuccess.value = null;
    flagged.value = timeCount.value = opened.value = 0;
    useProbabilityStore().clearHint();
    operationStore.clearSelection();
    trackEvent('game_start', {
      action: event ? 'restart' : 'init',
      level: level.value,
    });
    const bombs = [];
    bombs.length = total.value;
    bombs.fill(0, 0, total.value);
    grid.value = bombs.map((_, index) => {
      return {
        index,
        isBomb: false,
        count: 0,
        isOpen: false,
        isFlag: false,
        isQuestion: false,
        isUncovered: false,
      };
    });
    isStart.value = true;
    if (event) {
      for (const gridItem of gridItems.value) {
        gridItem.reset();
      }
    }
    // 刷新记录每分钟操作
    operationStore.onFreshOperateRecords();
    useProbabilityStore().bumpBoardVersion(); // 新局：精算状态清空（isRealStart 为 false，不会重排）
  }

  function doRealStart(clickedIndex) {
    isRealStart.value = true;
    // 首次点击必为空白（count === 0）：将点击格及其 8 邻域设为禁雷区
    // 若禁雷后剩余格子不足以放下所有雷（极高密度导致不存在任何空白），则退化为仅保证点击格本身不是雷
    const cx = clickedIndex % column.value;
    const cy = (clickedIndex / column.value) >> 0;
    const forbidden = new Set();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= column.value || ny < 0 || ny >= row.value) continue;
        forbidden.add(ny * column.value + nx);
      }
    }
    const canGuaranteeBlank = total.value - forbidden.size >= bombNumber.value;
    const excludeSet = canGuaranteeBlank ? forbidden : new Set([clickedIndex]);

    const candidates = [];
    for (let i = 0; i < total.value; i++) {
      if (!excludeSet.has(i)) candidates.push(i);
    }
    // Fisher-Yates 洗牌后取前 bombNumber 个
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) >> 0;
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const placeCount = Math.min(bombNumber.value, candidates.length);
    for (let i = 0; i < placeCount; i++) {
      grid.value[candidates[i]].isBomb = true;
    }
    grid.value = grid.value.map((item, index) => {
      const x = index % column.value;
      const y = (index / column.value) >> 0;
      let count = 0;
      for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row.value); i++) {
        for (
          let j = Math.max(0, x - 1);
          j < Math.min(x + 2, column.value);
          j++
        ) {
          if (
            grid.value[i * column.value + j].isBomb &&
            !(i === y && j === x)
          ) {
            count++;
          }
        }
      }
      return {
        ...item,
        count,
      };
    });
    interval = setInterval(() => {
      timeCount.value += 1;
    }, 1000);
    // 布雷完成、首格未开时的初始快照（同步记录，早于首格打开）
    operationStore.appendSnapshot({
      action: 'start',
      cellIndex: clickedIndex,
      ...encodeGridState(grid.value),
      flaggedCount: 0,
      openedCount: 0,
      clockSec: 0,
      row: row.value,
      column: column.value,
      bombNumber: bombNumber.value,
    });
    // 防止用户错误离开
    addEventListener('beforeunload', onBeforeUnload);
  }

  function doStop(success = false, failIndex = null, gridItems) {
    clearInterval(interval);
    isFailed.value = !success;
    isSuccess.value = success;
    isStart.value = isRealStart.value = false;
    removeEventListener('beforeunload', onBeforeUnload);
    // GA: 结算
    const avgEff = (() => {
      const ev = operationStore.efficiencyEvents;
      if (!ev.length) return null;
      return (ev.reduce((a, b) => a + b.score10, 0) / ev.length).toFixed(1);
    })();
    if (success) {
      getConfetti().addConfetti({
        confettiNumber: 500,
      });
      // 胜利：所有未开格（即全部雷位）统一标为旗，grid 数据与组件 UI 同步
      for (const cell of grid.value) {
        if (!cell.isOpen) {
          cell.isFlag = true;
          cell.isQuestion = false;
        }
      }
      for (const gridItem of gridItems.value) {
        gridItem.markAsFlag();
      }
      trackEvent('game_win', {
        time_seconds: timeCount.value,
        avg_efficiency: avgEff,
        level: level.value,
      });
    } else {
      if (failIndex != null && grid.value[failIndex]) {
        grid.value[failIndex].isOpen = true; // 踩雷格数据层同步为已开，与 UI 一致
      }
      for (const gridItem of gridItems.value) {
        gridItem.uncover();
      }
      trackEvent('game_lose', {
        time_seconds: timeCount.value,
        avg_efficiency: avgEff,
        level: level.value,
      });
    }
    scheduleSnapshot('final', failIndex, { result: success ? 'win' : 'lose' });
    operationStore.onStopOperateRecords();
    trackEvent(success ? 'game_complete_win' : 'game_complete_lose', {
      time_seconds: timeCount.value,
      level: level.value,
    });
    useProbabilityStore().bumpBoardVersion(); // 终局：精算状态清空（isRealStart 为 false，不会重排）
  }

  function onMarkState(index, state) {
    const prob = useProbabilityStore();
    const cell = grid.value?.[index];
    if (!cell || cell.isOpen) return;
    const prevFlag = cell.isFlag;
    cell.isFlag = state === 'flag';
    cell.isQuestion = state === 'question';
    // 插旗/拔旗评分（问号切换不评分，只记录操作节奏）
    if (isRealStart.value && (state === 'flag' || prevFlag)) {
      const { row: r, col: c } = getRowCol(index);
      const p = prob.displayedProbs.get(index);
      const { pMin, pMax } = prob.bestProbs;
      const action = state === 'flag' ? 'flag' : 'unflag';
      if (p != null && pMin != null && pMax != null) {
        const score = scoreForAction({ prob: p, pMin, pMax, action });
        if (score != null)
          operationStore.onRecordEfficiency({
            index,
            row: r,
            col: c,
            prob: p,
            pMin,
            pMax,
            score,
            action,
          });
      } else {
        // 孤立或首步旗标，无约束时视为最优
        operationStore.onRecordEfficiency({
          index,
          row: r,
          col: c,
          prob: p ?? 0,
          pMin: pMin ?? 0,
          pMax: pMax ?? 0,
          score: 1,
          action,
        });
      }
    }
    flagged.value += (state === 'flag' ? 1 : 0) - (prevFlag ? 1 : 0);
    trackEvent(
      state === 'flag'
        ? 'flag_set'
        : state === 'question'
          ? 'flag_question'
          : 'flag_unset',
      { index, level: level.value },
    );
    scheduleSnapshot(
      state === 'flag' ? 'flag' : prevFlag ? 'unflag' : 'question',
      index,
    );
  }

  async function onOpen(item, index, delayMs = 0, gridItems) {
    const prob = useProbabilityStore();
    if (!isRealStart.value) {
      doRealStart(index);
      // 开始记录每分钟操作
      operationStore.onUpdateOperateRecords('');
      await nextTick();
      onOpen(grid.value[index], index, 0, gridItems);
      return;
    }

    // 仅玩家主动点开（delayMs===0 且未通过递归展开）时计分；递归展开的空白连开不计分
    const isUserAction = delayMs === 0;
    if (isUserAction) {
      const { row, col } = getRowCol(index);
      // 首步必定安全（规避地雷），或孤立无约束时直接满分
      if (opened.value === 0 && flagged.value === 0) {
        operationStore.onRecordEfficiency({
          index,
          row,
          col,
          prob: 0,
          pMin: 0,
          pMax: 0,
          score: 1,
          action: 'open',
        });
      } else {
        const p = prob.displayedProbs.get(index);
        const { pMin, pMax } = prob.bestProbs;
        if (p != null && pMin != null && pMax != null) {
          const score = scoreForAction({ prob: p, pMin, pMax, action: 'open' });
          if (score != null)
            operationStore.onRecordEfficiency({
              index,
              row,
              col,
              prob: p,
              pMin,
              pMax,
              score,
              action: 'open',
            });
        } else {
          // 无约束或概率缺失时视为最优（与当前最低一致）
          operationStore.onRecordEfficiency({
            index,
            row,
            col,
            prob: p ?? 0,
            pMin: pMin ?? 0,
            pMax: pMax ?? 0,
            score: 1,
            action: 'open',
          });
        }
      }
      if (delayMs === 0)
        trackEvent('open_cell', {
          index,
          is_bomb: !!item.isBomb,
          level: level.value,
        });
    }

    if (item.isBomb) {
      prob.clearHintIfOpened(index);
      return doStop(false, index, gridItems);
    }
    // 同步到 grid 供概率计算使用
    if (grid.value[index] && !grid.value[index].isOpen)
      grid.value[index].isOpen = true;
    prob.clearHintIfOpened(index);
    opened.value += 1;
    if (opened.value >= total.value - bombNumber.value) {
      return doStop(true, null, gridItems);
    }
    // 如果点开的节点为 0，则点开附近的节点
    openGridItem(item, index, delayMs, gridItems);
    if (isUserAction) scheduleSnapshot('open', index);
    // 玩家手势结束、棋盘已稳定：旧精算作废，为新盘面重排（级联展开是同步的，到这里已全部完成）
    if (isUserAction) prob.bumpBoardVersion();
  }

  function onOpenAll(item, index, gridItems) {
    const prob = useProbabilityStore();
    if (item.count === 0) {
      return;
    }
    const x = index % column.value;
    const y = (index / column.value) >> 0;
    let count = 0;
    const items = [];
    const targetIndices = [];
    for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row.value); i++) {
      for (let j = Math.max(0, x - 1); j < Math.min(x + 2, column.value); j++) {
        if (i === y && j === x) continue;
        const idx = i * column.value + j;
        const gridItem = gridItems.value[idx];
        if (gridItem.isFlag) {
          count++;
        } else {
          items.push(gridItem);
          targetIndices.push(idx);
        }
      }
    }
    if (count === item.count) {
      // 双击批量打开视为绝对安全决策，固定满分 10（评分始终记录）
      if (targetIndices.length) {
        const { pMin, pMax } = prob.bestProbs;
        const avgProb =
          targetIndices.reduce(
            (a, ti) => a + (prob.displayedProbs.get(ti) ?? 0),
            0,
          ) / targetIndices.length;
        const { row, col } = getRowCol(index);
        operationStore.onRecordEfficiency({
          index,
          row,
          col,
          prob: avgProb,
          pMin: pMin ?? 0,
          pMax: pMax ?? 0,
          score: 1,
          action: 'chord',
        });
        trackEvent('chord_open', {
          center_index: index,
          opened_count: targetIndices.length,
          level: level.value,
        });
      }
      for (const gridItem of items) {
        gridItem.open();
        if (isFailed.value) return;
      }
      scheduleSnapshot('chord', index);
    }
  }

  function onLevelChange(newLevel, gridItems) {
    localStorage.setItem('level', newLevel);
    level.value = newLevel;
    row.value = Levels[newLevel].row;
    column.value = Levels[newLevel].column;
    doStart(true, gridItems);
    trackEvent('level_change', { new_level: newLevel, level: newLevel });
  }

  function openGridItem(item, index, delayMs = 0, gridItems) {
    if (item.count) {
      return;
    }
    const x = index % column.value;
    const y = (index / column.value) >> 0;
    for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row.value); i++) {
      for (let j = Math.max(0, x - 1); j < Math.min(x + 2, column.value); j++) {
        if (i === y && j === x) {
          continue;
        }
        const gridItem = gridItems.value[i * column.value + j];
        gridItem.open(false, delayMs + REVEAL_STEP_MS);
      }
    }
  }

  function onBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = '';
  }

  return {
    isStart,
    isRealStart,
    isFailed,
    isSuccess,
    level,
    row,
    column,
    flagged,
    opened,
    timeCount,
    total,
    bombNumber,
    gridStyle,
    grid,
    getRowCol,
    scheduleSnapshot,
    restoreToSnapshot,
    handleDownloadReplay,
    doStart,
    doRealStart,
    doStop,
    onMarkState,
    onOpen,
    onOpenAll,
    onLevelChange,
    openGridItem,
    onBeforeUnload,
  };
});
