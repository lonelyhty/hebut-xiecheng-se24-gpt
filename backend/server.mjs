import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.mjs";
import { createService, HttpError } from "./service.mjs";

const root = path.resolve(import.meta.dirname, "..");
export function createApp({
  dbPath = path.join(root, "data/travel.sqlite"),
  now = Date.now,
  instanceId = crypto.randomUUID(),
} = {}) {
  const store = createStore(dbPath),
    service = createService(store, { now });
  const server = http.createServer(async (req, res) => {
    const requestId = crypto.randomUUID(),
      url = new URL(req.url, "http://localhost");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    const send = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      if (url.pathname.startsWith("/api/")) {
        if (!["GET", "POST"].includes(req.method))
          throw new HttpError(405, "METHOD_NOT_ALLOWED", "不支持的请求方法");
        if (
          req.method === "POST" &&
          req.headers.origin &&
          req.headers.origin !== `http://${req.headers.host}`
        )
          throw new HttpError(403, "ORIGIN_REJECTED", "跨站写入请求已拒绝");
        let body = {};
        if (req.method === "POST") {
          if (!req.headers["content-type"]?.startsWith("application/json"))
            throw new HttpError(415, "CONTENT_TYPE", "请使用 JSON 请求");
          let data = "",
            size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 32768)
              throw new HttpError(413, "BODY_TOO_LARGE", "请求内容过大");
            data += chunk;
          }
          try {
            body = JSON.parse(data || "{}");
          } catch {
            throw new HttpError(400, "INVALID_JSON", "JSON 格式错误");
          }
          if (!body || typeof body !== "object" || Array.isArray(body))
            throw new HttpError(400, "INVALID_BODY", "请求内容必须为对象");
        }
        const actor = service.session(req.headers.cookie),
          method = req.method,
          p = url.pathname,
          q = Object.fromEntries(url.searchParams);
        if (p === "/api/health" && method === "GET")
          return send(200, { ok: true, service: "云程旅行", simulated: true, instanceId });
        if (p === "/api/meta" && method === "GET")
          return send(200, service.meta());
        if (p === "/api/session" && method === "GET")
          return send(200, { actor });
        if (p === "/api/session" && method === "POST") {
          const login = service.login(body);
          res.setHeader(
            "Set-Cookie",
            `yc_session=${login.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
          );
          return send(200, { actor: login.actor });
        }
        if (p === "/api/flights" && method === "GET")
          return send(200, service.search(q));
        if (["/api/hotels", "/api/attractions"].includes(p) && method === "GET")
          return send(200, {
            items: service.catalog(p.split("/").pop(), q.city),
          });
        if (!actor)
          throw new HttpError(401, "AUTH_REQUIRED", "请先选择一个演示角色");
        if (p === "/api/quotes" && method === "POST")
          return send(201, service.quote(body, actor));
        if (p === "/api/orders" && method === "POST")
          return send(
            201,
            service.createOrder(body, actor, req.headers["idempotency-key"]),
          );
        if (p === "/api/orders" && method === "GET")
          return send(200, { orders: service.orders(actor) });
        if (p === "/api/trips" && method === "POST")
          return send(201, service.plan(body, actor));
        if (p === "/api/trips" && method === "GET")
          return send(200, { trips: service.trips(actor) });
        if (p === "/api/agency" && method === "GET")
          return send(200, service.agency(actor));
        const match = p.match(
          /^\/api\/orders\/([A-Za-z0-9-]+)(?:\/(pay|cancel|check-in|seats))?$/,
        );
        if (match) {
          const [, id, action] = match;
          if (method === "GET" && !action)
            return send(200, service.order(id, actor));
          if (method === "GET" && action === "seats")
            return send(200, service.seats(id, actor));
          if (method === "POST" && action === "pay")
            return send(200, service.pay(id, body, actor));
          if (method === "POST" && action === "cancel")
            return send(200, service.cancel(id, actor));
          if (method === "POST" && action === "check-in")
            return send(200, service.checkin(id, body, actor));
        }
        throw new HttpError(404, "NOT_FOUND", "接口不存在");
      }
      if (!["GET", "HEAD"].includes(req.method))
        throw new HttpError(405, "METHOD_NOT_ALLOWED", "不支持的请求方法");
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        throw new HttpError(400, "INVALID_PATH", "路径格式错误");
      }
      const publicRoot = path.join(root, "frontend"),
        target = path.resolve(
          publicRoot,
          "." + (pathname === "/" ? "/index.html" : pathname),
        );
      if (target !== publicRoot && !target.startsWith(publicRoot + path.sep))
        throw new HttpError(403, "FORBIDDEN", "访问被拒绝");
      const bytes = await fs.readFile(target).catch(() => {
        throw new HttpError(404, "NOT_FOUND", "页面不存在");
      });
      const type =
        {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".webp": "image/webp",
        }[path.extname(target)] || "application/octet-stream";
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      res.writeHead(200, { "Content-Type": type });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(`[${requestId}]`, e);
      if (!res.headersSent)
        send(e.status || 500, {
          error: {
            code: e.code || "INTERNAL_ERROR",
            message: e instanceof HttpError ? e.message : "服务暂时不可用",
            requestId,
          },
        });
      else res.end();
    }
  });
  return {
    server,
    service,
    store,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      store.db.close();
    },
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 4173),
    host = process.env.HOST || "127.0.0.1";
  const app = createApp({
    dbPath: process.env.TRAVEL_DB || path.join(root, "data/travel.sqlite"),
    instanceId: process.env.TRAVEL_INSTANCE,
  });
  app.server.listen(port, host, () =>
    console.log(`云程旅行：http://${host}:${port}（本地模拟服务）`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => app.close().then(() => process.exit(0)));
}
