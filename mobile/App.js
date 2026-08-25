import { StatusBar } from 'expo-status-bar';

import { StyleSheet, View, LogBox } from 'react-native';

import { useEffect } from 'react';

import { DeviceEventEmitter } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import AdminLogin from './components/AdminLogin';



import RootNavigator from './src/navigation/RootNavigator';

import { ThemeProvider } from './src/context/ThemeContext';

import { FleetProvider } from './src/context/FleetContext';

import { AuthProvider, useAuth } from './src/context/AuthContext';



LogBox.ignoreLogs([

  'setLayoutAnimationEnabledExperimental is currently a no-op',

  'SafeAreaView has been deprecated'

]);



function AppShell() {

  const { isLoggedIn, user, logout } = useAuth();



  useEffect(() => {

    const sub = DeviceEventEmitter.addListener('logout', () => {

      logout();

    });

    return () => sub.remove();

  }, [logout]);



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

  );

}



export default function App() {

  return (

    <SafeAreaProvider>

      <AuthProvider>

        <AppShell />

      </AuthProvider>

    </SafeAreaProvider>

  );

}



const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: '#fafafa',

  },

});


