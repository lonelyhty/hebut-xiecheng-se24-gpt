# 携程公开站点逆向调查

调查日期：2026-10-20（Asia/Shanghai）。用户目标为 https://www.ctrip.com/，后续明确为航空旅行一站式服务课程平台。

## 交付范围与证据边界

已留存公开首页的渲染结构、无障碍文本、1440×1000 截图、网络事务及可取得的响应资源，并由 REA 导出脚本、静态分析、检查聚焦模块和跟踪关系。另在此基础上独立实现“云程旅行”及本地业务验证。

这次没有获得携程服务端源码、真实支付/订单库、会员授权或航司库存。机票站页面返回了 whaleguard block；因此原站预订、支付、出票、值机内部流程保持未知。

## 已观察的公开界面

来源：`ev_39fe3d6d3a5141b3a0879c0692e1ee3893ec294690009f4a6a768c757049d432`。

- 桌面布局包含左侧业务导航、顶部搜索及账户/订单入口；酒店为首页默认主搜索区域。
- 首页展示酒店搜索、目的地内容、推荐与推广卡片，并提供机票、门票、行程助手、旅行地图等入口。
- 酒店搜索字段包括目的地、入住退房、房间住客、级别与关键词。这些是当前捕获页面的界面事实。
- 首页可见机票推荐链接指向 flights.ctrip.com 的独立路径，并带有日期与追踪查询字段。保留的链接不是对其目的页面行为的验证。

![携程公开首页截图](../captures/homepage/homepage-settle.png)

## 网络与资源

本次首页记录 **176 个请求**、**175 份已保留响应资源**，共 **6,779,205 字节**浏览器解码后的响应内容；其中导出 **36 份脚本**。每个资源关联 transaction_id、URL、状态、类型、文件位置与 SHA-256。原始来源和值保留在资源及网络索引中。

- [资源及内容摘要](../captures/homepage/resources.json)
- [请求清单](../captures/homepage/network.json)
- [脚本导出 manifest](../captures/exported-scripts/manifest.json)

观测到首页加载 NFES/mfe_compose、mfe_hotelSearchV1、mfe_marketAdvert、mfe_travelMap 等独立脚本，并出现 bd-s.tripcdn.cn、webresource.c-ctrip.com 等资源域。**推断**：首页使用按业务模块组合的前端架构；脚本名称和资源边界不能证明其完整部署、运行隔离或服务端拓扑。

部分可见接口事务如下，路径仅说明在本次捕获窗口发生过相应请求，不等同于接口完整契约：

| 方法 | 观察到的路径 | 响应状态 |
|---|---|---|
| GET | `/restapi/soa2/10290/createclientid` | 200 |
| GET | `/restapi/soa2/10290/createclientid` | 200 |
| GET | `/restapi/soa2/10290/createclientid` | 200 |
| POST | `/restapi/soa2/12216/json/queryFormatNum` | 200 |
| GET | `/restapi/soa2/10290/createclientid` | 200 |
| POST | `/restapi/soa2/13916/tripAds.json` | 200 |
| POST | `/restapi/soa2/13916/tripAds.json` | 200 |
| POST | `/restapi/soa2/12216/json/queryFormatNum` | 200 |
| POST | `/restapi/soa2/18088/getAppConfig.json` | 200 |
| POST | `/restapi/soa2/21881/json/getHotDestination` | 200 |
| POST | `/restapi/soa2/15201/getMemberSummaryInfo` | 200 |
| POST | `/restapi/soa2/15201/getPopupTipsInfo` | 200 |
| POST | `/restapi/soa2/34951/getAdHotels` | 200 |
| POST | `/restapi/soa2/10994/json/GetFloatUI` | 200 |

完整请求体/响应体仅在 REA 标记 captured 时存在；not_exposed 或 unavailable 保留原始原因。认证、Cookie、Set-Cookie 等传输凭据按 REA 规则排除。普通查询字段、资源 URL 与内容不是按名称猜测后删改。

## REA 静态分析与聚焦检查

来源：`ev_9529a5b2efe9691f84acf4cd410722a464a4bc0a720814851ff18d0d15c7d1a0`；摘要：`ev_17d405c88a3ecf5de4b3b92a486e676f2271e663ac87e964ba1e9566dc13b4ab`。

REA 对导出的 **36 个 JavaScript 文件**读取了 **3,106,316 字节**文本、访问 **923,895 个 AST 节点**，记录 **417 个发现**，解析失败计数为 **0**。

这些统计不代表完整语义恢复。应用图与语义图均为 partial：部分大文件的展开关系超过父结果预算，REA 把相应静态事实保留在文件节点中；部分语义图没有全部展开。完整限制与未知项仍在 Evidence 中。

图中有 36 个脚本资产节点、61 个不同角色的 JavaScript 模块节点、22 个 endpoint 候选节点、43 个 storage 节点和 23 个 unknown 节点。这些图角色不等同于源文件数。部分 endpoint 候选来自一般 get() 调用（例如参数/存储键），**不能作为已验证网络接口**。

