import type { MotionSetting } from '../theme/motion';

export const STORY_DURATION_MS = 5000;

export interface PlaybackState {
  index: number;
  paused: boolean;
  completed: boolean;
  cycle: number;
  muted: boolean;
}

export type PlaybackEvent =
  | { type: 'NEXT' | 'TICK_COMPLETE'; total: number }
  | { type: 'GOTO'; index: number; total: number }
  | { type: 'PREVIOUS' | 'PAUSE' | 'RESUME' | 'REPLAY' | 'TOGGLE_MUTE' };

/** A new viewer owns a new state; mute is never persisted to application settings. */
export function createPlaybackState(): PlaybackState {
  return { index: 0, paused: false, completed: false, cycle: 0, muted: false };
}

export function storyAutoplays(motion: MotionSetting, osReduced: boolean): boolean {
  return motion === 'full' && !osReduced;
}

export function recapStoryPlaybackReducer(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  switch (event.type) {
    case 'NEXT':
    case 'GOTO':
      return { ...state, index: Math.max(0, Math.min(event.total - 1,
        event.type === 'GOTO' ? event.index : state.index + 1)), paused: false, completed: false };
    case 'PREVIOUS':
      return { ...state, index: Math.max(0, state.index - 1), paused: false, completed: false };
    case 'PAUSE': return { ...state, paused: true };
    case 'RESUME': return { ...state, paused: false };
    case 'REPLAY': return { ...createPlaybackState(), cycle: state.cycle + 1, muted: state.muted };
    case 'TOGGLE_MUTE': return { ...state, muted: !state.muted };
    case 'TICK_COMPLETE':
      if (state.paused || state.completed) return state;
      return state.index >= event.total - 1
        ? { ...state, completed: true }
        : { ...state, index: state.index + 1 };
  }
}
