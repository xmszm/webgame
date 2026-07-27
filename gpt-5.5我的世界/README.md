# gpt-5.5我的世界

WebGame 聚合项目中的首个游戏：一个静态可运行的 Minecraft 风格方块沙盒。

## 运行

在项目根目录启动静态服务器：

```bash
python -m http.server 4173
```

访问聚合入口：`http://127.0.0.1:4173/index.html`。

直接进入游戏：`http://127.0.0.1:4173/gpt-5.5我的世界/index.html`。

## 结构

```text
gpt-5.5我的世界/index.html        游戏页面
gpt-5.5我的世界/src/styles.css   游戏界面和响应式样式
gpt-5.5我的世界/src/main.js      游戏启动、主循环和 UI 事件绑定
gpt-5.5我的世界/src/game/        世界、玩家、输入、渲染、UI、存档模块
```

## 当前玩法

随机世界生成、昼夜推进、玩家移动、挖掘、放置、热栏选择、触屏方向键、本地保存和重置确认。
