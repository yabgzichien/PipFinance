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

let enabled = true;
let player: AudioPlayer | null = null;
/** Set once a player build has failed. A device that can't open an audio session won't start
 *  being able to mid-session, so retrying on every save just burns work and log noise. */
let unavailable = false;

/** Wired up from AppDataProvider whenever the `soundEnabled` preference changes. Sound gets
 *  its own switch rather than riding on the motion setting: it carries into a room the way
 *  animation and haptics don't, so people mute it on its own schedule. */
export function setSoundEnabled(next: boolean): void {
  enabled = next;
}

/** Builds the player on first use rather than at import: an install that never saves (or one
 *  that starts with Sounds off) never pays for decoding the asset. */
function getPlayer(): AudioPlayer | null {
  if (player || unavailable) return player;
  try {
    // mixWithOthers so a podcast or a playlist keeps running underneath the chime, and
    // playsInSilentMode false so the iOS silent switch means silent, with no in-app override.
    void setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {
      // A refused audio-session config still leaves the chime playable at system defaults.
    });
    player = createAudioPlayer(require('../../assets/sounds/saved.wav'));
    player.volume = VOLUME;
  } catch {
    unavailable = true;
    return null;
  }
  return player;
}

/** The reward moment — a save landed. Pairs with haptics.payoff() at the same call site so
 *  the sound and the buzz read as one event (docs/ui-engagement-plan.md §1: reward the
 *  looking, never the state of the finances). */
export function payoff(): void {
  if (!enabled || Platform.OS === 'web') return;
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
