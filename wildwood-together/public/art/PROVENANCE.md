# 游戏美术来源

本轮依据用户明确要求《饥荒》画面效果，采用手绘墨线、交叉排线、暗橄榄／赭色的视觉语言；不是从原作游戏包提取贴图，不声称官方素材或官方授权。

- 生成服务：本机配置的 gpt-image-2，实际生成调用结果保存在 `evidence/redesign/*generation.log`。
- 世界对象原图：`evidence/redesign/forest-atlas.png`，提示 `atlas.prompt.txt`。
- 物品原图：`evidence/redesign/items-atlas.png`，提示 `items.prompt.txt`。
- 地表：`terrain.png`，提示 `evidence/redesign/terrain.prompt.txt`。
- 透明精灵提取：`scripts/extract-art.py` 使用边缘连通白底分离，保留角色封闭区域内的浅色面部／衬衫；`sprites.json`、`items.json` 记录裁切坐标和尺寸。`evidence/redesign/alpha-preview.png`、`items-preview.png` 是真实底色上的透明检查。
- 动画：`src/renderer.js` 中的分关节角色摆动、资源摇晃、火焰曲线、火光与命中粒子为项目源代码实现，服务器同步动作时间戳。
- 参考画面：Steam 《Don't Starve Together》产品页公开截图，仅在 evidence 中用于比对，不随游戏发布。来源 https://store.steampowered.com/app/322330/Don't_Starve_Together/。

图像是生成输出，不把它们描述成原作原创团队作品；本记录不是对生成素材作独占版权或商用授权保证。若将作品作为官方移植发行或使用原作标识，需要自行取得相应授权。字体的独立 OFL 许可见 `public/fonts/OFL.txt`。
