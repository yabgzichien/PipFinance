// src/lib/sound.ts
// Semantic sound wrapper, the audible twin of src/lib/haptics.ts. Call sites never name an
// expo-audio API or an asset path, only what just happened: payoff(). Silent on web, silent
// whenever the user has turned Sounds off in Settings — see `setSoundEnabled`.
//
// The asset is generated, not sourced: run `node tools/sfx/gen.js` to re-tune and rebuild
// assets/sounds/saved.wav.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

/** Below full volume: a save confirmation should sit under whatever the user is listening
 *  to, not announce itself over the top of it. */
const VOLUME = 0.6;
const STORY_VOLUME = 0.5;

let enabled = true;
let player: AudioPlayer | null = null;
/** Set once a player build has failed. A device that can't open an audio session won't start
 *  being able to mid-session, so retrying on every save just burns work and log noise. */
let unavailable = false;

/** The monthly-story soundtrack is independent from the save chime so pausing the story never
 * interrupts a save payoff (and vice versa). Decoded per month when the story opens. */
const STORY_ASSETS: Record<string, any> = {
  '01': require('../../assets/sounds/stories/story-01.wav'),
  '02': require('../../assets/sounds/stories/story-02.wav'),
  '03': require('../../assets/sounds/stories/story-03.wav'),
  '04': require('../../assets/sounds/stories/story-04.wav'),
  '05': require('../../assets/sounds/stories/story-05.wav'),
  '06': require('../../assets/sounds/stories/story-06.wav'),
  '07': require('../../assets/sounds/stories/story-07.wav'),
  '08': require('../../assets/sounds/stories/story-08.wav'),
  '09': require('../../assets/sounds/stories/story-09.wav'),
  '10': require('../../assets/sounds/stories/story-10.wav'),
  '11': require('../../assets/sounds/stories/story-11.wav'),
  '12': require('../../assets/sounds/stories/story-12.wav'),
};

let storyPlayer: AudioPlayer | null = null;
let currentStoryMonth: string | null = null;
let storyUnavailable = false;
/** Monotonic intent token: any action that supersedes a pending rewind advances it. */
let storyStartVersion = 0;

function resolveStoryMonth(month?: string): string {
  if (!month) return '08';
  if (month.length >= 7 && month[4] === '-') {
    const mm = month.slice(5, 7);
    if (STORY_ASSETS[mm]) return mm;
  }
  if (STORY_ASSETS[month]) return month;
  return '08';
}

/** Wired up from AppDataProvider whenever the `soundEnabled` preference changes. Sound gets
 *  its own switch rather than riding on the motion setting: it carries into a room the way
 *  animation and haptics don't, so people mute it on its own schedule. */
export function setSoundEnabled(next: boolean): void {
  enabled = next;
  if (!next) storyStartVersion += 1;
}

/** Builds the player on first use rather than at import: an install that never saves (or one
 *  that starts with Sounds off) never pays for decoding the asset. */
function getPlayer(): AudioPlayer | null {
  if (player || unavailable) return player;
  try {
    // mixWithOthers so a podcast or a playlist keeps running underneath the chime, and
    // playsInSilentMode false so the iOS silent switch means silent, with no in-app override.
    if (Platform.OS !== 'web') {
      void setAudioModeAsync({
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      }).catch(() => {
        // A refused audio-session config still leaves the chime playable at system defaults.
      });
    }
    player = createAudioPlayer(require('../../assets/sounds/saved.wav'));
    player.volume = VOLUME;
  } catch {
    unavailable = true;
    return null;
  }
  return player;
}

function getStoryPlayer(month?: string): AudioPlayer | null {
  const targetMonth = resolveStoryMonth(month);
  if (storyPlayer && currentStoryMonth === targetMonth) return storyPlayer;
  if (storyUnavailable && currentStoryMonth === targetMonth) return null;

  try {
    if (storyPlayer && currentStoryMonth !== targetMonth) {
      try {
        storyPlayer.pause();
      } catch {
        // Ignore errors when resetting prior player
      }
      storyPlayer = null;
    }

    if (Platform.OS !== 'web') {
      void setAudioModeAsync({
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      }).catch(() => {
        // System defaults are an acceptable fallback for this optional sting.
      });
    }
    const asset = STORY_ASSETS[targetMonth] ?? STORY_ASSETS['08'];
    storyPlayer = createAudioPlayer(asset);
    storyPlayer.volume = STORY_VOLUME;
    storyPlayer.loop = true;
    currentStoryMonth = targetMonth;
    storyUnavailable = false;
  } catch {
    storyUnavailable = true;
    currentStoryMonth = targetMonth;
    return null;
  }
  return storyPlayer;
}

/** The reward moment — a save landed. Pairs with haptics.payoff() at the same call site so
 *  the sound and the buzz read as one event (docs/ui-engagement-plan.md §1: reward the
 *  looking, never the state of the finances). */
export function payoff(): void {
  if (!enabled) return;
  const active = getPlayer();
  if (!active) return;
  try {
    // Rewind first: the player holds its position at the end of the last play, so without
    // this a second save in the same session starts at the tail and sounds like nothing.
    void active.seekTo(0).catch(() => {
      // A failed seek is survivable — worst case this one chime starts partway through.
    });
    active.play();
  } catch {
    // Audio is a nicety; a denied audio focus or a busy output device should never surface
    // as an error on the screen that just told the user their save worked.
  }
}

/** Starts the soundtrack from its first beat for the given month. The story UI owns when this is called. */
export function storyIntro(month?: string): void {
  if (!enabled) return;
  const startVersion = ++storyStartVersion;
  const active = getStoryPlayer(month);
  if (!active) return;
  try {
    void active
      .seekTo(0)
      .then(() => {
        if (startVersion !== storyStartVersion || !enabled) return;
        try {
          active.play();
        } catch {
          // The sting is optional and never blocks the story.
        }
      })
      .catch(() => {
        // A failed rewind must not prevent the visual story from opening.
      });
  } catch {
    // Some native players can reject a seek synchronously while changing audio routes.
  }
}

/** Holds the sting at its current position for the viewer's press-and-hold gesture. */
export function pauseStoryIntro(): void {
  storyStartVersion += 1;
  if (!storyPlayer) return;
  try {
    storyPlayer.pause();
  } catch {
    // A disappearing audio route should stay invisible to the story UI.
  }
}

/** Continues from the held position; deliberately does not seek or lazily create a player. */
export function resumeStoryIntro(): void {
  if (!enabled || !storyPlayer) return;
  try {
    storyPlayer.play();
  } catch {
    // The visual timeline remains authoritative if audio focus is unavailable.
  }
}

/** Ends story audio for navigation/close and leaves the existing player ready at the start. */
export function stopStoryIntro(): void {
  if (!storyPlayer) return;
  pauseStoryIntro();
  try {
    void storyPlayer.seekTo(0).catch(() => {
      // Rewind is best-effort; the next storyIntro call also seeks before playing.
    });
  } catch {
    // Keep navigation and close paths silent even when native teardown races the seek.
  }
}
