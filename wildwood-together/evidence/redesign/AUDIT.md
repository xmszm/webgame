# 重做验收审计（等待用户视觉确认）

目标 4686f480-0968-4678-876a-ae6831aad026。未标记完成。

| 要求 | 当前证据 | 状态 |
|---|---|---|
| 全屏森林、替换规整色块与网页侧栏 | `src/renderer.js` 缓存绘制地表与图像对象；`src/style.css` 绝对定位世界与边缘 HUD；`tests/visual.spec.js` 校验 1280×800 满屏与窄栏 | 已实现／验证 |
| 手绘墨线人物、树草、岩石、灌木、怪物与背包 | `public/art/` 17 PNG；alpha-preview、items-preview；生成提示和原图在本目录；产物检查校验构建图片 | 已实现／验证 |
| 走路、采集、攻击、受击、动态营火与昼夜 | server action／hitAt／hurtAt；renderer 分关节动作、命中粒子、动态火焰和光域；walk-frame／gather-frame、attack-hit、真实 webm 录屏与 night | 已实现，具体动作表现等待用户评价 |
| 保留已有真实联机和玩法 | 最终 validate 13 单元／网络用例、5 浏览器用例全部通过；multiplayer.json；两个实际浏览器共同资源／营火／黑夜／聊天／断线验证 | 已验证 |
| 地图、聊天、房间、指南、重连、触屏 | 浏览器真实操作测试通过；mobile.png；网络离线／恢复回归通过 | 已验证 |
| alpha 命中区域、素材加载及性能 | alpha 像素命中后双客户端采集回归通过；data-assets ready；performance.json 最新中位 17.8ms、95分位18.3ms，90帧，本机 Chrome 1280×800，无浏览器异常 | 已验证（非所有设备性能承诺） |
| 既有内容与用户改动保留 | baseline-src 与 baseline HTML 保存；未迁移栈，server 规则仅增加反馈字段；changes.diff 87KB | 已记录 |
| 来源／授权／行为文档 | public/art/PROVENANCE.md、README、DESIGN、PLAN；生成图像非原作提取、不宣称独占商用授权；原作参考截图仅 evidence 内 | 已记录 |
| 本地完整验证、产物、diff、录像与实际渲染 | validation.log 最终全量成功，源码manifest、changes.diff、PNG、webm；直接打开所有最终尺寸截图与原作参考比对 | 已执行 |
| 和《饥荒》一样，不擅自缩窄标准 | 使用 Steam 官方公开截图对照墨线、头身比例、光照、沉浸 HUD；没有原作完整动作帧或全量内容，测试不能证明视觉等同。必须展示真实成品并获得用户确认或明确差异反馈 | **未通过：待用户视觉验收** |

## 下一步与阻塞

可运行地址 http://localhost:3000 已启动新版生产服务。请用户实际体验并确认是否满足其要求，或指出仍偏离的角色比例／线条／场景色调／HUD／动作。本目标明确要求用户视觉确认，目前缺少这项外部输入，不能以通过测试擅自判定完成。收到反馈后需要用户 `/goal resume` 恢复执行。
