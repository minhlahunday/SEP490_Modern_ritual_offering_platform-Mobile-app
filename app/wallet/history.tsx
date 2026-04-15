import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  Filter, 
  Calendar as CalendarIcon, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Info,
  X,
  RefreshCw,
  Search
} from 'lucide-react-native';
import { walletService, WalletTransaction, TransactionFilter } from '../../services/walletService';
import toast from '../../services/toast';

const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value)) return '0đ';
  return `${value.toLocaleString('vi-VN')}đ`;
};

const formatDateTimeVi = (value: string): string => {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTransactionStatusLabel = (status: string): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized.includes('success')) return 'Thành công';
  if (normalized.includes('fail') || normalized.includes('error')) return 'Thất bại';
  if (normalized.includes('pending')) return 'Chờ xử lý';
  if (normalized.includes('processing')) return 'Đang xử lý';
  return status || 'Không có';
};

const getStatusColor = (status: string): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized.includes('success')) return '#10b981'; // emerald-500
  if (normalized.includes('fail') || normalized.includes('error')) return '#f43f5e'; // rose-500
  if (normalized.includes('pending') || normalized.includes('processing')) return '#f59e0b'; // amber-500
  return '#64748b'; // slate-500
};

const getTransactionTypeLabel = (type: string, amount?: number): string => {
  const normalized = String(type || '').trim().toLowerCase();
  if ((normalized === 'systemadjustment' || normalized === 'adjust') && (amount || 0) > 0) {
    return 'Nạp tiền';
  }
  switch (normalized) {
    case 'deposit': case 'topup': return 'Nạp tiền';
    case 'withdrawal': case 'withdraw': return 'Rút tiền';
    case 'paymentorder': return 'Thanh toán đơn hàng';
    case 'systemadjustment': case 'adjust': return 'Điều chỉnh số dư';
    case 'vendorincome': return 'Doanh thu';
    case 'refundcustomer': case 'refundorder': return 'Hoàn tiền';
    default: return type || 'Khác';
  }
};

const isIncomingTransaction = (tx: WalletTransaction): boolean => {
  const normalized = String(tx.type || '').trim().toLowerCase();
  if (['deposit', 'topup', 'vendorincome', 'refundcustomer', 'withholdingrelease'].includes(normalized)) return true;
  if (['withdrawal', 'withdraw', 'paymentorder', 'penaltyvendor', 'platformfee'].includes(normalized)) return false;
  return (tx.amount || 0) >= 0;
};

