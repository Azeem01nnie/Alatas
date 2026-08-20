import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, LogBox } from 'react-native';
import { useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AdminLogin from './components/AdminLogin';

import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/context/ThemeContext';

LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental is currently a no-op',
  'SafeAreaView has been deprecated'
]);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('logout', () => {
      setIsLoggedIn(false);
      setUserRole(null);
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider>
      {isLoggedIn ? (
        <RootNavigator userRole={userRole} />
      ) : (
        <View style={styles.container}>
          <AdminLogin onSuccess={(role) => {
            setUserRole(role);
            setIsLoggedIn(true);
          }} />
          <StatusBar style="auto" />
        </View>
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  successText: {
    marginTop: 100,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  }
});
