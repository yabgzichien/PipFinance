# Backup & Restore (local + Google Drive cloud)

Status: approved for planning
Date: 2026-09-02

## Purpose

Pip currently has rich, period-scoped financial *reports* (PDF/xlsx/csv/html/json/receipts-zip/ewallet-csv) in `ExportScreen.tsx`, but no way to snapshot and recover the *entire app state* — all transactions, accounts, categories, commitments, splits, budget, tax relief, merchant memory, prefs, and receipt images — in one action. This feature adds:

1. A manual **local backup** (one zip: full JSON snapshot + all receipt images), reachable from Settings.
2. **Automatic cloud backup to Google Drive** on Android (hidden `appDataFolder`, single rolling file, silent background trigger on app foreground).
3. **Restore** from either a local backup zip or the Drive-hosted backup, as a destructive full-replace operation.
4. iCloud (iOS) gets a Settings row now, but is inert ("coming soon") — no native iCloud code in this build. iOS has no local `ios/` project checked in and development happens on Linux, so native iCloud work needs its own build/verify cycle on a real device later.

## Non-goals (this build)

- iCloud upload/restore implementation (UI stub only).
- Multiple backup versions / history browsing (single rolling backup only).
- True OS background scheduling (uses foreground-triggered debounce instead of `expo-background-task`/WorkManager).
- Any changes to the existing period-scoped `ExportScreen.tsx` reports.

## 1. Backup payload format

Reuse the existing `generateAdvancedImportJSON()` in [`src/lib/financialExport.ts`](../../../src/lib/financialExport.ts) as the JSON body — it is already a near-complete snapshot (transactions, transfers, accounts w/ balance history, categories, deleted-default-categories, commitments+occurrences, people/splits/shares/payments, budget+snapshots+advice, tax relief tags+memory, merchant memory, preferences).

Extensions needed:
- Add `receiptFile?: string` to each exported transaction row and each tax-relief tag's cert/e-invoice image reference, pointing at the corresponding `receipts/<file>` entry in the zip (mirrors the naming already used by `generateReceiptsZip`'s `buildReceiptExportList`).
- Call it over **all-time** data (no period filter) rather than the currently-selected report period.
- Bump the JSON `version` field only if the shape change would break the existing Advanced-Import parser's assumptions — otherwise keep it additive/optional so `parseJSON()` in `advancedImport.ts` continues to work unchanged for the manual-import use case.

New function `generateFullBackupZip()` in `financialExport.ts` (co-located with `generateReceiptsZip`, sharing its zip-building helpers):
- `backup.json` — the extended JSON above
- `receipts/*` — every receipt/cert/e-invoice image referenced by *any* transaction/tag (not period-filtered), via `readImageBytes` + `buildReceiptExportList` called unfiltered
- `MANIFEST.json`, `README.txt` — same pattern as `generateReceiptsZip`

## 2. Manual local backup

New Settings → Data row **"Back Up & Restore"** opens `BackupScreen.tsx` (new screen, wired the same way `ExportScreen` is: a prop callback from `App`/navigation root).

- "Back up now" button: builds `generateFullBackupZip()`, saves via the existing `saveOrDownloadExport()` (native file write + share sheet, or browser download on web) — no new save/share code needed.
- Shows last local backup timestamp (persisted via `metaRepo`, same pattern used elsewhere for small key/value app state).
- Errors surface via the existing `notify()` pattern from `platformAlert.ts`.

## 3. Google Drive cloud backup (Android)

New module `src/lib/cloudBackup/googleDrive.ts`:

- **Auth**: `expo-auth-session` (PKCE flow) requesting only the `https://www.googleapis.com/auth/drive.appdata` scope. Refresh/access tokens persisted in `expo-secure-store` (already a project dependency). Uses the app's existing `"scheme": "pip"` for the OAuth redirect — no config-plugin changes needed.
- **Storage target**: Drive's hidden `appDataFolder` — invisible in the user's normal Drive UI, doesn't consume visible quota display, and only this app can read/write it.
- **Transport**: plain `fetch` calls to Drive REST API v3 (`files.list` with `spaces=appDataFolder` to find the existing backup file, `files.create`/`files.update` multipart to upload). No native SDK, no prebuild changes.
- **New dependencies**: `expo-auth-session`, `expo-crypto`, `expo-web-browser`.
- **External setup (user-owned, outside this codebase change)**: a Google Cloud Console OAuth client ID (Android type: package `com.yabg.pipexpensestracker` + release/debug SHA-1 fingerprints). This will be called out explicitly as a manual step when implementation reaches this point — it cannot be scripted.

