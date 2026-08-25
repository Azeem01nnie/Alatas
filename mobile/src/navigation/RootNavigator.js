import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, ClipboardList, User, Users, Car, Camera, MessageSquare } from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import ActivityLogsScreen from '../screens/ActivityLogsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EmployeeManageScreen from '../screens/EmployeeManageScreen';
import CarLogsScreen from '../screens/CarLogsScreen';
import CarDetailsScreen from '../screens/CarDetailsScreen';
import CarPhotosScreen from '../screens/CarPhotosScreen';
import VehicleReportsScreen from '../screens/VehicleReportsScreen';

// Employee Screens
import EmployeeDashboardScreen from '../screens/EmployeeDashboardScreen';
import EmployeeCameraScreen from '../screens/EmployeeCameraScreen';
import EmployeeChatScreen from '../screens/EmployeeChatScreen';

import EmployeeProfileScreen from '../screens/EmployeeProfileScreen';

import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AdminTabNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Dashboard') {
            return <Home color={color} size={size} />;
          } else if (route.name === 'Logs') {
            return <ClipboardList color={color} size={size} />;
          } else if (route.name === 'Cars') {
            return <Car color={color} size={size} />;
          } else if (route.name === 'Employees') {
            return <Users color={color} size={size} />;
          } else if (route.name === 'Profile') {
            return <User color={color} size={size} />;
          }
        },
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
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Logs" component={ActivityLogsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Cars" component={CarLogsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Employees" component={EmployeeManageScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function EmployeeTabNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Dashboard') {
            return <Home color={color} size={size} />;
          } else if (route.name === 'Camera') {
            return <Camera color={color} size={size} />;
          } else if (route.name === 'Chat') {
            return <MessageSquare color={color} size={size} />;
          } else if (route.name === 'Profile') {
            return <User color={color} size={size} />;
          }
        },
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
      })}
    >
      <Tab.Screen name="Dashboard" component={EmployeeDashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Camera" component={EmployeeCameraScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Chat" component={EmployeeChatScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={EmployeeProfileScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator({ userRole }) {
  const { theme } = useTheme();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userRole === 'admin' ? (
          <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
        ) : (
          <Stack.Screen name="EmployeeTabs" component={EmployeeTabNavigator} />
        )}
        <Stack.Screen 
          name="CarDetails" 
          component={CarDetailsScreen} 
          options={{ 
            headerShown: true, 
            title: 'Car Details',
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.textMain,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: theme.bg },
          }}
        />
        <Stack.Screen
          name="CarPhotos"
          component={CarPhotosScreen}
          options={{
            headerShown: true,
            title: 'Car Photos',
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.textMain,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: theme.bg },
          }}
        />
        <Stack.Screen
          name="VehicleReports"
          component={VehicleReportsScreen}
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
