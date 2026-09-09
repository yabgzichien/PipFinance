jest.mock('../src/state/store', () => ({ useAppData: jest.fn() }));
jest.mock('../src/state/useReducedMotion', () => ({ useReducedMotion: () => true }));

const dashboard = require('../src/screens/DashboardScreen');

describe('Home hero panels with trips', () => {
  it('adds Trips to the swipeable panels only when there is a featured trip', () => {
    const panels = (dashboard as any).heroPanels;

    expect(panels?.(false, true)).toEqual(['cashflow', 'spent', 'networth', 'trips']);
    expect(panels?.(true, false)).toEqual(['cashflow', 'spent', 'left', 'networth']);
  });

  it('makes Trips the default only while the featured trip is current', () => {
    const pickDefault = (dashboard as any).adaptivePanel;

    expect(pickDefault?.(false, false, true)).toBe('trips');
    expect(pickDefault?.(false, false, false)).toBe('spent');
    expect(pickDefault?.(true, true, false)).toBe('left');
  });
});
