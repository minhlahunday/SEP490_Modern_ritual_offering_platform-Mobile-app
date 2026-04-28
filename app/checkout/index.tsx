import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  TextInput, 
  Image,
  Modal,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { 
  ChevronLeft, 
  MapPin, 
  Calendar as CalendarIcon, 
  ChevronRight, 
  Check, 
  Wallet, 
  CreditCard, 
  Info,
  AlertCircle,
  Package,
  Edit3
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { checkoutService, CheckoutSummary, CheckoutRequest } from '../../services/checkoutService';
import { addressService, CustomerAddress } from '../../services/addressService';
import { getProfile, getCurrentUser } from '../../services/auth';
import toast from '../../services/toast';

const MIN_PREPARATION_HOURS = 60;

export default function CheckoutScreen() {
  const router = useRouter();
  const { cartItemId, payosCanceled } = useLocalSearchParams<{ cartItemId: string; payosCanceled?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  
  const [deliveryDate, setDeliveryDate] = useState(new Date(Date.now() + 72 * 60 * 60 * 1000)); // Default +3 days
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  
  const minDeliveryDate = new Date(Date.now() + MIN_PREPARATION_HOURS * 60 * 60 * 1000);
  const maxDeliveryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [paymentMethod, setPaymentMethod] = useState('PayOS');
  const [decorationNotes, setDecorationNotes] = useState<Record<number, string>>({});
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const openPayosInApp = (url: string) => {
    const encoded = encodeURIComponent(url);
    const returnPath = `/checkout?cartItemId=${encodeURIComponent(String(cartItemId || ''))}`;
    router.push({
      pathname: '/payment-webview',
      params: {
        url: encoded,
        returnPath,
      },
    } as any);
  };

  const normalizeDeliveryTime = (timeValue: string): string | null => {
    const value = String(timeValue || '').trim();
    const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] || 0);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return null;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  };

  const formatDateLocalYmd = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatTimeLocalHms = (date: Date): string => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const resolveSummaryItems = (data: CheckoutSummary | null): any[] => {
    if (!data) return [];
    if (Array.isArray((data as any).items)) return (data as any).items;

    if (Array.isArray((data as any).vendorOrders)) {
      return (data as any).vendorOrders.flatMap((order: any) =>
        Array.isArray(order?.items) ? order.items : []
      );
    }

    return [];
  };

  const parseCartItemIds = (): number[] => {
    return String(cartItemId || '')
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
  };

  const fetchInitialData = async () => {
    if (!cartItemId) {
      toast.error('Không tìm thấy sản phẩm thanh toán');
      router.back();
      return;
    }

    try {
      setLoading(true);
      const ids = parseCartItemIds();
      if (!ids.length) {
        toast.error('Không tìm thấy sản phẩm thanh toán hợp lệ');
        router.replace('/(tabs)/cart');
        return;
      }
      
      const [addressList, summaryData, profile] = await Promise.all([
        addressService.getAddresses(),
        checkoutService.getSummary(ids),
        getProfile().catch(() => null)
      ]);

      setAddresses(addressList);
      if (summaryData) {
        setSummary(summaryData);
      } else {
        toast.error('Không tải được thông tin thanh toán');
        router.back();
        return;
      }

      if (profile) {
        setFullName(profile.fullName || '');
        setPhoneNumber(profile.phoneNumber || '');
      } else {
        const user = getCurrentUser();
        if (user) setFullName(user.name || '');
      }
    } catch (error: any) {
      const message = String(error?.message || '');
      if (/401|403|forbidden|unauthorized|khong co quyen|không có quyền/i.test(message)) {
        toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        router.replace('/login');
        return;
      }

      toast.error(error.message || 'Lỗi tải dữ liệu');
      router.replace('/(tabs)/cart');
      return;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [cartItemId]);

  useEffect(() => {
    if (!customTimeInput) {
      setCustomTimeInput('15:00');
    }
  }, []);

  useEffect(() => {
    if (String(payosCanceled || '') === '1') {
      toast.info('Bạn đã hủy thanh toán');
      router.replace({ pathname: '/checkout', params: { cartItemId } } as any);
    }
  }, [payosCanceled, cartItemId]);

  const summaryItems = resolveSummaryItems(summary);
  const summarySubTotal = Number(summary?.subTotal || summaryItems.reduce((sum: number, item: any) => sum + (Number(item?.lineTotal) || (Number(item?.price) * Number(item?.quantity || 0))), 0));
  const summaryShippingFromVendors = Array.isArray(summary?.vendorOrders)
    ? summary!.vendorOrders!.reduce((sum: number, vendor: any) => sum + Number(vendor?.shippingFee || 0), 0)
    : 0;
  const summaryShipping = Number(summary?.shippingFee ?? summaryShippingFromVendors);
  const summaryDiscount = Number(summary?.totalDiscount || 0);
  const summaryTotal = Number(summary?.totalAmount ?? (summarySubTotal + summaryShipping - summaryDiscount));
  const summaryTotalItems = Number(
    summary?.totalItems
    || summaryItems.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0)
    || parseCartItemIds().length
  );

  const handleSelectAddress = async (addrId: string | number) => {
    try {
      setLoading(true);
      const success = await addressService.setDefaultAddress(addrId);
      if (success) {
        setShowAddressModal(false);
        // Refresh summary
        const ids = parseCartItemIds();
        const summaryData = await checkoutService.getSummary(ids);
        if (summaryData) {
          const normalizedItems = resolveSummaryItems(summaryData);
          if (!normalizedItems.length) {
            toast.error('Đơn hàng hiện không còn sản phẩm hợp lệ');
            router.replace('/(tabs)/cart');
            return;
          }
          setSummary(summaryData);
        }
        toast.success('Đã cập nhật địa chỉ giao hàng');
      }
    } catch (error) {
      toast.error('Lỗi khi đổi địa chỉ');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    const normalizedDeliveryTime = normalizeDeliveryTime(customTimeInput);
    if (!normalizedDeliveryTime) {
      toast.error('Vui lòng nhập giờ giao hàng đúng định dạng HH:mm');
      return;
    }

    // Always build delivery datetime from local date object to avoid parse drift.
    const now = new Date();
    const [h, mins] = normalizedDeliveryTime.split(':').map(Number);

    const selectedDateTime = new Date(deliveryDate);
    selectedDateTime.setHours(h, mins, 0, 0);

    const diffInHours = (selectedDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 60) {
      toast.error('Thời gian đặt hàng phải cách thời điểm hiện tại ít nhất 60 giờ để chuẩn bị.');
      return;
    }

    if (selectedDateTime > maxDeliveryDate) {
      toast.error('Thời gian đặt hàng không được quá 1 tháng kể từ hiện tại.');
      return;
    }

    if (!summary) return;

    const fallbackIds = parseCartItemIds();
    if (!summaryItems.length && fallbackIds.length === 0) {
      toast.error('Đơn hàng không có sản phẩm hợp lệ');
      router.back();
      return;
    }

    const request: CheckoutRequest = {
      deliveryDate: formatDateLocalYmd(selectedDateTime),
      deliveryTime: formatTimeLocalHms(selectedDateTime),
      paymentMethod,
      items: summaryItems.length > 0
        ? summaryItems.map((item: any) => ({
            cartItemId: item.cartItemId,
            decorationNote: decorationNotes[item.cartItemId] || ''
          }))
        : fallbackIds.map((id) => ({ cartItemId: id, decorationNote: decorationNotes[id] || '' }))
    };

    setProcessing(true);
    try {
      const result = await checkoutService.processCheckout(request);
      if (result) {
        // Handle case where result is just a boolean (true)
        if (result === true || (typeof result === 'boolean')) {
          toast.success('Đặt hàng thành công!');
          // Redirect to orders page since no orderId is returned
          setTimeout(() => router.replace('/(tabs)/explore'), 800);
          return;
        }

        // Handle case where result is an object
        if (typeof result === 'object') {
          if (result.paymentUrl || result.checkoutUrl) {
            toast.success('Đã tạo đơn hàng. Đang chuyển hướng thanh toán...');
            const url = (result.paymentUrl || result.checkoutUrl)!;
            setTimeout(() => openPayosInApp(url), 400);
          } else if (result.orderId) {
            // Check if orderId exists and process transaction if needed
            const txOk = await checkoutService.processTransaction(result.orderId.toString());
            if (txOk) {
              toast.success('Đặt hàng thành công!');
              router.replace({ pathname: '/order-details/[id]', params: { id: result.orderId.toString() } } as any);
            } else {
              toast.error('Thanh toán ví thất bại. Vui lòng kiểm tra số dư.');
            }
          } else {
            // Order created but no payment info - assumption is it's successful
            toast.success('Đặt hàng thành công!');
            setTimeout(() => router.replace('/(tabs)/explore'), 800);
          }
        }
      }
    } catch (error: any) {
      if (error.message?.includes('Số dư') && paymentMethod === 'PayOS') {
        toast.info('Số dư ví không đủ. Đang tạo nạp qua PayOS...');
        const payos = await checkoutService.initiatePayOSPayment(summaryTotal);
        const paymentLink = payos?.paymentUrl || payos?.checkoutUrl;
        if (paymentLink) {
          openPayosInApp(paymentLink);
        } else {
          toast.error('Không thể tạo liên kết nạp tiền. Vui lòng thử lại.');
        }
      } else {
        toast.error(error.message || 'Đặt hàng thất bại');
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading && !summary) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!summary) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xác nhận thanh toán</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* DELIVERY ADDRESS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MapPin size={18} color="#000" />
              <Text style={styles.sectionTitle}>Thông tin nhận hàng</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAddressModal(true)}>
              <Text style={styles.changeBtnText}>Thay đổi</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addressCard}>
            <View style={styles.userInfoRow}>
              <Text style={styles.userName}>{fullName || 'Người nhận'}</Text>
              <Text style={styles.userPhone}>{phoneNumber || ''}</Text>
            </View>
            <Text style={styles.addressText} numberOfLines={2}>
              {summary.deliveryAddress || 'Vui lòng chọn địa chỉ giao hàng'}
            </Text>
          </View>
        </View>

        {/* SCHEDULING */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <CalendarIcon size={18} color="#000" />
            <Text style={styles.sectionTitle}>Thời gian nhận lễ</Text>
          </View>

          <TouchableOpacity 
            style={styles.dateSelector} 
            onPress={() => setShowDatePicker(true)}
          >
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Ngày giao hàng</Text>
              <Text style={styles.dateValue}>
                {deliveryDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={deliveryDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event: any, date?: Date) => {
                setShowDatePicker(false);
                if (date) setDeliveryDate(date);
              }}
              minimumDate={minDeliveryDate}
              maximumDate={maxDeliveryDate}
            />
          )}

          <Text style={styles.subSectionTitle}>Giờ giao hàng</Text>
          <View style={styles.customTimeInputWrap}>
            <TextInput
              style={styles.customTimeInput}
              value={customTimeInput}
              onChangeText={(text) => {
                const clean = text.replace(/[^0-9:]/g, '').slice(0, 5);
                setCustomTimeInput(clean);
              }}
              placeholder="HH:mm (VD: 14:30)"
              placeholderTextColor="#9ca3af"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <Text style={styles.customTimeHint}>Khách có thể tự nhập giờ giao hàng theo định dạng HH:mm</Text>
          </View>
        </View>

        {/* ITEMS & NOTES */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Package size={18} color="#000" />
            <Text style={styles.sectionTitle}>Sản phẩm & Ghi chú</Text>
          </View>
          
          {summaryItems.map((item: any) => (
            <View key={item.cartItemId} style={styles.checkoutItemCard}>
              <View style={styles.itemMain}>
                <Image source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/logo.png')} style={styles.itemImg} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.packageName}</Text>
                  <Text style={styles.itemMeta}>SL: {item.quantity} • {item.variantName}</Text>
                  <Text style={styles.itemPrice}>{Number(item.price || 0).toLocaleString('vi-VN')}đ</Text>
                </View>
              </View>
              
              <View style={styles.noteContainer}>
                <Edit3 size={14} color="#9ca3af" style={styles.noteIcon} />
                <TextInput
                  style={styles.noteInput}
                  placeholder="Ghi chú trang trí/yêu cầu thêm..."
                  placeholderTextColor="#9ca3af"
                  value={decorationNotes[item.cartItemId] || ''}
                  onChangeText={(txt) => setDecorationNotes(prev => ({ ...prev, [item.cartItemId]: txt }))}
                  multiline={false}
                />
              </View>
            </View>
          ))}
        </View>

        {/* PAYMENT METHOD */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <CreditCard size={18} color="#000" />
            <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
          </View>

          <View style={styles.paymentWalletCard}>
            <View style={[styles.radio, styles.radioSelected]}>
              <View style={styles.radioInner} />
            </View>
            <View style={styles.walletTextWrap}>
              <Text style={styles.methodName}>Ví của bạn</Text>
              <Text style={styles.methodDesc}>Nếu số dư không đủ thì sẽ nạp tiền bằng cách chuyển khoản, QR - An toàn & Nhanh chóng</Text>
            </View>
          </View>
        </View>

        {/* PRICE SUMMARY */}
        <View style={[styles.section, styles.summarySection]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính ({summaryTotalItems} món)</Text>
            <Text style={styles.summaryValue}>{summarySubTotal.toLocaleString('vi-VN')}đ</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phí vận chuyển</Text>
            <Text style={styles.summaryValue}>{summaryShipping.toLocaleString('vi-VN')}đ</Text>
          </View>
          {summaryDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Giảm giá</Text>
              <Text style={[styles.summaryValue, { color: '#10b981' }]}>-{summaryDiscount.toLocaleString('vi-VN')}đ</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{summaryTotal.toLocaleString('vi-VN')}đ</Text>
          </View>
        </View>

      </ScrollView>

      {/* FOOTER ACTION */}
      <View style={styles.footer}>
        <View style={styles.footerTotalInfo}>
          <Text style={styles.footerTotalLabel}>Thanh toán</Text>
          <Text style={styles.footerTotalValue}>{summaryTotal.toLocaleString('vi-VN')}đ</Text>
        </View>
        <TouchableOpacity 
          style={styles.placeOrderBtn}
          onPress={handlePlaceOrder}
          disabled={processing || !summary.deliveryAddress}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.placeOrderBtnText}>ĐẶT HÀNG</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ADDRESS MODAL */}
      <Modal visible={showAddressModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn địa chỉ giao hàng</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Check size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {addresses.map((addr) => (
                <TouchableOpacity 
                  key={addr.addressId} 
                  style={[
                    styles.modalAddressItem, 
                    summary.deliveryAddress?.includes(addr.addressText) && styles.modalAddressItemActive
                  ]}
                  onPress={() => handleSelectAddress(addr.addressId)}
                >
                  <MapPin size={20} color={summary.deliveryAddress?.includes(addr.addressText) ? '#000' : '#9ca3af'} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalAddressText}>{addr.addressText}</Text>
                    {addr.isDefault && <Text style={styles.defaultBadge}>Mặc định</Text>}
                  </View>
                  {summary.deliveryAddress?.includes(addr.addressText) && <Check size={20} color="#000" />}
                </TouchableOpacity>
              ))}
              {addresses.length === 0 && (
                <View style={styles.emptyAddress}>
                  <AlertCircle size={48} color="#d1d5db" />
                  <Text style={styles.emptyAddressText}>Bạn chưa có địa chỉ nào</Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.addAddressBtn}
                onPress={() => {
                  setShowAddressModal(false);
                  router.push('/profile');
                }}
              >
                <Text style={styles.addAddressBtnText}>Quản lý địa chỉ</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
  
  scrollContent: { paddingVertical: 16 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#000', textTransform: 'uppercase', letterSpacing: 0.5 },
  changeBtnText: { fontSize: 13, fontWeight: 'bold', color: '#6b7280', textDecorationLine: 'underline' },
  
  addressCard: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  userInfoRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  userName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  userPhone: { fontSize: 14, color: '#64748b' },
  addressText: { fontSize: 13, color: '#475569', lineHeight: 20 },

  dateSelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#000', 
    padding: 16, 
    borderRadius: 20, 
    justifyContent: 'space-between' 
  },
  dateInfo: { flex: 1 },
  dateLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase' },
  dateValue: { fontSize: 15, color: '#fff', fontWeight: '800', marginTop: 2 },
  
  subSectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748b', marginTop: 16, marginBottom: 12 },
  customTimeInputWrap: { marginBottom: 12 },
  customTimeInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  customTimeHint: { marginTop: 6, fontSize: 12, color: '#64748b' },

  checkoutItemCard: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 16 },
  itemMain: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  itemImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#f1f5f9' },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  itemMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '800', color: '#000', marginTop: 4 },
  noteContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  noteIcon: { marginRight: 8 },
  noteInput: { flex: 1, fontSize: 13, color: '#1e293b', padding: 0 },

  paymentOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#f1f5f9', 
    marginBottom: 12 
  },
  paymentLockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#fafafa',
  },
  paymentWalletCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#111827',
    backgroundColor: '#fafafa',
  },
  walletTextWrap: { flex: 1, paddingTop: 1 },
  paymentOptionActive: { borderColor: '#000', backgroundColor: '#fafafa' },
  paymentMethodInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  methodDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#000' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },

  summarySection: { 
    backgroundColor: '#000', 
    marginHorizontal: 16, 
    padding: 24, 
    borderRadius: 32, 
    marginTop: 8 
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  totalRow: { marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#fff' },
  totalValue: { fontSize: 24, fontWeight: '900', color: '#fff' },

  footer: { 
    flexDirection: 'row', 
    padding: 20, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 20, 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
    gap: 16
  },
  footerTotalInfo: { flex: 1 },
  footerTotalLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  footerTotalValue: { fontSize: 18, fontWeight: '900', color: '#000' },
  placeOrderBtn: { 
    backgroundColor: '#000', 
    paddingVertical: 16, 
    paddingHorizontal: 24, 
    borderRadius: 16, 
    minWidth: 140, 
    alignItems: 'center' 
  },
  placeOrderBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
  modalBody: { paddingBottom: 20 },
  modalAddressItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 16, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#f1f5f9', 
    marginBottom: 12 
  },
  modalAddressItemActive: { borderColor: '#000', backgroundColor: '#f8fafc' },
  modalAddressText: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
  defaultBadge: { 
    fontSize: 10, 
    color: '#000', 
    fontWeight: 'bold', 
    backgroundColor: '#f1f5f9', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4,
    marginTop: 4
  },
  emptyAddress: { alignItems: 'center', paddingVertical: 40 },
  emptyAddressText: { fontSize: 14, color: '#94a3b8', marginTop: 12 },
  addAddressBtn: { 
    paddingVertical: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderStyle: 'dashed', 
    alignItems: 'center', 
    marginTop: 12 
  },
  addAddressBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' }
});
