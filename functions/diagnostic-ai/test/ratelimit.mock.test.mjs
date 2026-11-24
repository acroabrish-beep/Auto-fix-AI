/**
 * MOCK-ONLY tests for the Stage 3.3 diagnostic rate-limit design.
 *
 * These tests exercise the ALGORITHM described in STAGE_3.3_RATE_LIMITING_DESIGN.md
 * using an in-memory mock store. They are NOT evidence of Appwrite atomicity,
 * concurrency, or production behaviour. No Appwrite project is contacted.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const LIMIT = 30;
const WINDOW_MS = 60_000;

function hashRowId(scope, userId, windowStart) {
  return createHash('sha256').update(`${scope}:${userId}:${windowStart}`).digest('hex').slice(0, 32);
}

// Mock store simulating createRow (unique id) + increment (no max) + getRow.
function makeStore({ failCreate = null, failIncrement = null, failGet = null } = {}) {
  const rows = new Map();
  return {
    rows,
    async createRow(rowId, data) {
      if (failCreate) throw failCreate;
      if (rows.has(rowId)) {
        const err = new Error('row already exists');
        err.status = 409;
        err.type = 'row_already_exists';
        throw err;
      }
      rows.set(rowId, { ...data });
      return rows.get(rowId);
    },
    async incrementRowColumn(rowId) {
      if (failIncrement) throw failIncrement;
      const row = rows.get(rowId);
      if (!row) {
        const err = new Error('row not found');
        err.status = 404;
        err.type = 'row_not_found';
        throw err;
      }
      row.count += 1;
      return { ...row };
    },
    async getRow(rowId) {
      if (failGet) throw failGet;
      const row = rows.get(rowId);
      if (!row) {
        const err = new Error('row not found');
        err.status = 404;
        err.type = 'row_not_found';
        throw err;
      }
      return { ...row };
    },
  };
}

function isDuplicateRowId(err) {
  return err?.status === 409 && err?.type === 'row_already_exists';
}

async function check(store, userId, now) {
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const windowEnd = windowStart + WINDOW_MS;
  const rowId = hashRowId('diagnostic', userId, windowStart);

  // create
  try {
    const row = await store.createRow(rowId, { userId, scope: 'diagnostic', count: 1, windowStart, windowEnd });
    return { allowed: true, count: row.count, windowEnd, rowId };
  } catch (err) {
    if (!isDuplicateRowId(err)) throw err;
  }

  // increment without max
  try {
    const row = await store.incrementRowColumn(rowId);
    return { allowed: row.count <= LIMIT, count: row.count, windowEnd, rowId };
  } catch (err) {
    // Corrected design: only verified duplicate-row errors reach increment.
    // Store-level rejections (locked, Appwrite 429) fail closed -> 503 (throw).
    if (err?.type === 'general_resource_locked' || err?.type === 'general_rate_limit_exceeded') {
      throw err;
    }
    const row = await store.getRow(rowId).catch(() => null);
    if (row && row.count >= LIMIT) {
      return { allowed: false, count: row.count, windowEnd, rowId };
    }
    throw err;
  }
}

test('mock rate limit: first request in a window is allowed with count 1', async () => {
  const store = makeStore();
  const r = await check(store, 'u1', 1000);
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.count, 1);
});

test('mock rate limit: requests 1-30 are allowed', async () => {
  const store = makeStore();
  const now = 1000;
  for (let i = 1; i <= 30; i++) {
    const r = await check(store, 'u1', now);
    assert.strictEqual(r.allowed, true, `request ${i} should be allowed`);
  }
  const last = await store.getRow(hashRowId('diagnostic', 'u1', Math.floor(now / WINDOW_MS) * WINDOW_MS));
  assert.strictEqual(last.count, 30);
});

test('mock rate limit: 31st request is denied', async () => {
  const store = makeStore();
  const now = 1000;
  for (let i = 0; i < 30; i++) await check(store, 'u1', now);
  const r = await check(store, 'u1', now);
  assert.strictEqual(r.allowed, false);
  assert.ok(r.count >= 31);
});

test('mock rate limit: window reset restarts count', async () => {
  const store = makeStore();
  const w1 = 1000;
  const w2 = w1 + WINDOW_MS;
  for (let i = 0; i < 5; i++) await check(store, 'u1', w1);
  const r = await check(store, 'u1', w2);
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.count, 1);
});

test('mock rate limit: two users have independent counters', async () => {
  const store = makeStore();
  const now = 1000;
  for (let i = 0; i < 5; i++) await check(store, 'u1', now);
  const r2 = await check(store, 'u2', now);
  assert.strictEqual(r2.allowed, true);
  assert.strictEqual(r2.count, 1);
});

test('mock rate limit: duplicate row id enters increment path', async () => {
  const store = makeStore();
  const now = 1000;
  await check(store, 'u1', now); // creates row
  // force a duplicate create by calling check again (createRow throws conflict)
  const r = await check(store, 'u1', now);
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.count, 2);
});

test('mock rate limit: unique-constraint violation (non-verified) fails closed 503', async () => {
  const store = makeStore();
  const err = new Error('unique constraint');
  err.status = 409;
  err.type = 'row_unique_constraint_violation';
  store.createRow = async () => { throw err; };
  await assert.rejects(() => check(store, 'u1', 1000), (e) => e.status === 409 && e.type === 'row_unique_constraint_violation');
});

test('mock rate limit: store unavailable (non-conflict) throws (fail closed -> 503)', async () => {
  const store = makeStore({ failCreate: Object.assign(new Error('boom'), { status: 500, type: 'general_server_error' }) });
  await assert.rejects(() => check(store, 'u1', 1000));
});

test('mock rate limit: increment failure with count below limit throws (fail closed -> 503)', async () => {
  const store = makeStore();
  await check(store, 'u1', 1000); // count 1
  store.incrementRowColumn = async () => { throw Object.assign(new Error('timeout'), { status: 504, type: 'general_timeout' }); };
  await assert.rejects(() => check(store, 'u1', 1000));
});

test('mock rate limit: locked increment fails closed (503), never allows', async () => {
  const store = makeStore();
  const now = 1000;
  const ws = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const rowId = hashRowId('diagnostic', 'u1', ws);
  store.rows.set(rowId, { userId: 'u1', scope: 'diagnostic', count: LIMIT, windowStart: ws, windowEnd: ws + WINDOW_MS });
  store.incrementRowColumn = async () => { throw Object.assign(new Error('locked'), { status: 409, type: 'general_resource_locked' }); };
  await assert.rejects(() => check(store, 'u1', now));
});

test('mock rate limit: row id is 32 lowercase hex and varies by user/window', () => {
  const a = hashRowId('diagnostic', 'u1', 1000);
  const b = hashRowId('diagnostic', 'u2', 1000);
  const c = hashRowId('diagnostic', 'u1', 1000 + WINDOW_MS);
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test('mock rate limit: unbounded increment returns counts above limit (no clamping)', async () => {
  const store = makeStore();
  const now = 1000;
  for (let i = 0; i < 32; i++) await check(store, 'u1', now);
  const ws = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const row = await store.getRow(hashRowId('diagnostic', 'u1', ws));
  assert.ok(row.count >= 32, 'counter must grow past the limit without clamping');
});