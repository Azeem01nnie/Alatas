import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';

import { Eye, EyeOff } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const AUTH_KEY = 'customer-encoder-admin-auth';
const ADMIN_USER = 'alatas';
const ADMIN_PASS = 'Alatas@2026';

export default function AdminLogin({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    setError('');
    setLoading(true);

    // Seed the database with demo credentials if it doesn't exist (simulated connection)
    try {
      const usersCollection = database.collections.get('users');
      const existingUsers = await usersCollection.query(Q.where('username', ADMIN_USER)).fetch();
      
      if (existingUsers.length === 0) {
        await database.write(async () => {
          await usersCollection.create(user => {
            user.username = ADMIN_USER;
            user.password = ADMIN_PASS;
          });
        });
      }

      // Check credentials against the database
      const userRecords = await usersCollection.query(
        Q.where('username', username.trim()),
        Q.where('password', password)
      ).fetch();

      setTimeout(() => {
        if (username.trim() === 'employee' && password === 'employee') {
          onSuccess('employee');
        } else if (userRecords.length > 0 || (username.trim() === ADMIN_USER && password === ADMIN_PASS)) {
          onSuccess('admin');
        } else {
          setError('Invalid username or password.');
          setLoading(false);
        }
      }, 900);
    } catch (err) {
      console.warn("DB Auth error, fallback to static:", err);
      setTimeout(() => {
        if (username.trim() === 'employee' && password === 'employee') {
          onSuccess('employee');
        } else if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
          onSuccess('admin');
        } else {
          setError('Invalid username or password.');
          setLoading(false);
        }
      }, 900);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.brand}>
          <View style={styles.seatbeltRail}>
            <View style={styles.seatbeltTexture} />
          </View>
          <View style={styles.logoPlate}>
            <Image source={require('../assets/logonobg.png')} style={styles.logoImage} resizeMode="contain" />
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Sign in to manage the fleet dashboard.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>Signing you in…</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setError('');
                }}
                autoCapitalize="none"
                autoComplete="username"
                editable={!loading}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError('');
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff color="#666" size={20} /> : <Eye color="#666" size={20} />}
                </TouchableOpacity>
              </View>
            </View>

            {!!error && <Text style={styles.errorMsg}>{error}</Text>}

            <TouchableOpacity 
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
      }
    }),
  },
  brand: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  seatbeltRail: {
    width: '120%',
    height: 28,
    backgroundColor: '#1c1c1c',
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    transform: [{ rotate: '-2deg' }],
  },
  seatbeltTexture: {
    width: '100%',
    height: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    opacity: 0.5,
  },
  logoPlate: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  logoImage: {
    width: 140,
    height: 40,
  },
  copy: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#444',
  },
  form: {
    width: '100%',
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fdfdfd',
    color: '#000',
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  passwordToggle: {
    position: 'absolute',
    right: 0,
    height: '100%',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  errorMsg: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  submitButton: {
    height: 48,
    backgroundColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
