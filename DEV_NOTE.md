# 开发笔记

长期有效的架构决策与踩坑记录。写给三个月后加入的新人：只解释"为什么"，不复述代码。

## 求解器（`src/solver/probability.js`）

- **旗信任策略分场景**：实时对局（学习模式）默认 `trustFlags=false`，旗只是玩家猜测、可能插错，约束只看已打开数字格、剩余雷数恒为 `bombNumber`，避免错旗误导玩家点雷（中残局前沿易连成上百变量的大分量，需配合有界搜索）；静态概率计算器（`Calculator.astro`）默认传入 `{ trustFlags: true, constrainZeroCells: true }`，把玩家手动录入的 `🚩` 与空白 `0` 格作为已知条件参与消减，同时提供开关切回 `trustFlags=false` 验错模式。
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
- IndexNow key 放在 `public/<key>.txt`，文件名即内容，随静态资源公开。`pnpm indexnow` 必须等该文件在线上返回 200 后再跑；构建期提交会被拒。
- `meathill-brand` 走 npm registry，不提交 tgz；站点级屏蔽清单（`EXCLUDED_BRAND_SITE_IDS`）统一收敛在 `src/brand-network.js`，游戏顶栏/页脚与 Astro `SiteFooter.astro` 共享同一份过滤结果。

## 多语言

- 游戏 UI 与内容子站全栈对齐 **8 语言**（`zh/en/es/ru/vi/de/pt/fr`）：游戏侧为 `src/locales/*.json` + `src/i18n.js` + `public/<lang>/index.html` 与 `public/(<lang>/)unblocked/index.html`（独立全屏 SPA 落地页，彻底废弃 iframe 方案）；内容侧为 `site/src/pages`（每语种 3 页：`guide/how-to-play`、`guide/google-minesweeper`、`tools/probability-calculator`，整站 `sitemap.xml` 共 40 个 URL）。`site/src/i18n.ts` 的 `gameHomePath()` 按语言返回对应游戏首页。
- **Unblocked 独立落地页架构决策**：`/unblocked/` 与各语种 `/<lang>/unblocked/` 原本套用 Astro 文章模板内嵌 `<iframe src="/">`，导致棋盘被截断、双重顶栏和双重滚动条。改造后直接作为游戏 SPA 的独立全屏落地页（无 iframe、无文章壳、全尺寸棋盘舒展展开），通过定制专属的 Title、Description、Keywords 与 `#ssr-hero` 预渲染块承接海外及本土 SEO 流量，并在语言切换时保持在 unblocked 路径上无缝跳转。
- **核心游戏组件与多页面 SEO 文案解耦**：原本 `App.vue` 混合了 340+ 行游戏主循环、顶栏逻辑与固化的首页长文，导致 `/unblocked/` 加载时在棋盘下方显示了 100% 相同的首页教程，产生严重的搜索引擎重复页面 / 门页风险。拆分后：
  - `minesweeper-game.vue`：独立封装操作区（Toolbar）、棋盘网格（`#stage`）、局后复盘图表（`operation-chart`）与全局快捷键（F2/H/L），高内聚纯粹；
  - `app-header.vue`：独立承载品牌徽标、教程与多语言下拉（含 `/` 与 `/unblocked/` 同步跳转）、站点切换与难度选择；
  - `seo-home-content.vue` 与 `seo-unblocked-content.vue`：分别承载首页与 unblocked 专属的 SEO 教学、网络环境说明与完全独立的 FAQ 词条（8 语种对齐，互不雷同）；
  - `App.vue`：退化为干净轻量的顶层路由编排器（<60 行），单文件控制在 300 行规范内。
- 语言唯一来源：`SUPPORTED_LOCALES` 与 `LOCALES`（含 URL path）定义在 `src/i18n.js` / `src/seo-meta.js`，`App.vue` 只消费不重复定义。内容子站侧组件 Props 只认 `SiteLang` 联合类型（`site/src/i18n.ts`），新增语言时同步改它；`SiteNav`/`SeoHead` 保持 `string` + fallback，刻意宽容。`document.lang` 映射（`zh→zh-CN`、`pt→pt-BR`）与 hreflang 互指逻辑集中维护。
- 游戏壳的 locale 只由 pathname 决定，不用 `localStorage` 或 `navigator.language`。否则英文爬虫打开 `/` 会把 canonical 改写成 `/en/`。语言切换仍 `pushState` 到对应首页。
- SEO 与合规：内容页 `SeoHead`/`GuideLayout` 自动生成 Organization + BreadcrumbList + FAQPage + HowTo；首页 JSON-LD 用 WebSite + WebPage，不伪造评分（2026-09 降级决策）。因游戏 SPA 接入了 Google AdSense，全站多语言文案严禁宣称“无广告 / Ad-Free / sin anuncios”（由 `src/seo-content-site.test.ts` 守卫）。

## 教程页即时转化（`MiniBoard` + `StickyPlayCta`）

