# 星跃兄弟

原创超级马里奥式横版平台游戏，使用 Phaser 3、TypeScript 和 Vite 构建。玩家可以通过键盘或触控移动、跳跃、收集星币、踩击敌人、避开尖刺与沟壑，并完成三段逐步解锁的关卡。

## 本地运行

```bash
npm run dev --workspace=starbound-brothers-platformer
```

## 验证

```bash
npm run lint --workspace=starbound-brothers-platformer
npm run test --workspace=starbound-brothers-platformer
npm run build --workspace=starbound-brothers-platformer
npm run test:e2e --workspace=starbound-brothers-platformer
```

所有视觉素材由游戏代码运行时绘制，音效由 Web Audio API 合成；详见 `public/assets/ASSETS.md`。
