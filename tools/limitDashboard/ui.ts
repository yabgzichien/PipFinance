// tools/limitDashboard/ui.ts
// Terminal formatting, visual progress bar rendering, and HTML GUI generator for Limit Dashboard.

export interface ProgressBarOptions {
  width?: number;
  showPercent?: boolean;
  colorOverride?: 'green' | 'yellow' | 'red' | 'cyan' | 'gray';
  fillChar?: string;
  emptyChar?: string;
}

const supportsColor = (): boolean => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NO_COLOR || process.env.NODE_DISABLE_COLORS) return false;
    if (process.env.FORCE_COLOR) return true;
  }
  return typeof process !== 'undefined' && process.stdout && Boolean(process.stdout.isTTY);
};

export const colors = {
  reset: (text: string) => (supportsColor() ? `\x1b[0m${text}\x1b[0m` : text),
  bold: (text: string) => (supportsColor() ? `\x1b[1m${text}\x1b[0m` : text),
  dim: (text: string) => (supportsColor() ? `\x1b[2m${text}\x1b[0m` : text),
  green: (text: string) => (supportsColor() ? `\x1b[32m${text}\x1b[0m` : text),
  yellow: (text: string) => (supportsColor() ? `\x1b[33m${text}\x1b[0m` : text),
  red: (text: string) => (supportsColor() ? `\x1b[31m${text}\x1b[0m` : text),
  cyan: (text: string) => (supportsColor() ? `\x1b[36m${text}\x1b[0m` : text),
  blue: (text: string) => (supportsColor() ? `\x1b[34m${text}\x1b[0m` : text),
  magenta: (text: string) => (supportsColor() ? `\x1b[35m${text}\x1b[0m` : text),
  gray: (text: string) => (supportsColor() ? `\x1b[90m${text}\x1b[0m` : text),
  bgGreen: (text: string) => (supportsColor() ? `\x1b[42m\x1b[30m${text}\x1b[0m` : text),
  bgYellow: (text: string) => (supportsColor() ? `\x1b[43m\x1b[30m${text}\x1b[0m` : text),
  bgRed: (text: string) => (supportsColor() ? `\x1b[41m\x1b[37m${text}\x1b[0m` : text),
  bgCyan: (text: string) => (supportsColor() ? `\x1b[46m\x1b[30m${text}\x1b[0m` : text),
};

/**
 * Get color function based on usage percentage:
 * - < 60%: green (healthy)
 * - 60% - 85%: yellow (moderate / warning)
 * - >= 85%: red (critical / rate-limited)
 */
export function getUsageColor(percent: number): (text: string) => string {
  if (percent >= 85) return colors.red;
  if (percent >= 60) return colors.yellow;
  return colors.green;
}

/**
 * Render a visual progress bar e.g. [████████░░░░░░░░] 50.0%
 */
export function renderProgressBar(
  percent: number,
  options: ProgressBarOptions = {}
): string {
  const width = options.width ?? 20;
  const showPercent = options.showPercent ?? true;
  const fillChar = options.fillChar ?? '█';
  const emptyChar = options.emptyChar ?? '░';

  // Clamp percentage between 0 and 100 for bar rendering
  const clampedPercent = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
  const filledCount = Math.round((clampedPercent / 100) * width);
  const emptyCount = width - filledCount;

  const filledBar = fillChar.repeat(filledCount);
  const emptyBar = emptyChar.repeat(emptyCount);

  let colorFn = getUsageColor(percent);
  if (options.colorOverride && colors[options.colorOverride]) {
    colorFn = colors[options.colorOverride];
  }

  const coloredBar = colorFn(filledBar) + colors.gray(emptyBar);
  const percentStr = isNaN(percent)
    ? ' n/a '
    : `${percent.toFixed(1).padStart(5, ' ')}%`;

  if (showPercent) {
    return `[${coloredBar}] ${colorFn(percentStr)}`;
  }
  return `[${coloredBar}]`;
}

/**
 * Format a badge e.g. [OK], [WARN], [ERROR], [FREE TIER]
 */
export function renderBadge(
  text: string,
  type: 'ok' | 'warn' | 'error' | 'info' | 'neutral' = 'info'
): string {
  switch (type) {
    case 'ok':
      return colors.bgGreen(` ${text} `);
    case 'warn':
      return colors.bgYellow(` ${text} `);
    case 'error':
      return colors.bgRed(` ${text} `);
    case 'info':
      return colors.bgCyan(` ${text} `);
    case 'neutral':
      return colors.gray(`[${text}]`);
  }
}

/**
 * Render a card box with border lines
 */
