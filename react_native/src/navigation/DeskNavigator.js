import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import DrawerProfileHero from '../components/DrawerProfileHero'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ACCENT } from '../theme/colors'
import CalendarScreen from '../screens/CalendarScreen'
import DashboardScreen from '../screens/DashboardScreen'
import EmployeesScreen from '../screens/EmployeesScreen'
import HistoryScreen from '../screens/HistoryScreen'
import ManageVehiclesScreen from '../screens/ManageVehiclesScreen'
import RentCarScreen from '../screens/RentCarScreen'
import ReportsScreen from '../screens/ReportsScreen'
import SettingsScreen from '../screens/SettingsScreen'
import TransactionScreen from '../screens/TransactionScreen'
import VehicleDetailScreen from '../screens/VehicleDetailScreen'
import VehicleFormScreen from '../screens/VehicleFormScreen'

const Drawer = createDrawerNavigator()
const Stack = createNativeStackNavigator()

const DRAWER_ROUTES = [
  { name: 'Dashboard', component: DashboardScreen, title: 'Dashboard' },
  { name: 'Calendar', component: CalendarScreen, title: 'Calendar' },
  { name: 'RentCar', component: RentCarScreen, title: 'Rent Car' },
  { name: 'ManageVehicles', component: ManageVehiclesScreen, title: 'Manage Vehicle', adminOnly: true },
  { name: 'Employees', component: EmployeesScreen, title: 'Employees', adminOnly: true },
  { name: 'Reports', component: ReportsScreen, title: 'Reports', adminOnly: true },
  { name: 'History', component: HistoryScreen, title: 'History' },
  { name: 'Settings', component: SettingsScreen, title: 'Settings' },
]

function CustomDrawerContent(props) {
  const { colors } = useTheme()
  const { logout } = useAuth()

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You will need to sign in again to use the desk.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          props.navigation.closeDrawer()
          void logout()
        },
      },
    ])
  }

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.drawerContent}
      style={{ backgroundColor: colors.surface }}
    >
      <DrawerProfileHero
        onPressSettings={() => {
          props.navigation.navigate('Settings')
          props.navigation.closeDrawer()
        }}
      />
      <DrawerItemList {...props} />
      <View style={[styles.logoutWrap, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            { borderColor: `${ACCENT}44`, backgroundColor: `${ACCENT}10` },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  )
}

function MainDrawer() {
  const { isAdmin } = useAuth()
  const { colors } = useTheme()
  const visibleRoutes = DRAWER_ROUTES.filter((route) => !route.adminOnly || isAdmin)

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        drawerActiveTintColor: ACCENT,
        drawerInactiveTintColor: colors.textSecondary,
        drawerActiveBackgroundColor: `${ACCENT}18`,
        drawerStyle: { backgroundColor: colors.surface },
        drawerLabelStyle: { fontWeight: '600', marginLeft: -4 },
      }}
    >
      {visibleRoutes.map((route) => (
        <Drawer.Screen
          key={route.name}
          name={route.name}
          component={route.component}
          options={{ title: route.title }}
        />
      ))}
    </Drawer.Navigator>
  )
}

export default function DeskNavigator() {
  const { colors } = useTheme()

  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={MainDrawer} options={{ headerShown: false }} />
      <Stack.Screen
        name="Transaction"
        component={TransactionScreen}
        options={{
          title: 'Transaction',
          headerStyle: { backgroundColor: colors.header },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="VehicleForm"
        component={VehicleFormScreen}
        options={{
          title: 'Vehicle',
          headerStyle: { backgroundColor: colors.header },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="VehicleDetail"
        component={VehicleDetailScreen}
        options={{
          title: 'Vehicle',
          headerStyle: { backgroundColor: colors.header },
          headerTintColor: colors.text,
        }}
      />
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  drawerContent: {
    paddingTop: 4,
    flexGrow: 1,
  },
  logoutWrap: {
    marginTop: 'auto',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logoutBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 15,
  },
})
