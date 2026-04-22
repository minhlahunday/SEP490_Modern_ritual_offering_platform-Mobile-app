import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  Package, 
  Clock, 
  ChevronRight, 
  Store,
  AlertCircle,
  Calendar
} from 'lucide-react-native';
import { orderService, Order } from '../../services/orderService';
import toast from '../../services/toast';
import CancelOrderModal from '../../components/CancelOrderModal';
import RefundModal from '../../components/RefundModal';

const TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'PAID', label: 'Đang xử lý' },
  { id: 'DELIVERING', label: 'Đang giao' },
  { id: 'DELIVERED', label: 'Đã giao' },
  { id: 'COMPLETED', label: 'Đã hoàn thành' },
  { id: 'REFUND', label: 'Trả hàng/Hoàn tiền' },
  { id: 'CANCELLED', label: 'Đã hủy' }
];

export default function MyOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState<string | null>(null);
  const [refundTargetOrder, setRefundTargetOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    try {
      const data = await orderService.getMyOrders();
      const sorted = (data || []).sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setOrders(sorted);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleCancelOrder = (orderId: string) => {
    setCancelTargetOrderId(orderId);
  };

  const handleConfirmCancelOrder = async (reason: string) => {
    if (!cancelTargetOrderId) return;

    setCancellingId(cancelTargetOrderId);
    try {
      await orderService.cancelOrder(cancelTargetOrderId, reason);
      toast.success('Hủy đơn hàng thành công');
      setCancelTargetOrderId(null);
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || 'Hủy đơn hàng thất bại');
    } finally {
      setCancellingId(null);
    }
  };

  const toNumber = (...values: any[]) => {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const raw = value.trim();
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) return parsed;

        const cleaned = raw.replace(/\s|₫|đ|vnd|VND|\+/g, '');
        if (/^-?\d{1,3}([.,]\d{3})+$/.test(cleaned)) {
          const grouped = Number(cleaned.replace(/[.,]/g, ''));
          if (Number.isFinite(grouped)) return grouped;
        }

        const fallbackNumeric = Number(
          cleaned
            .replace(/[^0-9,.-]/g, '')
            .replace(/[.,](?=\d{3}(\D|$))/g, '')
            .replace(',', '.')
        );
        if (Number.isFinite(fallbackNumeric)) return fallbackNumeric;
      }
    }
    return 0;
  };

  const getItemBaseTotal = (item: any) => {
    const qty = toNumber(item?.quantity, 1) || 1;
    const unit = toNumber(item?.price, item?.unitPrice, item?.variantPrice, item?.retailPrice, item?.basePrice);
    const lineTotal = toNumber(item?.lineTotal, item?.totalAmount, item?.finalAmount, item?.subTotal);
    const swapSubTotal = toNumber(item?.swapSubTotal, item?.swapsSubTotal, item?.swapTotal, item?.totalSwapAmount);
    const addOnSubTotal = toNumber(item?.addOnSubTotal, item?.addOnsSubTotal, item?.addOnTotal, item?.totalAddOnAmount);
    return toNumber(
      item?.variantSubTotal,
      item?.variantTotal,
      item?.baseSubTotal,
      item?.baseTotal,
      lineTotal > 0 ? Math.max(0, lineTotal - swapSubTotal - addOnSubTotal) : 0,
      unit * qty
    );
  };

  const getItemTotal = (item: any) => {
    const qty = toNumber(item?.quantity, 1) || 1;
    const unit = toNumber(item?.price, item?.unitPrice, item?.variantPrice);
    return toNumber(
      item?.lineTotal,
      item?.totalAmount,
      item?.finalAmount,
      item?.subTotal,
      item?.variantSubTotal,
      unit * qty
    );
  };

  const getOrderTotal = (order: any) => {
    return toNumber(
      order?.pricing?.finalAmount,
      order?.pricing?.totalAmount,
      order?.totalAmount,
      order?.finalAmount,
      (Array.isArray(order?.items) ? order.items.reduce((sum: number, it: any) => sum + getItemTotal(it), 0) : 0)
        + toNumber(order?.pricing?.shippingFee, order?.shippingFee)
        - toNumber(order?.pricing?.discountAmount, order?.discountAmount)
    );
  };

  const getStatusText = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return 'Chờ thanh toán';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PAID': return 'Đã thanh toán';
      case 'PREPARING':
      case 'PROCESSING': return 'Đang chuẩn bị';
      case 'SHIPPING':
      case 'DELIVERING': return 'Đang giao hàng';
      case 'DELIVERED': return 'Đã giao hàng';
      case 'COMPLETED': return 'Đơn hàng đã hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      case 'REFUNDED': return 'Đã hoàn tiền';
      case 'PAYMENTFAILED': return 'Thanh toán lỗi';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return '#f59e0b';
      case 'PAID':
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'PREPARING': return '#3b82f6';
      case 'COMPLETED': return '#16a34a';
      case 'DELIVERED': return '#111827';
      case 'CANCELLED': return '#ef4444';
      case 'REFUNDED': return '#64748b';
      case 'PAYMENTFAILED': return '#e11d48';
      case 'SHIPPING':
      case 'DELIVERING': return '#6366f1';
      default: return '#6b7280';
    }
  };

  const isRefundRelatedStatus = (rawStatus: any) => {
    const s = String(rawStatus || '').toUpperCase().replace(/[\s_-]/g, '');
    return [
      'REFUNDED',
      'REFUNDING',
      'REFUNDPENDING',
      'REFUNDREQUESTED',
      'RETURNED',
      'RETURNREQUESTED',
      'PARTIALREFUNDED',
    ].includes(s) || s.includes('REFUND') || s.includes('RETURN');
  };

  const isOrderItemRefunded = (item: any) => {
    if (!item) return false;
    if (isRefundRelatedStatus(item?.status)) return true;
    if (isRefundRelatedStatus(item?.refundStatus)) return true;
    if (isRefundRelatedStatus(item?.refund?.status)) return true;
    if (item?.isRefunded === true || item?.isReturned === true) return true;
    if (toNumber(item?.refundAmount) > 0) return true;
    if (toNumber(item?.refundedAmount) > 0) return true;
    if (toNumber(item?.refundedQuantity) > 0) return true;
    return false;
  };

  const orderHasRefundSignal = (order: any) => {
    if (!order) return false;

    if (isRefundRelatedStatus(order.orderStatus)) return true;
    if (String(order.orderStatus || '').toUpperCase() === 'VENDORREJECTED') return true;
    if (isRefundRelatedStatus((order as any).refundStatus)) return true;
    if (isRefundRelatedStatus((order as any).refund?.status)) return true;
    if (isRefundRelatedStatus((order as any).refundInfo?.status)) return true;
    if (toNumber((order as any).refundAmount) > 0) return true;
    if (toNumber((order as any).refundedAmount) > 0) return true;

    const items = Array.isArray(order.items) ? order.items : [];
    return items.some((item: any) => {
      if (item?.isRequestRefund === true) return true;
      if (isRefundRelatedStatus(item?.status)) return true;
      if (isRefundRelatedStatus(item?.refundStatus)) return true;
      if (item?.isRefunded === true || item?.isReturned === true) return true;
      if (typeof item?.refundAmount === 'number' && item.refundAmount > 0) return true;
      if (typeof item?.refundedAmount === 'number' && item.refundedAmount > 0) return true;
      return false;
    });
  };

  const canRequestRefundWithinWindow = (order: any) => {
    const deliveryDate = order?.delivery?.deliveryDate || (order as any)?.deliveryDate;
    const deliveryTime = order?.delivery?.deliveryTime || (order as any)?.deliveryTime || '00:00:00';

    if (!deliveryDate) return true;

    const deliveredAt = new Date(deliveryDate);
    if (Number.isNaN(deliveredAt.getTime())) return true;

    const [h, m, s] = String(deliveryTime).split(':').map((v: string) => Number(v) || 0);
    deliveredAt.setHours(h, m, s || 0, 0);

    const diffHours = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60);
    return diffHours <= 2;
  };

  const matchesTab = (status: string, tabId: string, order?: Order) => {
    const s = String(status || '').toUpperCase();
    if (tabId === 'ALL') return true;
    if (tabId === 'PENDING') return s === 'PENDING';
    if (tabId === 'PAID') return ['PAID', 'CONFIRMED', 'PREPARING', 'PROCESSING'].includes(s);
    if (tabId === 'DELIVERING') return ['DELIVERING', 'SHIPPING'].includes(s);
    if (tabId === 'DELIVERED') return s === 'DELIVERED';
    if (tabId === 'COMPLETED') return s === 'COMPLETED';
    if (tabId === 'REFUND') return orderHasRefundSignal(order);
    if (tabId === 'CANCELLED') return s === 'CANCELLED';
    return s === tabId;
  };

  const filteredOrders = activeTab === 'ALL' 
    ? orders 
    : orders.filter(o => matchesTab(o.orderStatus, activeTab, o));

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đơn hàng của tôi</Text>
      </View>

      {/* TABS */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {TABS.map((tab) => (
            <TouchableOpacity 
              key={tab.id} 
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
            >
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#000']} />}
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Package size={64} color="#e5e7eb" />
            <Text style={styles.emptyTitle}>Chưa có đơn hàng nào</Text>
            <Text style={styles.emptySubtitle}>Bạn chưa có đơn hàng nào ở trạng thái này.</Text>
            <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.shopBtnText}>Khám phá ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const hasRefundBadge = orderHasRefundSignal(order);

            return (
            <View key={order.orderId} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.vendorInfo}>
                  <Image
                    source={{
                      uri:
                        order.vendor?.shopAvatarUrl
                        || 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=120&q=80'
                    }}
                    style={styles.vendorAvatar}
                  />
                  <Text style={styles.vendorName} numberOfLines={1}>
                    {order.vendor?.shopName || 'Cửa hàng Việt Ritual'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.orderStatus) + '10' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(order.orderStatus) }]}>
                    {getStatusText(order.orderStatus)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.orderBody} 
                onPress={() => router.push({ pathname: '/order-details/[id]', params: { id: order.orderId } } as any)}
              >
                {order.items?.slice(0, 2).map((item, idx) => (
                  (() => {
                    const baseItemTotal = toNumber(getItemBaseTotal(item), getItemTotal(item));
                    const resolvedItemTotal = baseItemTotal > 0
                      ? baseItemTotal
                      : (order.items?.length === 1
                        ? toNumber(order?.pricing?.subTotal, order?.pricing?.totalAmount)
                        : baseItemTotal);

                    return (
                  <View key={idx} style={styles.itemRow}>
                    <Image
                      source={{
                        uri:
                          item.imageUrl
                          || 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=200&q=80'
                      }}
                      style={styles.itemImg}
                    />
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.packageName}</Text>
                      <Text style={styles.itemVariant}>Gói: {item.variantName} x{item.quantity}</Text>
                      {(isOrderItemRefunded(item) || hasRefundBadge) && (
                        <View style={styles.refundedItemBadge}>
                          <Text style={styles.refundedItemBadgeText}>ĐÃ HOÀN TIỀN</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemPrice}>
                      {resolvedItemTotal.toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                    );
                  })()
                ))}
                {order.items && order.items.length > 2 && (
                  <Text style={styles.moreItemsText}>Xem thêm {order.items.length - 2} sản phẩm khác...</Text>
                )}
              </TouchableOpacity>

              <View style={styles.orderFooter}>
                <View style={styles.dateInfo}>
                  <Calendar size={14} color="#9ca3af" />
                  <Text style={styles.dateText}>
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                  </Text>
                </View>
                <View style={styles.totalInfo}>
                  <Text style={styles.totalLabel}>Tổng tiền:</Text>
                  <Text style={styles.totalValue}>
                    {getOrderTotal(order).toLocaleString('vi-VN')}đ
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                {['PENDING', 'PAID', 'CONFIRMED'].includes(order.orderStatus.toUpperCase()) && (
                  <TouchableOpacity 
                    style={styles.cancelBtn} 
                    onPress={() => handleCancelOrder(order.orderId)}
                    disabled={cancellingId === order.orderId}
                  >
                    {cancellingId === order.orderId ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Text style={styles.cancelBtnText}>Hủy đơn</Text>
                    )}
                  </TouchableOpacity>
                )}
                {order.orderStatus.toUpperCase() === 'DELIVERED' &&
                  !orderHasRefundSignal(order) &&
                  canRequestRefundWithinWindow(order) && (
                    <TouchableOpacity
                      style={styles.refundBtn}
                      onPress={() => setRefundTargetOrder(order)}
                    >
                      <Text style={styles.refundBtnText}>Hoàn tiền</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={styles.detailBtn}
                  onPress={() => router.push({ pathname: '/order-details/[id]', params: { id: order.orderId } } as any)}
                >
                  <Text style={styles.detailBtnText}>Chi tiết</Text>
                  <ChevronRight size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )})
        )}
      </ScrollView>

      <CancelOrderModal
        visible={!!cancelTargetOrderId}
        loading={!!cancellingId}
        onClose={() => {
          if (!cancellingId) setCancelTargetOrderId(null);
        }}
        onConfirm={handleConfirmCancelOrder}
      />

      {refundTargetOrder && (
        <RefundModal
          isOpen={!!refundTargetOrder}
          order={refundTargetOrder}
          onClose={() => setRefundTargetOrder(null)}
          onSuccess={() => {
            const targetId = refundTargetOrder.orderId;
            setOrders((prev) => prev.map((item) => (
              item.orderId === targetId
                ? { ...item, orderStatus: 'REFUNDED' }
                : item
            )));
            setRefundTargetOrder(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    paddingVertical: 12, 
    backgroundColor: '#fff',
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#000' },

  tabsContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabsScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  tabItem: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  tabItemActive: { backgroundColor: '#000' },
  tabLabel: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  tabLabelActive: { color: '#fff' },

  listContent: { padding: 16, paddingBottom: 40 },
  orderCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 },
  vendorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  vendorAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e2e8f0' },
  vendorName: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  orderBody: { paddingVertical: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  itemImg: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#f1f5f9' },
  itemMeta: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  itemVariant: { fontSize: 12, color: '#64748b', marginTop: 2 },
  refundedItemBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  refundedItemBadgeText: {
    color: '#ea580c',
    fontSize: 10,
    fontWeight: '800',
  },
  itemPrice: { fontSize: 14, fontWeight: '800', color: '#000' },
  moreItemsText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 8 },

  orderFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 8, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#f1f5f9',
    borderStyle: 'dashed'
  },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  totalInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalLabel: { fontSize: 12, color: '#64748b' },
  totalValue: { fontSize: 16, fontWeight: '900', color: '#000' },

  cardActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '800' },
  refundBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#fde7cc', alignItems: 'center', justifyContent: 'center' },
  refundBtnText: { color: '#b45309', fontSize: 13, fontWeight: '800' },
  detailBtn: { flex: 2, flexDirection: 'row', backgroundColor: '#000', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4 },
  detailBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginTop: 8 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 40 },
  shopBtn: { marginTop: 12, backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  shopBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' }
});
