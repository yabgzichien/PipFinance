// worker/test/mockD1.ts
import type { D1Database, D1PreparedStatement } from '../src/quota';

export function createMockD1(): D1Database {
  const quotaStore = new Map<string, { used_count: number; updated_at: number }>();
  const reservations = new Map<string, {
    installation_hash: string;
    day_key: string;
    month_key: string;
    created_at: number;
    expires_at: number;
    status: string;
  }>();

  function makeStatement(query: string, params: unknown[] = []): D1PreparedStatement {
    return {
      bind(...values: unknown[]) {
        return makeStatement(query, values);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const q = query.trim().toUpperCase();

        if (q.includes('FROM QUOTA_USAGE')) {
          const hash = params[0] as string;
          const periodType = params[1] as string;
          const periodKey = params[2] as string;
          const key = `${hash}:${periodType}:${periodKey}`;
          const row = quotaStore.get(key);
          if (!row) return null;
          if (colName) return (row as any)[colName] ?? null;
          return row as unknown as T;
        }

        if (q.includes('FROM RESERVATIONS')) {
          const idKey = params[0] as string;
          const row = reservations.get(idKey);
          if (!row) return null;
          if (colName) return (row as any)[colName] ?? null;
          return row as unknown as T;
        }

        return null;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        return { results: [] };
      },
      async run(): Promise<{ success: boolean }> {
        const q = query.trim().toUpperCase();

        if (q.startsWith('INSERT OR REPLACE INTO RESERVATIONS')) {
          const [idKey, hash, dayKey, monthKey, createdAt, expiresAt, status] = params;
          reservations.set(idKey as string, {
            installation_hash: hash as string,
            day_key: dayKey as string,
            month_key: monthKey as string,
            created_at: createdAt as number,
            expires_at: expiresAt as number,
            status: status as string,
          });
          return { success: true };
        }

        if (q.startsWith('UPDATE RESERVATIONS SET STATUS = ?')) {
          const newStatus = params[0] as string;
          const idKey = params[1] as string;
          const res = reservations.get(idKey);
          if (res) {
            res.status = newStatus;
          }
          return { success: true };
        }

        if (q.startsWith('UPDATE RESERVATIONS SET STATUS = \'ROLLED_BACK\'')) {
          const idKey = params[0] as string;
          const res = reservations.get(idKey);
          if (res && res.status === 'reserved') {
            res.status = 'rolled_back';
          }
          return { success: true };
        }

        if (q.includes('INTO QUOTA_USAGE')) {
          const hash = params[0] as string;
          const periodKey = params[1] as string;
          const periodType = q.includes("'DAY'") ? 'day' : 'month';
          const updatedAt = params[2] as number;
          const key = `${hash}:${periodType}:${periodKey}`;
          const current = quotaStore.get(key)?.used_count ?? 0;
          quotaStore.set(key, { used_count: current + 1, updated_at: updatedAt });
          return { success: true };
        }

        return { success: true };
      },
    };
  }

  return {
    prepare(query: string) {
      return makeStatement(query);
    },
    async batch(statements: D1PreparedStatement[]) {
      const results = [];
      for (const stmt of statements) {
        const res = await stmt.run();
        results.push(res);
      }
      return results;
    },
  };
}
