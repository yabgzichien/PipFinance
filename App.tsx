import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomNav, type NavTab } from './src/components/BottomNav';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Pip } from './src/components/Pip';
import { AddFlow } from './src/screens/AddFlow';
import { AllTransactionsScreen } from './src/screens/AllTransactionsScreen';
import { BreakdownScreen } from './src/screens/BreakdownScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { BudgetScreen } from './src/screens/BudgetScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { NetWorthScreen } from './src/screens/NetWorthScreen';
import { OwedScreen } from './src/screens/OwedScreen';
import { RecapScreen } from './src/screens/RecapScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AdvancedImportScreen } from './src/screens/AdvancedImportScreen';
import { ExportScreen } from './src/screens/ExportScreen';
import { CommitmentsScreen } from './src/screens/CommitmentsScreen';
import { GlossaryModal } from './src/components/InfoButton';
import { AppAlertModal } from './src/components/AppAlertModal';
import { AccentProvider, useAccent } from './src/state/accent';
import { AlertHostProvider } from './src/state/alertHost';
import { ColorSchemeProvider, useColorSchemeMode, useThemeColors } from './src/state/colorScheme';
import { GlossaryProvider } from './src/state/glossary';
import { AppDataProvider, useAppData } from './src/state/store';
import { useNow } from './src/state/useNow';
import { useReminderSync } from './src/state/useReminderSync';
import { syncStreakWidget } from './src/widget/syncStreakWidget';
import { platformShadow, uiFont } from './src/theme';

type Screen = 'home' | 'add' | 'settings' | 'categories' | 'transactions' | 'breakdown' | 'budget' | 'recap' | 'networth' | 'calendar' | 'advancedImport' | 'owed' | 'export' | 'commitments';

/**
 * Web-only: a global :focus-visible outline so keyboard users get a visible focus indicator
 * on every Pressable/TextInput  RN-web renders these as real DOM elements but doesn't ship
 * any focus styling itself, and the browser's own default is easy to lose track of amid the
 * app's custom-styled surfaces. Injected once via a <style> tag rather than per-component,
 * since RN has no global stylesheet. No-op on native (there's no focus ring to add).
 */
function useWebFocusRing(accentColor: string) {
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = `:focus-visible { outline: 2px solid ${accentColor} !important; outline-offset: 2px !important; }`;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [accentColor]);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  return (
    <ColorSchemeProvider>
      <PhoneFrame>
        <SafeAreaProvider>
          <AppDataProvider>
            <AccentProvider>
              <GlossaryProvider>
                <AlertHostProvider>
                  <ErrorBoundary>
                    <Root fontsLoaded={fontsLoaded} />
                  </ErrorBoundary>
                </AlertHostProvider>
              </GlossaryProvider>
            </AccentProvider>
          </AppDataProvider>
          <ThemedStatusBar />
        </SafeAreaProvider>
      </PhoneFrame>
    </ColorSchemeProvider>
  );
}

/** Flips the native status bar's icon color with the resolved light/dark scheme. */
function ThemedStatusBar() {
  const { resolvedScheme } = useColorSchemeMode();
  return <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />;
}

/**
 * On web, render the app inside a centred iPhone-17-Pro-Max-sized window (440 × 956 pt) so the
 * exported web build looks like a phone instead of stretching to the browser. No-op on native.
 *
 * On a genuinely phone-narrow browser window (real mobile phones, not a small desktop window),
 * that mock-phone chrome is counter-productive: the fake status bar/notch and hand-tuned
 * 440×956 frame just waste space and clip content inside a real phone screen that already has
 * its own chrome. Below `NARROW_BROWSER_MAX` we skip the mock frame entirely and render full-bleed.
 */
const NARROW_BROWSER_MAX = 500;

function PhoneFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Platform.OS is constant for the life
  // of the app, so this early return never toggles hook order between renders.
  const { width } = useWindowDimensions();
  const theme = useThemeColors();
  const { resolvedScheme } = useColorSchemeMode();
  const isDark = resolvedScheme === 'dark';
  // Fake OS chrome only (desktop mock-phone bezel + status bar), not real app content, so a
  // plain black/white flip is enough  no WCAG audit needed for decorative icons this small.
  const chromeIcon = isDark ? '#fff' : '#000';
  const isNarrowBrowser = width < NARROW_BROWSER_MAX;
  if (isNarrowBrowser) {
    return <View style={[webStyles.fullBleed, { backgroundColor: theme.bg }]}>{children}</View>;
  }
  return (
    <View style={[webStyles.backdrop, { backgroundColor: isDark ? '#0d1310' : '#d2d8d2' }]}>
      <View style={[webStyles.phone, { backgroundColor: theme.bg, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
        <View style={[webStyles.statusBar, { backgroundColor: theme.bg, pointerEvents: 'none' }]}>
          <View style={webStyles.statusRow}>
            <StatusClock color={chromeIcon} />
            <View style={webStyles.rightIcons}>
              {/* cellular signal */}
              <View style={webStyles.signal}>
                {[4, 6, 8, 11].map((h) => (
                  <View key={h} style={[webStyles.bar, { height: h, backgroundColor: chromeIcon }]} />
                ))}
              </View>
              {/* wifi */}
              <Svg width={17} height={12} viewBox="0 0 16 12">
                <Path
                  d="M8 9.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zM8 5.2c1.7 0 3.3.66 4.5 1.85l-1.35 1.5A4.6 4.6 0 0 0 8 8.2c-1.2 0-2.3.45-3.15 1.35L3.5 7.05A6.4 6.4 0 0 1 8 5.2zM8 1.2c2.8 0 5.4 1.1 7.3 3l-1.35 1.5A8.4 8.4 0 0 0 8 3.2 8.4 8.4 0 0 0 2.05 5.7L.7 4.2A10.3 10.3 0 0 1 8 1.2z"
                  fill={chromeIcon}
                />
              </Svg>
              {/* battery */}
              <Svg width={27} height={13} viewBox="0 0 27 13">
                <Rect x="0.6" y="0.6" width="22" height="11.8" rx="3" fill="none" stroke={chromeIcon} strokeOpacity={0.35} />
                <Rect x="2" y="2" width="17" height="9" rx="1.5" fill={chromeIcon} />
                <Rect x="24" y="4" width="2.2" height="5" rx="1" fill={chromeIcon} fillOpacity={0.4} />
              </Svg>
            </View>
          </View>
          <View style={webStyles.island} />
        </View>
        <View style={styles.fill}>{children}</View>
      </View>
    </View>
  );
}

/** Live status-bar clock for the web phone-frame (24h H:MM, ticks each minute). */
function StatusClock({ color }: { color: string }) {
  const now = useNow(30_000);
  const hh = now.getHours();
  const mm = String(now.getMinutes()).padStart(2, '0');
  return <Text style={[webStyles.clock, { color }]}>{`${hh}:${mm}`}</Text>;
}

function Root({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready, onboardingComplete } = useAppData();
  const accentTheme = useAccent();
  const theme = useThemeColors();
  useWebFocusRing(accentTheme.accent);
  // Global rather than per-screen: the reminder ladder has to be re-armed whenever the app is
  // opened or a transaction is saved, and neither is tied to any one screen. No-ops on web.
  useReminderSync();
  const [screen, setScreen] = useState<Screen>('home');
  // Owed is reachable from both Home and Activity, so back has to return where it came from.
  const [owedOrigin, setOwedOrigin] = useState<Screen>('transactions');
  const [txnFilter, setTxnFilter] = useState<string | null>(null);
  const [addInitial, setAddInitial] = useState<'attach' | 'import'>('attach');
  const [calendarMonth, setCalendarMonth] = useState<string | undefined>(undefined);
  const [exportMonth, setExportMonth] = useState<string | undefined>(undefined);
  const [exportOrigin, setExportOrigin] = useState<Screen>('settings');
  const openExport = (from: Screen, month?: string) => {
    setExportOrigin(from);
    setExportMonth(month);
    setScreen('export');
  };

  // Deep linking and Android widget tap handler
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      if (url.startsWith('pip://add') || url.endsWith('/add')) {
        setAddInitial('attach');
        setScreen('add');
      } else if (url.startsWith('pip://dashboard') || url.endsWith('/home')) {
        setScreen('home');
      }
    };

    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const urlSub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => urlSub.remove();
  }, []);

  // Sync widget when app resumes from background
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncStreakWidget().catch(() => {});
      }
    });
    return () => appStateSub.remove();
  }, []);

  // Persistent bottom nav appears only on the four primary destinations.
  const navTab: NavTab | null =
    screen === 'home' ? 'home'
    : screen === 'transactions' ? 'activity'
    : screen === 'networth' ? 'networth'
    : screen === 'settings' ? 'settings'
    : null;
  const goTab = (t: NavTab) => {
    if (t === 'home') setScreen('home');
    else if (t === 'activity') {
      setTxnFilter(null);
      setScreen('transactions');
    } else if (t === 'networth') setScreen('networth');
    else setScreen('settings');
  };

  if (!fontsLoaded || !ready) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: theme.bg }]}>
        <Pip size={96} expr="idle" float />
      </View>
    );
  }

  // One-time setup before the main app.
  if (!onboardingComplete) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.bg }]}>
        <OnboardingScreen />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.bg }]}>
      <View style={styles.fill}>
      {screen === 'home' && (
        <DashboardScreen
          onScan={() => {
            setAddInitial('attach');
            setScreen('add');
          }}
          onOpenAll={() => {
            setTxnFilter(null);
            setScreen('transactions');
          }}
          onOpenBreakdown={() => setScreen('breakdown')}
          onOpenBudget={() => setScreen('budget')}
          onOpenRecap={() => setScreen('recap')}
          onOpenNetWorth={() => setScreen('networth')}
          onOpenOwed={() => {
            setOwedOrigin('home');
            setScreen('owed');
          }}
          onOpenCommitments={() => setScreen('commitments')}
        />
      )}
      {screen === 'add' && (
        <AddFlow
          initialPhase={addInitial}
          onClose={() => setScreen('home')}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          onBack={() => setScreen('home')}
          onMigrate={() => {
            setAddInitial('import');
            setScreen('add');
          }}
          onAdvancedImport={() => setScreen('advancedImport')}
          onOpenExport={() => openExport('settings')}
          onOpenCategories={() => setScreen('categories')}
          onOpenCommitments={() => setScreen('commitments')}
          onResetToOnboarding={() => setScreen('home')}
        />
      )}
      {screen === 'advancedImport' && <AdvancedImportScreen onClose={() => setScreen('settings')} />}
      {screen === 'export' && (
        <ExportScreen
          initialMonth={exportMonth}
          onBack={() => setScreen(exportOrigin)}
        />
      )}
      {screen === 'categories' && <CategoriesScreen onBack={() => setScreen('home')} />}
      {screen === 'transactions' && (
        <AllTransactionsScreen
          filterCategoryId={txnFilter}
          onClearFilter={() => setTxnFilter(null)}
          onOpenOwed={() => {
            setOwedOrigin('transactions');
            setScreen('owed');
          }}
          onBack={() => {
            setTxnFilter(null);
            setScreen('home');
          }}
        />
      )}
      {screen === 'owed' && <OwedScreen onBack={() => setScreen(owedOrigin)} />}
      {screen === 'commitments' && <CommitmentsScreen onBack={() => setScreen('home')} />}
      {screen === 'budget' && <BudgetScreen onBack={() => setScreen('home')} onOpenRecap={() => setScreen('recap')} />}
      {screen === 'recap' && (
        <RecapScreen
          onBack={() => setScreen('home')}
          onOpenCalendar={(month) => {
            setCalendarMonth(month);
            setScreen('calendar');
          }}
          onOpenExport={(month) => openExport('recap', month)}
        />
      )}
      {screen === 'calendar' && (
        <CalendarScreen
          onBack={() => setScreen('recap')}
          initialMonth={calendarMonth}
          onAdd={() => {
            setAddInitial('attach');
            setScreen('add');
          }}
        />
      )}
      {screen === 'networth' && <NetWorthScreen onBack={() => setScreen('home')} />}
      {screen === 'breakdown' && (
        <BreakdownScreen
          onBack={() => setScreen('home')}
          onOpenCategory={(id) => {
            setTxnFilter(id);
            setScreen('transactions');
          }}
        />
      )}
      </View>
      {navTab && (
        <BottomNav
          active={navTab}
          onNavigate={goTab}
          onAdd={() => {
            setAddInitial('attach');
            setScreen('add');
          }}
        />
      )}
      <GlossaryModal />
      <AppAlertModal />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});

