# Privacy Policy for Pip Finance

Last updated: September 13, 2026

Pip Finance ("we", "us", or "our") is designed from the ground up to respect your personal privacy. We believe that your personal financial records belong to you and should remain on your own device. This Privacy Policy explains how Pip Finance handles your information.

---

### 1. No Account Required & Local-First Storage

- **On-Device Storage:** Pip Finance does not require you to create an account, log in, or provide your name, email address, phone number, or banking passwords.
- **Local SQLite Database:** All transactions, receipts, category customizations, account balances, budgets, debt tracking, and net worth history are stored locally in an encrypted/private SQLite database directly on your device.
- **Backups:** If you create a backup, it is exported directly as a zip file to your device's local file storage or your personal cloud storage (e.g., Google Drive) under your explicit control. We do not operate any server that receives or hosts your backup files.

---

### 2. AI Receipt & Statement Scanning

- **One-Time Vision Extraction:** When you choose to scan a receipt or statement screenshot, the image is transmitted securely over HTTPS via a secure proxy (Cloudflare Worker) to an AI vision processing service solely for optical text recognition and structured transaction parsing.
- **No Image or Financial Data Retention:** The uploaded image is processed in transient memory to extract line items (merchant, date, amount, category) and returned immediately to your device. The image and the parsed transactions are never stored, logged, or retained on our backend servers.
- **Zero Model Training:** Transmitted scan images and extracted financial data are not used to train or improve external AI models.

---

### 3. Scan Quota & Anonymous Installation Identifier

- **Anonymous Identifier:** To enforce free-tier quota limits (20 AI scans per month, up to 3 per day) and grant unlimited scans for Pip Pro subscribers, the app generates a random, anonymous installation token stored in your device's secure storage.
- **Stored Quota Metadata:** Our Cloudflare Worker and D1 database store only:
  1. The anonymous installation token
  2. The current monthly scan count and daily scan count
  3. The subscription tier (Free or Pro)
- **No Link to Identity:** This quota record contains zero personal information, zero financial data, and cannot be linked to your real identity.

---

### 4. Subscriptions & In-App Purchases

- **Google Play In-App Billing:** Subscription payments (Pip Pro) are handled directly and securely by Google Play. We never see, process, or store your credit card numbers or financial account payment credentials.
- **RevenueCat:** We use RevenueCat to validate Google Play receipts and determine entitlement status. RevenueCat receives an anonymous application user identifier to verify subscription validity and manage renewal/cancellation states.

---

### 5. Crash Diagnostics (Optional)

- **Opt-In Diagnostics:** You can enable or disable crash reporting in Settings at any time.
- **Technical Information Only:** When a crash occurs and diagnostics are enabled, an anonymous technical stack trace (code line and device OS version) is submitted to identify and fix the bug. Crash reports never include your transactions, amounts, merchants, accounts, or receipts.

---

### 6. Third-Party Services

Pip Finance uses minimal, reputable infrastructure partners:
- **Google Play Services:** For billing, licensing, and app integrity verification.
- **Cloudflare (Worker & D1):** For secure vision proxying and anonymous quota tracking.
- **RevenueCat:** For subscription receipt validation and Customer Center management.
- **Sentry:** For anonymous crash error diagnostics (when enabled).

---

### 7. Data Deletion & Your Rights

Because your data is stored locally on your device:
- **Instant Data Wipe:** You can wipe all local financial transactions, accounts, categories, and settings at any time by going to **Settings > Danger Zone > Reset all data**.
- **Uninstalling:** Uninstalling the Pip Finance app permanently removes all local databases and cached receipt files from your device.
- **Anonymous Quota Deletion:** If you wish to reset your anonymous scan token, clearing app data via your Android device settings resets the installation identifier.

---

### 8. Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be posted with an updated revision date.

---

### 9. Contact Us

If you have questions about this Privacy Policy or Pip Finance's privacy practices, please contact us at:
- **Email:** support@pipfinance.app
