import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import {
  Home,
  Calendar,
  KeyRound,
  Car,
  ClipboardList,
  LayoutGrid,
  Camera,
  User,
} from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AdminDashboardScreen from '../screens/AdminDashboardScreen'
import EmployeeDashboardScreen from '../screens/EmployeeDashboardScreen'
import CalendarScreen from '../screens/CalendarScreen'
import RentCarScreen from '../screens/RentCarScreen'
import FleetManageScreen from '../screens/FleetManageScreen'
import HistoryScreen from '../screens/HistoryScreen'
import MoreScreen from '../screens/MoreScreen'
import SettingsScreen from '../screens/SettingsScreen'
import VehicleFormScreen from '../screens/VehicleFormScreen'
import RentalDetailScreen from '../screens/RentalDetailScreen'
import EmployeeManageScreen from '../screens/EmployeeManageScreen'
import CarLogsScreen from '../screens/CarLogsScreen'
import CarDetailsScreen from '../screens/CarDetailsScreen'
import CarPhotosScreen from '../screens/CarPhotosScreen'
import VehicleReportsScreen from '../screens/VehicleReportsScreen'
import EmployeeCameraScreen from '../screens/EmployeeCameraScreen'
import EmployeeProfileScreen from '../screens/EmployeeProfileScreen'
import ActivityLogsScreen from '../screens/ActivityLogsScreen'

import { useTheme } from '../context/ThemeContext'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function tabOptions(theme, insets) {
  return {
    tabBarActiveTintColor: '#b32025',
    tabBarInactiveTintColor: theme.textSub,
    tabBarHideOnKeyboard: true,
    tabBarStyle: {
      backgroundColor: theme.card,
      borderTopColor: theme.border,
      borderTopWidth: 1,
      paddingTop: 6,
      paddingBottom: Math.max(insets.bottom, 8),
      height: 56 + Math.max(insets.bottom, 8),
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 2,
    },
    headerShown: false,
  }
}

function AdminTabNavigator() {
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabOptions(theme, insets),
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Dashboard') return <Home color={color} size={size} />
          if (route.name === 'Calendar') return <Calendar color={color} size={size} />
          if (route.name === 'Rent') return <KeyRound color={color} size={size} />
          if (route.name === 'Fleet') return <Car color={color} size={size} />
          if (route.name === 'History') return <ClipboardList color={color} size={size} />
          if (route.name === 'More') return <LayoutGrid color={color} size={size} />
          return null
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Rent" component={RentCarScreen} />
      <Tab.Screen name="Fleet" component={FleetManageScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  )
}

function EmployeeTabNavigator() {
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabOptions(theme, insets),
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Dashboard') return <Home color={color} size={size} />
          if (route.name === 'Rent') return <KeyRound color={color} size={size} />
          if (route.name === 'Camera') return <Camera color={color} size={size} />
          if (route.name === 'History') return <ClipboardList color={color} size={size} />
          if (route.name === 'Profile') return <User color={color} size={size} />
          return null
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={EmployeeDashboardScreen} />
      <Tab.Screen name="Rent" component={RentCarScreen} />
      <Tab.Screen name="Camera" component={EmployeeCameraScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={EmployeeProfileScreen} />
    </Tab.Navigator>
  )
}

export default function RootNavigator({ userRole }) {
  const { theme } = useTheme()
  const headerOpts = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.card },
    headerTintColor: theme.textMain,
    headerTitleStyle: { fontWeight: '700' },
    contentStyle: { backgroundColor: theme.bg },
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userRole === 'admin' ? (
          <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
        ) : (
          <Stack.Screen name="EmployeeTabs" component={EmployeeTabNavigator} />
        )}
        <Stack.Screen name="CarDetails" component={CarDetailsScreen} options={{ ...headerOpts, title: 'Car Details' }} />
        <Stack.Screen name="CarPhotos" component={CarPhotosScreen} options={{ ...headerOpts, title: 'Car Photos' }} />
        <Stack.Screen name="VehicleReports" component={VehicleReportsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VehicleForm" component={VehicleFormScreen} options={{ ...headerOpts, title: 'Vehicle' }} />
        <Stack.Screen name="RentalDetail" component={RentalDetailScreen} options={{ ...headerOpts, title: 'Rental' }} />
        <Stack.Screen name="Employees" component={EmployeeManageScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CarsBrowse" component={CarLogsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ActivityLogs" component={ActivityLogsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
