import React from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';

export const SCREEN_PADDING_H = 20;
export const HEADER_PADDING_V = 12;

/** Bottom padding so scroll content clears the tab bar. */
export function useTabBarContentPadding(extra = 16) {
  const insets = useSafeAreaInsets();
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    tabBarHeight = 0;
  }
  if (tabBarHeight > 0) {
    return tabBarHeight + extra;
  }
  return insets.bottom + extra;
}

export function ScreenHeader({ title, subtitle, left, right, children, style }) {
  const { theme } = useTheme();

  if (children) {
    return (
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: theme.card, borderBottomColor: theme.border },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerMain}>
          {left}
          <View style={styles.headerTextBlock}>
            {title ? (
              <Text style={[styles.headerTitle, { color: theme.textMain }]} numberOfLines={2}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={[styles.headerSubtitle, { color: theme.textSub }]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {right}
      </View>
    </View>
  );
}

/**
 * Standard screen shell: safe top/left/right, optional header, scroll or flex body.
 * Tab screens: set padTabBar so lists are not hidden behind the bottom tab bar.
 */
export default function ScreenLayout({
  children,
  header,
  scroll = false,
  scrollProps = {},
  keyboard = false,
  keyboardVerticalOffset,
  edges = ['top', 'left', 'right'],
  padTabBar = true,
  style,
  contentContainerStyle,
}) {
  const { theme } = useTheme();
  const bottomPad = padTabBar ? useTabBarContentPadding() : 16;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[{ paddingBottom: bottomPad }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentContainerStyle]}>{children}</View>
  );

  const wrappedBody = keyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset ?? 0}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.bg }, style]}
      edges={edges}
    >
      {header}
      {wrappedBody}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SCREEN_PADDING_H,
    paddingVertical: HEADER_PADDING_V,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
});
