import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'

export function Screen({
  title,
  children,
  scroll = false,
  contentContainerStyle,
  edges = ['top', 'left', 'right'],
}) {
  const { colors } = useTheme()

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentContainerStyle]}>{children}</View>
  )

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      {title ? (
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.header }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
      ) : null}
      {body}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
})
