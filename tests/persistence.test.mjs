import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../backend/server.mjs";

test("SQLite 重启后保留商务舱订单、锁定金额与扣减库存", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "rexiecheng-test-"),
  );
  const dbPath = path.join(directory, "travel.sqlite");
  let app = createApp({
    dbPath,
    now: () => Date.parse("2026-10-20T08:00:00+08:00"),
  });
  const actor = { owner: "demo-traveler", role: "traveler" };
  try {
    const flight = app.service.search({
      from: "SHA",
      to: "BJS",
      date: "2026-10-21",
      cabin: "business",
    }).flights[0];
    const quote = app.service.quote(
      { flightId: flight.id, cabin: "business", passengers: 1 },
      actor,
    );
    const order = app.service.createOrder(
      {
        quoteId: quote.id,
        passengers: [{ name: "重启旅客", document: "DEMO99881" }],
        contact: "13800000000",
      },
      actor,
      crypto.randomUUID(),
    );
    assert.equal(order.flight.cabin, "business");
    assert.equal(order.amount, quote.amount);
    app.store.db.close();
    app = createApp({
      dbPath,
      now: () => Date.parse("2026-10-20T08:01:00+08:00"),
    });
    const restored = app.service.order(order.id, actor);
    assert.equal(restored.id, order.id);
    assert.equal(restored.amount, quote.amount);
    assert.equal(restored.flight.cabin, "business");
    assert.equal(restored.flight.seats, flight.seats - 1);
    assert.equal(restored.events[0].type, "CREATED");
  } finally {
    app.store.db.close();
    // The exact path was created exclusively by this test; delete only known files.
    for (const suffix of ["", "-wal", "-shm"])
      await fs.unlink(dbPath + suffix).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    await fs.rmdir(directory);
  }
});
