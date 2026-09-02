import { backTargetFor, type Screen } from '../src/lib/screenNav';

const origins = {
  owedOrigin: 'transactions' as Screen,
  calendarOrigin: 'recap' as Screen,
  exportOrigin: 'settings' as Screen,
  commitmentsOrigin: 'settings' as Screen,
  currencyOrigin: 'settings' as Screen,
};

describe('backTargetFor', () => {
  it('treats home as the root, with nowhere back to go', () => {
    expect(backTargetFor('home', origins)).toBeNull();
  });

  it('sends every flat screen back to home', () => {
    const flat: Screen[] = ['add', 'settings', 'transactions', 'budget', 'categoryDetail', 'recap', 'networth', 'breakdown'];
    for (const screen of flat) expect(backTargetFor(screen, origins)).toBe('home');
  });

  it('returns advancedImport to settings', () => {
    expect(backTargetFor('advancedImport', origins)).toBe('settings');
  });

  it('returns categories to settings', () => {
    expect(backTargetFor('categories', origins)).toBe('settings');
  });

  it('returns netWorthHistory to networth', () => {
    expect(backTargetFor('netWorthHistory', origins)).toBe('networth');
  });

  it('returns tax to settings', () => {
    expect(backTargetFor('tax', origins)).toBe('settings');
  });

  it('returns commitments to settings or home based on origin', () => {
    expect(backTargetFor('commitments', { ...origins, commitmentsOrigin: 'settings' })).toBe('settings');
    expect(backTargetFor('commitments', { ...origins, commitmentsOrigin: 'home' })).toBe('home');
  });

  it('returns currencySettings to settings or home based on origin', () => {
    expect(backTargetFor('currencySettings', { ...origins, currencyOrigin: 'settings' })).toBe('settings');
    expect(backTargetFor('currencySettings', { ...origins, currencyOrigin: 'home' })).toBe('home');
  });

  it('returns owed, calendar and export to wherever they were opened from', () => {
    expect(backTargetFor('owed', { ...origins, owedOrigin: 'home' })).toBe('home');
    expect(backTargetFor('owed', { ...origins, owedOrigin: 'transactions' })).toBe('transactions');
    expect(backTargetFor('calendar', { ...origins, calendarOrigin: 'home' })).toBe('home');
    expect(backTargetFor('calendar', { ...origins, calendarOrigin: 'recap' })).toBe('recap');
    expect(backTargetFor('export', { ...origins, exportOrigin: 'settings' })).toBe('settings');
    expect(backTargetFor('export', { ...origins, exportOrigin: 'home' })).toBe('home');
    expect(backTargetFor('export', { ...origins, exportOrigin: 'recap' })).toBe('recap');
  });
});
