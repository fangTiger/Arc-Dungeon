# ARC 版本验证记录

验证日期：2026-10-10。

- `npm --prefix arc-rpg run verify`：134 项测试全部通过；240 个 JS 模块语法通过；626 个本地模块/资源引用存在（包含 ARC LOGO 补充验证）。
- 原项目 `npm run verify`：624 项测试全部通过，静态文件与模块导入检查通过。已有未提交改动未被本次开发覆盖。
- `openspec validate add-arc-testnet-edition --strict`：通过。
- 官方公开 RPC 只读查询 `eth_chainId` 返回 `0x4cef52`，对应 5042002。
- 浏览器游客入口：Enter 进入职业选择，再 Enter 进入主城；画布正常显示。
- 浏览器模拟 EIP-1193 钱包：连接账户、4902 添加后再次切换、领取每日门票、启动真实游戏地牢、本地结算、主动发布零金额战绩、确认收据与交易数据、刷新后重新连接恢复已确认记录，全部通过。浏览器支持 Web Locks，控制台无错误与警告。
- 只读代码审查发现的多实例重复广播、历史失败记录重试、账户事件竞态及存储写入失败降级问题已修复并补充回归测试。

浏览器截图保存在原仓库 `output/playwright/arc-rpg-hub.png` 和 `output/playwright/arc-rpg-wallet-confirmed.png`。确认截图中的交易由模拟钱包生成，用于验证界面；不是公开测试网上的真实交易。

## ARC LOGO 补充验证

使用原创像素拱门和星点替换旧几何，清理入口、职业选择、主城及档案显示中的旧品牌文字。新增 4 项品牌测试验证几何独立性、主城实际绘制、各尺寸图文不重叠和 SVG 与 Canvas 一致。浏览器依次查看入口、职业选择和主城，顶栏、场景标记和 favicon 资源正常，控制台无错误与警告。截图为 `output/playwright/arc-logo-entry.png`、`arc-logo-class-selection.png`、`arc-logo-hub.png`。

## 验证边界

未使用真实钱包签名或广播测试网交易，未部署合约。RPC 连通性已核验；玩家需要安装钱包、领取测试 USDC，并完成一次真实发布以验证钱包兼容性和公开链确认。战绩由客户端提交，首版不提供防作弊验证或链上经济。
