import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function createStore(filename) {
  if (filename !== ":memory:")
    mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS flights(id TEXT PRIMARY KEY,data TEXT NOT NULL,seats INTEGER NOT NULL CHECK(seats>=0));
    CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY,owner TEXT NOT NULL,flight_id TEXT NOT NULL REFERENCES flights(id),amount INTEGER NOT NULL,passengers INTEGER NOT NULL,cabin TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,owner TEXT NOT NULL,role TEXT NOT NULL,flight_id TEXT NOT NULL REFERENCES flights(id),quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id),amount INTEGER NOT NULL,passengers TEXT NOT NULL,contact TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('PENDING_PAYMENT','CONFIRMED','CHECKED_IN','CANCELLED','EXPIRED')),created INTEGER NOT NULL,expires INTEGER NOT NULL,idempotency TEXT NOT NULL,seat TEXT,boarding TEXT,UNIQUE(owner,idempotency));
    CREATE INDEX IF NOT EXISTS orders_owner_created ON orders(owner,created DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS unique_checked_seat ON orders(flight_id,seat) WHERE status='CHECKED_IN';
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES orders(id),type TEXT NOT NULL,at INTEGER NOT NULL,detail TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,owner TEXT NOT NULL,role TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY,owner TEXT NOT NULL,data TEXT NOT NULL,created INTEGER NOT NULL);
  `);
  return {
    db,
    transaction(fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const value = fn();
        db.exec("COMMIT");
        return value;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    event(orderId, type, at, detail = {}) {
      db.prepare(
        "INSERT INTO events(order_id,type,at,detail) VALUES(?,?,?,?)",
      ).run(orderId, type, at, JSON.stringify(detail));
    },
  };
}
