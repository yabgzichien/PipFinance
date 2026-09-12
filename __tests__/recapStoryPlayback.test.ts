import { createPlaybackState, recapStoryPlaybackReducer as reduce, storyAutoplays } from '../src/lib/recapStoryPlayback';

it('clamps navigation and restarts previous even at the first card', () => {
  const start = createPlaybackState();
  expect(reduce(start, { type: 'PREVIOUS' })).toEqual(start);
  expect(reduce(start, { type: 'PREVIOUS' })).not.toBe(start);
  expect(reduce(start, { type: 'GOTO', index: -5, total: 3 }).index).toBe(0);
  const last = reduce(start, { type: 'GOTO', index: 99, total: 3 });
  expect(last.index).toBe(2);
  expect(reduce(last, { type: 'NEXT', total: 3 }).index).toBe(2);
  expect(reduce(last, { type: 'PREVIOUS' }).index).toBe(1);
});

it('ticks advance, stop at completion, and do nothing while paused', () => {
  const paused = reduce(createPlaybackState(), { type: 'PAUSE' });
  expect(reduce(paused, { type: 'TICK_COMPLETE', total: 2 })).toBe(paused);
  const resumed = reduce(paused, { type: 'RESUME' });
  const last = reduce(resumed, { type: 'TICK_COMPLETE', total: 2 });
  expect(last).toMatchObject({ index: 1, completed: false, paused: false });
  const done = reduce(last, { type: 'TICK_COMPLETE', total: 2 });
  expect(done).toMatchObject({ index: 1, completed: true });
  expect(reduce(done, { type: 'TICK_COMPLETE', total: 2 })).toBe(done);
  expect(reduce(done, { type: 'PREVIOUS' })).toMatchObject({ index: 0, completed: false });
});

it('replays a new cycle while retaining mute only within that session', () => {
  const muted = reduce(createPlaybackState(), { type: 'TOGGLE_MUTE' });
  const replay = reduce({ ...muted, index: 2, paused: true, completed: true }, { type: 'REPLAY' });
  expect(replay).toEqual({ index: 0, paused: false, completed: false, cycle: 1, muted: true });
  expect(reduce(replay, { type: 'TOGGLE_MUTE' }).muted).toBe(false);
  expect(createPlaybackState()).toEqual({ index: 0, paused: false, completed: false, cycle: 0, muted: false });
});

it('explicit navigation clears pause and completion without changing session sound or replay cycle', () => {
  const state = { index: 2, paused: true, completed: true, cycle: 4, muted: true };
  expect(reduce(state, { type: 'GOTO', index: 1, total: 3 })).toEqual({
    index: 1, paused: false, completed: false, cycle: 4, muted: true,
  });
});

it.each([
  ['full', false, true], ['full', true, false], ['reduced', false, false],
  ['reduced', true, false], ['off', false, false], ['off', true, false],
] as const)('motion %s with OS reduction %s autoplays: %s', (motion, os, expected) => {
  expect(storyAutoplays(motion, os)).toBe(expected);
});
