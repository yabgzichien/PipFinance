# Deploying Pip to Vercel

This repository is configured for one-click deployment as a web prototype on [Vercel](https://vercel.com).

## Overview

- **Build Command**: `npm run build:web` (`npx expo export -p web`)
- **Output Directory**: `dist`
- **Framework Preset**: Other
- **Headers & Security**: Pre-configured in [`vercel.json`](../vercel.json) with `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` for SQLite WebAssembly (`wa-sqlite`) support.

---

## Option 1: Deploy via Vercel Dashboard (Recommended)

1. Push your changes to your Git repository (GitHub / GitLab / Bitbucket).
2. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** > **"Project"**.
3. Import the `PipFinance` repository.
4. Under **Build & Development Settings**:
   - **Framework Preset**: `Other`
   - **Build Command**: `npm run build:web` (or leave default if reading `vercel.json`)
   - **Output Directory**: `dist`
5. Click **Deploy**.

---

## Option 2: Deploy via Vercel CLI

1. Install the Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Log in to Vercel:
   ```bash
   vercel login
   ```

3. Deploy preview:
   ```bash
   vercel
   ```

4. Deploy to production:
   ```bash
   vercel --prod
   ```

---

## Local Web Preview

To test the web build locally before deploying:

```bash
# 1. Export the static web bundle
npm run build:web

# 2. Serve the generated dist folder
npx serve dist
```
