jest.mock('react-native', () => {
  return {
    Platform: {
      OS: 'android',
      select: (options: Record<string, unknown>) => options.android ?? options.default,
    },
    NativeModules: {
      AppIconModule: {
        setAppIcon: jest.fn(),
        getAppIcon: jest.fn(async () => 'green'),
      },
    },
  };
});

import { setDynamicAppIcon } from '../src/lib/appIcon';

const mockSetAppIcon = jest.requireMock('react-native').NativeModules.AppIconModule
  .setAppIcon as jest.Mock<Promise<boolean>, [string]>;

describe('rapid Android app-icon selection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSetAppIcon.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('coalesces quick selections and applies only the final icon', async () => {
    const updates = [
      setDynamicAppIcon('blue'),
      setDynamicAppIcon('rose'),
      setDynamicAppIcon('teal'),
    ];

    expect(mockSetAppIcon).not.toHaveBeenCalled();

    await jest.runAllTimersAsync();

    await expect(Promise.all(updates)).resolves.toEqual([true, true, true]);
    expect(mockSetAppIcon).toHaveBeenCalledTimes(1);
    expect(mockSetAppIcon).toHaveBeenCalledWith('teal');
  });
});
