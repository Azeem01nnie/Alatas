import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, Text, ActivityIndicator, LogBox, DeviceEventEmitter } from 'react-native'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AdminLogin from './components/AdminLogin'
import RootNavigator from './src/navigation/RootNavigator'
import { ThemeProvider } from './src/context/ThemeContext'
import { FleetProvider } from './src/context/FleetContext'
import { AuthProvider, useAuth } from './src/context/AuthContext'

LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental is currently a no-op',
  'SafeAreaView has been deprecated',
])

function AppShell() {
  const { isLoggedIn, user, logout, bootstrapping } = useAuth()

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('logout', () => {
      logout()
    })
    return () => sub.remove()
  }, [logout])

  if (bootstrapping) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#b32025" />
        <Text style={styles.bootText}>Loading session…</Text>
        <StatusBar style="auto" />
      </View>
    )
  }

  return (
    <ThemeProvider>
      {isLoggedIn && user ? (
        <FleetProvider>
          <>
            <RootNavigator userRole={user.role} />
            <StatusBar style="auto" />
          </>
        </FleetProvider>
      ) : (
        <View style={styles.container}>
          <AdminLogin />
          <StatusBar style="auto" />
        </View>
      )}
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
    gap: 12,
  },
  bootText: {
    color: '#666',
    fontSize: 15,
  },
})
