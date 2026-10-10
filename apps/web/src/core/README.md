# Core Modules

这里存放可测试的纯玩法逻辑：战斗、成长、地图和 Discord 世界词缀。Canvas 渲染层只消费这些模块的输出。

`discordActivity.js` 是 Discord 活跃度基础数据层：它只归一化 message、voice、reaction、thread、quest、check-in 等活动元数据，并按 Discord userId 与 UTC 日期聚合每日摘要。该模块不会保存消息正文、附件、嵌入内容、原始 payload、token 或 OAuth 信息；后续赛季积分、奖励、排行榜和玩法调制应优先消费每日摘要，而不是直接依赖原始 Discord 事件。

`discordTextIngestion.js` 和 `discordPersona.js` 组成 RIALO 灵魂档案卡的第一版基础：前者只允许按 Discord userId、频道白名单、时间窗和消息预算采集短期文本样本，样本必须带 `expiresAt`，单条原文默认且最高只保留 200 字符，并丢弃附件、嵌入内容、组件、贴纸和原始 payload；后者从未过期样本和活跃摘要中提取长期画像特征，生成灵魂原型、称号、阵营倾向、推荐职业和 NPC 第一印象。画像只用于展示和身份氛围，不提供经验、掉落、伤害、价格、奖励资格或惩罚字段，也不推断政治、宗教、健康、性取向、真实身份等敏感属性。
