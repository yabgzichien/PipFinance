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

  it('preserves the pre-customization default smile and four-layer flame artwork', () => {
    const svg = composeMascot(cfg(), 7);
    expect(svg).toContain(
      'd="M43 64 Q50 72 57 64" fill="none" stroke="#7A4800" stroke-width="3.4"'
    );
    expect(svg).toContain('d="M34.5 42C38 47.5 41.5 51.5');
    expect(svg).toContain('d="M38.6 1C41.7 6.2 43.2 11.2');
    expect(svg).toContain('d="M42.5 61C46 67 49 72.5');
  });

  it('emits the badge outside the scaled group, in outer 76x64 coordinates', () => {
    const svg = composeMascot(cfg(), 7);
    const openTag = '<g transform="translate(5, 5) scale(0.54)">';
    const openIndex = svg.indexOf(openTag);
    expect(openIndex).toBeGreaterThan(-1);

    // Walk forward from the scaled group's opening tag, tracking <g>/</g> nesting depth, to find
    // the index of THAT group's own closing tag. A naive `svg.indexOf('</g>')` would instead
    // match one of the nested <g> elements inside individual parts (e.g. the eyes part and the
    // crossedKatana holding part both nest <g> internally), giving a false pass even if the badge
    // were wrongly moved inside the scaled group.
    const tagPattern = /<\/g>|<g\b/g;
    tagPattern.lastIndex = openIndex + openTag.length;
    let depth = 1;
    let closeIndex = -1;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(svg))) {
      if (match[0] === '</g>') {
        depth -= 1;
        if (depth === 0) {
          closeIndex = match.index;
          break;
        }
      } else {
        depth += 1;
      }
    }
    expect(closeIndex).toBeGreaterThan(-1);

    // A part drawn in mascot-space (the always-present coin body) must be inside the scaled
    // group; the badge, drawn in outer 76x64 space, must appear only after it closes.
    expect(svg.indexOf('data-part="body"')).toBeLessThan(closeIndex);
    expect(svg.indexOf('data-part="badge"')).toBeGreaterThan(closeIndex);
  });
});
