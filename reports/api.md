# HTTP API 契约

默认基址 `http://127.0.0.1:4173/api`。金额为人民币整数元，输出 `simulated: true` 表示模拟数据。所有写入使用 `Content-Type: application/json`；Cookie 由浏览器自动携带，同源写入。

## 会话与公共查询

| 方法 | 路径 | 输入 | 输出 |
|---|---|---|---|
| GET | `/health` | 无 | 服务状态 |
| GET | `/meta` | 无 | 城市、上海时区的今天、报价/订单期限、模拟提供者 |
| GET | `/session` | Cookie 可选 | 当前 actor 或 null |
| POST | `/session` | `{role: "traveler" 或 "agency"}` | actor；设置 HttpOnly、SameSite=Strict Cookie |
| GET | `/flights` | `from,to,date,cabin,passengers,sort,airline,maxPrice` | flights、calendar、query、pricing |
| GET | `/hotels` | `city` 可选 | `{items: [...]}` |
| GET | `/attractions` | `city` 可选 | `{items: [...]}` |

航班字段：`id, number, airline, fromCity, toCity, departure, arrival, duration, seats, price, tax, cabin, score, reasons`。时间戳为 ISO 格式，前端以 Asia/Shanghai 展示。输入日期必须为真实的 `YYYY-MM-DD`，范围为今天起 180 天。

`cabin` 为 `economy|business`；`passengers` 为 1–6；`sort` 为 `recommended|price|departure|duration`；`airline` 为 `MU|CA|CZ|HO|3U`；`maxPrice` 按单人含税价筛选。

```http
GET /api/flights?from=SHA&to=BJS&date=2026-10-21&cabin=economy&passengers=1&sort=price
```

## 报价与订单

以下接口需要有效演示会话，订单、报价、行程均按 `actor.owner` 隔离。

| 方法 | 路径 | 输入/行为 | 返回 |
|---|---|---|---|
| POST | `/quotes` | `{flightId, passengers:1, cabin:"economy"}` | 201：`id, flight, amount, passengers, cabin, expiresAt` |
| POST | `/orders` | Header `Idempotency-Key`；`{quoteId, passengers:[{name,document}], contact}` | 201：订单；同键同内容重放返回原订单 |
| GET | `/orders` | 无 | `{orders:[...]}`，本角色按创建时间倒序 |
| GET | `/orders/:id` | 本角色订单 | 订单、事件、登机牌 |
| POST | `/orders/:id/pay` | `{}` 成功；`{simulateFailure:true}` 失败 | 已出票订单或 402 |
| POST | `/orders/:id/cancel` | `{}` | 已取消订单；已出票时记录模拟退款 |
| GET | `/orders/:id/seats` | 本角色订单 | `{taken:["12A",...]}` |
| POST | `/orders/:id/check-in` | `{seat:"14F"}` | 已值机订单与 boarding |

下单样例：

```json
{
  "quoteId": "服务端返回的报价UUID",
  "passengers": [{"name": "云小程", "document": "DEMO20260001"}],
  "contact": "13800000000"
}
```

姓名 2–40 字，演示证件号为 6–20 位字母/数字，手机号为 11 位大陆手机号格式。每单旅客数必须与报价一致。未知 `amount` 等客户端金额不会参与服务端结算。

订单主要返回字段：

```text
id, role, flight, amount, passengers, contact, status,
createdAt, expiresAt, seat, boarding, events
```

`events` 按追加顺序返回 `{type, at, detail}`。`amount` 是成交锁定金额；`flight.price` 是展示时的模拟行情，不能用于替代订单金额。`boarding` 包含 `provider, pnr, seat, gate, boardingAt`。

## 行程与旅行社

| 方法 | 路径 | 输入 | 返回 |
|---|---|---|---|
| POST | `/trips` | `{city:"CTU", days:3, budget:3000}` | 201：持久化行程、酒店、逐日活动、费用分解、估算说明 |
| GET | `/trips` | 无 | `{trips:[...]}`，仅当前角色 |
| GET | `/agency` | agency 角色 | `{orders,revenue,pending,travelers}` |

行程预算不包括机票；`costBreakdown` 区分住宿、门票、餐饮交通，以及是否采用未收录酒店的住宿单价假设。

## 错误

统一错误体：

```json
{"error":{"code":"QUOTE_EXPIRED","message":"报价已过期或已使用，请重新选择航班","requestId":"..."}}
```

| HTTP | 代表 code | 处理 |
|---|---|---|
| 400 | `INVALID_ROUTE, INVALID_DATE, DATE_RANGE, INVALID_BODY, INVALID_PASSENGER, INVALID_CONTACT, INVALID_SEAT` | 修正输入；不扣库存 |
| 401 | `AUTH_REQUIRED` | 选择演示角色 |
| 402 | `PAYMENT_FAILED` | 保持待支付，允许模拟重试 |
| 403 | `ROLE_REQUIRED, ORIGIN_REJECTED` | 角色或同源范围不符 |
| 404 | `FLIGHT_NOT_FOUND, QUOTE_NOT_FOUND, ORDER_NOT_FOUND` | 不存在或不属于本角色 |
| 409 | `SOLD_OUT, QUOTE_EXPIRED, IDEMPOTENCY_CONFLICT, FLIGHT_CLOSED, INVALID_TRANSITION, CHECKIN_WINDOW, SEAT_TAKEN` | 刷新对应资源；不可盲目重放新订单 |
| 413 | `BODY_TOO_LARGE` | 请求体超过 32 KiB |
| 415 | `CONTENT_TYPE` | 改用 JSON |
| 500 | `INTERNAL_ERROR` | 页面提示失败，服务器日志含 requestId，不向客户端回传堆栈 |

当前接口没有生产认证、分页或真实支付回调。这些限制属于课程范围，不能将演示角色和示例账户隔离当成生产多租户安全保证。
