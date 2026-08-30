// tools/limitDashboard/report.ts
// Visual CLI Dashboard & Progress Bar Report for Shared LLM API Keys
//
// Coverage & Polling:
//   - OpenRouter: GET /api/v1/key -> exact spend, credit limit, and rate limits.
//   - Groq: minimal ping to read x-ratelimit-* response headers -> live RPM/TPM headroom gauge.
//   - Gemini: live connectivity ping + free-tier quota reference & AI Studio usage console link.
//   - Failover Keys: Inspects every backup key to detect silent primary exhaustion.
//
// Usage:
//   npx tsx tools/limitDashboard/report.ts            # One-shot visual CLI dashboard
//   npx tsx tools/limitDashboard/report.ts --watch    # Live refresh mode (updates every 5s)
//   npx tsx tools/limitDashboard/report.ts --web      # Export and open interactive HTML GUI
//   npx tsx tools/limitDashboard/report.ts --json     # Machine-readable JSON output

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import {
  fetchAllMetrics,
  type DashboardMetrics,
  type OpenRouterKeyMetric,
  type GroqKeyMetric,
  type GeminiKeyMetric,
} from './metrics';
import {
  colors,
  renderProgressBar,
  renderBadge,
  renderCard,
  formatUSD,
  formatNum,
  generateHtmlDashboard,
} from './ui';

const HTML_OUTPUT_PATH = path.join(__dirname, 'dashboard.html');

function renderHeader(): string {
  const line1 = colors.bold('  PIPCOMP SHARED-KEY FREE TIER DASHBOARD');
  const line2 = colors.dim('  Real-time quota headroom, spend progress & failover health');
  const line3 = colors.gray('  Architecture: 1. Gemini (Primary) → 2. Groq (Fast Fallback) → 3. OpenRouter');
  return renderCard('System Monitor', [line1, line2, '', line3], 76);
}

function renderOpenRouterSection(keys: OpenRouterKeyMetric[]): string {
  const lines: string[] = [];

  if (keys.length === 0) {
    lines.push(colors.yellow('  (No OpenRouter keys configured in .env.local)'));
    return renderCard('1. OpenRouter (Spend & Credit Limits)', lines, 76);
  }

  keys.forEach((k, idx) => {
    const roleLabel = idx === 0 ? colors.cyan('[Primary]') : colors.magenta(`[Failover #${idx}]`);
    const tierBadge = k.is_free_tier ? renderBadge('FREE TIER', 'info') : renderBadge('PAID TIER', 'neutral');
    let statusBadge = renderBadge('HEALTHY', 'ok');
    if (k.status === 'warning') statusBadge = renderBadge('WARN', 'warn');
    else if (k.status === 'rate_limited') statusBadge = renderBadge('LIMITED', 'error');
    else if (k.status === 'error') statusBadge = renderBadge('ERROR', 'error');

    lines.push(`${roleLabel} ${colors.bold(k.maskedKey)}  ${tierBadge} ${statusBadge}`);

    if (k.errorMessage) {
      lines.push(colors.red(`    Error: ${k.errorMessage}`));
      return;
    }

    // Spend Progress Bar
    if (k.limit !== null && k.limit > 0) {
      const pct = (k.usage / k.limit) * 100;
      const bar = renderProgressBar(pct, { width: 22 });
      lines.push(`    Spend Limit:  ${bar} (${formatUSD(k.usage)} / ${formatUSD(k.limit)})`);
      lines.push(`    Remaining:    ${colors.bold(formatUSD(k.limit_remaining))}`);
    } else {
      lines.push(`    Total Spend:  ${colors.bold(formatUSD(k.usage))}  ${colors.dim('(No account credit cap set)')}`);
    }

    // Spend Breakdown
    lines.push(
      `    Breakdown:    Today: ${colors.cyan(formatUSD(k.usage_daily))}  │  Week: ${colors.cyan(
        formatUSD(k.usage_weekly)
      )}  │  Month: ${colors.cyan(formatUSD(k.usage_monthly))}`
    );

    if (k.rate_limit) {
      lines.push(
        `    Rate Limit:   ${colors.dim(`${k.rate_limit.requests} req / ${k.rate_limit.interval}`)}`
      );
    }
    if (idx < keys.length - 1) lines.push(colors.gray('    ' + '─'.repeat(68)));
  });

  return renderCard('🌐 OpenRouter (Usage & Credits)', lines, 76);
}

function renderGroqSection(keys: GroqKeyMetric[]): string {
  const lines: string[] = [];

  if (keys.length === 0) {
    lines.push(colors.yellow('  (No Groq keys configured in .env.local)'));
    return renderCard('2. Groq (Live Rate Limit Headroom)', lines, 76);
  }

  keys.forEach((g, idx) => {
    const roleLabel = idx === 0 ? colors.cyan('[Primary]') : colors.magenta(`[Failover #${idx}]`);
    let statusBadge = renderBadge('READY', 'ok');
    if (g.status === 'warning') statusBadge = renderBadge('WARN', 'warn');
    else if (g.status === 'rate_limited') statusBadge = renderBadge('429 LIMITED', 'error');
    else if (g.status === 'error') statusBadge = renderBadge('OFFLINE', 'error');

    lines.push(`${roleLabel} ${colors.bold(g.maskedKey)}  ${statusBadge}  ${colors.dim(`[Model: ${g.model}]`)}`);

    if (g.errorMessage && g.status === 'error') {
      lines.push(colors.red(`    Error: ${g.errorMessage}`));
      return;
    }

    // RPM Progress Bar
    const rpmBar = renderProgressBar(g.rpmPercentUsed, { width: 22 });
    lines.push(
      `    RPM (Req/Min): ${rpmBar} (${g.rpmUsed} / ${g.rpmLimit} used · ${colors.bold(
        String(g.rpmRemaining)
      )} left)`
    );

    // TPM Progress Bar
    const tpmBar = renderProgressBar(g.tpmPercentUsed, { width: 22 });
    lines.push(
      `    TPM (Tokens):  ${tpmBar} (${formatNum(g.tpmUsed)} / ${formatNum(g.tpmLimit)} used · ${colors.bold(
        formatNum(g.tpmRemaining)
      )} left)`
    );

    if (g.resetTime) {
      lines.push(`    Cooldown:      Reset in ${colors.yellow(g.resetTime)}`);
    }

    if (idx < keys.length - 1) lines.push(colors.gray('    ' + '─'.repeat(68)));
  });

  return renderCard('⚡ Groq (Live RPM / TPM Headroom)', lines, 76);
}

