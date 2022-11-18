扫雷小游戏
========

常见的扫雷小游戏 Vue3 + vite 复刻版。

来源：[免费线上讲习班：使用 vue3 开发扫雷游戏](https://blog.meathill.com/share/free-online-workshop-develop-minesweeper-with-vue3.html)

[DEMO](https://minesweeper-mz.vercel.app/)


课程安排
--------

* [使用 Vue3 + SFC playground 开发扫雷游戏](https://www.bilibili.com/video/BV1SB4y1E7hX/)
  1. Vue 组件开发游乐场，免环境学开发的神器
  2. 什么是 MVVM 框架
  3. Vue3 基础
  4. 使用 display:grid 画地图
  5. 生成地雷
  6. 生成游戏地图
* [Vue3 组件开发](https://www.bilibili.com/video/BV1JG4y1x7bS/)
  1. 父子组件间传递数据的方式
  2. `defineEmits` 和 `defineExpose` 的使用
  3. 使用变量切换状态
  4. 递归变更节点状态（最后拼错了导致翻车
* [优化游戏](https://www.bilibili.com/video/BV1xT411P735/)
  1. 添加胜利效果
  2. 添加难度选择
* [本地开发环境，使用 pinia](https://www.bilibili.com/video/BV1kP411P7ky/)
  1. 梳理回顾代码
  2. 修改布雷时机，让游戏更好玩
  3. 将项目迁移到本地
  4. 使用 pinia 存储记录


环境配置
--------

1. [Node.js](https://nodejs.org/) >= 16
2. [pnpm](https://pnpm.io) >= 7
3. 现代化浏览器，Chrome、Edge 等
4. [Git](https://git-scm.com)


开发环境
--------

1. clone 本项目到 `/path/to/minesweeper`
2. 安装依赖 `pnpm i`
3. 启动开发环境 `pnpm run serve`
4. 打开浏览器访问 `http://localhost:5173`


LICENCE
-------

[MIT](https://mit-license.org)
