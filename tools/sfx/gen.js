// @ts-check
/**
 * tools/sfx/gen.js
 * Generates the save-confirmation chime at assets/sounds/saved.wav, played by
 * src/lib/sound.ts when a save lands on the Saved screen.
 *
 * Synthesized rather than sourced so the asset is original (no sample-pack licensing to
 * clear for a Play Store build) and so the character stays tunable: every voice is a data
 * literal in VOICES below, and regenerating is one command.
 *
 * Run:  node tools/sfx/gen.js                    → writes the shipped asset
 *       node tools/sfx/gen.js --all --out <dir>  → renders every voice for auditioning
 *       node tools/sfx/gen.js --voice marimba    → renders one voice to the shipped path
 *
 * ── What makes a save sound pleasant rather than sharp ────────────────────────
 * The first attempt (`horn` below, kept as the counter-example) read as a car honk. Three
 * things caused it, and every voice here is shaped against them:
 *
 *   1. Two sustained tones a fifth apart, overlapping. That interval held steady is close
 *      to how a car horn is actually built. Fix: let each note DECAY before the next one
 *      lands, so the ear hears a melody rather than a chord.
 *   2. A near-instant attack on a pure tone. The step edge itself is the "sharp". Fix:
 *      attacks of 4-15ms, and slower still for the soft voices.
 *   3. Harmonics that ring as long as the fundamental. Real struck objects lose their high
 *      partials first. Fix: `decayScale` below 1 on every upper partial.
 *
 * A one-pole lowpass on the whole render takes off whatever edge survives that.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const BIT_DEPTH = 16;
const SHIPPED = path.join(__dirname, '..', '..', 'assets', 'sounds', 'saved.wav');

/** The voice written to assets/sounds/saved.wav by a bare `node tools/sfx/gen.js`. */
const DEFAULT_VOICE = 'triad';

/**
 * @typedef {{ ratio: number, gain: number, decayScale?: number }} Partial
 *   A harmonic above the fundamental. `ratio` multiplies the note's frequency (2 = an
 *   octave up); `decayScale` shortens its decay relative to the fundamental's.
 * @typedef {{ freq: number, at: number, gain: number, decaySec: number,
 *             attackSec?: number, partials?: Partial[], dropSemis?: number }} Note
 * @typedef {{ freq: number, at: number, gain: number, decaySec: number }} NoiseHit
 * @typedef {{ label: string, durationSec: number, peak: number, releaseSec?: number,
 *             lowpassHz?: number, lowpassPoles?: number, notes: Note[],
 *             noise?: NoiseHit[] }} Voice
 */

