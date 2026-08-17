import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useState } from 'react';
import AdminLogin from './components/AdminLogin';

import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (isLoggedIn) {
    return <RootNavigator />;
  }

  return (
    <View style={styles.container}>
      <AdminLogin onSuccess={() => setIsLoggedIn(true)} />
      <StatusBar style="auto" />
    </View>
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
