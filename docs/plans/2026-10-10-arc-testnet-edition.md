# Arc 测试网游戏版本实现计划

**目标：** 在 `arc-rpg/` 提供现有游戏的独立可玩版本，接入钱包和链上战绩。

**架构：** 复制前端快照，新增 `src/arc/` 钱包、战绩发布与 DOM 面板。结算成功后发出事件；链上提交由玩家点击触发，本地游戏与交易状态解耦。

**技术栈：** 原生 JavaScript、Canvas、EIP-1193、Node 内置测试、Python 静态服务器。

## 1. 钱包适配

先在 `arc-rpg/test/arc-wallet.test.js` 覆盖无钱包、连接、4902 添加后切换、拒签、链和账户变化、提交前校验。运行 `node --test arc-rpg/test/arc-wallet.test.js` 确认失败，再在 `arc-rpg/apps/web/src/arc/wallet.js` 和 `network.js` 实现，重复运行直到通过。

## 2. 战绩发布

先在 `arc-rpg/test/arc-records.test.js` 覆盖结算数据、零金额交易、重复提交、刷新恢复、RPC 失败和收据回滚。运行对应测试确认失败，再实现 `records.js`。提交只返回 pending，查询完整交易与成功收据后才能 confirmed。

## 3. 前端集成

复制原 `apps/web/src`、`assets` 和 `vendor`，不复制密钥、数据库、后端和部署状态。修改 ARC 副本的 `index.html`、存储命名空间与展示品牌。在副本 `economySession.js` 的成功结算处接入 `arc:run-settled` 事件，加入面板入口。增加游戏结算集成测试验证事件只在成功时触发。

## 4. 验证和审查

执行 `npm --prefix arc-rpg run verify` 检查新代码测试、语法、资源和导入；执行原项目 `npm run verify` 检查回归。启动独立端口，在浏览器验证游客玩法和模拟钱包流程；真实钱包签名广播留给玩家操作并明确报告边界。检查 OpenSpec 任务与场景一致、原文件未变化后完成。
