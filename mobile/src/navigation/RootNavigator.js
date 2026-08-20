import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, ClipboardList, User, Users, Car, Camera, MessageSquare } from 'lucide-react-native';

import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import ActivityLogsScreen from '../screens/ActivityLogsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EmployeeManageScreen from '../screens/EmployeeManageScreen';
import CarLogsScreen from '../screens/CarLogsScreen';
import CarDetailsScreen from '../screens/CarDetailsScreen';

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
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: theme.textSub,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
        },
        headerShown: true,
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
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: theme.textSub,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
        },
        headerShown: true,
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
            headerTitleStyle: { fontWeight: '700' }
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