export function renderCard(title: string, lines: string[], minWidth = 72): string {
  const contentWidth = Math.max(
    minWidth,
    title.length + 6,
    ...lines.map((l) => stripAnsi(l).length + 4)
  );

  const topBorder = `┌─ ${colors.bold(title)} ${'─'.repeat(
    Math.max(0, contentWidth - title.length - 5)
  )}┐`;
  const bottomBorder = `└${'─'.repeat(contentWidth - 2)}┘`;

  const body = lines.map((line) => {
    const plainLen = stripAnsi(line).length;
    const padding = ' '.repeat(Math.max(0, contentWidth - plainLen - 4));
    return `│  ${line}${padding}│`;
  });

  return [colors.gray(topBorder), ...body, colors.gray(bottomBorder)].join('\n');
}

/** Strip ANSI codes for string width calculation */
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Format currency USD */
export function formatUSD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'n/a';
  return `$${amount.toFixed(4)}`;
}

/** Format numbers with commas */
export function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return 'n/a';
  return n.toLocaleString();
}

/**
 * Generate a standalone, responsive HTML page with animated progress bars & dark mode GUI
 */
export function generateHtmlDashboard(data: any): string {
  const now = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PipComp LLM Free Tier Quota Dashboard</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --heading: #f0f6fc;
      --green: #238636;
      --green-light: #2ea043;
      --yellow: #d29922;
      --red: #da3633;
      --cyan: #388bfd;
      --gray: #8b949e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    h1 { font-size: 24px; color: var(--heading); }
    .subtitle { font-size: 13px; color: var(--gray); margin-top: 4px; }
    .timestamp { font-size: 12px; color: var(--gray); text-align: right; }
    .btn-refresh {
      background: var(--cyan);
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 8px;
      transition: opacity 0.2s;
    }
    .btn-refresh:hover { opacity: 0.9; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    @media (min-width: 768px) {
      .grid { grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); }
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .card-title { font-size: 18px; font-weight: 600; color: var(--heading); display: flex; align-items: center; gap: 8px; }
    .badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
    }
    .badge-green { background: rgba(46, 160, 67, 0.2); color: #3fb950; border: 1px solid rgba(46, 160, 67, 0.4); }
    .badge-yellow { background: rgba(210, 153, 34, 0.2); color: #d29922; border: 1px solid rgba(210, 153, 34, 0.4); }
    .badge-red { background: rgba(218, 54, 51, 0.2); color: #f85149; border: 1px solid rgba(218, 54, 51, 0.4); }
    .badge-cyan { background: rgba(56, 139, 253, 0.2); color: #58a6ff; border: 1px solid rgba(56, 139, 253, 0.4); }

    .meter-group { margin-bottom: 16px; }
    .meter-label { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; font-weight: 500; }
    .progress-bar-bg {
      background: #21262d;
      border-radius: 6px;
      height: 14px;
      overflow: hidden;
      position: relative;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 6px;
      transition: width 0.4s ease;
    }
    .fill-green { background: var(--green-light); }
    .fill-yellow { background: var(--yellow); }
    .fill-red { background: var(--red); }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      background: #0d1117;
      padding: 12px;
      border-radius: 6px;
      margin-top: 14px;
      text-align: center;
    }
    .stat-val { font-size: 15px; font-weight: 600; color: var(--heading); }
    .stat-lbl { font-size: 11px; color: var(--gray); text-transform: uppercase; margin-top: 2px; }

    .key-info { font-family: monospace; font-size: 12px; color: var(--cyan); margin-bottom: 12px; }
    .failover-banner {
      background: rgba(56, 139, 253, 0.1);
      border: 1px solid rgba(56, 139, 253, 0.3);
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .ref-link { color: var(--cyan); text-decoration: none; font-size: 13px; }
    .ref-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>PipComp Free Tier Quota Dashboard</h1>
        <div class="subtitle">Real-time shared LLM API key limits & failover health monitor</div>
      </div>
      <div>
        <div class="timestamp">Last Updated: ${now}</div>
        <button class="btn-refresh" onclick="location.reload()">↻ Refresh</button>
      </div>
    </header>

    <div class="failover-banner">
      <div>
        <strong>Pipeline Architecture:</strong> 1. Gemini (Primary OCR & Docs) → 2. Groq (Fast Fallback) → 3. OpenRouter (Multi-Model Net)
      </div>
      <span class="badge badge-green">Healthy</span>
    </div>

    <div class="grid">
      <!-- OpenRouter Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🌐 OpenRouter</div>
          <span class="badge badge-cyan">Spend & Credit Quota</span>
        </div>
        ${
          data.openrouter && data.openrouter.length > 0
            ? data.openrouter
                .map((k: any) => {
                  const spendPct = k.limit && k.limit > 0 ? (k.usage / k.limit) * 100 : 0;
                  const colorClass = spendPct >= 85 ? 'fill-red' : spendPct >= 60 ? 'fill-yellow' : 'fill-green';
                  return `
            <div class="key-info">Key: ${k.maskedKey} (${k.is_free_tier ? 'Free Tier' : 'Paid Tier'})</div>
            <div class="meter-group">
              <div class="meter-label">
                <span>Spend vs Limit</span>
                <span>$${k.usage?.toFixed(4) || '0.0000'} / ${k.limit ? '$' + k.limit.toFixed(2) : 'Unlimited'} (${spendPct.toFixed(1)}%)</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill ${colorClass}" style="width: ${Math.min(100, spendPct)}%"></div>
              </div>
            </div>
            <div class="stats-row">
              <div>
                <div class="stat-val">$${k.usage_daily?.toFixed(4) || '0.0000'}</div>
                <div class="stat-lbl">Today</div>
              </div>
              <div>
                <div class="stat-val">$${k.usage_weekly?.toFixed(4) || '0.0000'}</div>
                <div class="stat-lbl">This Week</div>
              </div>
              <div>
                <div class="stat-val">$${k.usage_monthly?.toFixed(4) || '0.0000'}</div>
                <div class="stat-lbl">This Month</div>
              </div>
            </div>
          `;
                })
                .join('<hr style="border-color:var(--border); margin:16px 0;" />')
            : '<div class="key-info">No OpenRouter key configured.</div>'
        }
      </div>

      <!-- Groq Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚡ Groq</div>
          <span class="badge badge-green">Live RPM / TPM</span>
        </div>
        ${
          data.groq && data.groq.length > 0
            ? data.groq
                .map((g: any) => {
                  const rpmPct = g.rpmLimit > 0 ? (g.rpmUsed / g.rpmLimit) * 100 : 0;
                  const tpmPct = g.tpmLimit > 0 ? (g.tpmUsed / g.tpmLimit) * 100 : 0;
                  const rpmColor = rpmPct >= 85 ? 'fill-red' : rpmPct >= 60 ? 'fill-yellow' : 'fill-green';
                  const tpmColor = tpmPct >= 85 ? 'fill-red' : tpmPct >= 60 ? 'fill-yellow' : 'fill-green';
                  return `
            <div class="key-info">Key: ${g.maskedKey} (Model: ${g.model})</div>
            <div class="meter-group">
              <div class="meter-label">
                <span>Requests / Min (RPM)</span>
                <span>${g.rpmUsed} / ${g.rpmLimit} used (${rpmPct.toFixed(1)}%) &bull; ${g.rpmRemaining} left</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill ${rpmColor}" style="width: ${Math.min(100, rpmPct)}%"></div>
              </div>
            </div>
            <div class="meter-group">
              <div class="meter-label">
                <span>Tokens / Min (TPM)</span>
                <span>${g.tpmUsed?.toLocaleString() || 0} / ${g.tpmLimit?.toLocaleString() || 0} used (${tpmPct.toFixed(1)}%)</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill ${tpmColor}" style="width: ${Math.min(100, tpmPct)}%"></div>
              </div>
            </div>
            <div class="stats-row">
              <div>
                <div class="stat-val">${g.rpmRemaining ?? 'n/a'}</div>
                <div class="stat-lbl">RPM Left</div>
              </div>
              <div>
                <div class="stat-val">${g.tpmRemaining ? Math.round(g.tpmRemaining / 1000) + 'k' : 'n/a'}</div>
                <div class="stat-lbl">TPM Left</div>
              </div>
              <div>
                <div class="stat-val">${g.resetTime ?? 'instant'}</div>
                <div class="stat-lbl">Reset Window</div>
              </div>
            </div>
          `;
                })
                .join('<hr style="border-color:var(--border); margin:16px 0;" />')
            : '<div class="key-info">No Groq key configured.</div>'
        }
      </div>

      <!-- Gemini Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">✨ Google Gemini</div>
          <span class="badge badge-cyan">Primary Provider</span>
        </div>
        ${
          data.gemini && data.gemini.length > 0
            ? data.gemini
                .map((gm: any) => {
                  return `
            <div class="key-info">Key: ${gm.maskedKey} &bull; Status: <span style="color:#3fb950">● Active</span></div>
            <p style="font-size:13px; color:var(--text); margin-bottom:12px;">
              Gemini free tier provides generous daily & per-minute limits for <code>gemini-3.1-flash-lite</code> / <code>gemini-2.0-flash</code>.
            </p>
            <div class="stats-row" style="grid-template-columns: repeat(3, 1fr);">
              <div>
                <div class="stat-val">15</div>
                <div class="stat-lbl">RPM Cap</div>
              </div>
              <div>
                <div class="stat-val">1,500</div>
                <div class="stat-lbl">RPD (Per Day)</div>
              </div>
              <div>
                <div class="stat-val">1,000,000</div>
                <div class="stat-lbl">TPM Cap</div>
              </div>
            </div>
            <div style="margin-top:16px; text-align:center;">
              <a class="ref-link" href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer">
                Open Google AI Studio Usage Console ↗
              </a>
            </div>
          `;
                })
                .join('<hr style="border-color:var(--border); margin:16px 0;" />')
            : '<div class="key-info">No Gemini key configured.</div>'
        }
      </div>
    </div>
  </div>
</body>
</html>`;
}
