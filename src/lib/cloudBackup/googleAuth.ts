// src/lib/cloudBackup/googleAuth.ts
// Google OAuth constants + refresh-token exchange for cloud backup. The interactive part of
// the flow (the consent screen + authorization-code exchange) has to run as a React hook —
// expo-auth-session's useAuthRequest — so it lives in useCloudBackup.ts; this file only holds
// the pieces that don't need to be a hook.
//
// SETUP REQUIRED (one-time, external to this repo): create an OAuth client ID in Google Cloud
// Console (APIs & Services > Credentials > Create Credentials > OAuth client ID > Android),
// using this app's package name `com.yabg.pip` and your release/debug signing
// SHA-1 fingerprint(s). On that client's page, open Advanced Settings and turn on "Enable Custom
// URI scheme" — Google blocks custom-scheme redirects for Android clients by default, and this
// flow needs one. Then put the resulting client id in `.env.local` as
// EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID. Cloud backup stays disabled (and says so in Settings)
// until this is set.
export const GOOGLE_DRIVE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? '';
export const isGoogleDriveConfigured = GOOGLE_DRIVE_CLIENT_ID.length > 0;

/** Redirect Google sends the authorization code back to. Android OAuth clients only accept a
 *  custom scheme equal to the app's package name — the app's own `pip://` scheme is rejected
 *  with redirect_uri_mismatch — so this must match the Play Store package, which is the
 *  `applicationId` in android/app/build.gradle, mirrored by `expo.android.package` (app.json).
 *  The matching entry in `expo.scheme` is what registers the intent filter that routes it back. */
export const GOOGLE_DRIVE_REDIRECT_URI = 'com.yabg.pip:/oauth2redirect';

/** Narrow, hidden-folder-only scope — no access to the user's visible Drive files. */
export const GOOGLE_DRIVE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.appdata',
];

export interface RefreshedToken {
  accessToken: string;
  /** Epoch ms this access token stops being valid. */
  expiresAt: number;
}

/** Exchanges a stored refresh token for a fresh access token. Google's installed-app OAuth
 *  clients are public (no client secret), so this is a plain unauthenticated POST. */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshedToken> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_DRIVE_CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google token refresh failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
}
