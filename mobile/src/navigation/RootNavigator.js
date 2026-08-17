import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, ClipboardList, User, Users, Car } from 'lucide-react-native';

import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import ActivityLogsScreen from '../screens/ActivityLogsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EmployeeManageScreen from '../screens/EmployeeManageScreen';
import CarLogsScreen from '../screens/CarLogsScreen';
import CarDetailsScreen from '../screens/CarDetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AdminTabNavigator() {
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
        tabBarInactiveTintColor: '#64748b',
        headerShown: true,
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Logs" component={ActivityLogsScreen} />
      <Tab.Screen name="Cars" component={CarLogsScreen} />
      <Tab.Screen name="Employees" component={EmployeeManageScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
        <Stack.Screen 
          name="CarDetails" 
          component={CarDetailsScreen} 
          options={{ headerShown: true, title: 'Car Details' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
