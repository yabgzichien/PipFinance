import { genId, getDb } from './db';
import type { Trip } from '../lib/trips';
import { updateTransactionTrip } from './txnRepo';

interface TripRow {
  id: string;
  name: string;
  created_at: string;
  archived: number;
  start_date: string | null;
  end_date: string | null;
}

function toTrip(r: TripRow): Trip {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    archived: !!r.archived,
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
  };
}

export async function listTrips(): Promise<Trip[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TripRow>('SELECT * FROM trips ORDER BY created_at DESC');
  return rows.map(toTrip);
}

export async function addTrip(
  name: string,
  startDate: string | null = null,
  endDate: string | null = null
): Promise<Trip> {
  const db = await getDb();
  const id = genId();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO trips (id, name, created_at, archived, start_date, end_date) VALUES (?, ?, ?, 0, ?, ?)',
    id,
    name,
    createdAt,
    startDate,
    endDate
  );
  return { id, name, createdAt, archived: false, startDate, endDate };
}

export async function renameTrip(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE trips SET name = ? WHERE id = ?', name, id);
}

/** Archiving hides a trip from active pickers while keeping its membership intact, so a late
 *  charge or correction can still be attached. This is the preferred path over deletion. */
export async function setTripArchived(id: string, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE trips SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
}

/**
 * Delete a trip — a grouping, not spending. The transactions that belonged to it are the user's
 * actual financial history and must survive untouched, so this only clears their `trip_id`
 * before removing the trip row itself. Both statements run in one transaction.
 */
export async function deleteTrip(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE transactions SET trip_id = NULL WHERE trip_id = ?', id);
    await db.runAsync('DELETE FROM trips WHERE id = ?', id);
  });
}

/** Move one transaction into a trip, or out of every trip. Thin delegation so there is exactly
 *  one place that writes `transactions.trip_id` for a single row. */
export async function setTransactionTrip(txnId: string, tripId: string | null): Promise<void> {
  await updateTransactionTrip(txnId, tripId);
}

/**
 * Attach or detach many transactions at once — what the Activity multi-select hands over.
 *
 * One statement rather than a loop: a bulk attach that failed halfway would leave the trip
 * total showing a number that matches neither what the user selected nor what they had before.
 */
export async function setTransactionsTrip(txnIds: string[], tripId: string | null): Promise<void> {
  if (txnIds.length === 0) return;
  const db = await getDb();
  const placeholders = txnIds.map(() => '?').join(',');
  await db.runAsync(`UPDATE transactions SET trip_id = ? WHERE id IN (${placeholders})`, tripId, ...txnIds);
}
