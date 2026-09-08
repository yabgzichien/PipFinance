// __mocks__/@sentry/react-native.js
// Jest picks this up automatically for every suite (a root __mocks__ entry for a node_modules
// package needs no jest.mock call). Without it, any module that reaches src/lib/diagnostics.ts
// loads the real native SDK, which keeps a handle open and stops Jest exiting.
//
// Suites that assert on reporting behaviour (__tests__/diagnostics.test.ts) declare their own
// jest.mock factory, which takes precedence over this one.
module.exports = {
  init: jest.fn(),
  captureException: jest.fn(),
  captureEvent: jest.fn(),
  setUser: jest.fn(),
};
