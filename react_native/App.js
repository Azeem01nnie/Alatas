import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { FleetProvider } from './src/context/FleetContext'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import DeskNavigator from './src/navigation/DeskNavigator'
import LoginScreen from './src/screens/LoginScreen'
import { ACCENT } from './src/theme/colors'

function RootNavigator() {
  const { bootstrapping, isLoggedIn } = useAuth()
  const { colors, isDark } = useTheme()

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: ACCENT,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  }

  if (bootstrapping) {
    return (
      <View style={[styles.bootstrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    )
  }

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  return (
    <NavigationContainer theme={navTheme}>
      <DeskNavigator />
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <FleetProvider>
              <RootNavigator />
            </FleetProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bootstrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