- `/guide/*` 教程页首屏挂载轻量原生 TS 的 9×9（10 雷）初级微缩棋盘（`site/src/components/MiniBoard.astro` + `mini-board-core.ts`，独立于 Vue 主包，gzip ~2.5 kB）：容器设 `contain: layout style paint` 并固定 9×9 网格占位高度保证 `CLS = 0`；81 个按钮延后到双 `requestAnimationFrame` 挂载，确保 H1 与首段继续作为 LCP。
- `StickyPlayCta.astro` 采用被动滚动监听 + `requestAnimationFrame` 节流，页面滚动超 30% 时滑出转化条，并通过 `IntersectionObserver` 在文末 `.cta-box` 进入视口时自动收起（收起态同步切换 `inert` 避免焦点落入屏外）。

## 首页 SSR / LCP（issue-12）

- 游戏首页不是真正的服务端渲染：各语言静态 HTML（根 `index.html` + `public/<lang>/index.html`）在 `#app` 内预置 `#ssr-hero`（H1 + `.ssr-intro` + `.ssr-guides` 教程内链），供爬虫/PSI 在无 JS 时也能看到标题、介绍与核心内容页内链；Vue mount 后整段被替换。
- 棋盘 `game.doStart` 延后到双 `requestAnimationFrame`，让 header H1 先成为 LCP，避免首屏被大量格子 DOM 抢走。
- `public/<lang>/index.html` 经 Vite 原样拷贝，脚本仍写 `/src/main.js`；`merge-dist.mjs` 的 `patchLocaleGameHtmlAssets` 在构建后把根页的 `/assets/*` CSS/JS 同步进去（否则线上 /en/ 等语言首页 JS 404、NO_LCP）。
- 首页 JSON-LD 已去掉 HowTo；Organization 补 `logo`。内容页 Guide 的 HowTo 保留。


## 框架坑

- **ref 不要穿过模板边界**：模板表达式会自动解包 ref，把 ref 对象当参数传给函数拿到的是裸值。子组件实例注册表放 store 里、用 `:ref="(el) => setGridItemRef(el, index)"` 函数 ref 收集（2026-09 曾因此导致空白级联全灭的回归）。
- **e2e 端口固定 5199**：本机 5173/5174 常被其他项目占用，`playwright.config.ts` 用 `--strictPort` 避免静默跑错应用；`pnpm dev --` 在 pnpm v10 下透传参数不可靠，webServer 直接调 `pnpm exec vite`。
- `operation-chart.vue` 用 `defineAsyncComponent` 懒加载，避免首屏拉起 chart.js。
- GA 的 `gtag` 调用全部经 `trackEvent` 包一层 try/catch，无痕模式/屏蔽插件下不抛错。
- Measurement ID 不进仓库。Vite 与 Astro 构建读取 `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`（Vercel 环境变量）；未设置就去掉 gtag，构建不因此失败，日志只说明是否注入。
- `index.html` 内联的 `aria-hidden` MutationObserver 是为了修复 Google Vignette 误标 body，具体见行内注释，勿删。

## 交互（棋盘惰性 + 快捷键）

- 终局棋盘不用 `pointer-events: none`：事件落到棋盘外会导致 `@contextmenu.prevent` 失效、原生右键菜单透出。改用 `game-over` 类（只改 cursor/hover）+ 格子 `disabled` prop + store 三动作 `!isStart` 兜底，事件仍被棋盘吞掉（Windows 版同款惰性）。
- `#stage` / `.grid-item` 用 `touch-action: manipulation` 禁双击缩放：保留 pinch、不伤无障碍，双击仍走 chord；`user-scalable=no` 不用。
- 快捷键走 `src/utils/shortcuts.js` 纯函数（F2/N 新开、H 提示、L 教学；F2 对齐 Windows 经典键位）：输入框聚焦、弹窗打开、长按连发、修饰键全部放行不抢键。评论弹窗另有 capture 隔离（见下节），快捷键里再加一道 `dialog[open]` 守卫。

## 评论（`src/comment-dialog.vue`）

- 复用 Awesome Comment 的 `meathill.com` 站点（`siteId=47de…`，域名已验证，无需新建站点），全站统一 `postId=https://minesweeper.meathill.com`，中英共用一个评论区。
- SDK 用 `awesome-comment@0.12.0` + `awesome-auth@0.1.5`（0.12 的 `init` 参数含 `siteId`/`locale`，与 keytest 的 0.10.3 不同；`turnstileSiteKey` 可选，官方生成代码没带就不用传）。
- 弹窗复刻 keytest 形式：Header 按钮 → `<dialog class="modal">` + 骨架屏，首次打开才动态 `import`（JS 走 unpkg，`/* @vite-ignore */` 必加，否则 vite 试图预构建远端 URL）。`close` 回焦 `body`，`keydown` capture 隔离传播但不 `preventDefault`（保证输入法与 ESC 原生关闭正常）。
- 样式必须走本地 `src/vendor/awesome-comment.css`（Vite 打包成独立懒加载 chunk），不经过 unpkg：unpkg 在部分网络下会 hang 住，JS 到了、CSS 没到时组件永久裸奔（2026-09 真实踩坑），且样式失败无从重试。CSS 选择器全在 `.awesome-comment` 作用域下，不会污染主站。
- CDN 被拦截时降级保留骨架、不影响游戏（`initialized` 失败回滚允许重试）。
