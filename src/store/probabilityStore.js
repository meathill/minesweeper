import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  computeProbabilities,
  createForcedRefiner,
  getBestProbs,
} from '../solver/probability.js';
import { trackEvent } from '../analytics.js';
import { useGameStore } from './gameStore.js';

// 概率推断 + 后台精算 + 提示：读 gameStore 的盘面，只依赖"哪些格子已开"。
// 注意与 gameStore 的循环引用：此处在 setup 顶层调用 useGameStore 是安全的，
// 因为 gameStore 的 setup 顶层从不调用 useProbabilityStore（只在 action 内懒调用）。
export const useProbabilityStore = defineStore('probability', () => {
  const game = useGameStore();

  // 概率计算（玩家视角，不使用 isBomb）——始终计算用于评分，显隐仅由 showProbability 控制
  // 注意：概率只与"哪些格子已开"有关。旗只是玩家标记、不参与约束（见 solver 注释），
  // 因此插旗/拔旗不再触发重算——之前每次点旗都会触发一次全盘枚举，是卡顿的来源之一。
  const probResult = computed(() => {
    if (!game.isRealStart || !game.grid)
      return { map: new Map(), isApproximate: false };
    const _openDep = game.opened;
    game.grid.forEach((c) => c.isOpen);
    void _openDep;
    return computeProbabilities(
      game.grid,
      game.row,
      game.column,
      game.bombNumber,
    );
  });
  const probabilities = computed(() => probResult.value.map);
  const isApproximate = computed(() => probResult.value.isApproximate);

  // 后台精算：同步只给了近似值的大分量，在 idle 时补找 forced，找到就覆盖显示。
  // refinedMap 只对当前 boardVersion 有效；任何开格变化都会使其作废（见 bumpBoardVersion）。
  // 插旗/拔旗不改变约束，无需作废——与 probResult 去旗依赖保持一致。
  const boardVersion = ref(0);
  const refinedMap = ref(new Map());
  let refiner = null;
  let refineScheduled = false;
  const displayedProbs = computed(() => {
    if (refinedMap.value.size === 0) return probabilities.value;
    const merged = new Map(probabilities.value);
    for (const [k, v] of refinedMap.value) merged.set(k, v);
    return merged;
  });
  const bestProbs = computed(() => getBestProbs(displayedProbs.value));

  function idleCallback(fn) {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestIdleCallback === 'function'
    ) {
      return window.requestIdleCallback(fn, { timeout: 1500 });
    }
    // Safari 老版本没有 requestIdleCallback：退化为 setTimeout
    return setTimeout(
      () => fn({ timeRemaining: () => 10, didTimeout: false }),
      0,
    );
  }
  // 开格变化 => 旧精算作废；对局进行中则为新盘面安排精算
  function bumpBoardVersion() {
    boardVersion.value++;
    refinedMap.value = new Map();
    refiner = null;
    scheduleRefine();
  }
  function scheduleRefine() {
    if (refineScheduled || !game.isRealStart || !game.grid) return;
    const snap = probResult.value;
    if (!snap.isApproximate) return; // 全精确，无需精算
    refiner = createForcedRefiner(
      game.grid,
      game.row,
      game.column,
      snap.decidedSet,
    );
    if (refiner.total === 0) {
      refiner = null;
      return;
    }
    refineScheduled = true;
    const myVersion = boardVersion.value;
    idleCallback((deadline) => runRefineSlice(deadline, myVersion));
  }
  function runRefineSlice(deadline, myVersion) {
    refineScheduled = false;
    // 调度后盘面变了：旧快照整体丢弃，为新版重排（自愈，保证 chord 等多 bump 手势最终一定有精算在跑）
    if (myVersion !== boardVersion.value) {
      refiner = null;
      scheduleRefine();
      return;
    }
    if (!refiner || !game.isRealStart || !game.grid) {
      refiner = null;
      return;
    }
    const wallMs = Math.min(24, deadline?.timeRemaining?.() ?? 16);
    const { newly, done } = refiner.step({ fuelNodes: 80000, wallMs });
    // 切片执行期间若有新交互（版本号变了）：直接丢弃本次结果并为新版重排
    if (myVersion !== boardVersion.value) {
      refiner = null;
      scheduleRefine();
      return;
    }
    if (newly.size) {
      const m = new Map(refinedMap.value);
      for (const [k, v] of newly) m.set(k, v);
      refinedMap.value = m;
    }
    if (!done && game.isRealStart) {
      refineScheduled = true;
      idleCallback((deadline) => runRefineSlice(deadline, myVersion));
    } else {
      refiner = null;
    }
  }

  // 提示：最低概率格（优先有推断的前沿格，0% 绝对安全最优先）
  const hintIndex = ref(null);
  const hintFlashKey = ref(0);
  function handleHint() {
    if (!game.isRealStart || !game.grid) return;
    const frontierSet = probResult.value.frontierSet || new Set();
    let candidates = [];
    let minP = Infinity;
    for (const [idx, p] of displayedProbs.value) {
      const cell = game.grid[idx];
      if (!cell || cell.isOpen || cell.isFlag) continue;
      if (p < minP - 1e-9) {
        minP = p;
        candidates = [idx];
      } else if (Math.abs(p - minP) < 1e-9) {
        candidates.push(idx);
      }
    }
    if (candidates.length === 0) return;
    // 在并列最低（通常是大量 0%）中，优先有推断条件的前沿格，避免落在无推断的孤立区
    const frontierCandidates = candidates.filter((idx) => frontierSet.has(idx));
    const finalCandidates = frontierCandidates.length
      ? frontierCandidates
      : candidates;
    const pick =
      finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    hintIndex.value = pick;
    hintFlashKey.value++;
    trackEvent('hint_click', {
      hint_prob: displayedProbs.value.get(pick),
      hint_index: pick,
      level: game.level,
    });
  }

  function clearHintIfOpened(idx) {
    if (hintIndex.value === idx) {
      hintIndex.value = null;
    }
  }

  function getProbability(index) {
    return displayedProbs.value.get(index) ?? null;
  }

  function clearHint() {
    hintIndex.value = null;
  }

  return {
    probResult,
    probabilities,
    isApproximate,
    boardVersion,
    displayedProbs,
    bestProbs,
    hintIndex,
    hintFlashKey,
    bumpBoardVersion,
    scheduleRefine,
    handleHint,
    clearHintIfOpened,
    clearHint,
    getProbability,
  };
});
