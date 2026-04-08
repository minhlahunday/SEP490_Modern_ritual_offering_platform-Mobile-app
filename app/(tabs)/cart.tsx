import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { cartService, CartApi, CartItemApi } from '@/services/cartService';
import { checkoutService, CheckoutSummary } from '@/services/checkoutService';
import { getCurrentUser } from '@/services/auth';
import toast from '@/services/toast';
import { ShoppingBag, Trash2, Plus, Minus, ChevronRight, Info, CheckCircle2, Circle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const MAX_CART_ITEM_QUANTITY = 50;

export default function CartScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [cart, setCart] = useState<CartApi | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const fetchCartData = useCallback(async (showLoading = true) => {
    const user = getCurrentUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      console.log('🛒 Mobile: Fetching cart...');
      const cartData = await cartService.getCart();
      setCart(cartData);

      if (cartData && cartData.cartItems && cartData.cartItems.length > 0) {
        try {
          const cartItemIds = cartData.cartItems.map(item => item.cartItemId);
          const summary = await checkoutService.getSummary(cartItemIds);
          setCheckoutSummary(summary);
        } catch (summaryError: any) {
          console.warn('⚠️ Mobile: Checkout summary error:', summaryError);
          setCheckoutSummary(null);
        }
      } else {
        setCheckoutSummary(null);
      }
    } catch (error) {
      console.error('❌ Mobile: Failed to fetch cart:', error);
      toast.error('Không thể tải giỏ hàng');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      const user = getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      fetchCartData();
    }
  }, [isFocused, fetchCartData]);

  const [selectedCheckoutSummary, setSelectedCheckoutSummary] = useState<CheckoutSummary | null>(null);
  const [loadingSelectedSummary, setLoadingSelectedSummary] = useState(false);

  // Fetch checkout summary for selected items whenever selection changes
  useEffect(() => {
    const fetchSelectedSummary = async () => {
      if (selectedItems.size === 0) {
        setSelectedCheckoutSummary(null);
        return;
      }

      const selectedIds = Array.from(selectedItems);
      try {
        setLoadingSelectedSummary(true);
        const summary = await checkoutService.getSummary(selectedIds);
        setSelectedCheckoutSummary(summary);
      } catch (error) {
        console.warn('⚠️ Failed to fetch selected summary:', error);
      } finally {
        setLoadingSelectedSummary(false);
      }
    };

    fetchSelectedSummary();
  }, [selectedItems]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCartData(false);
  };

  const toggleItemSelection = (cartItemId: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cartItemId)) {
        newSet.delete(cartItemId);
      } else {
        newSet.add(cartItemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const cartItems = cart?.cartItems || [];
    if (selectedItems.size === cartItems.length) {
      // Deselect all
      setSelectedItems(new Set());
    } else {
      // Select all
      setSelectedItems(new Set(cartItems.map(item => item.cartItemId)));
    }
  };

  const handleUpdateQuantity = async (cartItemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(cartItemId);
      return;
    }

    if (newQuantity > MAX_CART_ITEM_QUANTITY) {
      toast.info(`Số lượng tối đa là ${MAX_CART_ITEM_QUANTITY}`);
      return;
    }

    setUpdating(cartItemId);
    try {
      const success = await cartService.updateCartItem({ cartItemId, quantity: newQuantity });
      if (success) {
        await fetchCartData(false);
        toast.success('Đã cập nhật');
      }
    } catch (error: any) {
      toast.error(error.message || 'Lỗi cập nhật');
    } finally {
      setUpdating(null);
    }
  };

  const handleRemoveItem = (cartItemId: number) => {
    Alert.alert(
      'Xóa sản phẩm?',
      'Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            setUpdating(cartItemId);
            try {
              const success = await cartService.removeCartItem(cartItemId);
              if (success) {
                await fetchCartData(false);
                toast.success('Đã xóa');
              }
            } catch (error: any) {
              toast.error('Không thể xóa sản phẩm');
            } finally {
              setUpdating(null);
            }
          }
        }
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      'Xóa giỏ hàng?',
      'Xóa toàn bộ sản phẩm trong giỏ?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa tất cả',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const success = await cartService.clearCart();
              if (success) {
                setCart(null);
                setCheckoutSummary(null);
                toast.success('Giỏ hàng đã trống');
              }
            } catch (error) {
              toast.error('Lỗi khi xóa giỏ hàng');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderCartItem = (item: CartItemApi) => {
    const isItemUpdating = updating === item.cartItemId;
    const isSelected = selectedItems.has(item.cartItemId);

    return (
      <View key={item.cartItemId} style={styles.card}>
        <View style={styles.itemContainer}>
          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={() => toggleItemSelection(item.cartItemId)}
          >
            {isSelected ? (
              <CheckCircle2 size={24} color="#000" />
            ) : (
              <Circle size={24} color="#cbd5e1" />
            )}
          </TouchableOpacity>

          <Image
            source={item.imageUrl ? { uri: item.imageUrl } : require('@/assets/images/logo.png')}
            style={styles.itemImage}
          />
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>{item.packageName}</Text>
            <Text style={styles.itemVariant}>{item.variantName}</Text>
            <Text style={styles.itemPrice}>{item.price.toLocaleString()}đ</Text>
            
            <View style={styles.itemActions}>
              <View style={styles.quantityContainer}>
                <TouchableOpacity 
                  style={styles.quantityBtn}
                  onPress={() => handleUpdateQuantity(item.cartItemId, item.quantity - 1)}
                  disabled={isItemUpdating}
                >
                  <Minus size={16} color="#475569" />
                </TouchableOpacity>
                
                <View style={styles.quantityValue}>
                  {isItemUpdating ? (
                    <ActivityIndicator size="small" color="#0f172a" />
                  ) : (
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                  )}
                </View>
                
                <TouchableOpacity 
                  style={styles.quantityBtn}
                  onPress={() => handleUpdateQuantity(item.cartItemId, item.quantity + 1)}
                  disabled={isItemUpdating || item.quantity >= MAX_CART_ITEM_QUANTITY}
                >
                  <Plus size={16} color="#475569" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.removeBtn}
                onPress={() => handleRemoveItem(item.cartItemId)}
                disabled={isItemUpdating}
              >
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Đang tải giỏ hàng...</Text>
      </View>
    );
  }

  const cartItems = cart?.cartItems || [];
  
  // Use selected summary if items are selected, otherwise use full summary
  const activeSummary = selectedItems.size > 0 ? selectedCheckoutSummary : checkoutSummary;
  
  const subtotal = selectedItems.size === 0 ? 0 : (activeSummary?.subTotal || 0);
  const shippingFromVendors = selectedItems.size === 0 ? 0 : (
    Array.isArray(activeSummary?.vendorOrders)
      ? activeSummary!.vendorOrders!.reduce((sum, vendor) => sum + Number(vendor?.shippingFee || 0), 0)
      : 0
  );
  const shipping = selectedItems.size === 0 ? 0 : (activeSummary?.shippingFee ?? shippingFromVendors);
  const discount = selectedItems.size === 0 ? 0 : (activeSummary?.totalDiscount || 0);
  const total = selectedItems.size === 0 ? 0 : (activeSummary?.totalAmount ?? (subtotal + shipping - discount));

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={styles.selectAllCheckbox}
              onPress={toggleSelectAll}
            >
              {cartItems.length > 0 && selectedItems.size === cartItems.length ? (
                <CheckCircle2 size={20} color="#000" />
              ) : selectedItems.size > 0 ? (
                <CheckCircle2 size={20} color="#9ca3af" />
              ) : (
                <Circle size={20} color="#cbd5e1" />
              )}
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Giỏ Hàng</Text>
          </View>
          {cartItems.length > 0 && (
            <TouchableOpacity onPress={handleClearCart}>
              <Text style={styles.clearText}>Xóa tất cả</Text>
            </TouchableOpacity>
          )}
        </View>

        {cartItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <ShoppingBag size={48} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>Giỏ hàng trống</Text>
            <Text style={styles.emptyDesc}>Hãy chọn cho mình các gói mâm cúng phù hợp nhé!</Text>
            <TouchableOpacity 
              style={styles.shopBtn}
              onPress={() => router.push('/(tabs)/explore')}
            >
              <Text style={styles.shopBtnText}>Tiếp tục mua sắm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {cartItems.map(renderCartItem)}
            
            {/* <View style={styles.infoBox}>
              <Info size={16} color="#475569" />
              <Text style={styles.infoText}>Miễn phí vận chuyển cho đơn hàng từ 1.000.000đ</Text>
            </View> */}
          </View>
        )}
      </ScrollView>

      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <LinearGradient
            colors={['rgba(255,255,255,0.9)', '#ffffff']}
            style={styles.footerGradient}
          >
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tạm tính:</Text>
              {loadingSelectedSummary && selectedItems.size > 0 ? (
                <ActivityIndicator size="small" color="#0f172a" />
              ) : (
                <Text style={styles.summaryValue}>{subtotal.toLocaleString()}đ</Text>
              )}
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phí vận chuyển:</Text>
              {loadingSelectedSummary && selectedItems.size > 0 ? (
                <ActivityIndicator size="small" color="#0f172a" />
              ) : (
                <Text style={styles.summaryValue}>{shipping.toLocaleString()}đ</Text>
              )}
            </View>
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Giảm giá:</Text>
                <Text style={[styles.summaryValue, { color: '#059669' }]}>-{discount.toLocaleString()}đ</Text>
              </View>
            )}
            
            <View style={styles.checkoutBar}>
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabelSmall}>Tổng cộng:</Text>
                {loadingSelectedSummary && selectedItems.size > 0 ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.totalValueLarge}>{total.toLocaleString()}đ</Text>
                )}
              </View>
              <TouchableOpacity 
                style={[styles.checkoutBtnSmall, selectedItems.size === 0 && styles.checkoutBtnDisabled]}
                onPress={() => {
                  if (selectedItems.size === 0) {
                    toast.info('Vui lòng chọn ít nhất 1 sản phẩm');
                    return;
                  }
                  const ids = Array.from(selectedItems).join(',');
                  router.push(`/checkout?cartItemId=${ids}`);
                }}
                disabled={selectedItems.size === 0 || loadingSelectedSummary}
              >
                <Text style={styles.checkoutBtnTextSmall}>Thanh toán ({selectedItems.size})</Text>
                <ChevronRight size={18} color={selectedItems.size === 0 ? '#9ca3af' : '#fff'} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 160, // Space for fixed footer
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectAllCheckbox: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    fontStyle: 'italic',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
    marginBottom: 24,
  },
  shopBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shopBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  listContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  itemContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    paddingTop: 4,
    paddingRight: 4,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  itemVariant: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
  },
  quantityBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  quantityValue: {
    width: 36,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  removeBtn: {
    padding: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerGradient: {
    padding: 16,
    paddingTop: 16,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '700',
  },
  totalRow: {
    marginTop: 12,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  checkoutBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 16,
  },
  totalContainer: {
    flex: 1,
  },
  totalLabelSmall: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  totalValueLarge: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  checkoutBtnSmall: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  checkoutBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
    opacity: 0.6,
  },
  checkoutBtnTextSmall: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
