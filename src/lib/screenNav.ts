// src/lib/screenNav.ts
// The single source of truth for "where does back go" across App.tsx's hand-rolled screen
// switcher (there's no navigation library, so this stands in for a stack's default pop). Both
// the on-screen back buttons and the hardware/gesture back handler call through here, so the two
// can never drift apart.

export type Screen =
  | 'home'
  | 'add'
  | 'settings'
  | 'categories'
  | 'transactions'
  | 'breakdown'
  | 'budget'
  | 'recap'
  | 'networth'
  | 'calendar'
  | 'advancedImport'
  | 'owed'
  | 'export'
  | 'commitments'
  | 'categoryDetail'
  | 'netWorthHistory'
  | 'tax';

/** The destinations reachable from more than one place, so their own "back" has to return
 * wherever the user actually came from rather than a fixed screen. */
export type ScreenOrigins = {
  owedOrigin: Screen;
  calendarOrigin: Screen;
  exportOrigin: Screen;
};

/** Where `screen`'s back action goes. `null` means `screen` is a root destination — Home,
 * reached directly from the bottom nav — with nowhere further back to go. */
export function backTargetFor(screen: Screen, origins: ScreenOrigins): Screen | null {
  switch (screen) {
    case 'home':
      return null;
    case 'advancedImport':
      return 'settings';
    case 'netWorthHistory':
      return 'networth';
    case 'tax':
      return 'settings';
    case 'export':
      return origins.exportOrigin;
    case 'owed':
      return origins.owedOrigin;
    case 'calendar':
      return origins.calendarOrigin;
    case 'add':
    case 'settings':
    case 'categories':
    case 'transactions':
    case 'commitments':
    case 'budget':
    case 'categoryDetail':
    case 'recap':
    case 'networth':
    case 'breakdown':
      return 'home';
  }
}
