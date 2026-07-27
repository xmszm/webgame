# 水果忍者：刀锋果园

基于 Phaser 3、TypeScript 和 Vite 的完整 Web 切水果游戏。项目不依赖远程图片或音频服务，可离线加载全部视觉资源；音效由 Web Audio API 实时合成。

## 游戏内容

- 冒险模式：六个独立关卡，目标分数、时限、重力、风向、抛射批次、炸弹和特殊水果概率逐关变化。
- 街机模式：90 秒高密度得分挑战，炸弹扣分但不损失生命。
- 禅境模式：60 秒无炸弹连斩。
- 生存模式：更高炸弹概率和三条生命限制。
- 五种普通水果、炸弹、黄金果、冰封果和狂热果。
- 连斩倍率、生命、漏切、评级、关卡解锁、本地进度和静音偏好。
- 鼠标拖动、移动端触控滑动及键盘空格挥刀。

## 本地运行

```bash
npm install
npm run dev
```

Vite 会输出本地访问地址。生产构建位于 `dist/`：

```bash
npm run build
npm run preview
```

## 验证

```bash
npm run check
```

`check` 依次运行 ESLint、Vitest 规则测试、TypeScript 与 Vite 生产构建、Playwright 桌面和移动端浏览器测试。浏览器测试产物写入 `artifacts/`，包含菜单、游戏中和结算状态截图，并检查画面像素、控件溢出、控制台错误和失败资源请求。

## 资源

本地资源清单位于 [`public/assets/ASSETS.md`](public/assets/ASSETS.md)。所有 SVG 均为本项目制作并随应用发布。
