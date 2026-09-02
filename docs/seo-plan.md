# SEO 策略

- 数据源：Ahrefs「Organic Keywords」报告，**minesweeper.online**（行业第一竞品），US，2026-09-02 导出，784 词。
- 我方站点：https://minesweeper.meathill.com/（`/` 中文默认，`/en/` 英文）。
- 报告为美国数据，全球量更大（尤其中文词）；量/KD 均引自该报告。

## 核心结论

1. **头部词不可打**。`minesweeper`(290万/KD79)、`mine sweeper`(8.9万/KD81)、`minesweeper online`(1.7万/KD78)、`play minesweeper`(1.6万/KD79) 全部 KD 71–83，且竞品全站权重碾压。头部流量本质是「域名权威 + 拼写归一化」（mindsweeper/minesweepr 等几十个错拼词全被 Google 归到同一意图），新站无操作空间。
2. **信息词成片流失，是最大机会**。竞品没有内容页，how-to/rules 簇正被 AI Overview 和内容站成片抢走：`how do you play minesweeper`(3800/KD73，第6→Lost)、`minesweeper rules`(1100/KD71，第1→Lost)、`how to play minesweeper google`(2400，第1→7)、`how to play minesweeper game`(Lost)、`minesweeper numbers`(Lost) 等。
3. **低 KD 缝隙多**。`saolei`(2000/KD0)、Google 扫雷 how-to 子簇(KD26–60)、Windows 怀旧簇(KD13–35)、`minesweeper download`(1000/KD14)、`daily minesweeper`(60/KD40) 等都低于新站可攻门槛。
4. **我方差异化即内容弹药**：概率热力图、提示、决策效率复盘、免右键/双击批量打开（苹果鼠标/触摸板/移动端）——正好承接 Google 扫雷「无鼠标怎么玩」等 query，且竞品无法复制。

## 关键词路线图

每个内容页都是独立任务：静态 HTML、双语、canonical/hreflang、进 sitemap、与游戏页互链。

### P1 扫雷教程/规则页 → `/guide/how-to-play` + `/en/guide/how-to-play`

| 关键词 | 量/KD | 竞品现状 |
| --- | --- | --- |
| how do you play minesweeper | 3800 / 73 | 第6 → Lost |
| minesweeper rules | 1100 / 71 | 第1 → Lost |
| minesweeper how to play | 450 / 75 | Lost |
| what is minesweeper | 400 / 70 | 第4 |
| how to play minesweeper game | 30 / 65 | Lost |

中文侧打：扫雷怎么玩、扫雷规则、扫雷技巧、扫雷数字含义。
写法：终极教程（规则 → 数字/插旗/双击 → 常见误区 → 进阶），直接答案放开头，配原创截图 + B 站/YouTube 视频（VideoObject），文末引流本站学习模式。

### P2 Google 扫雷怎么玩 → `/guide/google-minesweeper` + 英文版

| 关键词 | 量/KD | 竞品现状 |
| --- | --- | --- |
| how to flag in google minesweeper | 20 / 26 | Lost |
| how to play google minesweeper without a mouse | 50 / 39 | New |
| how to play minesweeper on google | 300 / 56 | 第10 |
| how do you play google minesweeper | 30 / 56 | 第8 |
| how to flag a mine in google minesweeper | 30 / 60 | Lost |
| how to play minesweeper google | 2400 / 64 | 第1 → 7 |

与免右键/触摸板/移动端特性严丝合缝，竞品无法承接。中文侧：谷歌扫雷怎么玩、没有鼠标怎么玩扫雷。

### P3 概率计算器工具页 → `/tools/probability-calculator` + 英文版

- 目标词：minesweeper probability calculator、minesweeper solver、minesweeper odds、扫雷概率计算器（竞品报告未覆盖，属增量蓝海，量需另行查证）。
- 实现：复用 `src/solver` 概率引擎，做一个可粘贴/还原棋盘、输出每格概率的纯前端工具页。
- 价值：工具页是最强外链磁铁（社区/教程/博客自发引用），直接拉动全站权重。

### P4 Unblocked 落地页 → `/unblocked` + 英文版

| 关键词 | 量/KD | 竞品现状 |
| --- | --- | --- |
| minesweeper unblocked | 2300 / 62 | 第4 |
| unblocked minesweeper | 100 / 45 | 第7 |
| minesweeper online unblocked | 20 / 73 | 第5 |

