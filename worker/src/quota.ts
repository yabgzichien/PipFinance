// worker/src/quota.ts
export const FREE_MONTHLY_LIMIT = 20;
export const FREE_DAILY_LIMIT = 3;
export const RESERVATION_TTL_MS = 60_000; // 1 minute

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<{ results?: T[]; success: boolean }>>;
}

export function getUtcKeys(timestamp: number): { dayKey: string; monthKey: string } {
  const d = new Date(timestamp);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return {
    dayKey: `${year}-${month}-${day}`,
    monthKey: `${year}-${month}`,
  };
}

export async function hashInstallationId(id: string, salt: string = 'pip_quota_salt_2026'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${id}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getUsage(
  db: D1Database,
  hash: string,
  dayKey: string,
  monthKey: string
): Promise<{ dayUsed: number; monthUsed: number }> {
  const dayRow = await db
    .prepare('SELECT used_count FROM quota_usage WHERE installation_hash = ? AND period_type = ? AND period_key = ?')
    .bind(hash, 'day', dayKey)
    .first<{ used_count: number }>();

  const monthRow = await db
    .prepare('SELECT used_count FROM quota_usage WHERE installation_hash = ? AND period_type = ? AND period_key = ?')
    .bind(hash, 'month', monthKey)
    .first<{ used_count: number }>();

  return {
    dayUsed: dayRow?.used_count ?? 0,
    monthUsed: monthRow?.used_count ?? 0,
  };
}

export interface ReserveResult {
  ok: boolean;
  blockedBy: 'daily' | 'monthly' | null;
  dayUsed: number;
  monthUsed: number;
  alreadyCommitted?: boolean;
}

export async function checkAndReserve(
  db: D1Database,
  hash: string,
  idempotencyKey: string,
  isPro: boolean,
  now: number = Date.now()
): Promise<ReserveResult> {
  const { dayKey, monthKey } = getUtcKeys(now);

  // Check idempotency first
  const existing = await db
    .prepare('SELECT status, expires_at FROM reservations WHERE idempotencyKey = ?')
    .bind(idempotencyKey)
    .first<{ status: string; expires_at: number }>();

  if (existing) {
    if (existing.status === 'committed') {
      const usage = await getUsage(db, hash, dayKey, monthKey);
      return { ok: true, blockedBy: null, dayUsed: usage.dayUsed, monthUsed: usage.monthUsed, alreadyCommitted: true };
    }
    if (existing.status === 'reserved' && existing.expires_at > now) {
      // Active reservation exists
      const usage = await getUsage(db, hash, dayKey, monthKey);
      return { ok: true, blockedBy: null, dayUsed: usage.dayUsed, monthUsed: usage.monthUsed };
    }
  }

  // Pro users bypass quota entirely and don't consume quota
  if (isPro) {
    await db
      .prepare(
        'INSERT OR REPLACE INTO reservations (idempotency_key, installation_hash, day_key, month_key, created_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(idempotencyKey, hash, dayKey, monthKey, now, now + RESERVATION_TTL_MS, 'reserved')
      .run();

    return { ok: true, blockedBy: null, dayUsed: 0, monthUsed: 0 };
  }

  // Free users: check current counts
  const usage = await getUsage(db, hash, dayKey, monthKey);

  if (usage.dayUsed >= FREE_DAILY_LIMIT) {
    return { ok: false, blockedBy: 'daily', dayUsed: usage.dayUsed, monthUsed: usage.monthUsed };
  }

  if (usage.monthUsed >= FREE_MONTHLY_LIMIT) {
    return { ok: false, blockedBy: 'monthly', dayUsed: usage.dayUsed, monthUsed: usage.monthUsed };
  }

  // Atomically create or replace reservation
  await db
    .prepare(
      'INSERT OR REPLACE INTO reservations (idempotency_key, installation_hash, day_key, month_key, created_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(idempotencyKey, hash, dayKey, monthKey, now, now + RESERVATION_TTL_MS, 'reserved')
    .run();

  return { ok: true, blockedBy: null, dayUsed: usage.dayUsed, monthUsed: usage.monthUsed };
}

export async function commitReservation(
  db: D1Database,
  idempotencyKey: string,
  isPro: boolean,
  now: number = Date.now()
): Promise<void> {
  const res = await db
    .prepare('SELECT installation_hash, day_key, month_key, status FROM reservations WHERE idempotency_key = ?')
    .bind(idempotencyKey)
    .first<{ installation_hash: string; day_key: string; month_key: string; status: string }>();

  if (!res || res.status === 'committed') return;

  const stmts: D1PreparedStatement[] = [
    db
      .prepare('UPDATE reservations SET status = ? WHERE idempotency_key = ?')
      .bind('committed', idempotencyKey),
  ];

  if (!isPro) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO quota_usage (installation_hash, period_type, period_key, used_count, updated_at)
           VALUES (?, 'day', ?, 1, ?)
           ON CONFLICT(installation_hash, period_type, period_key)
           DO UPDATE SET used_count = used_count + 1, updated_at = excluded.updated_at`
        )
        .bind(res.installation_hash, res.day_key, now)
    );

    stmts.push(
      db
        .prepare(
          `INSERT INTO quota_usage (installation_hash, period_type, period_key, used_count, updated_at)
           VALUES (?, 'month', ?, 1, ?)
           ON CONFLICT(installation_hash, period_type, period_key)
           DO UPDATE SET used_count = used_count + 1, updated_at = excluded.updated_at`
        )
        .bind(res.installation_hash, res.month_key, now)
    );
  }

  await db.batch(stmts);
}

export async function rollbackReservation(db: D1Database, idempotencyKey: string): Promise<void> {
  await db
    .prepare("UPDATE reservations SET status = 'rolled_back' WHERE idempotency_key = ? AND status = 'reserved'")
    .bind(idempotencyKey)
    .run();
}
