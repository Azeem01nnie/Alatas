import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import ScreenLayout, { ScreenHeader, useTabBarContentPadding } from '../components/ScreenLayout';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Send, MessageSquare } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../hooks/useConnectivity';
import { fetchChatMessages, sendChatMessage } from '../api/chat';
import { formatApiError } from '../api/client';
import { ACCENT } from '../theme/colors';

const POLL_MS = 4000;

export default function EmployeeChatScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { online } = useConnectivity();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    tabBarHeight = 0;
  }
  const listBottomPad = useTabBarContentPadding(8);

  const threadId = useMemo(() => {
    const key = user?.username?.trim() || user?.displayName?.trim() || 'employee';
    return key.toLowerCase();
  }, [user?.username, user?.displayName]);

  const senderName = user?.displayName?.trim() || user?.username?.trim() || 'Employee';
  const senderUsername = user?.username?.trim() || threadId;

  const mergeMessages = useCallback((incoming) => {
    setMessages((prev) => {
      const byId = new Map();
      [...prev, ...(Array.isArray(incoming) ? incoming : [])].forEach((msg) => {
        if (msg?.id) byId.set(String(msg.id), msg);
      });
      return [...byId.values()].sort((a, b) =>
        String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
      );
    });
  }, []);

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const rows = await fetchChatMessages({ threadId, limit: 200 });
      mergeMessages(rows);
    } catch (err) {
      if (!silent) {
        Alert.alert('Chat unavailable', formatApiError(err, 'chat'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [threadId, mergeMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!online) return undefined;
    const timer = setInterval(() => {
      loadMessages({ silent: true });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [online, loadMessages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const created = await sendChatMessage({
        threadId,
        senderRole: 'employee',
        senderName,
        senderUsername,
        text,
      });
      mergeMessages([created]);
      setInputText('');
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    } catch (err) {
      Alert.alert('Send failed', formatApiError(err, 'chat'));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderRole === 'employee';
    const time = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

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
            isMe
              ? [styles.messageBubbleMe, { backgroundColor: ACCENT }]
              : [styles.messageBubbleAdmin, { backgroundColor: theme.card, borderColor: theme.border }],
          ]}
        >
          {!isMe ? (
            <Text style={[styles.senderLabel, { color: theme.textSub }]}>
              {item.senderName || 'Admin'}
            </Text>
          ) : null}
          <Text style={[styles.messageText, { color: isMe ? '#fff' : theme.textMain }]}>{item.text}</Text>
          <Text style={[styles.messageTime, { color: isMe ? '#fecaca' : theme.textSub }]}>{time}</Text>
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
              <Text style={[styles.headerSubtitle, { color: online ? '#10b981' : theme.textSub }]}>
                {online ? 'Connected' : 'Offline — messages need connection'}
              </Text>
            </View>
          </View>
        </ScreenHeader>
      }
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad, flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <MessageSquare color={theme.textSub} size={40} strokeWidth={1.5} />
              <Text style={[styles.emptyTitle, { color: theme.textMain }]}>No messages yet</Text>
              <Text style={[styles.emptyDesc, { color: theme.textSub }]}>
                Message the desk admin. Replies show up here automatically.
              </Text>
            </View>
          }
        />
      )}

      <View style={[styles.inputContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.bg, color: theme.textMain, borderColor: theme.border }]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textSub}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || sending) && { opacity: 0.5 }]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={20} />}
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminAvatarTextSmall: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, fontWeight: '500' },
  listContent: { padding: 16 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  messageRow: { flexDirection: 'row', marginBottom: 16 },
  messageRowMe: { justifyContent: 'flex-end' },
  messageRowAdmin: { justifyContent: 'flex-start' },
  adminAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 'auto',
  },
  adminAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  messageBubble: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  messageBubbleMe: { borderBottomRightRadius: 4 },
  messageBubbleAdmin: { borderBottomLeftRadius: 4, borderWidth: 1 },
  senderLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTime: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
