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
  | 'tax'
  | 'currencySettings'
  | 'backup'
  | 'widgetCustomizer'
  | 'trips'
  | 'tripDetail';

/** The destinations reachable from more than one place, so their own "back" has to return
 * wherever the user actually came from rather than a fixed screen. */
export type ScreenOrigins = {
  owedOrigin: Screen;
  calendarOrigin: Screen;
  exportOrigin: Screen;
  commitmentsOrigin?: Screen;
  currencyOrigin?: Screen;
  /** Where the add flow was opened from. Home for the bottom-nav plus, but a trip's own
   *  "Add expense" has to come back to that trip rather than dumping the user on Home. */
  addOrigin?: Screen;
};

/** Where `screen`'s back action goes. `null` means `screen` is a root destination — Home,
 * reached directly from the bottom nav — with nowhere further back to go. */
export function backTargetFor(screen: Screen, origins: ScreenOrigins): Screen | null {
  switch (screen) {
    case 'home':
      return null;
    case 'advancedImport':
    case 'tax':
    case 'categories':
    case 'backup':
    case 'widgetCustomizer':
      return 'settings';
    case 'commitments':
      return origins.commitmentsOrigin ?? 'settings';
    case 'currencySettings':
      return origins.currencyOrigin ?? 'settings';
    case 'netWorthHistory':
      return 'networth';
    case 'tripDetail':
      return 'trips';
    case 'export':
      return origins.exportOrigin;
    case 'owed':
      return origins.owedOrigin;
    case 'calendar':
      return origins.calendarOrigin;
    case 'add':
      return origins.addOrigin ?? 'home';
    case 'settings':
    case 'transactions':
    case 'budget':
    case 'categoryDetail':
    case 'recap':
    case 'networth':
    case 'breakdown':
      return 'home';
    case 'trips':
      return 'transactions';
  }
}
