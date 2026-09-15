// Jest mocks for native gesture / animation modules.
jest.mock('react-native-reanimated', () => {
  const NOOP = () => {};
  const identity = (v) => v;
  return {
    __esModule: true,
    default: {
      call: NOOP,
      createAnimatedComponent: (c) => c,
      View: require('react-native').View,
      Text: require('react-native').Text,
      ScrollView: require('react-native').ScrollView,
      Image: require('react-native').Image,
    },
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    useSharedValue: (init) => ({ value: init }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    useAnimatedReaction: NOOP,
    useEvent: () => NOOP,
    useHandler: () => ({}),
    useDerivedValue: (fn) => ({ value: typeof fn === 'function' ? fn() : fn }),
    withTiming: identity,
    withSpring: identity,
    withDelay: (_d, v) => v,
    withSequence: identity,
    withRepeat: identity,
    Easing: { linear: identity, ease: identity, bezier: () => identity },
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: identity,
    FadeIn: {},
    FadeOut: {},
  };
});

jest.mock('react-native-worklets', () => ({
  createSerializable: (v) => v,
  isWorkletFunction: () => false,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
}));