`useCloudBackup()` hook (new, `src/lib/cloudBackup/useCloudBackup.ts`):
- State: `status` (`disconnected | connected | backing-up | restoring | error`), `lastBackupAt`, `accountEmail`.
- Actions: `connect()`, `disconnect()`, `backupNow()`, `restoreLatest()`.
- Persists connection state + `lastBackupAt` via `expo-secure-store` / `metaRepo`.

**Auto-backup trigger**: mounted once near the app root (alongside `AppDataProvider`). On app foreground/launch, if connected and `now - lastBackupAt > 6h` (constant, not user-configurable in this build), fire `backupNow()` in the background. Failures are logged only — never surfaced as an interruption, since this is an unattended background action.

**iOS**: Settings shows an iCloud row (platform-gated, `Platform.OS === 'ios'`) rendered as a disabled "Coming soon" state. No native iCloud code ships in this build.

## 4. Restore

Available for both a local zip (picked via `expo-document-picker`) and the Drive-hosted backup. **Destructive full-replace**, not a merge — this recovers *your* snapshot, so it does not go through the existing Advanced-Import reconciliation screen (`ImportReviewScreen.tsx`), which is designed for merging externally-parsed statements into existing data.

Flow (new `src/lib/backupRestore.ts`):
1. Confirm dialog (via existing `confirmAction()`): *"This replaces all current data with the backup from `<date>`. This can't be undone."*
2. Unzip with `fflate`, parse `backup.json`; validate version/shape before touching any data.
3. Write bundled receipt images to local storage (new small helper alongside `receiptStorage.ts` that accepts raw bytes rather than a source URI, since images arrive from the unzip rather than the OS picker), building an old-`receiptFile` → new-local-URI map.
4. Call existing `resetAllData()` (from `db.ts`), then insert every entity directly via the existing per-entity repo insert functions (`categoriesRepo`, `accountsRepo`, `txnRepo`, `commitmentsRepo`, `splitRepo`, `budgetRepo`, `reliefRepo`, `memoryRepo`, `currencyRepo`), resolving each transaction/tag's `receiptFile` through the URI map from step 3 before insert. No new repo-level functions — this is orchestration over what already exists.
5. Call `refreshAll()` (from `useAppData()`) to reload in-memory app state.

Errors before step 4 (bad zip, unparseable JSON) abort with no data loss. Errors during step 4 (partway through inserts) are a known risk of this design — accepted for this build since it mirrors the risk profile of `resetAllData` itself, and a full snapshot-then-swap approach is a larger change than this feature's scope justifies.

## 5. Settings UI

New Settings → Data row **"Back Up & Restore"** → `BackupScreen.tsx`:

- **Local backup card**: "Back up now" button, last-local-backup timestamp, "Restore from file" (document picker).
- **Cloud backup card** (platform-gated):
  - Android: Connect/Disconnect Google account button, "Last backed up: `<relative time>`", "Back up now", "Restore latest backup" (destructive-confirm).
  - iOS: static disabled "iCloud backup — coming soon" row.

## 6. Error handling summary

| Action | On failure |
|---|---|
| Local backup | `notify()` alert, same as `ExportScreen` |
| Auto cloud backup (background) | Logged only, silent |
| Manual "Back up now" (cloud) | `notify()` alert (network/auth/quota) |
| Restore (local or cloud) | Validate before any destructive write; `notify()` alert on parse/network failure; confirm dialog before wipe |
| Drive auth expired | Manual actions re-prompt sign-in; auto-backup silently skips and retries next foreground |

## 7. Testing

- Unit tests (`__tests__/`, following existing convention) for: `generateFullBackupZip()` payload shape, `backupRestore.ts` parsing/validation, URI-remapping logic.
- Browser-preview verification (web platform) for the Settings UI and local backup/download round trip.
- On-device manual verification for the Google OAuth flow and Drive upload/restore round trip — not exercisable in the web preview or Linux dev environment.

## 8. Implementation phasing

Given the size, implementation should land in reviewable phases rather than one change:

1. **Local backup**: `generateFullBackupZip()`, `BackupScreen.tsx` local-only, Settings wiring.
2. **Google Drive backup**: OAuth, upload, `useCloudBackup()`, auto-trigger, Settings cloud card (backup only, no restore yet).
3. **Restore**: `backupRestore.ts`, restore-from-file and restore-from-Drive UI, destructive-confirm flow.
4. **iOS stub + polish**: iCloud "coming soon" row, error-state polish, tests.
