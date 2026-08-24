import { backTargetFor, type Screen } from '../src/lib/screenNav';

const origins = { owedOrigin: 'transactions' as Screen, calendarOrigin: 'recap' as Screen, exportOrigin: 'settings' as Screen };

describe('backTargetFor', () => {
  it('treats home as the root, with nowhere back to go', () => {
    expect(backTargetFor('home', origins)).toBeNull();
  });

  it('sends every flat screen back to home', () => {
    const flat: Screen[] = ['add', 'settings', 'categories', 'transactions', 'commitments', 'budget', 'categoryDetail', 'recap', 'networth', 'breakdown'];
    for (const screen of flat) expect(backTargetFor(screen, origins)).toBe('home');
  });

  it('returns advancedImport to settings', () => {
    expect(backTargetFor('advancedImport', origins)).toBe('settings');
  });

  it('returns netWorthHistory to networth', () => {
    expect(backTargetFor('netWorthHistory', origins)).toBe('networth');
  });

  it('returns tax to settings', () => {
    expect(backTargetFor('tax', origins)).toBe('settings');
  });

  it('returns currencySettings to settings', () => {
    expect(backTargetFor('currencySettings', origins)).toBe('settings');
  });

  it('returns owed, calendar and export to wherever they were opened from', () => {
    expect(backTargetFor('owed', { ...origins, owedOrigin: 'home' })).toBe('home');
    expect(backTargetFor('owed', { ...origins, owedOrigin: 'transactions' })).toBe('transactions');
    expect(backTargetFor('calendar', { ...origins, calendarOrigin: 'home' })).toBe('home');
    expect(backTargetFor('calendar', { ...origins, calendarOrigin: 'recap' })).toBe('recap');
    expect(backTargetFor('export', { ...origins, exportOrigin: 'settings' })).toBe('settings');
    expect(backTargetFor('export', { ...origins, exportOrigin: 'recap' })).toBe('recap');
  });
});
