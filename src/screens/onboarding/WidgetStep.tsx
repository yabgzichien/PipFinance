// src/screens/onboarding/WidgetStep.tsx
// Step 5 of the setup wizard, Android-only  the orchestrator (OnboardingScreen.tsx) never
// renders this on iOS/web, since there's no widget target for those platforms in this app.
// `requestPinWidget` only confirms the launcher accepted the request, not that the user
// finished placing the widget, so Finish is reachable either way.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { requestPinWidget } from 'react-native-android-widget';
import { Icon } from '../../components/Icon';
import { FadeIn } from '../../components/Motion';
import { Body, BtnLabel, PrimaryButton, Title } from '../../components/ui';
import * as haptics from '../../lib/haptics';
import { useAccent } from '../../state/accent';
import { useThemeColors } from '../../state/colorScheme';
import { spacing, uiFont } from '../../theme';
import { stagger } from '../../theme/motion';

export function WidgetStep({ onFinish }: { onFinish: () => void }) {
  const theme = useAccent();
  const colorTheme = useThemeColors();
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);

  const addWidget = async () => {
    if (busy) return;
    haptics.tap();
    setBusy(true);
    try {
      await requestPinWidget({ widgetName: 'StreakWidget' });
    } catch {
      // Unsupported launcher/OS version  Finish still works below.
    } finally {
      setBusy(false);
      setAsked(true);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, flexGrow: 1, justifyContent: 'center' }}>
      <View style={styles.hero}>
        <FadeIn offset={14}>
          <View style={[styles.iconWrap, { backgroundColor: theme.accentTint }]}>
            <Icon name="pin" size={28} color={theme.accentInk} />
          </View>
        </FadeIn>
        <FadeIn delay={stagger}>
          <Title style={{ marginTop: spacing.base, textAlign: 'center' }}>Add the streak widget</Title>
        </FadeIn>
        <FadeIn delay={stagger * 2}>
          <Body color={colorTheme.ink2} style={styles.subtitle}>
            Pin Pip's streak widget to your home screen to see your logging streak at a glance,
            no need to open the app.
          </Body>
        </FadeIn>
      </View>

      <FadeIn delay={stagger * 3} style={styles.footer}>
        <PrimaryButton onPress={() => void addWidget()} disabled={busy}>
          <BtnLabel>{asked ? 'Add widget again' : busy ? 'Opening…' : 'Add widget'}</BtnLabel>
          <Icon name="pin" size={17} color="#fff" />
        </PrimaryButton>
        <Pressable
          onPress={() => { haptics.commit(); onFinish(); }}
          style={({ pressed }) => [styles.finishBtn, pressed && styles.finishPressed]}
        >
          <Text style={[styles.finishText, { color: colorTheme.ink2 }]}>{asked ? 'Finish' : 'Finish without adding'}</Text>
        </Pressable>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  subtitle: { marginTop: spacing.sm, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.sm },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
  finishBtn: { alignItems: 'center', paddingVertical: 10 },
  finishPressed: { opacity: 0.55 },
  finishText: { fontFamily: uiFont(600), fontSize: 13.5 },
});
