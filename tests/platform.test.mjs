import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../backend/server.mjs";

let app,
  base,
  time = Date.parse("2026-10-20T08:00:00+08:00");
before(async () => {
  app = createApp({ dbPath: ":memory:", now: () => time });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => app.close());
async function request(
  path,
  { method = "GET", body, cookie, key, origin } = {},
) {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
async function actor(role = "traveler") {
  return (await request("/session", { method: "POST", body: { role } })).cookie;
}
async function search(extra = "") {
  const r = await request("/flights?from=SHA&to=BJS&date=2026-10-21" + extra);
  assert.equal(r.status, 200);
  return r.data.flights;
}
async function booking(
  cookie,
  { count = 1, flightId, key = crypto.randomUUID() } = {},
) {
  const f = flightId || (await search())[0].id;
  const q = await request("/quotes", {
    method: "POST",
    cookie,
    body: { flightId: f, passengers: count },
  });
  assert.equal(q.status, 201);
  const body = {
    quoteId: q.data.id,
    passengers: Array.from({ length: count }, (_, i) => ({
      name: "演示旅客" + i,
      document: "DEMO202600" + i,
    })),
    contact: "13800000000",
  };
  const order = await request("/orders", { method: "POST", cookie, key, body });
  return { order, quote: q.data, body, key };
}

test("真实 HTTP 搜索：筛选、排序、推荐、舱位与含税价格", async () => {
  const all = await search();
  assert.equal(all.length, 5);
  assert.ok(
    all.every(
      (f) =>
        f.price > 80 &&
        f.seats > 0 &&
        f.fromCity.name === "上海" &&
        f.toCity.name === "北京",
    ),
  );
  const cheap = await search("&sort=price");
  assert.ok(cheap.every((f, i) => !i || f.price >= cheap[i - 1].price));
  assert.equal((await search("&airline=MU")).length, 1);
  assert.equal((await search("&maxPrice=1")).length, 0);
  const business = await search("&cabin=business");
  assert.ok(business[0].price > all[0].price);
  assert.ok(all[0].score >= all[1].score);
});
test("查询边界：同城、未知城市、无效日历日、过去日期与超大人数", async () => {
  for (const query of [
    "from=SHA&to=SHA&date=2026-10-21",
    "from=XXX&to=BJS&date=2026-10-21",
    "from=SHA&to=BJS&date=2026-02-30",
    "from=SHA&to=BJS&date=2026-99-99",
    "from=SHA&to=BJS&date=2020-01-01",
    "from=SHA&to=BJS&date=2026-10-21&passengers=99",
  ])
    assert.equal((await request("/flights?" + query)).status, 400);
});
test("未登录写入、角色与跨站写入边界", async () => {
  assert.equal((await request("/orders")).status, 401);
  assert.equal(
    (await request("/quotes", { method: "POST", body: { flightId: "x" } }))
      .status,
    401,
  );
  const c = await actor();
  assert.equal((await request("/agency", { cookie: c })).status, 403);
  assert.equal(
    (await request("/session", { method: "POST", body: { role: "admin" } }))
      .status,
    400,
  );
  assert.equal(
    (
      await request("/session", {
        method: "POST",
        body: { role: "agency" },
        origin: "https://other.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/quotes", { method: "POST", cookie: c, body: {} })).status,
    400,
  );
});
test("查询→锁价→创建订单→模拟支付失败/成功→选座值机完整流程", async () => {
  const cookie = await actor();
  const { order, quote } = await booking(cookie);
  assert.equal(order.status, 201);
  const id = order.data.id;
  assert.equal(order.data.status, "PENDING_PAYMENT");
  assert.equal(order.data.amount, quote.amount);
  assert.equal(
    (
      await request(`/orders/${id}/check-in`, {
        method: "POST",
        cookie,
        body: { seat: "12A" },
      })
    ).status,
    409,
  );
  const fail = await request(`/orders/${id}/pay`, {
    method: "POST",
    cookie,
    body: { simulateFailure: true },
  });
  assert.equal(fail.status, 402);
  assert.equal(
    (await request(`/orders/${id}`, { cookie })).data.events.at(-1).type,
    "PAYMENT_FAILED",
  );
  assert.equal(
    (await request(`/orders/${id}`, { cookie })).data.status,
    "PENDING_PAYMENT",
  );
  const paid = await request(`/orders/${id}/pay`, {
    method: "POST",
    cookie,
    body: {},
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.data.status, "CONFIRMED");
  const repeat = await request(`/orders/${id}/pay`, {
    method: "POST",
    cookie,
    body: {},
  });
  assert.equal(repeat.data.events.length, paid.data.events.length);
  assert.equal(
    (
      await request(`/orders/${id}/check-in`, {
        method: "POST",
        cookie,
        body: { seat: "999Z" },
      })
    ).status,
    400,
  );
  const checkin = await request(`/orders/${id}/check-in`, {
    method: "POST",
    cookie,
    body: { seat: "12A" },
  });
  assert.equal(checkin.data.status, "CHECKED_IN");
  assert.equal(checkin.data.boarding.seat, "12A");
  assert.equal(checkin.data.boarding.provider, "mock-aviation");
  assert.equal(
    (
      await request(`/orders/${id}/cancel`, {
        method: "POST",
        cookie,
        body: {},
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/orders/${id}/check-in`, {
        method: "POST",
        cookie,
        body: { seat: "12B" },
      })
    ).status,
    409,
  );
});
test("订单创建幂等、报价不可重用、篡改金额无效及账户隔离", async () => {
  const cookie = await actor(),
    agency = await actor("agency");
  const b = await booking(cookie);
  assert.equal(b.order.status, 201);
  const again = await request("/orders", {
    method: "POST",
    cookie,
    key: b.key,
    body: b.body,
  });
  assert.equal(again.data.id, b.order.data.id);
  const altered = await request("/orders", {
    method: "POST",
    cookie,
    key: b.key,
    body: { ...b.body, contact: "13900000000" },
  });
  assert.equal(altered.status, 409);
  const reused = await request("/orders", {
    method: "POST",
    cookie,
    key: crypto.randomUUID(),
    body: b.body,
  });
  assert.equal(reused.status, 409);
  assert.equal(
    (await request(`/orders/${b.order.data.id}`, { cookie: agency })).status,
    404,
  );
  const q = await request("/quotes", {
    method: "POST",
    cookie,
    body: { flightId: (await search())[1].id },
  });
  const tampered = await request("/orders", {
    method: "POST",
    cookie,
    key: crypto.randomUUID(),
    body: { ...b.body, quoteId: q.data.id, amount: 1 },
  });
  assert.equal(tampered.status, 201);
  assert.equal(tampered.data.amount, q.data.amount);
});
test("创建时校验乘机人及联系手机，失败不扣库存", async () => {
  const cookie = await actor(),
    f = (await search())[2];
  const q = await request("/quotes", {
    method: "POST",
    cookie,
    body: { flightId: f.id },
  });
  const before = app.store.db
    .prepare("SELECT seats FROM flights WHERE id=?")
    .get(f.id).seats;
  for (const body of [
    { quoteId: q.data.id, passengers: [], contact: "13800000000" },
    {
      quoteId: q.data.id,
      passengers: [{ name: "旅客", document: "!" }],
      contact: "13800000000",
    },
    {
      quoteId: q.data.id,
      passengers: [{ name: "旅客", document: "DEMO12345" }],
      contact: "123",
    },
  ])
    assert.equal(
      (
        await request("/orders", {
          method: "POST",
          cookie,
          key: crypto.randomUUID(),
          body,
        })
      ).status,
      400,
    );
  assert.equal(
    app.store.db.prepare("SELECT seats FROM flights WHERE id=?").get(f.id)
      .seats,
    before,
  );
});
test("取消与退款为幂等状态转换，库存只恢复一次", async () => {
  const cookie = await actor(),
    f = (await search())[3];
  const before = app.store.db
    .prepare("SELECT seats FROM flights WHERE id=?")
    .get(f.id).seats;
  const b = await booking(cookie, { flightId: f.id, count: 2 });
  await request(`/orders/${b.order.data.id}/pay`, {
    method: "POST",
    cookie,
    body: {},
  });
  const cancel = await request(`/orders/${b.order.data.id}/cancel`, {
    method: "POST",
    cookie,
    body: {},
  });
  assert.equal(cancel.data.status, "CANCELLED");
  assert.equal(cancel.data.events.at(-1).detail.refund, b.quote.amount);
  await request(`/orders/${b.order.data.id}/cancel`, {
    method: "POST",
    cookie,
    body: {},
  });
  assert.equal(
    app.store.db.prepare("SELECT seats FROM flights WHERE id=?").get(f.id)
      .seats,
    before,
  );
  assert.equal(
    (
      await request(`/orders/${b.order.data.id}/pay`, {
        method: "POST",
        cookie,
        body: {},
      })
    ).status,
    409,
  );
});
test("最后一张票的并发订单只能一单成功", async () => {
  const cookie = await actor(),
    f = (await search())[4];
  app.store.db.prepare("UPDATE flights SET seats=1 WHERE id=?").run(f.id);
  const qs = await Promise.all(
    [1, 2].map(() =>
      request("/quotes", { method: "POST", cookie, body: { flightId: f.id } }),
    ),
  );
  const results = await Promise.all(
    qs.map((q) =>
      request("/orders", {
        method: "POST",
        cookie,
        key: crypto.randomUUID(),
        body: {
          quoteId: q.data.id,
          passengers: [{ name: "并发旅客", document: "DEMO99999" }],
          contact: "13800000000",
        },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    app.store.db.prepare("SELECT seats FROM flights WHERE id=?").get(f.id)
      .seats,
    0,
  );
});
test("已占座位不能被另一订单重复值机", async () => {
  const cookie = await actor();
  const existing = app.store.db
    .prepare(
      "SELECT flight_id FROM orders WHERE status='CHECKED_IN' AND seat='12A'",
    )
    .get();
  const b = await booking(cookie, { flightId: existing.flight_id });
  await request(`/orders/${b.order.data.id}/pay`, {
    method: "POST",
    cookie,
    body: {},
  });
  assert.equal(
    (
      await request(`/orders/${b.order.data.id}/check-in`, {
        method: "POST",
        cookie,
        body: { seat: "12A" },
      })
    ).status,
    409,
  );
  const res = await request(`/orders/${b.order.data.id}/check-in`, {
    method: "POST",
    cookie,
    body: { seat: "12B" },
  });
  assert.equal(res.data.status, "CHECKED_IN");
});
test("酒店与门票查询、行程生成及旅行社聚合接口", async () => {
  assert.equal((await request("/hotels?city=BJS")).data.items[0].city, "BJS");
  assert.equal(
    (await request("/attractions?city=CTU")).data.items[0].name,
    "成都大熊猫繁育研究基地",
  );
  const cookie = await actor("agency");
  const t = await request("/trips", {
    method: "POST",
    cookie,
    body: { city: "CTU", days: 3, budget: 3000 },
  });
  assert.equal(t.status, 201);
  assert.equal(t.data.itinerary.length, 3);
  assert.equal(t.data.estimatedTotal, 398 * 2 + 55 + 450);
  assert.equal(
    t.data.itinerary
      .flatMap((day) => day.activities)
      .filter((a) => a.name === "成都大熊猫繁育研究基地").length,
    1,
  );
  assert.equal(
    (await request("/trips", { cookie })).data.trips[0].id,
    t.data.id,
  );
  assert.equal(
    (
      await request("/trips", {
        method: "POST",
        cookie,
        body: { city: "BJS", days: 99, budget: 3000 },
      })
    ).status,
    400,
  );
  assert.equal((await request("/agency", { cookie })).status, 200);
});
test("报价到期拒绝创建；订单到期释放库存且只能释放一次", async () => {
  const cookie = await actor(),
    f = (await search())[2];
  const q = await request("/quotes", {
    method: "POST",
    cookie,
    body: { flightId: f.id },
  });
  time += 601000;
  assert.equal(
    (
      await request("/orders", {
        method: "POST",
        cookie,
        key: crypto.randomUUID(),
        body: {
          quoteId: q.data.id,
          passengers: [{ name: "超时旅客", document: "DEMO88888" }],
          contact: "13800000000",
        },
      })
    ).status,
    409,
  );
  const before = app.store.db
    .prepare("SELECT seats FROM flights WHERE id=?")
    .get(f.id).seats;
  const b = await booking(cookie, { flightId: f.id });
  time += 901000;
  const expired = await request(`/orders/${b.order.data.id}`, { cookie });
  assert.equal(expired.data.status, "EXPIRED");
  assert.equal(
    app.store.db.prepare("SELECT seats FROM flights WHERE id=?").get(f.id)
      .seats,
    before,
  );
  await request("/orders", { cookie });
  assert.equal(
    app.store.db.prepare("SELECT seats FROM flights WHERE id=?").get(f.id)
      .seats,
    before,
  );
  assert.equal(
    (
      await request(`/orders/${b.order.data.id}/pay`, {
        method: "POST",
        cookie,
        body: {},
      })
    ).status,
    409,
  );
});
test("前端独立静态资源可访问，内容类型与 CSP 正确", async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(
    response.headers.get("content-security-policy"),
    /default-src 'self'/,
  );
  assert.match(await response.text(), /云程旅行/);
  for (const asset of [
    "/app.js",
    "/style.css",
    "/assets/logo.svg",
    "/assets/chengdu.svg",
  ])
    assert.equal((await fetch(base + asset)).status, 200);
});
