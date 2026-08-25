import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function pickProfilePhoto(useCamera = false) {
  const permission = useCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert('Permission needed', useCamera ? 'Camera access is required.' : 'Photo library access is required.');
    return null;
  }

  const result = useCamera
    ? await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })
    : await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}
