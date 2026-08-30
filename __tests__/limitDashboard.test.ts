// __tests__/limitDashboard.test.ts
import {
  renderProgressBar,
  renderBadge,
  renderCard,
  stripAnsi,
  formatUSD,
  formatNum,
  generateHtmlDashboard,
  getUsageColor,
  colors,
} from '../tools/limitDashboard/ui';
import {
  maskKey,
  splitKeys,
  readEnvLocal,
} from '../tools/limitDashboard/metrics';

describe('Limit Dashboard UI Utilities', () => {
  describe('stripAnsi', () => {
    it('removes ANSI color codes', () => {
      const colored = '\x1b[32mHealthy\x1b[0m \x1b[31mCritical\x1b[0m';
      expect(stripAnsi(colored)).toBe('Healthy Critical');
    });
  });

  describe('renderProgressBar', () => {
    it('renders empty bar at 0%', () => {
      const bar = stripAnsi(renderProgressBar(0, { width: 10, showPercent: false }));
      expect(bar).toBe('[░░░░░░░░░░]');
    });

    it('renders half filled bar at 50%', () => {
      const bar = stripAnsi(renderProgressBar(50, { width: 10, showPercent: false }));
      expect(bar).toBe('[█████░░░░░]');
    });

    it('renders full bar at 100%', () => {
      const bar = stripAnsi(renderProgressBar(100, { width: 10, showPercent: false }));
      expect(bar).toBe('[██████████]');
    });

    it('clamps negative values to 0%', () => {
      const bar = stripAnsi(renderProgressBar(-20, { width: 10, showPercent: false }));
      expect(bar).toBe('[░░░░░░░░░░]');
    });

    it('clamps values > 100% to full bar width', () => {
      const bar = stripAnsi(renderProgressBar(150, { width: 10, showPercent: false }));
      expect(bar).toBe('[██████████]');
    });

    it('includes percentage text when showPercent is true', () => {
      const bar = stripAnsi(renderProgressBar(42.5, { width: 10, showPercent: true }));
      expect(bar).toContain('42.5%');
    });
  });

  describe('getUsageColor', () => {
    it('returns green for low usage (<60%)', () => {
      expect(getUsageColor(30)).toBe(colors.green);
    });

    it('returns yellow for moderate usage (60%-84%)', () => {
      expect(getUsageColor(70)).toBe(colors.yellow);
    });

    it('returns red for high usage (>=85%)', () => {
      expect(getUsageColor(90)).toBe(colors.red);
    });
  });

  describe('renderBadge', () => {
    it('renders badge for ok status', () => {
      const badge = stripAnsi(renderBadge('OK', 'ok'));
      expect(badge).toBe(' OK ');
    });

    it('renders neutral badge with brackets', () => {
      const badge = stripAnsi(renderBadge('PAID', 'neutral'));
      expect(badge).toBe('[PAID]');
    });
  });

  describe('renderCard', () => {
    it('renders top and bottom box borders with title', () => {
      const card = stripAnsi(renderCard('Test Box', ['Line 1', 'Line 2'], 40));
      expect(card).toContain('Test Box');
      expect(card).toContain('Line 1');
      expect(card).toContain('Line 2');
      expect(card).toContain('┌─');
      expect(card).toContain('└─');
    });
  });

  describe('formatters', () => {
    it('formats USD correctly', () => {
      expect(formatUSD(1.2345)).toBe('$1.2345');
      expect(formatUSD(0)).toBe('$0.0000');
      expect(formatUSD(null)).toBe('n/a');
    });

    it('formats numbers with commas', () => {
      expect(formatNum(1000000)).toBe('1,000,000');
      expect(formatNum(42)).toBe('42');
      expect(formatNum(undefined)).toBe('n/a');
    });
  });

  describe('generateHtmlDashboard', () => {
    it('generates HTML with provider sections', () => {
      const html = generateHtmlDashboard({
        openrouter: [
          {
            maskedKey: 'sk-or-***1234',
            usage: 0.25,
            limit: 1.0,
            is_free_tier: true,
            usage_daily: 0.05,
            usage_weekly: 0.15,
            usage_monthly: 0.25,
          },
        ],
        groq: [
          {
            maskedKey: 'gsk_***5678',
            model: 'qwen/qwen3.6-27b',
            rpmLimit: 30,
            rpmUsed: 5,
            rpmRemaining: 25,
            tpmLimit: 6000,
            tpmUsed: 1000,
            tpmRemaining: 5000,
          },
        ],
        gemini: [
          {
            maskedKey: 'AIza***9999',
            model: 'gemini-3.1-flash-lite',
            status: 'active',
          },
        ],
      });

      expect(html).toContain('PipComp Free Tier Quota Dashboard');
      expect(html).toContain('OpenRouter');
      expect(html).toContain('Groq');
      expect(html).toContain('Google Gemini');
      expect(html).toContain('sk-or-***1234');
      expect(html).toContain('gsk_***5678');
      expect(html).toContain('AIza***9999');
    });
  });
});

describe('Limit Dashboard Metrics Utilities', () => {
  describe('maskKey', () => {
    it('masks middle characters of long keys', () => {
      expect(maskKey('sk-or-v1-abcdef1234567890')).toBe('sk-or-...7890');
    });

    it('masks short keys with ***', () => {
      expect(maskKey('short')).toBe('***');
    });

    it('handles empty key', () => {
      expect(maskKey('')).toBe('(no key)');
    });
  });

  describe('splitKeys', () => {
    it('splits comma separated keys', () => {
      expect(splitKeys('key1, key2,key3')).toEqual(['key1', 'key2', 'key3']);
    });

    it('splits newline separated keys', () => {
      expect(splitKeys('key1\nkey2\n\nkey3')).toEqual(['key1', 'key2', 'key3']);
    });

    it('handles empty string', () => {
      expect(splitKeys('')).toEqual([]);
    });
  });
});
