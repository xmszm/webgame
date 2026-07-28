# WebGame Monorepo

一个可统一安装、构建和部署的 Web 游戏集合。根入口包含四款游戏：

- `starbound-brothers`：Phaser 3 原创超级马里奥式横版平台游戏。
- `fruit-ninja`：Phaser 3 水果忍者游戏。
- `5.6-sol我的世界`：Three.js 第一人称方块游戏。
- `gpt-5.5我的世界`：原生 Canvas 方块游戏。

## 环境

- Node.js 22 或更高版本
- npm 11

## 一键构建

```bash
npm ci
npm run build
```

完整静态站点会生成到根目录 `dist/`：

```text
dist/
├─ index.html
├─ fruit-ninja/
├─ starbound-brothers/
├─ 5.6-sol我的世界/
└─ gpt-5.5我的世界/
```

本地预览构建结果：

```bash
npm run preview
```

## 验证

```bash
npm run check
npm run test:deploy
npm run test:e2e
```

`npm run check` 会运行所有 workspace 的 lint、单元测试、类型检查、生产构建，并通过 Playwright 打开聚合站和四款游戏，检查部署路由、画布、控制台及资源请求。`npm run test:deploy` 可单独复验已有 `dist/`，`npm run test:e2e` 会额外运行三个现代游戏各自的完整交互测试。

## 部署

### GitHub Pages

推送到 `main` 后，[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) 会构建并发布 `dist/`。仓库首次使用时，在 GitHub 的 **Settings > Pages > Build and deployment** 中将 Source 设为 **GitHub Actions**。

### Vercel

导入仓库即可；`vercel.json` 已配置 `npm ci`、`npm run build` 和输出目录 `dist`。

### Netlify

导入仓库即可；`netlify.toml` 已配置 Node.js 22、统一构建命令和发布目录。

## Workspace

根 npm workspace 管理两个需要编译的应用。原生 Canvas 游戏没有第三方依赖，由聚合脚本直接复制到最终产物。每个游戏仍保留独立的源码、测试和开发命令。