/** @type {Record<string, Voice>} */
const VOICES = {
  // ── The counter-example ──────────────────────────────────────────────────────
  horn: {
    label: 'Two sine tones a fifth apart, overlapping — the honk. Kept for comparison.',
    durationSec: 0.55,
    peak: 0.72,
    notes: [
      { freq: 880.0, at: 0.0, gain: 0.85, decaySec: 0.26, partials: [{ ratio: 2, gain: 0.16 }] },
      { freq: 1318.51, at: 0.085, gain: 1.0, decaySec: 0.34, partials: [{ ratio: 2, gain: 0.16 }] },
    ],
  },

  // ── Candidates ───────────────────────────────────────────────────────────────
  /** Struck wood. The 4:1 partial is the real bar mode of a marimba, and it dies fast. */
  marimba: {
    label: 'Marimba — wooden, dry, two low notes that get out of the way quickly.',
    durationSec: 0.5,
    peak: 0.72,
    lowpassHz: 4200,
    notes: [
      {
        freq: 523.25, // C5
        at: 0.0,
        gain: 1.0,
        decaySec: 0.15,
        attackSec: 0.004,
        partials: [
          { ratio: 4, gain: 0.13, decayScale: 0.35 },
          { ratio: 9.2, gain: 0.04, decayScale: 0.2 },
        ],
      },
      {
        freq: 783.99, // G5
        at: 0.105,
        gain: 0.95,
        decaySec: 0.19,
        attackSec: 0.004,
        partials: [
          { ratio: 4, gain: 0.1, decayScale: 0.35 },
          { ratio: 9.2, gain: 0.03, decayScale: 0.2 },
        ],
      },
    ],
  },

  /** Tiny and precise. Bright by nature, so it runs quieter than the rest. */
  musicbox: {
    label: 'Music box — small, delicate, a touch bright. Quieter than the others by design.',
    durationSec: 0.6,
    peak: 0.58,
    lowpassHz: 5200,
    notes: [
      {
        freq: 1046.5, // C6
        at: 0.0,
        gain: 0.9,
        decaySec: 0.2,
        attackSec: 0.003,
        partials: [
          { ratio: 2, gain: 0.09, decayScale: 0.45 },
          { ratio: 3, gain: 0.04, decayScale: 0.3 },
        ],
      },
      {
        freq: 1567.98, // G6
        at: 0.1,
        gain: 0.8,
        decaySec: 0.26,
        attackSec: 0.003,
        partials: [{ ratio: 2, gain: 0.07, decayScale: 0.45 }],
      },
    ],
  },

  /** Slightly inharmonic partials are what separate a bell from a beep. */
  celesta: {
    label: 'Soft bell — rounded, a little shimmer, longest tail of the set.',
    durationSec: 0.8,
    peak: 0.7,
    lowpassHz: 3400,
    notes: [
      {
        freq: 440.0, // A4
        at: 0.0,
        gain: 1.0,
        decaySec: 0.32,
        attackSec: 0.012,
        partials: [
          { ratio: 2.01, gain: 0.24, decayScale: 0.7 },
          { ratio: 3.02, gain: 0.08, decayScale: 0.45 },
        ],
      },
      {
        freq: 659.25, // E5
        at: 0.13,
        gain: 0.9,
        decaySec: 0.4,
        attackSec: 0.012,
        partials: [
          { ratio: 2.01, gain: 0.2, decayScale: 0.7 },
          { ratio: 3.02, gain: 0.06, decayScale: 0.45 },
        ],
      },
    ],
  },

  /** A physical "done" — the filtered noise burst reads as contact, not as a tone. */
  knock: {
    label: 'Wooden knock into a quiet note — tactile, the least musical option.',
    durationSec: 0.5,
    peak: 0.72,
    lowpassHz: 2600,
    noise: [{ freq: 900, at: 0.0, gain: 0.55, decaySec: 0.022 }],
    notes: [
      { freq: 220.0, at: 0.0, gain: 0.7, decaySec: 0.09, attackSec: 0.003 },
      {
        freq: 659.25, // E5
        at: 0.075,
        gain: 0.62,
        decaySec: 0.26,
        attackSec: 0.008,
        partials: [{ ratio: 2, gain: 0.1, decayScale: 0.5 }],
      },
    ],
  },

  /** One note, no attack edge at all. The quietest thing that still registers. */
  swell: {
    label: 'Soft swell — one note that fades up and away. Nearly impossible to find sharp.',
    durationSec: 0.75,
    peak: 0.68,
    releaseSec: 0.12,
    lowpassHz: 2400,
    notes: [
      {
        freq: 698.46, // F5
        at: 0.0,
        gain: 1.0,
        decaySec: 0.42,
        attackSec: 0.085,
        partials: [{ ratio: 2, gain: 0.11, decayScale: 0.6 }],
      },
    ],
  },

  /**
   * Three steps up. The most overtly "you earned that" option, and the approved direction.
   *
   * Speed lives in two places, not one: the spacing between note onsets AND the decay of the
   * notes being stepped over. Tightening only the spacing makes the first two notes still be
   * ringing when the third lands, which stacks them into a chord — the honk failure mode from
   * the first attempt. So each step's decay comes down with its spacing, while the final G5
   * keeps a long tail: that last ring is what makes it read as a resolve rather than a beep.
   */
  triad: {
    label: 'Rising triad — three quick steps up, the most celebratory of the set.',
    durationSec: 0.55,
    peak: 0.7,
    lowpassHz: 4000,
    notes: [
      { freq: 523.25, at: 0.0, gain: 0.85, decaySec: 0.1, attackSec: 0.004, partials: [{ ratio: 2, gain: 0.1, decayScale: 0.5 }] }, // C5
      { freq: 659.25, at: 0.055, gain: 0.9, decaySec: 0.12, attackSec: 0.004, partials: [{ ratio: 2, gain: 0.1, decayScale: 0.5 }] }, // E5
      { freq: 783.99, at: 0.11, gain: 1.0, decaySec: 0.26, attackSec: 0.004, partials: [{ ratio: 2, gain: 0.09, decayScale: 0.5 }] }, // G5
    ],
  },

  /** The same triad taken further, in case the retune above didn't go far enough. */
  triadrush: {
    label: 'Rising triad, faster still — steps at 40ms, near the limit before it slurs.',
    durationSec: 0.5,
    peak: 0.7,
    lowpassHz: 4000,
    notes: [
      { freq: 523.25, at: 0.0, gain: 0.85, decaySec: 0.075, attackSec: 0.003, partials: [{ ratio: 2, gain: 0.1, decayScale: 0.5 }] }, // C5
      { freq: 659.25, at: 0.04, gain: 0.9, decaySec: 0.09, attackSec: 0.003, partials: [{ ratio: 2, gain: 0.1, decayScale: 0.5 }] }, // E5
      { freq: 783.99, at: 0.08, gain: 1.0, decaySec: 0.24, attackSec: 0.003, partials: [{ ratio: 2, gain: 0.09, decayScale: 0.5 }] }, // G5
    ],
  },

  /** A full harmonic stack plus the pitch dip a real string makes when it's plucked hard. */
  pluck: {
    label: 'Nylon pluck — warm and low, like a thumb on a guitar string.',
    durationSec: 0.6,
    peak: 0.72,
    lowpassHz: 2800,
    notes: [
      {
        freq: 392.0, // G4
        at: 0.0,
        gain: 1.0,
        decaySec: 0.22,
        attackSec: 0.002,
        dropSemis: 0.3,
        partials: [
          { ratio: 2, gain: 0.3, decayScale: 0.6 },
          { ratio: 3, gain: 0.14, decayScale: 0.4 },
          { ratio: 4, gain: 0.06, decayScale: 0.3 },
        ],
      },
      {
        freq: 587.33, // D5
        at: 0.1,
        gain: 0.92,
        decaySec: 0.3,
        attackSec: 0.002,
        dropSemis: 0.3,
        partials: [
          { ratio: 2, gain: 0.26, decayScale: 0.6 },
          { ratio: 3, gain: 0.11, decayScale: 0.4 },
        ],
      },
    ],
  },
};

