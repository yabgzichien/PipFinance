// src/screens/onboarding/WidgetStep.tsx
// Step 5 of the setup wizard. Rendered on every platform so the step is always reviewable,
// but only Android can actually pin anything: this app ships an Android widget target and
// no iOS one. On the platforms that can't pin, the step says so and offers only Finish,
// rather than a button that would look live and do nothing (react-native-android-widget
// swaps in a no-op module off Android, so `requestPinWidget` there just resolves false).
//
// On Android, `requestPinWidget` only confirms the launcher accepted the request, not that
// the user finished placing the widget, so Finish is reachable either way.
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { requestPinWidget } from 'react-native-android-widget';
import { Icon } from '../../components/Icon';
import { FadeIn } from '../../components/Motion';
import { Pip } from '../../components/Pip';
import { Body, BtnLabel, PrimaryButton, Title } from '../../components/ui';
import * as haptics from '../../lib/haptics';
import { useThemeColors } from '../../state/colorScheme';
import { spacing, uiFont } from '../../theme';
import { stagger } from '../../theme/motion';

/** Only Android ships a widget target in this app, so only Android can offer to pin one. */
const CAN_PIN = Platform.OS === 'android';
const PIP_SIZE = 88;

export function WidgetStep({ onFinish }: { onFinish: () => void }) {
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

  const finish = () => {
    haptics.commit();
    onFinish();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, flexGrow: 1, justifyContent: 'center' }}>
      <View style={styles.hero}>
        <FadeIn offset={14}>
          <Pip size={PIP_SIZE} glasses float />
        </FadeIn>
        <FadeIn delay={stagger}>
          <Title style={{ marginTop: spacing.base, textAlign: 'center' }}>
            {CAN_PIN ? 'Add the streak widget' : 'The streak widget'}
          </Title>
        </FadeIn>
        <FadeIn delay={stagger * 2}>
          <Body color={colorTheme.ink2} style={styles.subtitle}>
            {CAN_PIN
              ? "Pin Pip's streak widget to your home screen to see your logging streak at a glance, no need to open the app."
              : "Pip's streak widget shows your logging streak at a glance, without opening the app. It's on Android for now, so there's nothing to pin on this device."}
          </Body>
        </FadeIn>
      </View>

      <FadeIn delay={stagger * 3} style={styles.footer}>
        {CAN_PIN ? (
          <>
            <PrimaryButton onPress={() => void addWidget()} disabled={busy}>
              <BtnLabel>{asked ? 'Add widget again' : busy ? 'Opening…' : 'Add widget'}</BtnLabel>
              <Icon name="pin" size={17} color="#fff" />
            </PrimaryButton>
            <Pressable
              onPress={finish}
              style={({ pressed }) => [styles.finishBtn, pressed && styles.finishPressed]}
            >
              <Text style={[styles.finishText, { color: colorTheme.ink2 }]}>{asked ? 'Finish' : 'Finish without adding'}</Text>
            </Pressable>
          </>
        ) : (
          <PrimaryButton onPress={finish}>
            <BtnLabel>Finish</BtnLabel>
            <Icon name="check" size={18} color="#fff" stroke={2.4} />
          </PrimaryButton>
        )}
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  subtitle: { marginTop: spacing.sm, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.sm },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
  finishBtn: { alignItems: 'center', paddingVertical: 10 },
  finishPressed: { opacity: 0.55 },
  finishText: { fontFamily: uiFont(600), fontSize: 13.5 },
});
