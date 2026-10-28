import assert from "node:assert/strict";
import test from "node:test";
import { databaseStartupOptions } from "./clientOptions.js";

test("direct and session pools keep PostgreSQL startup timeouts", () => {
  const expected = {
    connection: { statement_timeout: 15_000, lock_timeout: 10_000 },
  };
  assert.deepEqual(databaseStartupOptions("direct", 15_000, 10_000), expected);
  assert.deepEqual(databaseStartupOptions("session", 15_000, 10_000), expected);
});

test("transaction pooling omits unsupported session startup parameters", () => {
  assert.deepEqual(databaseStartupOptions("transaction", 15_000, 10_000), {});
});