// ── Synthesis ─────────────────────────────────────────────────────────────────

/** Deterministic noise, so two runs of this script produce byte-identical files. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0x100000000) * 2 - 1;
  };
}

/**
 * One note: fundamental plus its partials, each with a fast attack into an exponential
 * decay. Phase is accumulated sample by sample rather than computed from `t` so a pitch
 * envelope (`dropSemis`) can bend the frequency without the waveform tearing.
 */
function renderNote(buffer, note) {
  const start = Math.round(note.at * SAMPLE_RATE);
  const attack = Math.max(1, Math.round((note.attackSec ?? 0.006) * SAMPLE_RATE));
  const partials = [{ ratio: 1, gain: 1 }, ...(note.partials ?? [])];
  let phase = 0;

  for (let i = start; i < buffer.length; i++) {
    const t = (i - start) / SAMPLE_RATE;
    const attackGain = Math.min(1, (i - start) / attack);
    const body = Math.exp(-t / note.decaySec);
    // Stop once the decay tail is inaudible — but only after the attack has finished. The
    // ramp starts at exactly 0, so a bare `body * attackGain < 1e-4` check matches the
    // note's first sample and breaks before writing anything, rendering the file silent.
    if (i - start >= attack && body < 1e-4) break;

    // A plucked string starts a hair sharp and settles. Tiny, but it's most of why a pluck
    // reads as a struck object rather than an oscillator.
    const bend = note.dropSemis ? Math.pow(2, (note.dropSemis * Math.exp(-t / 0.05)) / 12) : 1;
    phase += (2 * Math.PI * note.freq * bend) / SAMPLE_RATE;

    let sample = 0;
    for (const p of partials) {
      const decay = note.decaySec * (p.decayScale ?? 1);
      sample += p.gain * Math.exp(-t / decay) * Math.sin(phase * p.ratio);
    }
    buffer[i] += note.gain * attackGain * sample;
  }
}