轻量直玩页：免下载、HTTPS、支持触屏，页面即玩。正文平实描述「可在学校等受限网络访问的在线扫雷」，不做对抗性表述。

### Backlog（按性价比排序）

1. `saolei`(2000/KD0，竞品第28)：中文站自然覆盖 pinyin 词 + 中文词 `扫雷`(4800/KD65)、`在线扫雷`、`扫雷在线`。
2. `minesweeper download`(1000/KD14)：PWA 安装引导页（配合 manifest，桌面/手机「添加到主屏幕」）。
3. Windows 怀旧簇(KD13–35)：`windows xp minesweeper`(30/13)、`windows 95 minesweeper`(30–50/32)、`windows 98 minesweeper`(35)、`old minesweeper`(250/68) → `/guide/windows-minesweeper`。
4. `daily minesweeper`(60/KD40)：产品加每日挑战 + `/daily` 页，天然复访。
5. 大棋盘：`minesweeper 1000x1000`(100/69)、`giant minesweeper`——已有 16×30，可写超大棋盘玩法页。
6. 多语言页：`сапер`(俄)、`buscaminas`(西)、`dò mìn`(越)、`minesweeper spielen`(德)——竞品在俄语市场根基深，非优先。

## 技术 SEO 原则

- **内容页必须是静态 HTML**：内容子站用 Astro（`site/`，pnpm workspace 子包），构建期直出正文、零框架 JS；游戏 SPA 完全不动。产物由 `scripts/merge-dist.mjs` 并入游戏 `dist/`，同时重生成整站 `sitemap.xml`（游戏 2 页 + 内容页自动收录，含 lastmod）。
- 构建链：`pnpm build` = vite build → astro build → merge；写作预览用 `pnpm dev:site`（Astro dev，http://localhost:4321）。
- 每页双语互为 hreflang + 各自 canonical；`path` 传语言中立路径（如 `/guide/how-to-play/`），`SeoHead` 自动派生 en 前缀与 x-default；URL kebab-case、目录式尾斜杠。
- 内链：内容页 ↔ 游戏页互链，锚文本带关键词；游戏 UI 加「教程」入口（待办）。
- 结构化数据：`SeoHead`/`GuideLayout` 自动生成 Organization + BreadcrumbList + FAQPage + HowTo；配视频后加 VideoObject。

### 新增内容页 checklist

1. 建 `site/src/pages/<路径>.astro`（中文）与 `site/src/pages/en/<路径>.astro`（英文），复用 `GuideLayout`，两页传相同的语言中立 `path`。
2. `pnpm dev:site` 预览，`pnpm build` 验证并确认 sitemap 收录新 URL。
3. 玩法特性相关的截图/图表配 alt 后再配 `<figure>`；有视频再补 VideoObject。
4. 需要游戏站内入口（导航/页脚）时回 `src/App.vue` 增加。
5. 在本文档路线图勾掉对应项。

## SERP 特性与 GEO

- 该词簇 SERP 特性密集：AI Overview、People also ask、Video preview、Image pack。
- 写法面向 AI 引用：每页开头一段直接答案，小标题即问题句式；同步维护 `public/llms.txt`。
- 图片：原创截图/图表 + 描述性 alt，打 Image pack。
- 视频：B 站教学视频同步传 YouTube，页面嵌入 + VideoObject，打 Video preview。
- 论坛类 feature：在 Reddit r/minesweeper、StackExchange 回答并留链。

## 外链计划

- 已有资产：B 站教学视频简介、blog.meathill.com 文章互链、GitHub README、机核 gcores 推广帖（撰写中）。
- P3 工具页优先上线，作为外链磁铁。
- 社区分发：Reddit r/minesweeper、V2EX/掘金/知乎、独立开发者社区。
- 目标：先积累到能吃 KD ≤ 60 的词，再攻 60–73 的 P1 簇；不追 KD 80+。

## 明确不做

- 拼写错误词群（mindsweeper/minesweepr…）：Google 归一化后由权威决定，无操作空间。
- `minesweeper google`(33K) 等导航词：Google 自己的 doodle 占位。
- 买链接、刷点击、AI 群发低质内容页（helpful content 风险）。
- 为 KD 70+ 头部词投入内容预算。

## 度量

- Google Search Console：提交 sitemap，按季度看收录、impression、CTR、目标词位次（人工操作）。
- GA4 已有；重点看内容页 → 游戏页的转化路径。
- 里程碑：3 个月内 5 个内容页被收录且 P1/P2 词进前 20；6 个月内进前 10。