function renderGeminiSection(keys: GeminiKeyMetric[]): string {
  const lines: string[] = [];

  if (keys.length === 0) {
    lines.push(colors.yellow('  (No Gemini keys configured in .env.local)'));
    return renderCard('3. Google Gemini (Primary OCR & Docs)', lines, 76);
  }

  keys.forEach((gm, idx) => {
    const roleLabel = idx === 0 ? colors.cyan('[Primary]') : colors.magenta(`[Failover #${idx}]`);
    let statusBadge = renderBadge('ACTIVE', 'ok');
    if (gm.status === 'rate_limited') statusBadge = renderBadge('429 LIMITED', 'error');
    else if (gm.status === 'error') statusBadge = renderBadge('INVALID / OFFLINE', 'error');

    lines.push(`${roleLabel} ${colors.bold(gm.maskedKey)}  ${statusBadge}  ${colors.dim(`[Model: ${gm.model}]`)}`);

    if (gm.errorMessage && gm.status === 'error') {
      lines.push(colors.red(`    Error: ${gm.errorMessage}`));
    } else {
      lines.push(`    Free Quota:    ${colors.green('15 RPM')}  │  ${colors.green('1,500 RPD (Per Day)')}  │  ${colors.green('1,000,000 TPM')}`);
    }
    lines.push(`    Console:       ${colors.cyan(gm.consoleUrl)}`);

    if (idx < keys.length - 1) lines.push(colors.gray('    ' + '─'.repeat(68)));
  });

  return renderCard('✨ Google Gemini (Primary OCR & Docs)', lines, 76);
}

function renderFailoverSummary(metrics: DashboardMetrics): string {
  const lines: string[] = [];
  const allKeysCount = metrics.openrouter.length + metrics.groq.length + metrics.gemini.length;
  const anyRateLimited = [
    ...metrics.openrouter,
    ...metrics.groq,
    ...metrics.gemini,
  ].some((k) => k.status === 'rate_limited');

  if (anyRateLimited) {
    lines.push(
      colors.yellow('  ⚠ Caution: One or more shared keys reached their rate limit. Fallback is active.')
    );
  } else {
    lines.push(
      colors.green('  ✔ All configured keys are operational. Automatic failover pool is ready.')
    );
  }

  lines.push(
    `  Total Keys Configured: ${colors.bold(String(allKeysCount))} (Gemini: ${metrics.gemini.length}, Groq: ${
      metrics.groq.length
    }, OpenRouter: ${metrics.openrouter.length})`
  );
  lines.push(`  Report Timestamp:      ${colors.dim(new Date(metrics.timestamp).toLocaleString())}`);

  return renderCard('Status & Failover Health', lines, 76);
}

export function printCliDashboard(metrics: DashboardMetrics): void {
  console.log('\n' + renderHeader());
  console.log('\n' + renderGeminiSection(metrics.gemini));
  console.log('\n' + renderGroqSection(metrics.groq));
  console.log('\n' + renderOpenRouterSection(metrics.openrouter));
  console.log('\n' + renderFailoverSummary(metrics) + '\n');
}

export function openUrl(filePath: string): void {
  const start =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';
  exec(`${start} "${filePath}"`, () => {});
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isWatch = args.includes('--watch') || args.includes('-w');
  const isWeb = args.includes('--web') || args.includes('--gui');
  const isJson = args.includes('--json');

  if (isJson) {
    const metrics = await fetchAllMetrics();
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  if (isWeb) {
    console.log(colors.cyan('Generating interactive HTML Limit Dashboard...'));
    const metrics = await fetchAllMetrics();
    const html = generateHtmlDashboard(metrics);
    fs.writeFileSync(HTML_OUTPUT_PATH, html, 'utf8');
    console.log(colors.green(`✔ Dashboard exported to: ${HTML_OUTPUT_PATH}`));
    console.log(colors.dim('Opening in browser...'));
    openUrl(HTML_OUTPUT_PATH);
    return;
  }

  if (isWatch) {
    const delayArgIndex = args.indexOf('--delay');
    const delayMs = delayArgIndex !== -1 && args[delayArgIndex + 1] ? Number(args[delayArgIndex + 1]) : 5000;

    const refresh = async () => {
      // Clear terminal screen
      process.stdout.write('\x1b[2J\x1b[0;0H');
      console.log(colors.cyan(`[LIVE WATCH MODE - Refreshing every ${delayMs / 1000}s. Press Ctrl+C to exit]`));
      const metrics = await fetchAllMetrics();
      printCliDashboard(metrics);
    };

    await refresh();
    setInterval(refresh, delayMs);
    return;
  }

  // Default one-shot CLI view
  const metrics = await fetchAllMetrics();
  printCliDashboard(metrics);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(colors.red(`Fatal error in Limit Dashboard: ${err.message}`));
    process.exit(1);
  });
}