/** A short filtered noise burst: the sound of contact, with no pitch of its own. */
function renderNoise(buffer, hit, rng) {
  const start = Math.round(hit.at * SAMPLE_RATE);
  const a = 1 - Math.exp((-2 * Math.PI * hit.freq) / SAMPLE_RATE);
  let filtered = 0;
  for (let i = start; i < buffer.length; i++) {
    const t = (i - start) / SAMPLE_RATE;
    const envelope = Math.exp(-t / hit.decaySec);
    if (envelope < 1e-4) break;
    filtered += a * (rng() - filtered);
    buffer[i] += hit.gain * envelope * filtered;
  }
}

/** One-pole lowpass, applied `poles` times for a steeper slope. Takes off the edge. */
function lowpass(buffer, hz, poles) {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / SAMPLE_RATE);
  for (let pass = 0; pass < poles; pass++) {
    let y = 0;
    for (let i = 0; i < buffer.length; i++) {
      y += a * (buffer[i] - y);
      buffer[i] = y;
    }
  }
}

/** @param {Voice} voice */
function render(voice) {
  const total = Math.round(voice.durationSec * SAMPLE_RATE);
  const samples = new Float64Array(total);
  const rng = makeRng(0x5eed);
  for (const note of voice.notes) renderNote(samples, note);
  for (const hit of voice.noise ?? []) renderNoise(samples, hit, rng);
  if (voice.lowpassHz) lowpass(samples, voice.lowpassHz, voice.lowpassPoles ?? 2);

  // Normalize to the headroom target rather than to a fixed gain: retuning a note's gain or
  // adding another one then can't push the file into clipping.
  let loudest = 0;
  for (const s of samples) loudest = Math.max(loudest, Math.abs(s));
  const scale = loudest > 0 ? voice.peak / loudest : 0;

  const release = Math.max(1, Math.round((voice.releaseSec ?? 0.06) * SAMPLE_RATE));
  for (let i = 0; i < total; i++) {
    const fade = i > total - release ? (total - i) / release : 1;
    samples[i] *= scale * fade;
  }
  return samples;
}

/** Canonical 44-byte RIFF/WAVE header for mono 16-bit PCM, then the samples. */
function toWav(samples) {
  const bytesPerSample = BIT_DEPTH / 8;
  const dataBytes = samples.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // audio format: PCM
  buf.writeUInt16LE(1, 22); // channels: mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28); // byte rate
  buf.writeUInt16LE(bytesPerSample, 32); // block align
  buf.writeUInt16LE(BIT_DEPTH, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * bytesPerSample);
  }
  return buf;
}

function write(name, file) {
  const voice = VOICES[name];
  if (!voice) {
    console.error(`Unknown voice "${name}". Known: ${Object.keys(VOICES).join(', ')}`);
    process.exit(1);
  }
  const wav = toWav(render(voice));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, wav);
  // A silent render is a valid WAV that no decoder complains about, so say the peak out
  // loud: it's the one number that proves the file has audio in it.
  let peak = 0;
  for (let i = 44; i + 1 < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
  console.log(
    `${name.padEnd(9)} → ${path.relative(process.cwd(), file)}  ` +
      `${(wav.length / 1024).toFixed(1)} KB, ${voice.durationSec}s, peak ${((peak / 32767) * 100).toFixed(0)}%`
  );
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1] ?? null;
};

if (argv.includes('--all')) {
  const dir = flag('--out') ?? path.join(__dirname, 'preview');
  for (const name of Object.keys(VOICES)) write(name, path.join(dir, `${name}.wav`));
} else {
  write(flag('--voice') ?? DEFAULT_VOICE, flag('--out') ?? SHIPPED);
}