export default function TransactionHistoryScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<WalletTransaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const filter: TransactionFilter = {
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      };
      const data = await walletService.getMyTransactions(filter);
      const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(sorted);
    } catch (err: any) {
      setError(err.message || 'Không thể tải lịch sử giao dịch.');
      toast.error(err.message || 'Lỗi tải giao dịch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [typeFilter, statusFilter]);

  const handleOpenDetail = async (tx: WalletTransaction) => {
    setDetailTx(tx);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const fresh = await walletService.getTransactionById(tx.id);
      setDetailTx(fresh);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalIn = transactions
    .filter(isIncomingTransaction)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const totalOut = transactions
    .filter(tx => !isIncomingTransaction(tx))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Lịch sử giao dịch',
          headerTitleAlign: 'center',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 } as ViewStyle}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
          ),
          headerStyle: { 
            backgroundColor: '#fff',
          },
          headerShadowVisible: false,
        }} 
      />

      {/* SUMMARY CARDS */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, styles.summaryCardLeft, { backgroundColor: '#ecfdf5' }]}> 
          <ArrowDownLeft size={20} color="#059669" />
          <View>
            <Text style={styles.summaryLabel as TextStyle}>Tiền vào</Text>
            <Text style={[styles.summaryValue as TextStyle, { color: '#059669' }]}>{formatCurrency(totalIn)}</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardRight, { backgroundColor: '#fff1f2' }]}> 
          <ArrowUpRight size={20} color="#e11d48" />
          <View>
            <Text style={styles.summaryLabel as TextStyle}>Tiền ra</Text>
            <Text style={[styles.summaryValue as TextStyle, { color: '#e11d48' }]}>{formatCurrency(totalOut)}</Text>
          </View>
        </View>
      </View>

      {/* FILTERS */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity 
            style={[styles.filterItem, !typeFilter && styles.filterItemActive]}
            onPress={() => setTypeFilter('')}
          >
            <Text style={[styles.filterText as TextStyle, !typeFilter && (styles.filterTextActive as TextStyle)]}>Tất cả</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterItem, typeFilter === 'Deposit' && styles.filterItemActive]}
            onPress={() => setTypeFilter('Deposit')}
          >
            <Text style={[styles.filterText as TextStyle, typeFilter === 'Deposit' && (styles.filterTextActive as TextStyle)]}>Nạp tiền</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterItem, typeFilter === 'PaymentOrder' && styles.filterItemActive]}
            onPress={() => setTypeFilter('PaymentOrder')}
          >
            <Text style={[styles.filterText as TextStyle, typeFilter === 'PaymentOrder' && (styles.filterTextActive as TextStyle)]}>Thanh toán</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterItem, typeFilter === 'RefundCustomer' && styles.filterItemActive]}
            onPress={() => setTypeFilter('RefundCustomer')}
          >
            <Text style={[styles.filterText as TextStyle, typeFilter === 'RefundCustomer' && (styles.filterTextActive as TextStyle)]}>Hoàn tiền</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {loading && transactions.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#000000" />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText as TextStyle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
              <RefreshCw size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.centerContainer}>
            <Search size={48} color="#cbd5e1" />
            <Text style={styles.emptyText as TextStyle}>Bạn chưa có giao dịch nào</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 8, textAlign: 'center' } as TextStyle}>
              Thông tin nạp tiền, thanh toán và hoàn tiền sẽ xuất hiện tại đây sau khi bạn thực hiện giao dịch.
            </Text>
          </View>
        ) : (
          <View style={styles.transactionList}>
            {transactions.map((tx) => {
              const incoming = isIncomingTransaction(tx);
              return (
                <TouchableOpacity 
                  key={tx.id} 
                  style={styles.txItem} 
                  onPress={() => handleOpenDetail(tx)}
                >
                  <View style={[styles.txIcon, { backgroundColor: incoming ? '#f0fdf4' : '#fef2f2' }]}>
                    {incoming ? (
                      <ArrowDownLeft size={20} color="#10b981" />
                    ) : (
                      <ArrowUpRight size={20} color="#ef4444" />
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txTypeName as TextStyle}>{getTransactionTypeLabel(tx.type, tx.amount)}</Text>
                    <Text style={styles.txDesc as TextStyle} numberOfLines={1}>{tx.description || 'Không có mô tả'}</Text>
                    <Text style={styles.txDate as TextStyle}>{formatDateTimeVi(tx.createdAt)}</Text>
                  </View>
                  <View style={styles.txAmountContainer}>
                    <Text style={[styles.txAmount as TextStyle, { color: incoming ? '#10b981' : '#ef4444' }]}>
                      {incoming ? '+' : '-'}{formatCurrency(tx.amount)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tx.status) + '20' }]}>
                      <Text style={[styles.statusText as TextStyle, { color: getStatusColor(tx.status) }]}>
                        {getTransactionStatusLabel(tx.status)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal visible={detailOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle as TextStyle}>Chi tiết giao dịch</Text>
              <TouchableOpacity onPress={() => setDetailOpen(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {detailTx && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailAmountSection}>
                  <Text style={styles.detailAmountLabel as TextStyle}>Số tiền</Text>
                  <Text style={[styles.detailAmount as TextStyle, { color: isIncomingTransaction(detailTx) ? '#10b981' : '#ef4444' }]}>
                    {isIncomingTransaction(detailTx) ? '+' : '-'}{formatCurrency(detailTx.amount)}
                  </Text>
                  <View style={[styles.detailStatusBadge, { backgroundColor: getStatusColor(detailTx.status) + '20' }]}>
                    <Text style={[styles.detailStatusText as TextStyle, { color: getStatusColor(detailTx.status) }]}>
                      {getTransactionStatusLabel(detailTx.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel as TextStyle}>Loại</Text>
                  <Text style={styles.detailValue as TextStyle}>{getTransactionTypeLabel(detailTx.type, detailTx.amount)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel as TextStyle}>Thời gian</Text>
                  <Text style={styles.detailValue as TextStyle}>{formatDateTimeVi(detailTx.createdAt)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel as TextStyle}>Mã giao dịch</Text>
                  <Text style={[styles.detailValue as TextStyle, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>{detailTx.id}</Text>
                </View>
                
                {Number.isFinite(detailTx.balanceBefore) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel as TextStyle}>Số dư trước GD</Text>
                    <Text style={styles.detailValue as TextStyle}>{formatCurrency(detailTx.balanceBefore)}</Text>
                  </View>
                )}

                <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start', borderBottomWidth: 0 }]}>
                  <Text style={styles.detailLabel as TextStyle}>Ghi chú</Text>
                  <Text style={styles.detailDesc as TextStyle}>{detailTx.description || 'Không có mô tả'}</Text>
                </View>

                {detailLoading && (
                  <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#000000" />
                    <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 } as TextStyle}>Đang tải thêm...</Text>
                  </View>
                )}
              </ScrollView>
            )}
            
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailOpen(false)}>
              <Text style={styles.closeBtnText as TextStyle}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  summaryContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  summaryCardLeft: { marginRight: 6 },
  summaryCardRight: { marginLeft: 6 },
  summaryLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  
  filterBar: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterItem: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  filterItemActive: { backgroundColor: '#000', borderColor: '#000' },
  filterText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  listContent: { paddingBottom: 40 },
  transactionList: { padding: 16, gap: 16 },
  txItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  txIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txTypeName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  txDesc: { fontSize: 13, color: '#64748b', marginTop: 2 },
  txDate: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  txAmountContainer: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '800', textAlign: 'right' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-end' },
  statusText: { fontSize: 10, fontWeight: '700' },

  centerContainer: { padding: 80, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ef4444', marginBottom: 16, textAlign: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyText: { color: '#94a3b8', fontSize: 14, marginTop: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  modalBody: { marginBottom: 20 },
  detailAmountSection: { alignItems: 'center', paddingVertical: 10 },
  detailAmountLabel: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  detailAmount: { fontSize: 32, fontWeight: '900' },
  detailStatusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 12 },
  detailStatusText: { fontSize: 12, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  detailLabel: { fontSize: 14, color: '#64748b' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  detailDesc: { fontSize: 14, color: '#1e293b', marginTop: 8, lineHeight: 22 },
  closeBtn: { backgroundColor: '#0f172a', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
