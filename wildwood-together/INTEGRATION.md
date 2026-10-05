# 放置与运行说明

从 `C:\myApplication\workspace\mytest\261004` 复制到本仓库的 `wildwood-together/`。原项目保留不变，没有移动或删除用户文件。没有复制 node_modules、旧 dist、服务器 PID 或临时生成服务脚本；保留游戏源码、素材、授权、测试及可审查证据。

## 仓库集成

- 根 npm workspace：`wildwood-together`。
- 根首页链接：`./wildwood-together/`。
- 根 build：先构建各 workspace，再组装 `dist/wildwood-together/`。
- 前端资源改为相对路径；Vite `base: './'`，字体由构建管理；不再误请求站点根 `/art/`、`/fonts/` 或 `/ws`。
- 根 `npm run preview`：4173 端口运行 Node 权威世界与整个合集静态文件；WS 位于 `/wildwood-together/ws`，健康检查位于 `/wildwood-together/health`。
- 原有静态页面和游戏行为保持不变；根验证新增游戏资源检查和双客户端同房冒烟检查。

## 本地命令

在合集根目录使用仓库要求的 Node 22 与 npm 11：

```sh
npm ci
npm run check
npm run preview
```

若本机 npm 是 10，可使用 `npx --yes npm@11.18.0 run check`。单独开发游戏：

```sh
npm run dev --workspace=wildwood-together
```

单独完整验证：

```sh
npm run validate --workspace=wildwood-together
```

单独生产服务默认仍在 3000 端口、根路径运行；合集中预览不占用 3000。测试端口 3140／3137 需空闲，不干扰原项目 3000 端口服务。

## AWS／静态部署边界

现有发布脚本仅发布静态 dist；此次本地放置没有调整云资源或生产发布服务。不得把静态页面能打开当成联机已经上线。

以后如需 AWS 真联机，先按父目录 AGENTS.md 的流程测试、提交并推送，经用户授权配置持久 Node 服务和 Caddy 路由。可选两种运行方法：

1. 后端也提供全站：在仓库根运行 `PORT=4173 npm run preview`，代理所有请求到该进程。
2. 保持现有静态 Caddy 文件服务，仅代理游戏 WS／health：在 `wildwood-together/` 启动 `PORT=3001 HOST=127.0.0.1 GAME_BASE_PATH=/wildwood-together/ npm start`；Caddy 对 `/wildwood-together/ws`、`/wildwood-together/health` 使用 **保留路径** 的 reverse_proxy 到 127.0.0.1:3001，静态游戏文件仍由现有 Caddy 提供。不要使用会剥离前缀的 handle_path。

跨域后端也支持构建变量 `VITE_GAME_SERVER_URL=wss://你的后端/路径/ws`。该地址必须是真实可达服务，不能把示例地址当作已部署端点。世界仍为内存保存，没有账号或持久存档；保持原游戏重启／断线行为。

## 验证证据与提醒

`wildwood-together/evidence/integration-check.log`记录全 workspace lint、测试、类型／构建和六页面部署冒烟通过；部署冒烟同时验证两个真实浏览器连接前缀路径的同一房间。

安装依赖扫描报告 `evidence/dependency-audit.json`：现有依赖树有 4 告警（vitest / @vitest/mocker moderate，nanoid / brace-expansion high），没有擅自升级其他游戏依赖。原作风格生成素材的来源与授权边界见 `public/art/PROVENANCE.md`。

没有提交、推送、启动云部署或改变生产定时器；后续部署仍按父目录 AGENTS.md 的正式脚本进行。
