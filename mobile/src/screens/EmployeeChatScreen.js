import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const mockMessages = [
  { id: '1', text: 'Hello, please check the new Toyota Corolla today.', sender: 'admin', time: '09:00 AM' },
  { id: '2', text: 'Will do, boss. Heading to the yard now.', sender: 'employee', time: '09:15 AM' },
  { id: '3', text: 'Make sure to capture the interior clearly, particularly the dashboard.', sender: 'admin', time: '09:20 AM' },
];

export default function EmployeeChatScreen() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState(mockMessages);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      const newMessage = {
        id: Date.now().toString(),
        text: inputText.trim(),
        sender: 'employee',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...messages, newMessage]);
      setInputText('');
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender === 'employee';
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowAdmin]}>
        {!isMe && (
          <View style={styles.adminAvatar}>
            <Text style={styles.adminAvatarText}>A</Text>
          </View>
        )}
        <View 
          style={[
            styles.messageBubble, 
            isMe ? [styles.messageBubbleMe, { backgroundColor: '#3b82f6' }] : [styles.messageBubbleAdmin, { backgroundColor: theme.card, borderColor: theme.border }]
          ]}
        >
          <Text style={[styles.messageText, { color: isMe ? '#fff' : theme.textMain }]}>{item.text}</Text>
          <Text style={[styles.messageTime, { color: isMe ? '#e0f2fe' : theme.textSub }]}>{item.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.adminAvatarSmall}>
          <Text style={styles.adminAvatarTextSmall}>A</Text>
        </View>
        <View>
          <Text style={[styles.headerTitle, { color: theme.textMain }]}>Admin</Text>
          <Text style={[styles.headerSubtitle, { color: '#10b981' }]}>Online</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TouchableOpacity style={styles.attachBtn}>
            <ImageIcon color={theme.textSub} size={24} />
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.bg, color: theme.textMain, borderColor: theme.border }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSub}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} 
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Send color="#fff" size={20} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 15,
    borderBottomWidth: 1,
  },
  adminAvatarSmall: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b',
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  adminAvatarTextSmall: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, fontWeight: '500' },
  listContent: { padding: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 16 },
  messageRowMe: { justifyContent: 'flex-end' },
  messageRowAdmin: { justifyContent: 'flex-start' },
  adminAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e293b',
    justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 'auto'
  },
  adminAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  messageBubble: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  messageBubbleMe: { borderBottomRightRadius: 4 },
  messageBubbleAdmin: { borderBottomLeftRadius: 4, borderWidth: 1 },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTime: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1,
  },
  attachBtn: { padding: 8, marginRight: 4 },
  textInput: {
    flex: 1, minHeight: 40, maxHeight: 100, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center', marginLeft: 12
  }
});
