import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { ACCENT } from '../theme/colors'
import { Users, ChartBar, Settings, ChevronRight } from 'lucide-react-native'

export default function MoreScreen({ navigation }) {
  const { theme } = useTheme()
  const { user } = useAuth()
  const pad = useTabBarContentPadding()
  const isAdmin = user?.role === 'admin'

  const items = [
    isAdmin && {
      key: 'employees',
      title: 'Employees',
      subtitle: 'Team accounts',
      icon: Users,
      onPress: () => navigation.navigate('Employees'),
    },
    isAdmin && {
      key: 'reports',
      title: 'Vehicle Reports',
      subtitle: 'Owner / vehicle reports',
      icon: ChartBar,
      onPress: () => navigation.navigate('VehicleReports'),
    },
    {
      key: 'settings',
      title: 'Settings',
      subtitle: 'Profile, theme, Supabase',
      icon: Settings,
      onPress: () => navigation.navigate('Settings'),
    },
  ].filter(Boolean)

  return (
    <ScreenLayout
      scroll={false}
      header={<ScreenHeader title="More" subtitle="Team, reports, and settings" />}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: pad }}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={item.onPress}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#fef2f2' }]}>
                <Icon color={ACCENT} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.textMain }]}>{item.title}</Text>
                <Text style={{ color: theme.textSub }}>{item.subtitle}</Text>
              </View>
              <ChevronRight color={theme.textSub} size={20} />
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700', fontSize: 16 },
})
