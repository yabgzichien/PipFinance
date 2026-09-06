// src/state/useCloudBackupSync.ts
// Silent, foreground-triggered Google Drive auto-backup (Android only — see
// docs/superpowers/specs/2026-09-02-backup-restore-design.md, "auto-backup trigger"). Mounted
// once at the App root, same pattern as useReminderSync. Never surfaces errors to the user:
// this runs unattended, so a failure just means the next foreground check tries again.
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { buildBackupZip, type BackupSourceData } from '../lib/backupBundle';
import { getLastCloudBackupAt, isCloudBackupConnected, silentBackupIfConnected } from '../lib/cloudBackup/useCloudBackup';
import { useAppData } from './store';

const AUTO_BACKUP_STALE_MS = 6 * 60 * 60 * 1000; // 6h, per spec: not user-configurable in this build.

export function useCloudBackupSync(): void {
  const data = useAppData();
  // A ref rather than an effect dependency: `data` is a new object every render, and this
  // background check should only run on mount/foreground, not on every state change.
  const dataRef = useRef<BackupSourceData>(data);
  dataRef.current = data;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let running = false;

    const run = async () => {
      if (running) return;
      running = true;
      try {
        const connected = await isCloudBackupConnected();
        if (!connected) return;
        const lastAt = await getLastCloudBackupAt();
        const stale = !lastAt || Date.now() - new Date(lastAt).getTime() > AUTO_BACKUP_STALE_MS;
        if (!stale) return;
        const zip = await buildBackupZip(dataRef.current);
        await silentBackupIfConnected(zip);
      } catch (e) {
        console.warn('[cloudBackup] auto-backup skipped:', e);
      } finally {
        running = false;
      }
    };

    void run();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void run();
    });
    return () => sub.remove();
  }, []);
}
