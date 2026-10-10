# ARC Dungeon

基于 Circle Arc Testnet 的独立像素地牢版本。保留现有职业、战斗、地牢、门票、皮肤与本地结算，并新增钱包及链上战绩面板。

ARC 品牌使用原创「像素拱门＋星点」标记，浅蓝色门户形成 A 字轮廓，配暖金色星点。入口、职业选择和主城使用 Canvas 几何绘制，顶栏和 favicon 使用同源 SVG：`apps/web/assets/branding/arc-logo.svg`。此图形是游戏自定义标记。

## 启动

需要 Node.js 22+（验证环境为 25.8.0）和 Python 3。没有第三方 npm 运行依赖。

```bash
cd arc-rpg
npm run dev
```

打开 [本地游戏](http://127.0.0.1:5174)。在原项目工作区内，可以运行 `npm --prefix arc-rpg run dev`。

## 游玩与发布战绩

1. 游戏入口选择游客，按 Enter；选择职业后按 Enter 进入主城。
2. 使用方向键或 WASD 移动，在公告板领取每日门票，靠近传送门按 E 进入地牢；J/空格攻击，K 闪避，U/I/O/P 使用技能。
3. 顶栏连接 MetaMask 等注入式 EVM 钱包，点击切换测试网。未添加网络时钱包会请求添加 Arc Testnet。
4. 从 [Circle 水龙头](https://faucet.circle.com) 领取测试 USDC，用于 gas。
5. 地牢死亡或撤离并完成结算后，打开「链上战绩」，点击「发布本局战绩」并在钱包中确认交易。
6. 面板区分待确认、已确认和执行失败，提供交易链接、继续查询与历史失败战绩重试。刷新后重新连接同一钱包可恢复记录。

战绩发布是携带公开 JSON 的零金额自转账，消耗测试 USDC gas。记录包括协议版本、局 ID、种子、职业、最高层数、Boss 数、探索率和结束原因；不含 Discord 资料、头像或存档。战绩为玩家自行提交，不构成服务端认证或防作弊证明。积分、奖励、门票与皮肤目前仍为本地模拟资产。

游客存档与钱包归属独立：连接钱包不会迁移游戏存档，发布时使用当前钱包署名。当前只保留最近一局尚未发布的战绩；已经发布的交易按钱包保留历史。

## 测试网配置

| 参数 | 值 |
| --- | --- |
| Chain ID | 5042002 / `0x4cef52` |
| RPC | `https://rpc.testnet.arc.io` |
| 浏览器 | `https://explorer.testnet.arc.io` |
| 原生 gas 币 | USDC，18 位小数 |

集中配置位于 `apps/web/src/arc/network.js`，依据 [Arc 官方连接文档](https://docs.arc.io/arc/references/connect-to-arc) 于 2026-10-10 核验。原生 gas 与 ERC-20 USDC 使用同一余额，ERC-20 接口精度为 6；后续资金合约需按调用接口选择精度，参见 [官方 gas 文档](https://docs.arc.io/arc/references/gas-and-fees)。

## 开发结构

```text
arc-rpg/
  apps/web/           独立前端、美术与 vendor 快照
    src/arc/          网络、钱包、战绩、结算事件、面板
  test/               ARC 专属测试与保留玩法的回归测试
  scripts/check.mjs   JS 语法、模块导入引用与静态资源检查
  package.json        独立启动和验证命令
```

前端快照来自仓库 `1c915db1125757aa16fa2a59add5afb713cd8f40` 加当前工作区前端状态，仅复制 `apps/web` 的公开资源；未复制 `.env`、后端、数据库或部署绑定。资源与 vendor 的原有许可文件随快照保留。后续修改在本目录开发，玩法修复按需显式同步。

ARC 经济、语言、战绩使用 `arc:`/`arc.` 存储键，与原版隔离。Discord 登录未配置公开客户端 ID，默认游客入口。现代浏览器通过 Web Locks 保护跨标签页的提交与日志写入；不支持 Web Locks 时仅保护同页面多实例，建议单标签页操作。浏览器禁用存储时当前会话仍可提交，但需要自行保存交易链接。

## 验证

```bash
npm run verify
```

涵盖钱包拒绝请求、添加/切链、账户竞态、零金额战绩交易、收据验证、幂等、刷新恢复、存储降级，以及现有玩法回归。浏览器冒烟结果和真实链广播边界见 `VERIFICATION.md`。

## 部署

独立仓库的根目录包含 `vercel.json`，使用静态部署，输出目录为 `apps/web`，无需构建命令或环境变量。测试、开发脚本和规范文档不上传到线上站点。将 GitHub 仓库关联至独立的 Vercel 项目后，`main` 分支用于生产发布。
