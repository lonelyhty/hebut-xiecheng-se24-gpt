import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createApp } from "../backend/server.mjs";
const app = createApp({ dbPath: ":memory:" });
await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
try {
  const today = app.service.meta().today,
    date = new Date(Date.parse(today + "T12:00:00Z") + 86400000)
      .toISOString()
      .slice(0, 10);
  const url = `http://127.0.0.1:${app.server.address().port}/api/flights?from=SHA&to=BJS&date=${date}&sort=price`;
  for (let i = 0; i < 20; i++) await (await fetch(url)).json();
  const timings = [],
    count = 300,
    concurrency = 10;
  let cursor = 0,
    success = 0;
  const begin = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor++ < count) {
        const start = performance.now(),
          response = await fetch(url),
          body = await response.json();
        if (response.ok && body.flights.length === 5) success++;
        timings.push(performance.now() - start);
      }
    }),
  );
  const duration = performance.now() - begin;
  timings.sort((a, b) => a - b);
  const percentile = (p) =>
    Math.round(timings[Math.ceil(timings.length * p) - 1] * 100) / 100;
  const report = {
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      transport: "loopback HTTP",
      database: "SQLite in-memory",
    },
    scenario:
      "Warmed repeated SHA → BJS flight search; five simulated flights; default inventory; 20 warmups",
    requests: count,
    concurrency,
    success,
    failed: count - success,
    durationMs: Math.round(duration),
    requestsPerSecond: Math.round(success / (duration / 1000)),
    latencyMs: {
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      max: Math.round(timings.at(-1) * 100) / 100,
    },
    acceptance: {
      criterion: "zero failures and local p95 < 250 ms",
      passed: success === count && percentile(0.95) < 250,
    },
    limitations: [
      "Local warmed process only; not a production load/capacity guarantee.",
      "No external API latency, cross-host network, TLS, concurrent order writes or production-size database is included.",
    ],
  };
  await fs.writeFile(
    path.resolve(import.meta.dirname, "../reports/performance.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.acceptance.passed) process.exitCode = 1;
} finally {
  await app.close();
}
