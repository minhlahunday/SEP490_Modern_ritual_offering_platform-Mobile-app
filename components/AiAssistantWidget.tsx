import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react-native';

import { aiChatService, SuggestedPackage } from '../services/aiChatService';
import { getCurrentUser } from '../services/auth';
import toast from '../services/toast';

type UiMessage = {
  role: 'user' | 'bot';
  text: string;
  suggestedPackages?: SuggestedPackage[];
};

const BUBBLE_SIZE = 58;

export default function AiAssistantWidget() {
  const router = useRouter();
  const { width, height } = Dimensions.get('window');

  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const pan = useRef(new Animated.ValueXY({ x: width - 86, y: height - 230 })).current;
  const lastPos = useRef({ x: width - 86, y: height - 230 });

  const user = getCurrentUser();
  const canShow = useMemo(() => {
    const role = String((user as any)?.role || '').toLowerCase();
    const roles = Array.isArray((user as any)?.roles)
      ? (user as any).roles.map((r: any) => String(r).toLowerCase())
      : [];
    return role === 'customer' || roles.includes('customer');
  }, [user]);

  const clampPos = (x: number, y: number) => {
    const minX = 8;
    const maxX = Math.max(minX, width - BUBBLE_SIZE - 8);
    const minY = 90;
    const maxY = Math.max(minY, height - BUBBLE_SIZE - 100);
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        pan.setOffset(lastPos.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        pan.stopAnimation((value: any) => {
          const next = clampPos(value.x, value.y);
          lastPos.current = next;
          Animated.spring(pan, {
            toValue: next,
            useNativeDriver: false,
            bounciness: 6,
          }).start();
        });
      },
    })
  ).current;

  const closeAssistant = async () => {
    if (sessionId) {
      await aiChatService.closeSession(sessionId);
    }
    setIsOpen(false);
    setSessionId(null);
    setMessages([]);
    setInput('');
  };

  useEffect(() => {
    if (!isOpen || sessionId || isInitializing) return;

    if (!canShow) {
      setIsOpen(false);
      return;
    }

    const init = async () => {
      setIsInitializing(true);
      try {
        const session = await aiChatService.createSession();
        if (session?.sessionId) {
          setSessionId(session.sessionId);
        } else {
          throw new Error('Khong nhan duoc ID phien chat hop le');
        }
      } catch (error: any) {
        toast.error(error?.message || 'Khong the khoi tao phien chat AI');
        setIsOpen(false);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [isOpen, sessionId, isInitializing, canShow]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isLoading || isInitializing) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const result = await aiChatService.sendMessage(sessionId, userText);
      setMessages((prev) => [...prev, {
        role: 'bot',
        text: result.assistantText || 'Minh da nhan thong tin. Ban vui long cho biet them chi tiet de tu van chinh xac hon nhe.',
        suggestedPackages: result.suggestedPackages,
      }]);
    } catch (error: any) {
      setMessages((prev) => [...prev, {
        role: 'bot',
        text: 'Xin loi, toi dang gap loi ket noi. Ban vui long thu lai sau nhe!',
      }]);

      if (String(error?.message || '').includes('dang nhap')) {
        setSessionId(null);
        setIsOpen(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (text: string) => setInput(text);

  if (!canShow) return null;

  return (
    <>
      <Animated.View style={[styles.fabWrap, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]} {...panResponder.panHandlers}>
        <TouchableOpacity style={styles.fabBtn} onPress={() => setIsOpen(true)}>
          <MessageCircle size={26} color="#fff" />
          <View style={styles.pingDot} />
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={() => { void closeAssistant(); }}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView style={styles.panel} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.panelHeader}>
              <View style={styles.headerLeft}>
                <Sparkles size={16} color="#fff" />
                <View>
                  <Text style={styles.headerTitle}>Tro ly Ritual AI</Text>
                  <Text style={styles.headerSub}>Tu van nghiem tuc, goi y nhanh</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => { void closeAssistant(); }}>
                <X size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView ref={scrollRef} style={styles.messagesWrap} contentContainerStyle={styles.messagesContent}>
              {messages.length === 0 && !isInitializing && (
                <View style={styles.welcomeBox}>
                  <Text style={styles.welcomeText}>Chao ban, minh co the giup gi cho nghi le cua gia dinh minh?</Text>
                  <View style={styles.quickRow}>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickQuestion('Can chuan bi gi cho cung day thang?')}>
                      <Text style={styles.quickText}>Cung day thang</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickQuestion('Huong dat mam cung tan gia?')}>
                      <Text style={styles.quickText}>Cung tan gia</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {isInitializing && (
                <View style={styles.centerLoading}>
                  <ActivityIndicator color="#111827" />
                  <Text style={styles.loadingLabel}>Dang ket noi tro ly...</Text>
                </View>
              )}

              {messages.map((msg, index) => (
                <View key={`${msg.role}-${index}`} style={[styles.msgRow, msg.role === 'user' ? styles.msgRowUser : styles.msgRowBot]}>
                  <View style={[styles.msgBubble, msg.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleBot]}>
                    <Text style={[styles.msgText, msg.role === 'user' ? styles.msgTextUser : styles.msgTextBot]}>{msg.text}</Text>
                    {msg.role === 'bot' && Array.isArray(msg.suggestedPackages) && msg.suggestedPackages.length > 0 && (
                      <View style={styles.suggestWrap}>
                        <Text style={styles.suggestTitle}>Goi y mam cung</Text>
                        {msg.suggestedPackages.slice(0, 3).map((pkg) => (
                          <TouchableOpacity
                            key={pkg.packageId}
                            style={styles.suggestCard}
                            onPress={() => {
                              setIsOpen(false);
                              router.push(`/product/${pkg.packageId}` as any);
                            }}
                          >
                            <Text style={styles.suggestName} numberOfLines={1}>{pkg.packageName}</Text>
                            <Text style={styles.suggestDesc} numberOfLines={2}>{pkg.description}</Text>
                            <Text style={styles.suggestPrice}>Tu {Number(pkg.minVariantPrice || 0).toLocaleString('vi-VN')}d</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ))}

              {isLoading && (
                <View style={styles.msgRowBot}>
                  <View style={[styles.msgBubble, styles.msgBubbleBot]}>
                    <ActivityIndicator size="small" color="#6b7280" />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder={isInitializing ? 'Vui long cho...' : 'Hoi ve nghi le...'}
                placeholderTextColor="#94a3b8"
                editable={!isInitializing && !isLoading}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || isLoading || isInitializing) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!input.trim() || isLoading || isInitializing}
              >
                <Send size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    zIndex: 999,
    elevation: 20,
  },
  fabBtn: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  pingDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
    borderWidth: 1,
    borderColor: '#fff',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.26)',
    justifyContent: 'flex-end',
  },
  panel: {
    height: '74%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  panelHeader: {
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  headerSub: { color: '#cbd5e1', fontSize: 10, marginTop: 1 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },

  messagesWrap: { flex: 1, backgroundColor: '#f8fafc' },
  messagesContent: { padding: 12, gap: 10, paddingBottom: 18 },
  welcomeBox: { alignItems: 'center', gap: 8, paddingVertical: 10 },
  welcomeText: { fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  quickBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  quickText: { fontSize: 11, color: '#334155', fontWeight: '700' },
  centerLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, gap: 6 },
  loadingLabel: { fontSize: 11, color: '#94a3b8' },

  msgRow: { width: '100%' },
  msgRowUser: { alignItems: 'flex-end' },
  msgRowBot: { alignItems: 'flex-start' },
  msgBubble: { maxWidth: '88%', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  msgBubbleUser: { backgroundColor: '#111827', borderTopRightRadius: 4 },
  msgBubbleBot: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderTopLeftRadius: 4 },
  msgText: { fontSize: 13, lineHeight: 19 },
  msgTextUser: { color: '#fff' },
  msgTextBot: { color: '#0f172a' },

  suggestWrap: { marginTop: 8, gap: 6 },
  suggestTitle: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  suggestCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 8, backgroundColor: '#f8fafc' },
  suggestName: { fontSize: 12, fontWeight: '800', color: '#111827' },
  suggestDesc: { fontSize: 11, color: '#475569', marginTop: 2 },
  suggestPrice: { fontSize: 11, color: '#7c2d12', fontWeight: '800', marginTop: 4 },

  inputRow: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 13,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
});
