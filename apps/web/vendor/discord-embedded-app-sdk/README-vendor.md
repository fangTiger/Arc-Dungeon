# Discord Embedded App SDK（内嵌副本）

来源：`@discord/embedded-app-sdk@2.5.0` 发布产物中的 `output/**/*.mjs`。

## 为什么内嵌

本项目约定**无 npm 运行时依赖、无构建工具**。该 SDK 的发布产物已把
`big-integer`、`decimal.js-light` 等依赖打进包内，70 个 `.mjs` 文件**全部为相对导入、
零裸导入**，因此可以由浏览器原生 ESM 直接加载，无需打包。

`scripts/check-static.mjs` 会断言本目录下不存在裸导入——一旦升级后出现裸导入，
静态检查会红灯，而不是等到浏览器运行时才炸。

## 升级方式

```
npm pack @discord/embedded-app-sdk@<版本>
tar xzf discord-embedded-app-sdk-<版本>.tgz
# 用 package/output/ 下的全部 .mjs 覆盖本目录，并更新此处版本号
```

升级后必须重跑 `npm run check:static`。
