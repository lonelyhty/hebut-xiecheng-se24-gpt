import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const names=['homepage-scenario','flights-scenario','script-export','javascript-application','javascript-summary-view','hotel-module-view','hotel-feature-trace'];
const evidence=Object.fromEntries(await Promise.all(names.map(async n=>[n,await read('evidence/'+n+'.json')])));
const home=await read('reports/homepage-summary.json'),staticSummary=await read('reports/static-summary.json'),index=await read('reports/evidence-index.json'),perf=await read('reports/performance.json');
const hotel=evidence['hotel-module-view'].normalized_result.item;
const staticHotel=hotel.observations.find(o=>o.properties.static_analysis)?.properties.static_analysis;
const facts={evidenceId:evidence['hotel-module-view'].evidence_id,nodeId:hotel.node_id,path:hotel.path,sha256:hotel.identity.sha256,staticParseStatus:staticHotel?.parse_status,vendors:staticHotel?.vendors,endpointCandidates:staticHotel?.endpoints,sourceMapDeclarations:staticHotel?.source_map_urls,limitations:staticHotel?.limitations,trace:evidence['hotel-feature-trace'].normalized_result.summary};
await fs.writeFile(path.join(root,'reports/hotel-facts.json'),JSON.stringify(facts,null,2));
const evTable=names.map(n=>`| ${evidence[n].operation} | [${n}.json](../evidence/${n}.json) | \`${evidence[n].evidence_id}\` |`).join('\n');
const apiRows=home.api_requests.filter(r=>new URL(r.url).pathname.startsWith('/restapi/')).slice(0,16).map(r=>`| ${r.method} | \`${new URL(r.url).pathname}\` | ${r.status} |`).join('\n');
const reverse=`# 携程公开站点逆向调查

调查日期：2026-10-20（Asia/Shanghai）。用户目标为 https://www.ctrip.com/，后续明确为航空旅行一站式服务课程平台。

## 交付范围与证据边界

已留存公开首页的渲染结构、无障碍文本、1440×1000 截图、网络事务及可取得的响应资源，并由 REA 导出脚本、静态分析、检查聚焦模块和跟踪关系。另在此基础上独立实现“云程旅行”及本地业务验证。

这次没有获得携程服务端源码、真实支付/订单库、会员授权或航司库存。机票站页面返回了 whaleguard block；因此原站预订、支付、出票、值机内部流程保持未知。

## 已观察的公开界面

来源：\`${evidence['homepage-scenario'].evidence_id}\`。

- 桌面布局包含左侧业务导航、顶部搜索及账户/订单入口；酒店为首页默认主搜索区域。
- 首页展示酒店搜索、目的地内容、推荐与推广卡片，并提供机票、门票、行程助手、旅行地图等入口。
- 酒店搜索字段包括目的地、入住退房、房间住客、级别与关键词。这些是当前捕获页面的界面事实。
- 首页可见机票推荐链接指向 flights.ctrip.com 的独立路径，并带有日期与追踪查询字段。保留的链接不是对其目的页面行为的验证。

![携程公开首页截图](../captures/homepage/homepage-settle.png)

## 网络与资源

本次首页记录 **${home.requests} 个请求**、**${home.resources} 份已保留响应资源**，共 **${home.bytes.toLocaleString('en-US')} 字节**浏览器解码后的响应内容；其中导出 **36 份脚本**。每个资源关联 transaction_id、URL、状态、类型、文件位置与 SHA-256。原始来源和值保留在资源及网络索引中。

- [资源及内容摘要](../captures/homepage/resources.json)
- [请求清单](../captures/homepage/network.json)
- [脚本导出 manifest](../captures/exported-scripts/manifest.json)

观测到首页加载 NFES/mfe_compose、mfe_hotelSearchV1、mfe_marketAdvert、mfe_travelMap 等独立脚本，并出现 bd-s.tripcdn.cn、webresource.c-ctrip.com 等资源域。**推断**：首页使用按业务模块组合的前端架构；脚本名称和资源边界不能证明其完整部署、运行隔离或服务端拓扑。

部分可见接口事务如下，路径仅说明在本次捕获窗口发生过相应请求，不等同于接口完整契约：

| 方法 | 观察到的路径 | 响应状态 |
|---|---|---|
${apiRows}

完整请求体/响应体仅在 REA 标记 captured 时存在；not_exposed 或 unavailable 保留原始原因。认证、Cookie、Set-Cookie 等传输凭据按 REA 规则排除。普通查询字段、资源 URL 与内容不是按名称猜测后删改。

## REA 静态分析与聚焦检查

来源：\`${evidence['javascript-application'].evidence_id}\`；摘要：\`${evidence['javascript-summary-view'].evidence_id}\`。

REA 对导出的 **${staticSummary.statistics.parsed_javascript_files} 个 JavaScript 文件**读取了 **${staticSummary.statistics.text_bytes_read.toLocaleString('en-US')} 字节**文本、访问 **${staticSummary.statistics.visited_ast_nodes.toLocaleString('en-US')} 个 AST 节点**，记录 **${staticSummary.statistics.findings} 个发现**，解析失败计数为 **${staticSummary.statistics.parse_failures}**。

这些统计不代表完整语义恢复。应用图与语义图均为 partial：部分大文件的展开关系超过父结果预算，REA 把相应静态事实保留在文件节点中；部分语义图没有全部展开。完整限制与未知项仍在 Evidence 中。

图中有 ${staticSummary.nodesByKind['javascript-asset']} 个脚本资产节点、${staticSummary.nodesByKind['javascript-module']} 个不同角色的 JavaScript 模块节点、${staticSummary.nodesByKind.endpoint} 个 endpoint 候选节点、${staticSummary.nodesByKind.storage} 个 storage 节点和 ${staticSummary.nodesByKind.unknown} 个 unknown 节点。这些图角色不等同于源文件数。部分 endpoint 候选来自一般 get() 调用（例如参数/存储键），**不能作为已验证网络接口**。

酒店搜索脚本聚焦检查选择了精确节点 \`${hotel.node_id}\`，SHA-256 为 \`${hotel.identity.sha256}\`。静态事实、位置、候选端点与供应商标记保存在 [hotel-facts.json](hotel-facts.json)，节点完整视图保存在 Evidence。对该节点执行了 outgoing 跟踪；结果仍继承 source_graph_status=partial，不能从未到达的关系推断原站缺少功能。

本次保留的是已发布脚本及静态解析结果，没有恢复原始变量名、原始项目结构或全部 source map。没有把静态代码存在解释为其已经执行。

## 机票入口的观测限制

直接访问首页所指向的 https://flights.ctrip.com/ 时，可访问文本为 **whaleguard block**。本次记录 ${1} 个请求，保留了该响应与截图。没有尝试绕过阻断，也没有把首页推荐链接中的字段认定为下单或支付接口。

来源：\`${evidence['flights-scenario'].evidence_id}\`。原站登录态业务、真实订单、支付协议、价格算法、航信和值机状态流全部保持未知。

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
${evTable}

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
`;
await fs.writeFile(path.join(root,'reports/reverse-engineering.md'),reverse);
const testing=`# 测试与验证报告

日期：2026-10-20（Asia/Shanghai）。实际执行环境：Windows x64、Node v24.14.0、npm 11.9.0、PowerShell 7.6.6（L:\\Programs\\PowerShell\\7）。浏览器版本以各 REA Evidence.browser.version 为准。

## 功能与持久化

\`npm test\`：**13 项通过，0 项失败**。原始输出见 [tests.tap](tests.tap)。HTTP 测试通过实际回环网络请求访问临时服务，数据库按测试隔离；SQLite 重启用例使用独立临时文件并在完成后清理。

覆盖：航班筛选/排序/舱位、无效输入、未登录与角色边界、跨站写入拒绝、完整支付和值机链路、支付失败事件、创建幂等、报价单次消耗、服务端金额、账户隔离、乘机信息校验、取消退款和回库幂等、最后一张票的并发创建、重复占座、报价/订单过期、酒店门票与行程预算、SQLite 重启后的订单/金额/舱位/库存保留及静态资源响应。

时钟相关 HTTP 测试注入固定时间，以可复现方式验证过期行为；实际浏览器流程使用真实运行时钟和默认次日出发日期。

## REA 真实浏览器场景

六个场景已在独立新 SQLite 上重放，临时服务携带实例标识，脚本只控制自己创建并持有进程句柄的服务。场景通过具体页面里程碑等待，使用原生 Chrome 渲染与真实 API，而不是把后端直接调用当作 UI 测试。

| 场景 | 完成步骤（含初始导航） | 断言里程碑 | Evidence |
|---|---|---|---|
${index.localScenarios.map(s=>`| ${s.name} | ${s.completedSteps} | ${s.milestone} | \`${s.evidenceId}\` |`).join('\n')}

