import { normalizeFileUri } from '../src/lib/documentScanner';

describe('normalizeFileUri', () => {
  it('adds the file:// scheme to a bare filesystem path', () => {
    expect(normalizeFileUri('/data/user/0/com.yabg.pipexpensestracker/cache/scan.jpg')).toBe(
      'file:///data/user/0/com.yabg.pipexpensestracker/cache/scan.jpg'
    );
  });

  it('leaves an already-schemed file:// URI untouched', () => {
    expect(normalizeFileUri('file:///var/mobile/scan.jpg')).toBe('file:///var/mobile/scan.jpg');
  });

  it('leaves an http(s) URI untouched', () => {
    expect(normalizeFileUri('https://example.com/scan.jpg')).toBe('https://example.com/scan.jpg');
  });
});
