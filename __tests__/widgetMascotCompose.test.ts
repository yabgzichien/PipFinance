import { DEFAULT_WIDGET_MASCOT_CONFIG } from '../src/widget/mascot/config';
import { composeMascot } from '../src/widget/mascot/compose';

const cfg = (over: Partial<typeof DEFAULT_WIDGET_MASCOT_CONFIG> = {}) => ({
  ...DEFAULT_WIDGET_MASCOT_CONFIG,
  ...over,
});

describe('composeMascot', () => {
  it('produces a single well-formed svg element', () => {
    const svg = composeMascot(cfg(), 0);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });

  it('always draws the coin body', () => {
    expect(composeMascot(cfg(), 0)).toContain('data-part="body"');
  });

  it('includes a selected head part and omits it when set to none', () => {
    expect(composeMascot(cfg({ head: 'strawHat' }), 0)).toContain('data-part="strawHat"');
    expect(composeMascot(cfg({ head: 'none' }), 0)).not.toContain('data-part="strawHat"');
  });

  it('falls back to the slot default when the part id is unknown', () => {
    const svg = composeMascot(cfg({ head: 'nonexistentPart' }), 0);
    expect(svg).not.toContain('nonexistentPart');
    expect(svg).toContain('data-part="body"');
  });

  it('orders fragments by z ascending, so behind-body precedes body', () => {
    const svg = composeMascot(cfg({ holding: 'crossedKatana' }), 0);
    expect(svg.indexOf('data-part="crossedKatana"')).toBeLessThan(svg.indexOf('data-part="body"'));
  });

  it('renders the streak number', () => {
    expect(composeMascot(cfg(), 7)).toContain('>7<');
    expect(composeMascot(cfg(), 128)).toContain('>128<');
  });

  it('omits the badge entirely when badgeIcon is none', () => {
    expect(composeMascot(cfg({ badgeIcon: 'none' }), 7)).not.toContain('data-part="badge"');
  });
});
