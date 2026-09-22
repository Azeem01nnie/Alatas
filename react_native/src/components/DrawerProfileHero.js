import { useCallback, useEffect, useState } from 'react'
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { fetchAdminProfile } from '../api/backend'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'

const LOGO = require('../../assets/logo.jpg')

function profileInitials(name) {
  const parts = String(name || 'A')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  }
  return (parts[0]?.slice(0, 2) || 'A').toUpperCase()
}

function GlassCard({ isDark, children }) {
  const tint = isDark ? 'dark' : 'light'
  const overlay = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)'
  const border = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)'

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.glass,
          {
            backgroundColor: overlay,
            borderColor: border,
          },
        ]}
      >
        <View style={styles.glassContent}>{children}</View>
      </View>
    )
  }

  return (
    <View style={styles.glassOuter}>
      <BlurView intensity={isDark ? 28 : 48} tint={tint} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: overlay,
            borderRadius: 12,
          },
        ]}
      />
      <View style={[styles.glassBorder, { borderColor: border }]} pointerEvents="none" />
      <View style={styles.glassContent}>{children}</View>
    </View>
  )
}

export default function DrawerProfileHero({ onPressSettings }) {
  const { user, isAdmin } = useAuth()
  const { colors, isDark } = useTheme()
  const [photo, setPhoto] = useState('')

  const displayName = user?.displayName || user?.username || 'User'
  const username = user?.username ? `@${user.username}` : ''
  const roleLabel = isAdmin ? 'Admin' : 'Employee'

  const loadPhoto = useCallback(async () => {
    if (!isAdmin) {
      setPhoto('')
      return
    }
    try {
      const profile = await fetchAdminProfile()
      if (typeof profile?.photo === 'string' && profile.photo.trim()) {
        setPhoto(profile.photo.trim())
      }
    } catch {
      /* ignore */
    }
  }, [isAdmin])

  useEffect(() => {
    void loadPhoto()
  }, [loadPhoto])

  return (
    <Pressable
      onPress={onPressSettings}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${roleLabel}. Open settings.`}
    >
      <GlassCard isDark={isDark}>
        <View style={styles.row}>
          <View style={[styles.avatar, { borderColor: `${ACCENT}33` }]}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatarImage} />
            ) : isAdmin ? (
              <Image source={LOGO} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: `${ACCENT}12` }]}>
                <Text style={[styles.avatarInitials, { color: ACCENT }]}>
                  {profileInitials(displayName)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.meta}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
              {[username, roleLabel].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  glassOuter: {
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  glass: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 1,
  },
  glassContent: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sub: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '500',
  },
})
