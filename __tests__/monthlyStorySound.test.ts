/** Guards the generated opening sting as a decoder-safe, headroom-safe shipped asset. */
import { readFileSync } from 'fs';
import { join } from 'path';

const WAV = join(__dirname, '..', 'assets', 'sounds', 'monthly-story.wav');
const HEADER_BYTES = 44;
const FULL_SCALE = 32767;
const wav = readFileSync(WAV);

function samples(): number[] {
  const out: number[] = [];
  for (let i = HEADER_BYTES; i + 1 < wav.length; i += 2) out.push(wav.readInt16LE(i) / FULL_SCALE);
  return out;
}

describe('monthly-story.wav', () => {
  it('is mono 16-bit PCM at 44.1kHz in a RIFF/WAVE container', () => {
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(44100);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(wav.length - HEADER_BYTES);
  });

  it('lasts between 11.9 and 12.1 seconds for loopable playback', () => {
    const seconds = (wav.length - HEADER_BYTES) / 2 / 44100;
    expect(seconds).toBeGreaterThanOrEqual(11.9);
    expect(seconds).toBeLessThanOrEqual(12.1);
  });

  it('contains audible audio with no more than 70% peak amplitude', () => {
    const decoded = samples();
    const peak = decoded.reduce((largest, sample) => Math.max(largest, Math.abs(sample)), 0);
    const audible = decoded.filter((sample) => Math.abs(sample) > 0.01);

    expect(audible.length).toBeGreaterThan(1000);
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(0.7);
  });
});
