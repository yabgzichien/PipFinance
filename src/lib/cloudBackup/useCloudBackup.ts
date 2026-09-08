// src/lib/cloudBackup/useCloudBackup.ts
// React hook wrapping the Google Drive OAuth flow (expo-auth-session) and the Drive REST calls
// in googleDriveApi.ts into the state a Settings screen (or the silent auto-backup trigger)
// needs. Android only — see googleAuth.ts for the one-time OAuth client setup this requires.
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { getMeta, setMeta } from '../../db/metaRepo';
import {
  GOOGLE_DRIVE_CLIENT_ID,
  GOOGLE_DRIVE_REDIRECT_URI,
  GOOGLE_DRIVE_SCOPES,
  isGoogleDriveConfigured,
  refreshAccessToken,
} from './googleAuth';
import { downloadBackup, fetchAccountEmail, uploadBackup } from './googleDriveApi';
import {
  clearStoredCredential,
  getStoredAccountEmail,
  getStoredRefreshToken,
  setStoredAccountEmail,
  setStoredRefreshToken,
} from './tokenStore';

WebBrowser.maybeCompleteAuthSession();

const LAST_BACKUP_AT_KEY = 'cloud_backup_google_last_at';

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export type CloudBackupStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'backing-up'
  | 'restoring'
  | 'error';

export interface CloudBackupState {
  isConfigured: boolean;
  status: CloudBackupStatus;
  accountEmail: string | null;
  lastBackupAt: string | null;
  error: string | null;
  connect: () => void;
  disconnect: () => Promise<void>;
  backupNow: (zipBytes: Uint8Array) => Promise<void>;
  restoreLatest: () => Promise<Uint8Array | null>;
}

/** Exchanges the stored refresh token for a fresh access token. Refreshed on every call rather
 *  than cached — backups happen at most a few times a day, so the extra round trip is cheap
 *  next to the complexity of tracking access-token expiry. */
async function getFreshAccessToken(): Promise<string> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) throw new Error('Google Drive is not connected.');
  const { accessToken } = await refreshAccessToken(refreshToken);
  return accessToken;
}

export function useCloudBackup(): CloudBackupState {
  const [status, setStatus] = useState<CloudBackupStatus>('disconnected');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `native` wins over `scheme` in a built app, which is what we want: Google requires the
  // package-name scheme here, not the app's `pip://` one. See GOOGLE_DRIVE_REDIRECT_URI.
  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'pip', native: GOOGLE_DRIVE_REDIRECT_URI }),
    []
  );

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_DRIVE_CLIENT_ID,
      scopes: GOOGLE_DRIVE_SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: { access_type: 'offline', prompt: 'consent' },
    },
    DISCOVERY
  );

  // Restore "already connected" status on mount from the stored refresh token, without
  // forcing a re-consent every time Settings opens.
  useEffect(() => {
    (async () => {
      const [refreshToken, email, lastAt] = await Promise.all([
        getStoredRefreshToken(),
        getStoredAccountEmail(),
        getMeta(LAST_BACKUP_AT_KEY),
      ]);
      setAccountEmail(email);
      setLastBackupAt(lastAt);
      if (refreshToken) setStatus('connected');
    })();
  }, []);

  // Completes the flow once the consent screen redirects back with an authorization code.
  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') {
      if (response.type === 'error') setError(response.error?.message ?? 'Google sign-in failed.');
      setStatus((s) => (s === 'connecting' ? 'disconnected' : s));
      return;
    }
    (async () => {
      try {
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: GOOGLE_DRIVE_CLIENT_ID,
            code: response.params.code,
            redirectUri,
            extraParams: { code_verifier: request?.codeVerifier ?? '' },
          },
          DISCOVERY
        );
        if (!tokenResult.refreshToken) {
          throw new Error("Google didn't return a refresh token. Try disconnecting and connecting again.");
        }
        await setStoredRefreshToken(tokenResult.refreshToken);
        const email = await fetchAccountEmail(tokenResult.accessToken);
        if (email) {
          await setStoredAccountEmail(email);
          setAccountEmail(email);
        }
        setStatus('connected');
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? 'Could not finish connecting to Google Drive.');
        setStatus('error');
      }
    })();
  }, [response, request, redirectUri]);

  const connect = useCallback(() => {
    if (!isGoogleDriveConfigured) {
      setError('Google Drive backup is not configured yet.');
      return;
    }
    setError(null);
    setStatus('connecting');
    void promptAsync();
  }, [promptAsync]);

  const disconnect = useCallback(async () => {
    await clearStoredCredential();
    setAccountEmail(null);
    setStatus('disconnected');
  }, []);

  const backupNow = useCallback(async (zipBytes: Uint8Array) => {
    setStatus('backing-up');
    setError(null);
    try {
      const accessToken = await getFreshAccessToken();
      await uploadBackup(accessToken, zipBytes);
      const at = new Date().toISOString();
      await setMeta(LAST_BACKUP_AT_KEY, at);
      setLastBackupAt(at);
      setStatus('connected');
    } catch (e: any) {
      setError(e?.message ?? 'Backup to Google Drive failed.');
      setStatus('error');
      throw e;
    }
  }, []);

  const restoreLatest = useCallback(async (): Promise<Uint8Array | null> => {
    setStatus('restoring');
    setError(null);
    try {
      const accessToken = await getFreshAccessToken();
      const bytes = await downloadBackup(accessToken);
      setStatus('connected');
      return bytes;
    } catch (e: any) {
      setError(e?.message ?? 'Restoring from Google Drive failed.');
      setStatus('error');
      throw e;
    }
  }, []);

  return {
    isConfigured: isGoogleDriveConfigured,
    status,
    accountEmail,
    lastBackupAt,
    error,
    connect,
    disconnect,
    backupNow,
    restoreLatest,
  };
}

/** Silent, non-interactive counterpart to backupNow/getFreshAccessToken for the foreground
 *  auto-backup trigger (useCloudBackupSync.ts), which has no UI to drive a hook's lifecycle
 *  from. Throws are caught by the caller and logged, never surfaced to the user. */
export async function silentBackupIfConnected(zipBytes: Uint8Array): Promise<boolean> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return false;
  const { accessToken } = await refreshAccessToken(refreshToken);
  await uploadBackup(accessToken, zipBytes);
  await setMeta(LAST_BACKUP_AT_KEY, new Date().toISOString());
  return true;
}

export async function getLastCloudBackupAt(): Promise<string | null> {
  return getMeta(LAST_BACKUP_AT_KEY);
}

export async function isCloudBackupConnected(): Promise<boolean> {
  return (await getStoredRefreshToken()) !== null;
}
