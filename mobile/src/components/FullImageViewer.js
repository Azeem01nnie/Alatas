import React from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Text,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { X } from 'lucide-react-native';

/**
 * Fullscreen photo viewer — tap a thumbnail, then tap X or the dimmed area to close.
 */
export default function FullImageViewer({ visible, uri, title, onClose }) {
  if (!uri) return null;

  return (
    <Modal
      visible={Boolean(visible)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
          <View style={styles.header} pointerEvents="box-none">
            <Text style={styles.title} numberOfLines={1}>
              {title || 'Photo'}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
              <X color="#fff" size={22} />
            </TouchableOpacity>
          </View>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          <Text style={styles.hint}>Tap outside or × to close</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  backdrop: { flex: 1, justifyContent: 'center' },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    padding: 8,
  },
  image: {
    width: '100%',
    height: '78%',
    alignSelf: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '500',
  },
});