// Web-only: a centred iPhone-17-Pro-Max-sized window so the web build looks like a phone.
const webStyles = StyleSheet.create({
  // Real mobile browsers (< NARROW_BROWSER_MAX wide): no mock chrome, no fake status bar  the
  // device's own browser already provides both, so this is just a full-height, full-width host.
  fullBleed: {
    flex: 1,
    minHeight: '100vh' as unknown as number,
  },
  backdrop: {
    flex: 1,
    minHeight: '100vh' as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  phone: {
    width: 440,
    height: 956,
    maxHeight: '100vh' as unknown as number,
    maxWidth: '100%' as unknown as number,
    borderRadius: 44,
    overflow: 'hidden',
    borderWidth: 1,
    ...platformShadow('#000000', 0.18, 40, { width: 0, height: 18 }, 0),
  },
  statusBar: {
    height: 50,
    justifyContent: 'center',
    zIndex: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  clock: {
    fontFamily: uiFont(700),
    fontSize: 16,
    letterSpacing: 0.3,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  signal: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 1,
  },
  island: {
    position: 'absolute',
    top: 11,
    left: '50%',
    marginLeft: -63, // half of width (126) to centre
    width: 126,
    height: 35,
    borderRadius: 999,
    backgroundColor: '#000',
  },
});
