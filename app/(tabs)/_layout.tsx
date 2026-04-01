import React, { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Image, Modal, TextInput, Linking, Alert, ActivityIndicator } from 'react-native';
import { Hop as Home, Compass, User, Bell, ShoppingCart, Wallet, RefreshCw, Plus, X } from 'lucide-react-native';
import { getMyWallet, WalletInfo, createTopupLink } from '../../services/walletService';
import { getCurrentUser } from '../../services/auth';
import { cartService } from '../../services/cartService';

function HeaderRight() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [showWalletCard, setShowWalletCard] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = getCurrentUser();

  const fetchWallet = async () => {
    if (!user) return;
    try {
      setIsRefreshing(true);
      const data = await getMyWallet('Customer');
      setWallet(data);
    } catch (error) {
      console.error('Error fetching wallet in header:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 60000); // 1 minute refresh
    return () => clearInterval(interval);
  }, [user?.email]);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  const handleAmountChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setTopupAmount(numericValue);
  };

  const handleTopup = async () => {
    const amount = parseInt(topupAmount);
    if (!amount || amount < 10000) {
      Alert.alert('Thông báo', 'Số tiền tối thiểu là 10.000 VNĐ');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createTopupLink(amount, 'Customer');
      
      // PayOS implementation usually returns { checkoutUrl, ... } or { paymentUrl, ... }
      const paymentUrl = result?.checkoutUrl || result?.paymentUrl;
      
      if (paymentUrl) {
        setShowTopupModal(false);
        setTopupAmount('');
        // Open PayOS in system browser
        const supported = await Linking.canOpenURL(paymentUrl);
        if (supported) {
          await Linking.openURL(paymentUrl);
        } else {
          Alert.alert('Lỗi', 'Không thể mở liên kết thanh toán');
        }
      } else {
        throw new Error('Không lấy được link thanh toán');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra khi tạo link nạp tiền');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.headerRightOuter}>
      <View style={styles.headerRightContainer}>
        {/* Phone Number */}
        <Text style={styles.phoneText}>1900 8888</Text>

        {/* Notification Bell */}
        <TouchableOpacity style={styles.bellButton} onPress={() => {}}>
          <Bell size={20} color="#64748b" fill="#64748b" />
          <View style={styles.notifBadge}>
            <Text style={styles.notifBadgeText}>9+</Text>
          </View>
        </TouchableOpacity>

        {/* Wallet Icon Box */}
        <TouchableOpacity 
          style={[styles.walletIconButton, showWalletCard && styles.walletIconActive]}
          onPress={() => setShowWalletCard(!showWalletCard)}
        >
          <Wallet size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Wallet Dropdown Card */}
      {showWalletCard && user && (
        <View style={styles.walletCard}>
          <View style={styles.walletCardHeader}>
            <View style={styles.walletStatusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.walletStatusText}>SỐ DƯ KHẢ DỤNG</Text>
            </View>
            <TouchableOpacity 
              onPress={fetchWallet}
              disabled={isRefreshing}
            >
              <RefreshCw size={14} color="#94a3b8" style={isRefreshing ? { transform: [{ rotate: '45deg' }] } : {}} />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>
              {wallet ? formatVND(wallet.balance) : '0'}
            </Text>
            <Text style={styles.balanceUnit}>VND</Text>
          </View>

          <TouchableOpacity 
            style={styles.depositButton}
            onPress={() => {
              setShowWalletCard(false);
              setShowTopupModal(true);
            }}
          >
            <View style={styles.plusIconContainer}>
              <Plus size={16} color="#fff" strokeWidth={3} />
            </View>
            <Text style={styles.depositButtonText}>Nạp thêm tiền</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Topup Modal */}
      <Modal
        visible={showTopupModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTopupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nạp tiền vào ví</Text>
              <TouchableOpacity onPress={() => setShowTopupModal(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>Số tiền muốn nạp (VNĐ)</Text>
            </View>
            
            <TextInput
              style={styles.amountInput}
              placeholder="Ví dụ: 100000"
              keyboardType="numeric"
              value={topupAmount}
              onChangeText={handleAmountChange}
              autoFocus
            />

            <View style={styles.presetContainer}>
              {[50000, 100000, 200000, 500000].map((val) => (
                <TouchableOpacity 
                  key={val} 
                  style={styles.presetBtn}
                  onPress={() => setTopupAmount(String(val))}
                >
                  <Text style={styles.presetBtnText}>{formatVND(val)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.confirmBtn, isSubmitting && styles.disabledBtn]}
              onPress={handleTopup}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Xác nhận nạp tiền</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function HeaderLeft() {
  return (
    <View style={styles.headerLeftContainer}>
      <Image
        source={require('@/assets/images/logo1.png')}
        style={styles.logoHeader}
        resizeMode="contain"
      />
    </View>
  );
}

export default function TabLayout() {
  const [cartCount, setCartCount] = useState<number>(0);
  const user = getCurrentUser();

  useEffect(() => {
    if (!user) {
      setCartCount(0);
      return;
    }

    const fetchCart = async () => {
      try {
        const cart = await cartService.getCart();
        setCartCount(cart?.totalItems || 0);
      } catch (e) {
        console.error('Error fetching cart count:', e);
      }
    };

    fetchCart();
    // Refresh cart count periodically
    const interval = setInterval(fetchCart, 30000);
    return () => clearInterval(interval);
  }, [user?.email]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerLeft: () => <HeaderLeft />,
        headerRight: () => <HeaderRight />,
        headerTitle: '',
        tabBarActiveTintColor: '#000', // black
        tabBarInactiveTintColor: '#94a3b8', // slate-400
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9', // slate-100
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Khám phá',
          tabBarIcon: ({ color, size }) => (
            <Compass color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Giỏ hàng',
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart color={color} size={size} />
          ),
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: 'white',
            fontSize: 10,
          }
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRightOuter: {
    position: 'relative',
    zIndex: 100,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    gap: 12,
  },
  phoneText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 4,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: 'bold',
  },
  walletIconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  walletIconActive: {
    backgroundColor: '#f8fafc',
  },
  walletCard: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 260,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  walletCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  walletStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 20,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  balanceUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  depositButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  plusIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerLeftContainer: {
    paddingLeft: 0,
  },
  logoHeader: {
    width: 180,
    height: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  inputLabelRow: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  amountInput: {
    width: '100%',
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  confirmBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#000',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
