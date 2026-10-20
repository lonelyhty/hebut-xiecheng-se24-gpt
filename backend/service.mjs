import { randomUUID } from "node:crypto";
import {
  cities,
  city,
  hotels,
  attractions,
  schedule,
  dateInShanghai,
  hash,
} from "./catalog.mjs";

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const assert = (condition, status, code, message) => {
  if (!condition) throw new HttpError(status, code, message);
};
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const mockProviders = {
  payment(order, failure) {
    return failure
      ? { ok: false, provider: "mock-payment", reason: "模拟支付失败，请重试" }
      : {
          ok: true,
          provider: "mock-payment",
          reference: `PAY-${order.id}`,
          ticket: `781-${hash(order.id).toString().padStart(10, "0")}`,
        };
  },
  checkin(order, seat) {
    return {
      provider: "mock-aviation",
      pnr: hash(order.id)
        .toString(36)
        .toUpperCase()
        .padStart(6, "0")
        .slice(0, 6),
      seat,
      gate: `B${(hash(order.id) % 20) + 1}`,
      boardingAt: new Date(
        Date.parse(order.flight.departure) - 45 * 60000,
      ).toISOString(),
    };
  },
};

export function createService(store, { now = Date.now } = {}) {
  const { db } = store;
  function expire() {
    const time = now();
    store.transaction(() => {
      for (const o of db
        .prepare(
          "SELECT * FROM orders WHERE status='PENDING_PAYMENT' AND expires<=?",
        )
        .all(time)) {
        db.prepare("UPDATE orders SET status='EXPIRED' WHERE id=?").run(o.id);
        db.prepare("UPDATE flights SET seats=seats+? WHERE id=?").run(
          JSON.parse(o.passengers).length,
          o.flight_id,
        );
        store.event(o.id, "EXPIRED", time);
      }
    });
  }
  function validRoute({ from, to, date }) {
    assert(
      city(from) && city(to) && from !== to,
      400,
      "INVALID_ROUTE",
      "请选择不同的出发城市和到达城市",
    );
    assert(
      typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Number.isFinite(Date.parse(date + "T00:00:00Z")) &&
        new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date,
      400,
      "INVALID_DATE",
      "请选择有效出发日期",
    );
    const today = dateInShanghai(now());
    const last = dateInShanghai(now() + 180 * 86400000);
    assert(
      date >= today && date <= last,
      400,
      "DATE_RANGE",
      "仅支持今天起 180 天内的出行日期",
    );
  }
  function price(flight, cabin = "economy") {
    const days =
      (Date.parse(flight.date + "T00:00:00+08:00") - now()) / 86400000;
    const timeVariation =
      ((hash(flight.id + Math.floor(now() / 300000)) % 13) - 6) * 5;
    return (
      Math.round(
        (flight.base + (days < 3 ? 120 : days < 14 ? 40 : 0) + timeVariation) *
          (cabin === "business" ? 2.6 : 1),
      ) + 80
    );
  }
  function flightFromRow(row, cabin = "economy") {
    const flight = JSON.parse(row.data);
    return {
      ...flight,
      seats: row.seats,
      price: price(flight, cabin),
      tax: 80,
      fromCity: city(flight.from),
      toCity: city(flight.to),
      cabin,
    };
  }
  function flight(id, cabin = "economy") {
    const row = db.prepare("SELECT * FROM flights WHERE id=?").get(id);
    assert(row, 404, "FLIGHT_NOT_FOUND", "航班不存在，请重新查询");
    return flightFromRow(row, cabin);
  }
  function order(id, actor) {
    expire();
    const row = db
      .prepare("SELECT * FROM orders WHERE id=? AND owner=?")
      .get(id, actor.owner);
    assert(row, 404, "ORDER_NOT_FOUND", "订单不存在");
    return orderView(row);
  }
  function orderView(row) {
    const q = db
      .prepare("SELECT cabin FROM quotes WHERE id=?")
      .get(row.quote_id);
    return {
      id: row.id,
      role: row.role,
      flight: flight(row.flight_id, q.cabin),
      amount: row.amount,
      passengers: JSON.parse(row.passengers),
      contact: row.contact,
      status: row.status,
      createdAt: new Date(row.created).toISOString(),
      expiresAt: new Date(row.expires).toISOString(),
      seat: row.seat,
      boarding: row.boarding ? JSON.parse(row.boarding) : null,
      events: db
        .prepare(
          "SELECT type,at,detail FROM events WHERE order_id=? ORDER BY id",
        )
        .all(row.id)
        .map((e) => ({
          ...e,
          at: new Date(e.at).toISOString(),
          detail: JSON.parse(e.detail),
        })),
    };
  }
  return {
    meta() {
      return {
        cities,
        today: dateInShanghai(now()),
        demo: true,
        roles: ["traveler", "agency"],
        providers: ["mock-payment", "mock-aviation"],
        quoteTtlSeconds: 600,
        orderTtlSeconds: 900,
      };
    },
    session(cookie) {
      if (!cookie) return null;
      const id = cookie
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("yc_session="))
        ?.slice(11);
      return id
        ? db.prepare("SELECT owner,role FROM sessions WHERE id=?").get(id) ||
            null
        : null;
    },
    login(data) {
      assert(
        object(data) && ["traveler", "agency"].includes(data.role),
        400,
        "INVALID_ROLE",
        "请选择旅客或旅行社演示角色",
      );
      const id = randomUUID();
      db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
        id,
        `demo-${data.role}`,
        data.role,
        now(),
      );
      return {
        id,
        actor: {
          owner: `demo-${data.role}`,
          role: data.role,
          name: data.role === "agency" ? "云程旅行社" : "体验旅客",
        },
      };
    },
    search(input) {
      expire();
      validRoute(input);
      const { from, to, date } = input;
      const cabin = input.cabin || "economy";
      assert(
        ["economy", "business"].includes(cabin),
        400,
        "INVALID_CABIN",
        "舱位无效",
      );
      const passengers = Number(input.passengers || 1);
      assert(
        Number.isInteger(passengers) && passengers >= 1 && passengers <= 6,
        400,
        "INVALID_PASSENGERS",
        "每单支持 1 至 6 位旅客",
      );
      for (const f of schedule(from, to, date))
        db.prepare("INSERT OR IGNORE INTO flights VALUES(?,?,?)").run(
          f.id,
          JSON.stringify(f),
          f.seats,
        );
      let results = db
        .prepare("SELECT * FROM flights WHERE id LIKE ?")
        .all(`${from}-${to}-${date}-%`)
        .map((row) => flightFromRow(row, cabin))
        .filter(
          (f) =>
            f.seats >= passengers &&
            Date.parse(f.departure) > now() + 45 * 60000,
        );
      const max = Number(input.maxPrice || 100000);
      assert(
        Number.isFinite(max) && max >= 0,
        400,
        "INVALID_PRICE",
        "最高价格无效",
      );
      results = results.filter(
        (f) =>
          f.price <= max &&
          (!input.airline || f.airline.code === input.airline),
      );
      const sort = input.sort || "recommended";
      assert(
        ["recommended", "price", "departure", "duration"].includes(sort),
        400,
        "INVALID_SORT",
        "排序方式无效",
      );
      const min = Math.min(...results.map((f) => f.price));
      for (const f of results) {
        const hour = new Date(
          Date.parse(f.departure) + 8 * 3600000,
        ).getUTCHours();
        f.score = Math.round(
          100 -
            f.price / 50 -
            f.duration / 30 -
            (hour < 8 || hour >= 22 ? 5 : 0),
        );
        f.reasons = [
          f.price === min ? "同日低价" : "直飞省心",
          hour < 12 ? "上午出发" : "从容出行",
        ];
      }
      results.sort((a, b) =>
        sort === "price"
          ? a.price - b.price
          : sort === "departure"
            ? Date.parse(a.departure) - Date.parse(b.departure)
            : sort === "duration"
              ? a.duration - b.duration
              : b.score - a.score,
      );
      return {
        flights: results,
        total: results.length,
        simulated: true,
        pricing: {
          model:
            "base + departure proximity + five-minute demand bucket + tax; business x2.6",
          refreshAt: new Date(
            (Math.floor(now() / 300000) + 1) * 300000,
          ).toISOString(),
        },
        query: { from, to, date, cabin, passengers },
        calendar: Array.from({ length: 7 }, (_, i) => {
          const d = dateInShanghai(
            Date.parse(date + "T00:00:00+08:00") + (i - 3) * 86400000,
          );
          return {
            date: d,
            price: Math.min(
              ...schedule(from, to, d).map((f) => price(f, cabin)),
            ),
          };
        }),
      };
    },
    quote(data, actor) {
      expire();
      assert(
        object(data) && typeof data.flightId === "string",
        400,
        "INVALID_BODY",
        "请提供航班编号",
      );
      const cabin = data.cabin || "economy";
      assert(
        ["economy", "business"].includes(cabin),
        400,
        "INVALID_CABIN",
        "舱位无效",
      );
      const count = data.passengers ?? 1;
      assert(
        Number.isInteger(count) && count >= 1 && count <= 6,
        400,
        "INVALID_PASSENGERS",
        "每单支持 1 至 6 位旅客",
      );
      const f = flight(data.flightId, cabin);
      assert(
        Date.parse(f.departure) > now() + 45 * 60000,
        409,
        "FLIGHT_CLOSED",
        "航班已停止预订",
      );
      assert(f.seats >= count, 409, "SOLD_OUT", "余票不足，请选择其他航班");
      const id = randomUUID(),
        expires = now() + 600000,
        amount = f.price * count;
      db.prepare(
        "INSERT INTO quotes(id,owner,flight_id,amount,passengers,cabin,expires) VALUES(?,?,?,?,?,?,?)",
      ).run(id, actor.owner, f.id, amount, count, cabin, expires);
      return {
        id,
        flight: f,
        passengers: count,
        cabin,
        amount,
        expiresAt: new Date(expires).toISOString(),
        simulated: true,
      };
    },
    createOrder(data, actor, key) {
      expire();
      assert(
        typeof key === "string" && key.length >= 8 && key.length <= 150,
        400,
        "IDEMPOTENCY_REQUIRED",
        "创建订单需要唯一请求编号",
      );
      assert(
        object(data) && typeof data.quoteId === "string",
        400,
        "INVALID_BODY",
        "请提供有效报价编号",
      );
      return store.transaction(() => {
        const existing = db
          .prepare("SELECT * FROM orders WHERE owner=? AND idempotency=?")
          .get(actor.owner, key);
        if (existing) {
          assert(
            existing.quote_id === data.quoteId &&
              JSON.stringify(data.passengers) === existing.passengers &&
              data.contact === existing.contact,
            409,
            "IDEMPOTENCY_CONFLICT",
            "该请求编号已用于其他订单内容",
          );
          return orderView(existing);
        }
        const q = db
          .prepare("SELECT * FROM quotes WHERE id=? AND owner=?")
          .get(data.quoteId, actor.owner);
        assert(q, 404, "QUOTE_NOT_FOUND", "报价不存在");
        assert(
          q.expires > now() && !q.used,
          409,
          "QUOTE_EXPIRED",
          "报价已过期或已使用，请重新选择航班",
        );
        assert(
          Date.parse(flight(q.flight_id).departure) > now() + 45 * 60000,
          409,
          "FLIGHT_CLOSED",
          "航班已停止预订",
        );
        assert(
          Array.isArray(data.passengers) &&
            data.passengers.length === q.passengers,
          400,
          "PASSENGER_COUNT",
          "乘机人数与报价不一致",
        );
        assert(
          data.passengers.every(
            (p) =>
              object(p) &&
              typeof p.name === "string" &&
              p.name.trim().length >= 2 &&
              p.name.length <= 40 &&
              typeof p.document === "string" &&
              /^[A-Za-z0-9]{6,20}$/.test(p.document),
          ),
          400,
          "INVALID_PASSENGER",
          "请填写旅客姓名及 6–20 位演示证件号",
        );
        assert(
          typeof data.contact === "string" &&
            /^1[3-9]\d{9}$/.test(data.contact),
          400,
          "INVALID_CONTACT",
          "请填写 11 位联系手机号",
        );
        const changed = db
          .prepare("UPDATE flights SET seats=seats-? WHERE id=? AND seats>=?")
          .run(q.passengers, q.flight_id, q.passengers);
        assert(changed.changes === 1, 409, "SOLD_OUT", "余票不足，请重新查询");
        const id = `YC${now().toString().slice(-9)}${randomUUID().slice(0, 5).toUpperCase()}`;
        db.prepare(
          "INSERT INTO orders(id,owner,role,flight_id,quote_id,amount,passengers,contact,status,created,expires,idempotency) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          actor.owner,
          actor.role,
          q.flight_id,
          q.id,
          q.amount,
          JSON.stringify(data.passengers),
          data.contact,
          "PENDING_PAYMENT",
          now(),
          now() + 900000,
          key,
        );
        db.prepare("UPDATE quotes SET used=1 WHERE id=?").run(q.id);
        store.event(id, "CREATED", now(), {
          amount: q.amount,
          quoteId: q.id,
          cabin: q.cabin,
        });
        return orderView(db.prepare("SELECT * FROM orders WHERE id=?").get(id));
      });
    },
    orders(actor) {
      expire();
      return db
        .prepare("SELECT * FROM orders WHERE owner=? ORDER BY created DESC")
        .all(actor.owner)
        .map(orderView);
    },
    order,
    pay(id, data, actor) {
      const o = order(id, actor);
      if (["CONFIRMED", "CHECKED_IN"].includes(o.status)) return o;
      assert(
        o.status === "PENDING_PAYMENT",
        409,
        "INVALID_TRANSITION",
        "当前订单无法支付",
      );
      const result = mockProviders.payment(o, data.simulateFailure === true);
      const updated = store.transaction(() => {
        const current = db
          .prepare("SELECT status FROM orders WHERE id=?")
          .get(id);
        assert(
          current.status === "PENDING_PAYMENT",
          409,
          "INVALID_TRANSITION",
          "订单状态已更新",
        );
        if (!result.ok) {
          store.event(id, "PAYMENT_FAILED", now(), result);
          return null;
        }
        db.prepare("UPDATE orders SET status='CONFIRMED' WHERE id=?").run(id);
        store.event(id, "PAYMENT_SUCCEEDED", now(), result);
        store.event(id, "TICKET_ISSUED", now(), {
          ticket: result.ticket,
          provider: "mock-aviation",
        });
        return orderView(db.prepare("SELECT * FROM orders WHERE id=?").get(id));
      });
      if (!result.ok) throw new HttpError(402, "PAYMENT_FAILED", result.reason);
      return updated;
    },
    cancel(id, actor) {
      const o = order(id, actor);
      if (o.status === "CANCELLED") return o;
      assert(
        ["PENDING_PAYMENT", "CONFIRMED"].includes(o.status),
        409,
        "INVALID_TRANSITION",
        "已值机或已过期订单无法取消",
      );
      return store.transaction(() => {
        db.prepare("UPDATE orders SET status='CANCELLED' WHERE id=?").run(id);
        db.prepare("UPDATE flights SET seats=seats+? WHERE id=?").run(
          o.passengers.length,
          o.flight.id,
        );
        store.event(id, "CANCELLED", now(), {
          refund: o.status === "CONFIRMED" ? o.amount : 0,
          provider: "mock-payment",
        });
        return orderView(db.prepare("SELECT * FROM orders WHERE id=?").get(id));
      });
    },
    checkin(id, data, actor) {
      const o = order(id, actor);
      if (o.status === "CHECKED_IN") {
        assert(
          o.seat === data.seat,
          409,
          "ALREADY_CHECKED_IN",
          "已完成值机，请查看登机牌",
        );
        return o;
      }
      assert(
        o.status === "CONFIRMED",
        409,
        "INVALID_TRANSITION",
        "支付出票后才可值机",
      );
      assert(
        o.passengers.length === 1,
        409,
        "SINGLE_CHECKIN_ONLY",
        "当前演示值机支持单人订单；多人订单可完成支付出票",
      );
      const remaining = Date.parse(o.flight.departure) - now();
      assert(
        remaining <= 48 * 3600000 && remaining > 45 * 60000,
        409,
        "CHECKIN_WINDOW",
        "请在起飞前 48 小时至 45 分钟办理值机",
      );
      assert(
        typeof data.seat === "string" &&
          /^(?:[1-9]|[12]\d|30)[ABCDEF]$/.test(data.seat),
        400,
        "INVALID_SEAT",
        "请选择 1–30 排 A–F 座位",
      );
      return store.transaction(() => {
        assert(
          !db
            .prepare(
              "SELECT id FROM orders WHERE flight_id=? AND seat=? AND status='CHECKED_IN'",
            )
            .get(o.flight.id, data.seat),
          409,
          "SEAT_TAKEN",
          "该座位已被选择，请更换",
        );
        const boarding = mockProviders.checkin(o, data.seat);
        db.prepare(
          "UPDATE orders SET status='CHECKED_IN',seat=?,boarding=? WHERE id=?",
        ).run(data.seat, JSON.stringify(boarding), id);
        store.event(id, "CHECKED_IN", now(), boarding);
        return orderView(db.prepare("SELECT * FROM orders WHERE id=?").get(id));
      });
    },
    seats(id, actor) {
      const o = order(id, actor);
      return {
        taken: db
          .prepare(
            "SELECT seat FROM orders WHERE flight_id=? AND status='CHECKED_IN'",
          )
          .all(o.flight.id)
          .map((s) => s.seat),
      };
    },
    catalog(kind, code) {
      assert(!code || city(code), 400, "INVALID_CITY", "目的地无效");
      return (kind === "hotels" ? hotels : attractions)
        .filter((x) => !code || x.city === code)
        .map((x) => ({ ...x, cityName: city(x.city).name, simulated: true }));
    },
    plan(data, actor) {
      assert(
        object(data) && city(data.city),
        400,
        "INVALID_CITY",
        "请选择目的地",
      );
      assert(
        Number.isInteger(data.days) && data.days >= 1 && data.days <= 7,
        400,
        "INVALID_DAYS",
        "行程天数为 1 至 7 天",
      );
      const budget = Number(data.budget);
      assert(
        Number.isFinite(budget) && budget >= 100 && budget <= 100000,
        400,
        "INVALID_BUDGET",
        "预算范围为 100 至 100000 元",
      );
      const hotel = hotels.find((h) => h.city === data.city),
        attraction = attractions.find((a) => a.city === data.city);
      const known =
        (hotel?.price || 350) * Math.max(0, data.days - 1) +
        (attraction?.price || 0);
      const trip = {
        id: randomUUID(),
        city: data.city,
        cityName: city(data.city).name,
        days: data.days,
        budget,
        estimatedTotal: known + data.days * 150,
        withinBudget: known + data.days * 150 <= budget,
        hotel: hotel || null,
        costBreakdown: {
          lodging: (hotel?.price || 350) * Math.max(0, data.days - 1),
          tickets: attraction?.price || 0,
          foodAndTransport: data.days * 150,
          lodgingRateAssumed: !hotel,
        },
        itinerary: Array.from({ length: data.days }, (_, i) => ({
          day: i + 1,
          title:
            i === 0
              ? "抵达与城市初见"
              : i === data.days - 1
                ? "慢游与返程"
                : "深入城市的日常",
          activities: [
            {
              time: "09:00",
              name: i === 0 ? "抵达目的地 · 行李寄存" : "酒店早餐 · 自由漫步",
            },
            {
              time: "10:30",
              name:
                i === 0 && attraction
                  ? attraction.name
                  : ["城市文化探索", "历史街区漫步", "城市公园休闲"][i % 3],
              duration: i === 0 && attraction ? attraction.duration : 120,
            },
            {
              time: "14:30",
              name: i % 2 ? "当地博物馆与街区" : "城市公园与在地美食",
            },
            {
              time: "18:00",
              name:
                i === data.days - 1
                  ? "收拾行李 · 预留返程交通时间"
                  : "晚餐 · 返回酒店",
            },
          ],
        })),
        simulated: true,
        algorithm:
          "规则式行程规划，酒店与门票为本地模拟数据；每日餐饮交通按 150 元估算；未收录酒店的城市按 350 元/晚估算住宿；通用街区/公园活动按免费估算，收费景点仅安排一次",
      };
      db.prepare("INSERT INTO trips VALUES(?,?,?,?)").run(
        trip.id,
        actor.owner,
        JSON.stringify(trip),
        now(),
      );
      return trip;
    },
    trips(actor) {
      return db
        .prepare("SELECT data FROM trips WHERE owner=? ORDER BY created DESC")
        .all(actor.owner)
        .map((t) => JSON.parse(t.data));
    },
    agency(actor) {
      assert(
        actor.role === "agency",
        403,
        "ROLE_REQUIRED",
        "仅旅行社演示角色可查看工作台",
      );
      const all = this.orders(actor);
      return {
        orders: all.length,
        revenue: all
          .filter((o) => ["CONFIRMED", "CHECKED_IN"].includes(o.status))
          .reduce((s, o) => s + o.amount, 0),
        pending: all.filter((o) => o.status === "PENDING_PAYMENT").length,
        travelers: all
          .filter((o) => !["CANCELLED", "EXPIRED"].includes(o.status))
          .reduce((s, o) => s + o.passengers.length, 0),
      };
    },
  };
}