酒店搜索脚本聚焦检查选择了精确节点 `jag_node_d3c72425a3c1b8c7d0dc87b1d1d1932daa3e70937475aa7a40ceb3af646af188`，SHA-256 为 `4a27667447d6f526c0137d7f60269a34a6784af9e5a6afb87aac1b118a1d51a4`。静态事实、位置、候选端点与供应商标记保存在 [hotel-facts.json](hotel-facts.json)，节点完整视图保存在 Evidence。对该节点执行了 outgoing 跟踪；结果仍继承 source_graph_status=partial，不能从未到达的关系推断原站缺少功能。

本次保留的是已发布脚本及静态解析结果，没有恢复原始变量名、原始项目结构或全部 source map。没有把静态代码存在解释为其已经执行。

## 机票入口的观测限制

直接访问首页所指向的 https://flights.ctrip.com/ 时，可访问文本为 **whaleguard block**。本次记录 1 个请求，保留了该响应与截图。没有尝试绕过阻断，也没有把首页推荐链接中的字段认定为下单或支付接口。

来源：`ev_7beed5bca362a378ba434dff450307f4fddd292f868eb3c506c514c08e3a5b1d`。原站登录态业务、真实订单、支付协议、价格算法、航信和值机状态流全部保持未知。

## 本地实现如何使用这些证据

| 已观察/需求 | 本地设计选择 | 性质 |
|---|---|---|
| 业务导航、聚合搜索、推荐卡片 | 机票/酒店/门票/行程/订单/旅行社六个区域 | 观察启发的独立设计 |
| 机票推荐与价格展示 | 规则评分、动态模拟价、含税展示 | 本项目模拟算法 |
| 用户要求复杂预订事件流 | 报价、原子库存、订单、支付/出票、值机状态机 | 本项目规则与后端 |
| 用户要求前后端分离 | 浏览器 ES Modules + JSON API + SQLite | 本项目架构 |
| 用户要求支付/航信模拟 | 本地 mock 适配器与可复现失败路径 | 模拟实现，无真实接入 |

本地界面、插画和后端独立编写，运行时不加载携程脚本，不调用携程私有接口。原站材料集中保留在 captures/ 和 evidence/，便于继续复查。

## Evidence 清单

| REA 操作 | 文件 | Evidence ID |
|---|---|---|
| capture_browser_scenario | [homepage-scenario.json](../evidence/homepage-scenario.json) | `ev_39fe3d6d3a5141b3a0879c0692e1ee3893ec294690009f4a6a768c757049d432` |
| capture_browser_scenario | [flights-scenario.json](../evidence/flights-scenario.json) | `ev_7beed5bca362a378ba434dff450307f4fddd292f868eb3c506c514c08e3a5b1d` |
| export_web_scripts | [script-export.json](../evidence/script-export.json) | `ev_7757f6670b246bf7fab7c981e774d74eb3cd0f4df27962e3c42d144a1e7fb0ef` |
| analyze_javascript_application | [javascript-application.json](../evidence/javascript-application.json) | `ev_9529a5b2efe9691f84acf4cd410722a464a4bc0a720814851ff18d0d15c7d1a0` |
| inspect_analysis_view | [javascript-summary-view.json](../evidence/javascript-summary-view.json) | `ev_17d405c88a3ecf5de4b3b92a486e676f2271e663ac87e964ba1e9566dc13b4ab` |
| inspect_analysis_view | [hotel-module-view.json](../evidence/hotel-module-view.json) | `ev_8e174edc02e59d98a1f7813e77b019072f17c9aa96eded165e04d051624a367c` |
| trace_application_feature | [hotel-feature-trace.json](../evidence/hotel-feature-trace.json) | `ev_a11c0fa78d30067b53481fac8470745a8613a94d478e81d4970696d6f495dd8f` |

本地验证的 Evidence ID 见 [browser-verification.json](browser-verification.json)；完整文件指纹、覆盖及失败历史见 [evidence-index.json](evidence-index.json)。文件 SHA-256 和 REA 语义 Evidence ID 是不同身份，索引保留两者。

## 结论检查表

| 问题 | 状态 | 证据与剩余边界 |
|---|---|---|
| 首页长什么样、有哪些可见模块 | 已回答（该时刻） | DOM/无障碍文本/截图；不是全站所有页面 |
| 本次加载哪些公开资源和请求 | 部分回答 | 176 个请求与逐项内容状态；后台晚发/未暴露内容不完整 |
| 已捕获脚本包含什么静态线索 | 部分回答 | 36 个文件，解析成功；图展开与动态表达式仍有未知 |
| 原站机票预订/支付/值机如何实现 | 未解决 | 机票站阻断，未观察真实业务 |
| 课程要求的本地核心流程能否运行 | 已验证（声明范围） | 13 项功能/持久化测试、6 个 REA 浏览器场景与性能测量 |
| 是否等价于携程整站或真实航空系统 | 未建立 | 没有此等价性结论；实现与模拟边界已明确 |