场景包括桌面搜索页、查询→报价→创建→支付→选座→登机牌、390×844 移动端、酒店→成都三日行程、订单列表和旅行社角色切换/工作台。六个场景的声明动作全部完成，page-error 事件为 0。

截图已人工查看：桌面与移动端未发现主要控件遮挡，预订弹窗、登机牌、行程卡片可读。保存的截图是视口范围，不代表对整页所有像素或所有分辨率进行自动可访问性认证。

部分网络内容选择可能令 REA completeness 保持 incomplete（例如未暴露请求体）；动作/DOM/截图的成功与全网络覆盖分别记录。上述通过仅针对声明的业务里程碑，不声称网络观测绝对完整。

## 搜索性能

运行 \`npm run test:performance\`。结果见 [performance.json](performance.json)。

| 指标 | 实测 |
|---|---|
| 场景 | 回环 HTTP，上海→北京，5 个模拟航班；20 次预热 |
| 请求数 / 并发 | ${perf.requests} / ${perf.concurrency} |
| 成功 / 失败 | ${perf.success} / ${perf.failed} |
| P50 / P95 / P99 | ${perf.latencyMs.p50} / ${perf.latencyMs.p95} / ${perf.latencyMs.p99} ms |
| 吞吐 | ${perf.requestsPerSecond} 次/秒 |
| 验收 | 0 失败且本地 P95 <250ms：${perf.acceptance.passed?'通过':'未通过'} |

这是本机预热进程与内存 SQLite 的搜索测量，不包含跨主机网络、TLS、真实外部 API、大型数据集、并发写入或生产容量保证。并发最后一张票另由功能测试覆盖，不能把搜索吞吐等同于下单吞吐。

## 证据核验

\`npm run verify:evidence\` 检查 ${index.verifiedArtifacts} 个截图/文本工件、${index.verifiedBodies} 份已保留网络内容及 ${index.verifiedScripts} 份脚本导出内容的字节数和 SHA-256，并核对六个本地场景状态及里程碑。它保留原始 REA Evidence ID，不尝试把文件哈希当作语义 ID。

首次浏览器场景曾因不唯一的测试定位器失败，修正为精确首卡定位后重新运行。首次沙箱进程/网络错误与这些失败均保留在 evidence/，最终通过的输入和结果单独命名，未覆盖为虚假的成功。

## 尚未验证或尚未实现

- 原站机票业务、支付、库存、航信与值机；原站首页完整语义图。
- 真实支付和航信、生产身份认证、多租户隔离、外部回调与对账。
- 多人逐人值机、酒店/门票交易、往返/国际/中转航班。
- 屏幕阅读器全流程、所有视口、所有浏览器及正式 WCAG 审计。
- 生产规模数据、跨进程/跨主机并发和真实网络故障条件。

## 重现

\`npm test\`、\`npm run test:performance\` 不需要外部网站。\`scripts/run-rea.ps1\` 使用已安装 REA 和 Chrome 启动独立临时服务与新数据库；\`inputs/\` 是声明式场景。该脚本已实际执行通过。
`;
await fs.writeFile(path.join(root,'reports/testing.md'),testing);
console.log('Wrote reverse-engineering.md, testing.md and hotel-facts.json');
