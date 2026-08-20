import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ImagePlus, Upload, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function EmployeeCameraScreen() {
  const { theme, isDark } = useTheme();
  const [imageCaptured, setImageCaptured] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [carDetails, setCarDetails] = useState('');
  
  const handleCapture = () => {
    // Mock capture
    setImageCaptured(true);
  };

  const handleRemoveImage = () => {
    setImageCaptured(false);
  };

  const handleSubmit = () => {
    if (!imageCaptured) {
      Alert.alert('Error', 'Please capture an image first.');
      return;
    }
    Alert.alert('Success', 'Image and details submitted for admin approval!', [
      { 
        text: 'OK', 
        onPress: () => {
          setImageCaptured(false);
          setRemarks('');
          setCarDetails('');
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Capture Car Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Photo Capture</Text>
        
        {imageCaptured ? (
          <View style={[styles.imageContainer, { borderColor: theme.border }]}>
            <Image 
              source={{ uri: 'https://via.placeholder.com/600x400.png?text=Captured+Car+Part' }} 
              style={styles.capturedImage} 
            />
            <TouchableOpacity style={styles.removeImageBtn} onPress={handleRemoveImage}>
              <X color="#fff" size={20} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.captureBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
              <Camera color={theme.textSub} size={48} />
              <Text style={[styles.captureText, { color: theme.textSub }]}>Tap to Open Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleCapture}>
              <ImagePlus color={theme.textSub} size={20} />
              <Text style={[styles.uploadText, { color: theme.textSub }]}>Or Upload from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.textMain, marginTop: 24 }]}>Car Details & Remarks</Text>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textMain }]}>Car Identifier (e.g. Plate # or Model)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.textMain, borderColor: theme.border }]}
            placeholder="Enter car details"
            placeholderTextColor={theme.textSub}
            value={carDetails}
            onChangeText={setCarDetails}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textMain }]}>Remarks / Inspector Notes</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.card, color: theme.textMain, borderColor: theme.border }]}
            placeholder="Add observations, defects, or general remarks..."
            placeholderTextColor={theme.textSub}
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, (!imageCaptured) && { opacity: 0.5 }]} 
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Upload color="#fff" size={20} style={{ marginRight: 8 }} />
          <Text style={styles.submitButtonText}>Submit for Approval</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingTop: 40, paddingBottom: 15,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  captureBox: {
    height: 250, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', padding: 20
  },
  captureBtn: { alignItems: 'center', marginBottom: 20 },
  captureText: { marginTop: 12, fontSize: 16, fontWeight: '500' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  uploadText: { marginLeft: 8, fontSize: 14, fontWeight: '500' },
  imageContainer: {
    height: 250, borderRadius: 12, borderWidth: 1, overflow: 'hidden', position: 'relative'
  },
  capturedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: {
    position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20, padding: 6
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: {
    height: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, fontSize: 15
  },
  textArea: {
    minHeight: 100, borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15
  },
  submitButton: {
    flexDirection: 'row', backgroundColor: '#3b82f6', height: 50, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginTop: 12
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
