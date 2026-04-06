import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send, MessageCircle, Search } from 'lucide-react-native';

import { ChatMessage, ChatSession, vendorChatService } from '../../services/vendorChatService';
import { vendorService } from '../../services/vendorService';
import { getCurrentUser } from '../../services/auth';
import toast from '../../services/toast';

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vendorId?: string; packageId?: string; sessionId?: string }>();

  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorMetaMap, setVendorMetaMap] = useState<Record<string, { name: string; avatar?: string }>>({});

  const pollRef = useRef<any>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const vendorIdParam = String(params.vendorId || '').trim();
  const sessionIdParam = String(params.sessionId || '').trim();
  const packageIdParam = Number(String(params.packageId || '').trim());
  const isVendorLocked = vendorIdParam.length > 0;

  const activeVendorId = String(activeSession?.vendorId || '').trim();
  const activeVendorName = activeVendorId
    ? (vendorMetaMap[activeVendorId]?.name || `Cua hang #${activeVendorId.slice(-4) || '...'}`)
    : 'Tin nhắn';
  const activeVendorAvatar = activeVendorId ? String(vendorMetaMap[activeVendorId]?.avatar || '').trim() : '';

  const filteredSessions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return sessions;

    return sessions.filter((session) => {
      const vendorId = String(session.vendorId || '').trim();
      const name = String(vendorMetaMap[vendorId]?.name || `Shop #${vendorId.slice(-4)}`).toLowerCase();
      const lastMsg = String(session.messages?.[session.messages.length - 1]?.content || '').toLowerCase();
      return name.includes(keyword) || lastMsg.includes(keyword);
    });
  }, [sessions, searchQuery, vendorMetaMap]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return ta - tb;
    });
  }, [messages]);

  const loadVendorMeta = async (sessionList: ChatSession[]) => {
    const ids = Array.from(new Set(sessionList.map((s) => String(s.vendorId || '').trim()).filter(Boolean)));
    const nextMap: Record<string, { name: string; avatar?: string }> = {};

    sessionList.forEach((session) => {
      const id = String(session.vendorId || '').trim();
      if (!id) return;

      const sessionName = String(session.counterPartyName || '').trim();
      const sessionAvatar = String(session.counterPartyAvatar || '').trim();
      nextMap[id] = {
        name: sessionName || `Cua hang #${id.slice(-4)}`,
        avatar: sessionAvatar || undefined,
      };
    });

    await Promise.all(ids.map(async (id) => {
      try {
        const vendor = await vendorService.getVendorCached(id);
        const current = nextMap[id] || { name: `Cua hang #${id.slice(-4)}` };
        const vendorName = String(vendor?.shopName || '').trim();
        const vendorAvatar = String(vendor?.shopAvatarUrl || vendor?.avatarUrl || '').trim();
        nextMap[id] = {
          name: vendorName || current.name,
          avatar: vendorAvatar || current.avatar,
        };
      } catch {
        if (!nextMap[id]) {
          nextMap[id] = { name: `Cua hang #${id.slice(-4)}` };
        }
      }
    }));

    setVendorMetaMap((prev) => ({ ...prev, ...nextMap }));
  };

  const applySession = async (sessionId: string) => {
    setLoadingMessages(true);
    try {
      const details = await vendorChatService.getSessionDetails(sessionId);
      setActiveSession(details);
      setMessages(Array.isArray(details.messages) ? details.messages : []);
      vendorChatService.markAsRead(details.sessionId).catch(() => null);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải cuộc trò chuyện');
    } finally {
      setLoadingMessages(false);
    }
  };

  const bootstrap = async () => {
    const user = getCurrentUser();
    if (!user) {
      toast.warning('Vui lòng đăng nhập để sử dụng tính năng này');
      router.replace('/login' as any);
      return;
    }

    setLoading(true);
    try {
      let sessionList = await vendorChatService.getSessions('customer');

      let nextSessionId = '';

      if (sessionIdParam) {
        nextSessionId = sessionIdParam;
      } else if (vendorIdParam) {
        const existed = sessionList.find((s) => String(s.vendorId || '').trim() === vendorIdParam);
        if (existed?.sessionId) {
          nextSessionId = existed.sessionId;
          sessionList = [existed];
        } else {
          const createdId = await vendorChatService.createSession(
            vendorIdParam,
            Number.isInteger(packageIdParam) && packageIdParam > 0 ? packageIdParam : undefined,
          );
          nextSessionId = createdId;
          const refreshed = await vendorChatService.getSessions('customer');
          const createdSession = refreshed.find((s) => s.sessionId === createdId);
          sessionList = createdSession ? [createdSession] : [];
        }
      } else if (sessionList.length > 0) {
        nextSessionId = '';
      }

      if (isVendorLocked) {
        sessionList = sessionList.filter((s) => String(s.vendorId || '').trim() === vendorIdParam);
      }

      setSessions(sessionList);
      loadVendorMeta(sessionList).catch(() => null);

      if (nextSessionId) {
        await applySession(nextSessionId);
      } else {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Khong the khoi tao chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorIdParam, sessionIdParam]);

  useEffect(() => {
    if (!activeSession?.sessionId) return;

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const details = await vendorChatService.getSessionDetails(activeSession.sessionId);
        setMessages(Array.isArray(details.messages) ? details.messages : []);
      } catch {
        // silent polling
      }
    }, 4000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeSession?.sessionId]);

  useEffect(() => {
    if (sortedMessages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [sortedMessages.length]);

  const handleSend = async () => {
    if (!activeSession?.sessionId || !newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      const sent = await vendorChatService.sendMessage(activeSession.sessionId, content);
      if (sent) {
        setMessages((prev) => [...prev, sent]);
        setSessions((prev) => prev.map((session) => (
          session.sessionId === activeSession.sessionId
            ? {
                ...session,
                lastActiveAt: sent.timestamp,
                messages: [...(session.messages || []), sent],
              }
            : session
        )));
      }
    } catch (error: any) {
      toast.error(error?.message || 'Không thể gửi tin nhắn');
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = String(item.role || '').toLowerCase() === 'customer';
    const timeText = item.timestamp
      ? new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
        <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
          <Text style={[styles.msgText, isMine ? styles.msgTextMine : styles.msgTextOther]}>{item.content}</Text>
        </View>
        <Text style={[styles.msgTime, isMine ? styles.msgTimeMine : styles.msgTimeOther]}>{timeText}</Text>
      </View>
    );
  };

  const renderSessionItem = ({ item }: { item: ChatSession }) => {
    const vendorId = String(item.vendorId || '').trim();
    const name = vendorMetaMap[vendorId]?.name || `Shop #${vendorId.slice(-4) || '...'}`;
    const avatar = String(vendorMetaMap[vendorId]?.avatar || '').trim();
    const lastMsg = item.messages?.[item.messages.length - 1];
    const timeText = lastMsg?.timestamp
      ? new Date(lastMsg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : '';
    const preview = String(lastMsg?.content || 'Chưa có tin nhắn');

    return (
      <TouchableOpacity style={styles.sessionRow} onPress={() => applySession(item.sessionId)}>
        <View style={styles.sessionAvatar}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.sessionAvatarImage} />
          ) : (
            <Text style={styles.sessionAvatarText}>{name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.sessionMeta}>
          <Text style={styles.sessionName} numberOfLines={1}>{name}</Text>
          <Text style={styles.sessionPreview} numberOfLines={1}>{preview}</Text>
        </View>
        <Text style={styles.sessionTime}>{timeText}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerWrap}>
        <ActivityIndicator size="large" color="#0f172a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (activeSession && !isVendorLocked) {
              setActiveSession(null);
              setMessages([]);
              return;
            }
            router.back();
          }}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          {activeSession ? (
            <View style={styles.headerActiveWrap}>
              <View style={styles.headerActiveAvatar}>
                {activeVendorAvatar ? (
                  <Image source={{ uri: activeVendorAvatar }} style={styles.headerActiveAvatarImage} />
                ) : (
                  <Text style={styles.headerActiveAvatarText}>{activeVendorName.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.headerActiveMeta}>
                <Text style={styles.headerTitle} numberOfLines={1}>{activeVendorName}</Text>
                <Text style={styles.headerSub}>Hỗ trợ khách hàng</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.headerTitle} numberOfLines={1}>Tin nhắn</Text>
              <Text style={styles.headerSub}>Quản lý trò chuyện</Text>
            </>
          )}
        </View>
      </View>

      {activeSession ? (
        <KeyboardAvoidingView style={styles.chatWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {loadingMessages ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="small" color="#0f172a" />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={sortedMessages}
              keyExtractor={(item, index) => `${item.messageId || index}`}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.listWrap}>
          <View style={styles.searchWrap}>
            <Search size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm cuộc trò chuyện..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#94a3b8"
            />
          </View>

          {filteredSessions.length > 0 ? (
            <FlatList
              data={filteredSessions}
              keyExtractor={(item) => item.sessionId}
              renderItem={renderSessionItem}
              contentContainerStyle={styles.sessionsList}
              ItemSeparatorComponent={() => <View style={styles.sessionDivider} />}
            />
          ) : (
            <View style={styles.emptyWrap}>
              <MessageCircle size={46} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Chua co cuoc tro chuyen</Text>
              <Text style={styles.emptySub}>Hay mo chat voi cua hang de duoc tu van nhanh hon.</Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1 },
  headerActiveWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerActiveAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActiveAvatarImage: { width: '100%', height: '100%' },
  headerActiveAvatarText: { fontSize: 14, fontWeight: '800', color: '#334155' },
  headerActiveMeta: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  listWrap: { flex: 1 },
  searchWrap: {
    margin: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 0,
  },
  sessionsList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  sessionDivider: { height: 8 },
  sessionAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionAvatarImage: { width: '100%', height: '100%' },
  sessionAvatarText: { fontSize: 16, fontWeight: '800', color: '#334155' },
  sessionMeta: { flex: 1, minWidth: 0 },
  sessionName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  sessionPreview: { marginTop: 2, fontSize: 12, color: '#64748b' },
  sessionTime: { fontSize: 11, color: '#94a3b8', marginLeft: 6 },

  chatWrap: { flex: 1 },
  messagesList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14, gap: 8 },
  msgRow: { maxWidth: '82%' },
  msgRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgRowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  msgBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  msgBubbleMine: { backgroundColor: '#0f172a', borderBottomRightRadius: 6 },
  msgBubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderBottomLeftRadius: 6 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  msgTextOther: { color: '#0f172a' },
  msgTime: { fontSize: 10, marginTop: 4 },
  msgTimeMine: { color: '#64748b' },
  msgTimeOther: { color: '#94a3b8' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 14,
    backgroundColor: '#f8fafc',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 10 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
