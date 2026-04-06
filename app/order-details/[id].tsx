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
  Alert,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { reviewService } from '../../services/reviewService';
import { getCurrentUser } from '../../services/auth';
import toast from '../../services/toast';
import RefundModal from '../../components/RefundModal';
import ReviewModal from '../../components/ReviewModal';
import CancelOrderModal from '../../components/CancelOrderModal';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedItemForReview, setSelectedItemForReview] = useState<{ itemId: string, packageName: string } | null>(null);
  const [refundInfo, setRefundInfo] = useState<RefundRecord | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofModalTitle, setProofModalTitle] = useState('');
  const [proofModalImages, setProofModalImages] = useState<string[]>([]);
  const [reviewedItemIds, setReviewedItemIds] = useState<Set<string>>(new Set());

  const getReviewItemId = (item: any): string => {
    return String(item?.reviewItemId || item?.itemId || '').trim();
  };

  const isItemReviewedFlag = (item: any): boolean => {
    const raw = item?.isReviewed;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw === 1;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
  };

  const loadReviewedItems = async (orderData: Order) => {
    try {
      const currentUser = getCurrentUser();
      const currentUserId = String(currentUser?.userId || '').trim();

      if (!currentUserId || !Array.isArray(orderData?.items) || orderData.items.length === 0) {
        setReviewedItemIds(new Set());
        return;
      }

      const orderItemIds = new Set(
        orderData.items
          .map((item: any) => getReviewItemId(item))
          .filter((value) => value.length > 0)
      );

      if (orderItemIds.size === 0) {
        setReviewedItemIds(new Set());
        return;
      }

      const packageIds = Array.from(new Set(
        orderData.items
          .map((item: any) => Number(String(item?.packageId || '').trim()))
          .filter((value) => Number.isInteger(value) && value > 0)
      ));

      if (packageIds.length === 0) {
        setReviewedItemIds(new Set());
        return;
      }

      const reviewGroups = await Promise.all(
        packageIds.map((packageId) => reviewService.getReviewsByPackageId(packageId).catch(() => []))
      );

      const mine = new Set<string>();
      reviewGroups.flat().forEach((review: any) => {
        const reviewCustomerId = String(review?.customerId || '').trim();
        const reviewItemId = String(review?.itemId || review?.orderItemId || '').trim();

        if (reviewCustomerId === currentUserId && reviewItemId && orderItemIds.has(reviewItemId)) {
          mine.add(reviewItemId);
        }
      });

      setReviewedItemIds(mine);
    } catch {
      setReviewedItemIds(new Set());
    }
  };

  const fetchOrder = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await orderService.getOrderDetails(id);
      if (data) {
        setOrder(data);
        await loadRefundInfo(data.orderId);
        await loadReviewedItems(data);
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

  const handleOpenVendorShop = async () => {
    if (!order) return;

    const rawVendorId = String(
      order.vendor?.profileId
      || (order as any).vendorProfileId
      || (order as any).vendorId
      || ''
    ).trim();

    const resolvedProfileId = await vendorService.resolveVendorProfileId(rawVendorId, order.vendor?.shopName);

    if (!resolvedProfileId) {
      toast.error('Khong tim thay cua hang tu don hang nay');
      return;
    }

    router.push(`/vendor/${resolvedProfileId}` as any);
  };

  const handleCancelOrder = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancelOrder = async (reason: string) => {
    setCancelling(true);
    try {
      await orderService.cancelOrder(id as string, reason);
      toast.success('Hủy đơn hàng thành công');
      setShowCancelModal(false);
      fetchOrder();
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi hủy đơn');
    } finally {
      setCancelling(false);
    }
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
      case 'PAID': return '#3b82f6';
      case 'PROCESSING': return '#8b5cf6';
      case 'DELIVERING': return '#6366f1';
      case 'DELIVERED': return '#22c55e';
      case 'COMPLETED': return '#16a34a';
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

  const toNumber = (...values: any[]) => {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return 0;
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

  const orderHasRefundSignal = (targetOrder: any) => {
    if (!targetOrder) return false;
    if (isRefundRelatedStatus(targetOrder?.orderStatus)) return true;
    if (isRefundRelatedStatus(targetOrder?.refundStatus)) return true;
    if (isRefundRelatedStatus(targetOrder?.refund?.status)) return true;
    if (isRefundRelatedStatus(refundInfo?.status)) return true;
    if (toNumber(targetOrder?.refundAmount) > 0) return true;
    if (toNumber(targetOrder?.refundedAmount) > 0) return true;
    const items = Array.isArray(targetOrder?.items) ? targetOrder.items : [];
    return items.some((item: any) => isOrderItemRefunded(item) || item?.isRequestRefund === true);
  };

  const getItemTotal = (item: any) => {
    const qty = toNumber(item?.quantity, 1) || 1;
    const unit = toNumber(item?.price, item?.unitPrice, item?.variantPrice);
    return toNumber(item?.lineTotal, item?.totalPrice, unit * qty);
  };

  const orderSubTotal = toNumber(
    order?.pricing?.subTotal,
    Array.isArray(order?.items) ? order.items.reduce((sum: number, item: any) => sum + getItemTotal(item), 0) : 0
  );
  const orderShippingFee = toNumber(order?.pricing?.shippingFee);
  const orderDiscount = toNumber(order?.pricing?.discountAmount);
  const orderTotal = toNumber(
    order?.pricing?.finalAmount,
    order?.pricing?.totalAmount,
    orderSubTotal + orderShippingFee - orderDiscount
  );
  const orderLevelRefunded = orderHasRefundSignal(order);

  const openProofImage = async (type: 'preparation' | 'delivery') => {
    const latest = await orderService.getOrderDetails(id as string).catch(() => null);
    const source = latest || order;

    if (latest) {
      setOrder(latest);
    }

    const preparationProofImages = Array.isArray(source?.delivery?.preparationProofImages)
      ? source.delivery.preparationProofImages.filter((url) => typeof url === 'string' && url.trim().length > 0)
      : [];
    const deliveryProofImages = Array.isArray(source?.delivery?.deliveryProofImages)
      ? source.delivery.deliveryProofImages.filter((url) => typeof url === 'string' && url.trim().length > 0)
      : [];

    const urls = type === 'preparation' ? preparationProofImages : deliveryProofImages;
    if (!urls.length) {
      toast.info(type === 'preparation' ? 'Chưa có ảnh chuẩn bị' : 'Chưa có ảnh giao hàng');
      return;
    }

    setProofModalTitle(type === 'preparation' ? 'Ảnh chuẩn bị' : 'Ảnh giao hàng');
    setProofModalImages(urls);
    setShowProofModal(true);
  };

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
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>Trạng thái đơn hàng</Text>
            <Text style={styles.statusValue}>{getStatusText(order.orderStatus)}</Text>

            {order.orderStatus.toUpperCase() === 'DELIVERED' && (
              <View style={styles.statusActionsRow}>
                <TouchableOpacity
                  style={styles.statusGhostBtn}
                  onPress={() => setIsRefundModalOpen(true)}
                >
                  <Text style={styles.statusGhostBtnText}>Yêu cầu hoàn tiền</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statusPrimaryBtn}
                  onPress={handleCompleteOrder}
                  disabled={completing}
                >
                  {completing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.statusPrimaryBtnText}>Đã nhận hàng</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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

          <View style={styles.proofActionsRow}>
            <TouchableOpacity
              style={styles.proofBtn}
              onPress={() => openProofImage('preparation')}
            >
              <Text style={styles.proofBtnText}>Ảnh chuẩn bị</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proofBtn}
              onPress={() => openProofImage('delivery')}
            >
              <Text style={styles.proofBtnText}>Ảnh giao hàng</Text>
            </TouchableOpacity>
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
            onPress={handleOpenVendorShop}
          >
            <Image 
              source={{
                uri:
                  order.vendor.shopAvatarUrl
                  || 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=120&q=80'
              }} 
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
          {order.items.map((item, index) => {
            const hasRefundBadge = isOrderItemRefunded(item) || orderLevelRefunded;

            return (
            <TouchableOpacity
              key={index}
              style={[styles.itemRow, index === order.items.length - 1 && { borderBottomWidth: 0 }]}
              activeOpacity={0.85}
              onPress={() => {
                const packageId = String(item.packageId || '').trim();
                if (!packageId) {
                  toast.info('Không tìm thấy thông tin gói lễ');
                  return;
                }
                router.push({ pathname: '/product/[id]', params: { id: packageId } } as any);
              }}
            >
              <Image
                source={{
                  uri:
                    item.imageUrl
                    || 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=200&q=80'
                }}
                style={styles.itemImage}
              />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={2}>{item.packageName}</Text>
                <Text style={styles.itemVariant}>Gói: {item.variantName}</Text>
                <Text style={styles.itemQty}>Số lượng: {item.quantity}</Text>
                {hasRefundBadge && (
                  <View style={styles.refundedItemBadge}>
                    <Text style={styles.refundedItemBadgeText}>ĐÃ HOÀN TIỀN</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemPriceCol}>
                <Text style={styles.itemPrice}>{getItemTotal(item).toLocaleString('vi-VN')}đ</Text>
                {order.orderStatus.toUpperCase() === 'COMPLETED' && (
                  (() => {
                    const reviewItemId = getReviewItemId(item);
                    const alreadyReviewed = reviewedItemIds.has(reviewItemId) || isItemReviewedFlag(item);

                    if (alreadyReviewed) {
                      return <Text style={styles.reviewedText}>Đã đánh giá</Text>;
                    }

                    return (
                      <TouchableOpacity
                        onPress={() => {
                          if (!reviewItemId) {
                            toast.error('Khong tim thay ItemId de danh gia');
                            return;
                          }
                          setSelectedItemForReview({ itemId: reviewItemId, packageName: item.packageName });
                          setIsReviewModalOpen(true);
                        }}
                      >
                        <Text style={styles.reviewBtnText}>Đánh giá</Text>
                      </TouchableOpacity>
                    );
                  })()
                )}
              </View>
            </TouchableOpacity>
          )})}
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
            <Text style={styles.paymentValue}>{orderSubTotal.toLocaleString('vi-VN')}đ</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Phí giao hàng</Text>
            <Text style={styles.paymentValue}>{orderShippingFee.toLocaleString('vi-VN')}đ</Text>
          </View>
          {(orderDiscount > 0) && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Giảm giá</Text>
              <Text style={[styles.paymentValue, { color: '#10b981' }]}>-{orderDiscount.toLocaleString('vi-VN')}đ</Text>
            </View>
          )}
          <View style={[styles.paymentRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Tổng thanh toán</Text>
            <Text style={styles.totalValue}>{orderTotal.toLocaleString('vi-VN')}đ</Text>
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
          onSuccess={async () => {
            const reviewedId = String(selectedItemForReview?.itemId || '').trim();
            if (reviewedId) {
              setReviewedItemIds((prev) => {
                const next = new Set(prev);
                next.add(reviewedId);
                return next;
              });
            }
            await fetchOrder();
          }}
          itemId={selectedItemForReview.itemId}
          packageName={selectedItemForReview.packageName}
        />
      )}

      <CancelOrderModal
        visible={showCancelModal}
        loading={cancelling}
        onClose={() => {
          if (!cancelling) setShowCancelModal(false);
        }}
        onConfirm={handleConfirmCancelOrder}
      />

      <Modal
        visible={showProofModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProofModal(false)}
      >
        <View
          style={[
            styles.proofModalOverlay,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.proofModalHeader}>
            <Text style={styles.proofModalTitle}>{proofModalTitle}</Text>
            <TouchableOpacity onPress={() => setShowProofModal(false)} style={styles.proofModalCloseBtn}>
              <Text style={styles.proofModalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.proofModalScroll}
            style={{ width: screenWidth }}
          >
            {proofModalImages.map((url, index) => (
              <View key={`${url}-${index}`} style={[styles.proofImageSlide, { width: screenWidth }]}>
                <Image
                  source={{ uri: url }}
                  style={[
                    styles.proofImage,
                    {
                      width: Math.max(screenWidth - 24, 220),
                      height: Math.max(screenHeight * 0.72, 320),
                    },
                  ]}
                  resizeMode="contain"
                />
                <Text style={styles.proofImageIndex}>{index + 1}/{proofModalImages.length}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
  statusActionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusGhostBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusGhostBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  statusPrimaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 110,
    alignItems: 'center',
  },
  statusPrimaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  reviewedText: {
    color: '#16a34a',
    fontWeight: '800',
    fontSize: 13,
  },

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
  proofActionsRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  proofBtn: {
    backgroundColor: '#000',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  proofBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  proofModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'flex-start',
  },
  proofModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  proofModalTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  proofModalCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 10,
  },
  proofModalCloseText: { color: '#fff', fontWeight: '700' },
  proofModalScroll: {
    alignItems: 'center',
  },
  proofImageSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  proofImage: {
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  proofImageIndex: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },

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
  refundedItemBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  refundedItemBadgeText: {
    color: '#ea580c',
    fontSize: 10,
    fontWeight: '800',
  },
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
