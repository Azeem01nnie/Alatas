import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Platform } from 'react-native';
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Send, Image as ImageIcon, MessageSquare } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function EmployeeChatScreen() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    tabBarHeight = 0;
  }
  const listBottomPad = useTabBarContentPadding(8);

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
            isMe ? [styles.messageBubbleMe, { backgroundColor: '#b32025' }] : [styles.messageBubbleAdmin, { backgroundColor: theme.card, borderColor: theme.border }]
          ]}
        >
          <Text style={[styles.messageText, { color: isMe ? '#fff' : theme.textMain }]}>{item.text}</Text>
          <Text style={[styles.messageTime, { color: isMe ? '#e0f2fe' : theme.textSub }]}>{item.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenLayout
      scroll={false}
      keyboard
      keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarHeight : 0}
      header={
        <ScreenHeader>
          <View style={styles.headerRow}>
            <View style={styles.adminAvatarSmall}>
              <Text style={styles.adminAvatarTextSmall}>A</Text>
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: theme.textMain }]}>Admin</Text>
              <Text style={[styles.headerSubtitle, { color: '#10b981' }]}>Online</Text>
            </View>
          </View>
        </ScreenHeader>
      }
    >
        <FlatList
          style={styles.flex}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad, flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <MessageSquare color={theme.textSub} size={40} strokeWidth={1.5} />
              <Text style={[styles.emptyTitle, { color: theme.textMain }]}>No messages yet</Text>
              <Text style={[styles.emptyDesc, { color: theme.textSub }]}>
                Team chat is not connected to the server yet. Messages you send stay on this device only.
              </Text>
            </View>
          }
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
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#b32025',
    justifyContent: 'center', alignItems: 'center', marginLeft: 12
  }
});
