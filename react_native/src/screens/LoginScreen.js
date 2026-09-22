import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { useTheme } from '../context/ThemeContext'
import { isPlaceholderSupabaseConfig, isSupabaseConfigured } from '../api/supabaseClient'
import { ACCENT } from '../theme/colors'

const LOGO = require('../../assets/logo.jpg')

export default function LoginScreen() {
  const { loginWithPassword } = useAuth()
  const { reloadData } = useFleet()
  const { colors } = useTheme()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const configBad = !isSupabaseConfigured || isPlaceholderSupabaseConfig()

  async function handleSignIn() {
    setError('')
    setSubmitting(true)
    try {
      await loginWithPassword(username, password)
      await reloadData()
    } catch (err) {
      setError(err?.message || 'Sign in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.brandBlock}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Alatas Car Rental" />
          <Text style={styles.brandWordmark}>ALATAS</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Fleet desk sign in
        </Text>

        {configBad ? (
          <Text style={[styles.configWarning, { color: colors.warning }]}>
            Supabase is not set up. Put your real URL and anon key in react_native/.env (same as
            frontend/.env), not the .env.example placeholders. Restart Expo after saving.
          </Text>
        ) : null}

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            placeholder="Username"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!submitting}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={() => void handleSignIn()}
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={() => void handleSignIn()}
            disabled={submitting || configBad}
            style={({ pressed }) => [
              styles.button,
              pressed && !submitting ? styles.buttonPressed : null,
              submitting || configBad ? styles.buttonDisabled : null,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  inner: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 8,
  },
  brandWordmark: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 3,
    color: ACCENT,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
  },
  configWarning: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 18,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
  },
  error: {
    color: ACCENT,
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 20,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
})
