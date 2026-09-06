# 开发笔记

长期有效的架构决策与踩坑记录。写给三个月后加入的新人：只解释"为什么"，不复述代码。

## 求解器（`src/solver/probability.js`）

- **旗不可信**：旗只是玩家猜测、可能插错。约束只看已打开的数字格，`need` 不扣减旗数；剩余雷数恒为 `bombNumber`；所有未开格（含旗/问号）都是未知变量。后果：中残局前沿易连成上百变量的巨大分量，无界 DFS 会卡死主线程十几秒。
- **有界搜索**：单次 `computeProbabilities` 总节点预算 `CALL_NODE_BUDGET=100000`，目标最坏情况 <500ms。预算耗尽回退 forced 检查 + 平均近似，保证必有界。
- **计算顺序**：O(n) 约束传播先行（定死格直接落子）→ 分量拆分 → 小分量精确枚举 → 大分量近似。重叠边界规则取代子集规则（2026-09 实测更紧）。
- **后台精算**：同步只给近似的大分量，用 `createForcedRefiner` 在 `requestIdleCallback`（Safari 退化为 `setTimeout`）分片补找 forced，找到即覆盖显示。`refinedMap` 只对当前 `boardVersion` 有效，开格变化即作废；插旗/拔旗不改变约束，不作废。
- **依赖纪律**：`probResult` 只依赖"哪些格子已开"（`opened` + `isOpen` 遍历），插旗不触发重算——之前每次点旗全盘枚举是卡顿来源之一。

## 复盘链路

- 快照（`board-replay.js` 位串 `encodeGridState`）→ 操作/效率事件（`operationRecords` store）→ 图表（`chart-data.js`，RPM 桶宽 `SECONDS_PER_BUCKET=6`）→ JSON 导出（`replay-export.js`）。图表点击回放走 `applySnapshot` 完整恢复旗数/开格数/计时器。
- 评分采用固定差距扣分（`scoreForAction`，`SCORE_GAP_FULL=0.5` 扣满）：顺利局不再被系统性打低分，危险局点差格仍得低分。双击批量打开（chord）视为绝对安全决策，固定满分。

## 构建链（游戏 + 内容子站）

- `pnpm build` = vite build（游戏 SPA）→ astro build（`site/` workspace 子包，静态 HTML、零框架 JS）→ `scripts/merge-dist.mjs` 并入 `dist/` 并重生成整站 `sitemap.xml`。游戏 SPA 不动，内容页纯静态。
- `dist/` 不进仓（gitignored），本地有构建产物属正常。
- `meathill-brand` 走 npm registry，不提交 tgz。

## 多语言

- 游戏 UI 仅 zh/en（`src/locales` + `src/i18n.js`）；内容页 6 语言（zh/en/es/ru/vi/de，`site/src/pages`）。其它语言页的"开始游戏"落到 `/en/`。
- 语言唯一来源：`SUPPORTED_LOCALES` 与 `LOCALES`（含 URL path）定义在 `src/i18n/` 相关模块，`App.vue` 只消费不重复定义。内容子站侧组件 Props 只认 `SiteLang` 联合类型（`site/src/i18n.ts`），新增语言时同步改它；`SiteNav`/`SeoHead` 保持 `string` + fallback，刻意宽容。`document.lang` 映射（zh→zh-CN）与 hreflang 互指逻辑集中在一处。
- SEO：内容页 `SeoHead`/`GuideLayout` 自动生成 Organization + BreadcrumbList + FAQPage + HowTo；首页 JSON-LD 用 WebSite + WebPage，不伪造评分（2026-09 降级决策）。

## 框架坑

- `operation-chart.vue` 用 `defineAsyncComponent` 懒加载，避免首屏拉起 chart.js。
- GA 的 `gtag` 调用全部经 `trackEvent` 包一层 try/catch，无痕模式/屏蔽插件下不抛错。
- `index.html` 内联的 `aria-hidden` MutationObserver 是为了修复 Google Vignette 误标 body，具体见行内注释，勿删。
