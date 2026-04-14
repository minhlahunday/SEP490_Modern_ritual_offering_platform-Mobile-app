import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Bell, ChevronLeft, CheckCheck, Circle } from 'lucide-react-native';
import {
  fetchNotifications,
  markAllNotificationsAsReadApi,
  markNotificationAsRead,
  NotificationItem,
} from '@/services/notificationService';
import toast from '@/services/toast';

export default function NotificationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  const loadNotifications = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const result = await fetchNotifications(1, 50);
      setItems(result.items || []);
    } catch (error: any) {
      toast.error(error?.message || 'Khong the tai thong bao');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications(false);
  };

  const extractOrderIdFromText = (value: string): string | null => {
    const input = String(value || '').trim();
    if (!input) return null;

    const byPath = input.match(/\/order-details\/([^/?#]+)/i)
      || input.match(/\/orders\/([^/?#]+)/i)
      || input.match(/\/order\/([^/?#]+)/i);
    if (byPath?.[1]) return decodeURIComponent(byPath[1]);

    const byQuery = input.match(/[?&](orderId|id)=([^&#]+)/i);
    if (byQuery?.[2]) return decodeURIComponent(byQuery[2]);

    return null;
  };

  const resolveNotificationRoute = (item: NotificationItem): { path: string; params?: Record<string, string> } | null => {
    const redirect = String(item.redirectUrl || '').trim();
    const target = String(item.target || '').trim();
    const type = String(item.type || '').toLowerCase();
    const content = `${redirect} ${target} ${item.message || ''} ${item.title || ''}`.toLowerCase();

    if (redirect) {
      try {
        const asUrl = new URL(redirect.startsWith('http') ? redirect : `https://local${redirect.startsWith('/') ? redirect : `/${redirect}`}`);
        const path = asUrl.pathname.toLowerCase();

        const idFromUrl = asUrl.searchParams.get('orderId')
          || asUrl.searchParams.get('id')
          || extractOrderIdFromText(path);

        if (path.includes('/order-details') && idFromUrl) {
          return { path: '/order-details/[id]', params: { id: String(idFromUrl) } };
        }

        if (path.includes('/order-details')) {
          return { path: '/orders' };
        }

        if (path.includes('/orders')) {
          if (idFromUrl) {
            return { path: '/order-details/[id]', params: { id: String(idFromUrl) } };
          }
          return { path: '/orders' };
        }

        if (path.includes('/wallet/history') || path.includes('/transactions')) {
          return { path: '/wallet/history' };
        }

        if (path.includes('/notifications')) {
          return { path: '/notifications' };
        }

        if (path.includes('/profile')) {
          return { path: '/(tabs)/profile' };
        }

        if (path.includes('/cart')) {
          return { path: '/(tabs)/cart' };
        }

        if (path.includes('/checkout')) {
          return { path: '/checkout' };
        }

        if (path.includes('/explore') || path.includes('/product')) {
          return { path: '/(tabs)/explore' };
        }
      } catch {
        const idFromRaw = extractOrderIdFromText(redirect);
        if (idFromRaw) {
          return { path: '/order-details/[id]', params: { id: String(idFromRaw) } };
        }
      }
    }

    const fallbackOrderId = extractOrderIdFromText(target) || extractOrderIdFromText(item.message || '');
    if (fallbackOrderId) {
      return { path: '/order-details/[id]', params: { id: String(fallbackOrderId) } };
    }

    if (content.includes('giao hang') || content.includes('don hang') || type.includes('order') || type.includes('delivery')) {
      return { path: '/orders' };
    }

    if (content.includes('thanh toan') || content.includes('giao dich') || content.includes('hoan tien') || type.includes('wallet') || type.includes('payment')) {
      return { path: '/wallet/history' };
    }

    return null;
  };

  const logNotificationNavigation = (item: NotificationItem, destination: { path: string; params?: Record<string, string> } | null, phase: 'resolved' | 'navigated' | 'failed', errorMessage?: string) => {
    if (!__DEV__) return;

    console.log('[Notifications] Navigation', {
      phase,
      notificationId: item.notificationId,
      type: item.type,
      target: item.target,
      redirectUrl: item.redirectUrl,
      destination,
      errorMessage: errorMessage || null,
    });
  };

  const handlePressNotification = async (item: NotificationItem) => {
    if (!item.isRead) {
      const ok = await markNotificationAsRead(item.notificationId);
      if (ok) {
        setItems((prev) =>
          prev.map((it) =>
            String(it.notificationId) === String(item.notificationId)
              ? { ...it, isRead: true }
              : it
          )
        );
      }
    }

    const destination = resolveNotificationRoute(item);
    logNotificationNavigation(item, destination, 'resolved');
    if (!destination) return;

    try {
      if (destination.params && destination.params.id) {
        router.push({ pathname: '/order-details/[id]', params: { id: destination.params.id } } as any);
      } else {
        router.push(destination.path as any);
      }
      logNotificationNavigation(item, destination, 'navigated');
    } catch (error: any) {
      logNotificationNavigation(item, destination, 'failed', error?.message || 'unknown');
      toast.info('Khong mo duoc trang tuong ung tu thong bao nay');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    try {
      setMarkingAll(true);
      const ok = await markAllNotificationsAsReadApi();
      if (!ok) {
        toast.error('Khong the danh dau da doc tat ca');
        return;
      }

      setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
      toast.success('Da danh dau da doc tat ca');
    } catch {
      toast.error('Khong the danh dau da doc tat ca');
    } finally {
      setMarkingAll(false);
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    return (
      <TouchableOpacity
        style={[styles.itemCard, !item.isRead && styles.itemCardUnread]}
        onPress={() => handlePressNotification(item)}
      >
        <View style={styles.itemHeaderRow}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title || 'Thong bao'}
          </Text>
          {!item.isRead && <Circle size={10} color="#2563eb" fill="#2563eb" />}
        </View>

        <Text style={styles.itemMessage}>{item.message || ''}</Text>
        <Text style={styles.itemTime}>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Thong bao</Text>
          <Text style={styles.headerSubTitle}>{unreadCount} chua doc</Text>
        </View>

        <TouchableOpacity
          style={[styles.markAllBtn, (markingAll || unreadCount === 0) && styles.markAllBtnDisabled]}
          disabled={markingAll || unreadCount === 0}
          onPress={handleMarkAllAsRead}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <>
              <CheckCheck size={16} color="#111827" />
              <Text style={styles.markAllText}>Doc het</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.loadingText}>Dang tai thong bao...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Bell size={44} color="#94a3b8" />
          <Text style={styles.emptyTitle}>Chua co thong bao nao</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${item.notificationId}-${index}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubTitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  markAllBtnDisabled: {
    opacity: 0.5,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyTitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
  itemCard: {
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  itemCardUnread: {
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  itemMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    marginBottom: 8,
  },
  itemTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
