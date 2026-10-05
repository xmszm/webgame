# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

用户请求「饥荒联机网页版」。完成目标要求可游玩的中文生存游戏与真实多人联机，而非静态概念页面。

## Capabilities and Constraints

探索、采集、物品、制作、生存状态、昼夜危险、共享世界。保留用户文件（初始目录为空）。不使用原作专有角色、名称或美术来冒充官方移植。

## Stack

本轮实现选择（尚非用户指定）：原生浏览器 JavaScript / Canvas，Node.js / WebSocket 服务端权威世界，Vite 构建。用户未指定框架或部署平台。

## Users

推定：希望通过浏览器与朋友共同玩生存游戏的中文用户。支持键盘鼠标和触屏。

## Operating Context

推定：单 Node 进程运行，朋友通过房间码或同一网址连接。世界在进程内保存，不宣称持久存档或兼容原作服务器。

## Evidence on Hand

初始目录为空；没有原作源码、授权素材或现成 CI。将创建单元测试、真实浏览器双客户端测试及截图证据。

## Open Decisions

原作内容精确复刻、特定框架、公开部署与美术授权均未由用户指定。本实现是独立原创生存联机游戏，不宣称原作全量功能或官方移植。
