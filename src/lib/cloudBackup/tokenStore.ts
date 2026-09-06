// src/lib/cloudBackup/tokenStore.ts
// Persists the Google Drive OAuth refresh token + account email. Kept in expo-secure-store
// (OS keychain/keystore) rather than app_meta/SQLite, since a refresh token is a durable
// credential, not app preference data.
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'cloud_backup_google_refresh_token';
const ACCOUNT_EMAIL_KEY = 'cloud_backup_google_account_email';

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setStoredRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function getStoredAccountEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCOUNT_EMAIL_KEY);
}

export async function setStoredAccountEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNT_EMAIL_KEY, email);
}

/** Clears the stored credential ("Disconnect" in Settings). Does not revoke the token with
 *  Google — the user can do that from their Google Account's third-party access settings. */
export async function clearStoredCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(ACCOUNT_EMAIL_KEY);
}
