import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  Platform,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  MapPin, 
  Phone, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Package, 
  Shop as ShopIcon,
  MessageSquare,
  AlertCircle,
  ChevronRight,
  Info,
  Store,
  Star
} from 'lucide-react-native';
import { orderService, Order } from '../../services/orderService';
import { refundService, RefundRecord } from '../../services/refundService';
import { vendorService } from '../../services/vendorService';
import toast from '../../services/toast';
import RefundModal from '../../components/RefundModal';
import ReviewModal from '../../components/ReviewModal';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedItemForReview, setSelectedItemForReview] = useState<{ itemId: string, packageName: string } | null>(null);
  const [refundInfo, setRefundInfo] = useState<RefundRecord | null>(null);
  const [escalating, setEscalating] = useState(false);

  const fetchOrder = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await orderService.getOrderDetails(id);
      if (data) {
        setOrder(data);
        await loadRefundInfo(data.orderId);
      } else {
        toast.error('Không tìm thấy đơn hàng!');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('Không thể tải chi tiết đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  const loadRefundInfo = async (orderId: string) => {
    try {
      const data = await refundService.getRefundByOrderId(orderId);
      setRefundInfo(data);
    } catch {
      setRefundInfo(null);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleCancelOrder = () => {
    Alert.alert(
      'Xác nhận hủy đơn',
      'Bạn có chắc chắn muốn hủy đơn hàng này không?',
      [
        { text: 'Bỏ qua', style: 'cancel' },
        { 
          text: 'Đồng ý hủy', 
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const success = await orderService.cancelOrder(id as string, 'Khách hàng yêu cầu hủy');
              if (success) {
                toast.success('Hủy đơn hàng thành công');
                fetchOrder();
              } else {
                toast.error('Hủy đơn hàng thất bại');
              }
            } catch (error: any) {
              toast.error(error.message || 'Lỗi khi hủy đơn');
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  const handleCompleteOrder = () => {
    Alert.alert(
      'Xác nhận hoàn thành',
      'Bạn xác nhận đã nhận đủ hàng và hài lòng với dịch vụ?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Hoàn thành', 
          onPress: async () => {
            setCompleting(true);
            try {
              const success = await orderService.updateOrderStatus(id as string, 'Completed');
              if (success) {
                toast.success('Đơn hàng đã hoàn thành');
                fetchOrder();
              } else {
                toast.error('Cập nhật thất bại');
              }
            } catch (error: any) {
              toast.error(error.message || 'Lỗi khi cập nhật');
            } finally {
              setCompleting(false);
            }
          }
        }
      ]
    );
  };

  const handleEscalateRefund = async () => {
    if (!refundInfo) return;
    setEscalating(true);
    try {
      const ok = await refundService.escalateRefund(refundInfo.refundId, true);
      if (ok) {
        toast.success('Đã gửi khiếu nại lên quản trị');
        loadRefundInfo(id as string);
      }
    } catch (error: any) {
      toast.error(error.message || 'Không thể gửi khiếu nại');
    } finally {
      setEscalating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!order) return null;

  const getStatusText = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return 'Chờ thanh toán';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PAID': return 'Đã thanh toán';
      case 'PROCESSING': return 'Đang chuẩn bị';
      case 'DELIVERING': return 'Đang giao hàng';
      case 'DELIVERED': return 'Đã giao hàng';
      case 'COMPLETED': return 'Đã hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return '#f59e0b';
      case 'CONFIRMED': return '#0ea5e9';
      case 'PAID': return '#10b981';
      case 'PROCESSING': return '#8b5cf6';
      case 'DELIVERING': return '#6366f1';
      case 'DELIVERED': return '#22c55e';
      case 'COMPLETED': return '#111827';
      case 'CANCELLED': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getTrackingStepIndex = (status: string) => {
    const normalized = status?.toUpperCase() || '';
    if (['PENDING', 'CONFIRMED', 'PAID'].includes(normalized)) return 0;
    if (['PROCESSING'].includes(normalized)) return 1;
    if (['DELIVERING'].includes(normalized)) return 2;
    if (['DELIVERED', 'COMPLETED'].includes(normalized)) return 3;
    return 0;
  };

  const trackingStepIndex = getTrackingStepIndex(order.orderStatus);
  const trackingSteps = [
    { label: 'Xác nhận', icon: CheckCircle2 },
    { label: 'Chuẩn bị', icon: Package },
    { label: 'Đang giao', icon: Truck },
    { label: 'Hoàn tất', icon: HouseIcon },
  ];

  // Map HouseIcon to Home or similar if needed, or use existing Lucide icons
  // Actually I see I didn't import Home, let's just use Package/CheckCircle etc.

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
          <Text style={styles.orderIdText}>Mã: #{order.orderId.substring(0, 8).toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* STATUS BANNER */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(order.orderStatus) }]}>
          <View>
            <Text style={styles.statusLabel}>Trạng thái đơn hàng</Text>
            <Text style={styles.statusValue}>{getStatusText(order.orderStatus)}</Text>
          </View>
          <View style={styles.statusIconContainer}>
            <Info size={24} color="#fff" />
          </View>
        </View>

        {/* TIMELINE */}
        <View style={styles.section}>
          <View style={styles.timelineContainer}>
            {trackingSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index <= trackingStepIndex;
              const isCurrent = index === trackingStepIndex;
              
              return (
                <View key={index} style={styles.timelineItem}>
                  <View style={[
                    styles.timelineDot, 
                    isActive ? styles.timelineDotActive : styles.timelineDotInactive,
                    isCurrent && { borderWidth: 3, borderColor: '#fff' }
                  ]}>
                    <Icon size={14} color={isActive ? '#fff' : '#9ca3af'} />
                  </View>
                  <Text style={[
                    styles.timelineLabel, 
                    isActive ? styles.timelineLabelActive : styles.timelineLabelInactive
                  ]}>
                    {step.label}
                  </Text>
                  {index < trackingSteps.length - 1 && (
                    <View style={[
                      styles.timelineLine, 
                      index < trackingStepIndex ? styles.timelineLineActive : styles.timelineLineInactive
                    ]} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* VENDOR INFO */}
        <View style={styles.whiteSection}>
          <View style={styles.sectionTitleRow}>
            <Store size={18} color="#000" />
            <Text style={styles.sectionTitle}>Cung cấp bởi</Text>
          </View>
          <TouchableOpacity 
            style={styles.vendorCard} 
            onPress={() => router.push(`/vendor/${order.vendor.profileId}`)}
          >
            <Image 
              source={{ uri: order.vendor.shopAvatarUrl || 'https://via.placeholder.com/100' }} 
              style={styles.vendorAvatar} 
            />
            <View style={styles.vendorInfo}>
              <Text style={styles.vendorName}>{order.vendor.shopName}</Text>
              <Text style={styles.viewShopText}>Xem cửa hàng</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* ITEMS */}
        <View style={styles.whiteSection}>
          <View style={styles.sectionTitleRow}>
            <Package size={18} color="#000" />
            <Text style={styles.sectionTitle}>Các gói lễ đã đặt</Text>
          </View>
          {order.items.map((item, index) => (
            <View key={index} style={[styles.itemRow, index === order.items.length - 1 && { borderBottomWidth: 0 }]}>
              <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }} style={styles.itemImage} />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={1}>{item.packageName}</Text>
                <Text style={styles.itemVariant}>Gói: {item.variantName}</Text>
                <Text style={styles.itemQty}>Số lượng: {item.quantity}</Text>
              </View>
              <View style={styles.itemPriceCol}>
                <Text style={styles.itemPrice}>{(item.price * item.quantity).toLocaleString('vi-VN')}đ</Text>
                {order.orderStatus.toUpperCase() === 'COMPLETED' && (
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedItemForReview({ itemId: item.itemId, packageName: item.packageName });
                      setIsReviewModalOpen(true);
                    }}
                  >
                    <Text style={styles.reviewBtnText}>Đánh giá</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* DELIVERY INFO */}
        <View style={styles.whiteSection}>
          <Text style={styles.sectionTitleInner}>Thông tin nhận hàng</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Người nhận</Text>
              <Text style={styles.infoValue}>{order.delivery.customerName}</Text>
              <Text style={styles.infoSubValue}>{order.delivery.customerPhone}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Thời gian</Text>
              <Text style={styles.infoValue}>
                {new Date(order.delivery.deliveryDate).toLocaleDateString('vi-VN')}
              </Text>
              <Text style={styles.infoSubValue}>{order.delivery.deliveryTime}</Text>
            </View>
          </View>
          <View style={styles.addressBox}>
            <MapPin size={16} color="#6b7280" />
            <Text style={styles.addressText}>{order.delivery.deliveryAddress}</Text>
          </View>
        </View>

        {/* PAYMENT SUMMARY */}
        <View style={styles.whiteSection}>
          <Text style={styles.sectionTitleInner}>Tóm tắt thanh toán</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Tạm tính ({order.items.length} món)</Text>
            <Text style={styles.paymentValue}>{order.pricing.subTotal.toLocaleString('vi-VN')}đ</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Phí giao hàng</Text>
            <Text style={styles.paymentValue}>{order.pricing.shippingFee.toLocaleString('vi-VN')}đ</Text>
          </View>
          {order.pricing.discountAmount && order.pricing.discountAmount > 0 && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Giảm giá</Text>
              <Text style={[styles.paymentValue, { color: '#10b981' }]}>-{order.pricing.discountAmount.toLocaleString('vi-VN')}đ</Text>
            </View>
          )}
          <View style={[styles.paymentRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Tổng thanh toán</Text>
            <Text style={styles.totalValue}>{(order.pricing.finalAmount || order.pricing.totalAmount).toLocaleString('vi-VN')}đ</Text>
          </View>
        </View>

        {/* ACTIONS */}
        <View style={styles.actionSection}>
          {order.orderStatus.toUpperCase() === 'PENDING' && (
            <TouchableOpacity 
              style={styles.cancelOrderBtn} 
              onPress={handleCancelOrder}
              disabled={cancelling}
            >
              {cancelling ? <ActivityIndicator color="#ef4444" size="small" /> : <Text style={styles.cancelOrderBtnText}>Hủy đơn hàng</Text>}
            </TouchableOpacity>
          )}

          {order.orderStatus.toUpperCase() === 'DELIVERED' && (
            <View style={styles.deliveredActions}>
              <TouchableOpacity 
                style={styles.refundBtn}
                onPress={() => setIsRefundModalOpen(true)}
              >
                <Text style={styles.refundBtnText}>Yêu cầu hoàn tiền</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.completeBtn}
                onPress={handleCompleteOrder}
                disabled={completing}
              >
                {completing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.completeBtnText}>Đã nhận hàng</Text>}
              </TouchableOpacity>
            </View>
          )}

          {refundInfo && refundInfo.status === 'Rejected' && (
            <View style={styles.refundNotice}>
              <View style={styles.refundNoticeHeader}>
                <AlertCircle size={18} color="#ef4444" />
                <Text style={styles.refundNoticeTitle}>Hoàn tiền bị từ chối</Text>
              </View>
              <Text style={styles.refundNoticeDesc}>Ghi chú: {refundInfo.adminNote || 'Không có lý do cụ thể'}</Text>
              <TouchableOpacity style={styles.escalateBtn} onPress={handleEscalateRefund} disabled={escalating}>
                <Text style={styles.escalateBtnText}>{escalating ? 'Đang gửi...' : 'Gửi khiếu nại lên quản trị'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>

      {/* MODALS */}
      <RefundModal 
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        onSuccess={fetchOrder}
        order={order}
      />
      
      {selectedItemForReview && (
        <ReviewModal 
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setSelectedItemForReview(null);
          }}
          onSuccess={fetchOrder}
          itemId={selectedItemForReview.itemId}
          packageName={selectedItemForReview.packageName}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f4f6' 
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
  orderIdText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  
  scrollContent: { paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  statusBanner: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 24, 
    margin: 16, 
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4
  },
  statusLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  statusValue: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 4 },
  statusIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  section: { paddingHorizontal: 16, marginBottom: 24 },
  whiteSection: { backgroundColor: '#fff', padding: 20, marginHorizontal: 16, borderRadius: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  
  timelineContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 20, backgroundColor: '#fff', borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  timelineItem: { flex: 1, alignItems: 'center', position: 'relative' },
  timelineDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  timelineDotActive: { backgroundColor: '#000' },
  timelineDotInactive: { backgroundColor: '#f3f4f6' },
  timelineLabel: { fontSize: 10, fontWeight: 'bold', marginTop: 8, textAlign: 'center' },
  timelineLabelActive: { color: '#000' },
  timelineLabelInactive: { color: '#9ca3af' },
  timelineLine: { position: 'absolute', top: 16, left: '50%', width: '100%', height: 2, zIndex: 1 },
  timelineLineActive: { backgroundColor: '#000' },
  timelineLineInactive: { backgroundColor: '#f3f4f6' },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#000', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitleInner: { fontSize: 15, fontWeight: '800', color: '#000', marginBottom: 16 },

  vendorCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vendorAvatar: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#f3f4f6' },
  vendorInfo: { flex: 1 },
  vendorName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  viewShopText: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  itemImage: { width: 70, height: 70, borderRadius: 16, backgroundColor: '#f3f4f6' },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  itemVariant: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  itemQty: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  itemPriceCol: { alignItems: 'flex-end', justifyContent: 'space-between' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#000' },
  reviewBtnText: { fontSize: 12, fontWeight: 'bold', color: '#000', textDecorationLine: 'underline', marginTop: 8 },

  infoGrid: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6 },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  infoSubValue: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  addressBox: { flexDirection: 'row', gap: 8, backgroundColor: '#f9fafb', padding: 12, borderRadius: 12 },
  addressText: { flex: 1, fontSize: 13, color: '#4b5563', lineHeight: 20 },

  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  paymentLabel: { fontSize: 14, color: '#6b7280' },
  paymentValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  totalRow: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', borderTopStyle: 'dashed' },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#000' },
  totalValue: { fontSize: 20, fontWeight: '900', color: '#000' },

  actionSection: { paddingHorizontal: 16, marginBottom: 40 },
  cancelOrderBtn: { paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center' },
  cancelOrderBtnText: { color: '#ef4444', fontWeight: 'bold' },
  
  deliveredActions: { flexDirection: 'row', gap: 12 },
  refundBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
  refundBtnText: { color: '#374151', fontWeight: 'bold' },
  completeBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#000', alignItems: 'center' },
  completeBtnText: { color: '#fff', fontWeight: 'bold' },

  refundNotice: { backgroundColor: '#fef2f2', padding: 16, borderRadius: 20, borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  refundNoticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  refundNoticeTitle: { fontSize: 14, fontWeight: 'bold', color: '#ef4444' },
  refundNoticeDesc: { fontSize: 13, color: '#7f1d1d', marginBottom: 16 },
  escalateBtn: { backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  escalateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});

// Helper for House icon if not available
function HouseIcon({ size, color }: { size: number, color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <CheckCircle2 size={size} color={color} />
    </View>
  );
}
