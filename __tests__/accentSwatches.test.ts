import { accentSwatchJustifyContent, accentSwatchSize } from '../src/lib/accentSwatches';

describe('accentSwatchSize', () => {
  it('keeps seven accent choices at their regular size when the row has room', () => {
    expect(accentSwatchSize(326, 7)).toBe(38);
  });

  it('shrinks seven choices to stay in one row before they would wrap', () => {
    expect(accentSwatchSize(280, 7)).toBe(34);
  });

  it('uses the compact 30px size at the narrowest supported row width', () => {
    expect(accentSwatchSize(252, 7)).toBe(30);
  });

  it('centers the row when its normal-size swatches leave spare space', () => {
    expect(accentSwatchJustifyContent(326, 7)).toBe('center');
  });

  it('does not add a leading inset when the compact row already fills the container', () => {
    expect(accentSwatchJustifyContent(252, 7)).toBe('flex-start');
  });
});
