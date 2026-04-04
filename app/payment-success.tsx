import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  CheckCircle2, 
  XCircle, 
  Info, 
  ChevronRight, 
  Home, 
  FileText,
  Clock
} from 'lucide-react-native';
import { checkoutService } from '../services/checkoutService';
import toast from '../services/toast';

const { width } = Dimensions.get('window');

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTransaction = async () => {
    if (!transactionId) {
      setError('Không tìm thấy mã giao dịch');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await checkoutService.getTransaction(transactionId);
      if (result) {
        setTransaction(result);
        if (result.status === 'Success' || result.paymentStatus === 'Success') {
          toast.success('Thanh toán thành công!');
        }
      } else {
        setError('Không thể lấy thông tin giao dịch');
      }
    } catch (err: any) {
      console.error('Failed to fetch transaction:', err);
      setError('Đã xảy ra lỗi khi lấy thông tin giao dịch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransaction();
  }, [transactionId]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Đang xử lý kết quả...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContent}>
          <XCircle size={80} color="#ef4444" />
          <Text style={styles.errorTitle}>Có lỗi xảy ra</Text>
          <Text style={styles.errorDesc}>{error}</Text>
          <TouchableOpacity 
            style={styles.homeBtn} 
            onPress={() => router.replace('/')}
          >
            <Text style={styles.homeBtnText}>Về trang chủ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isSuccess = transaction?.status === 'Success' || transaction?.paymentStatus === 'Success';
  const isPending = transaction?.status === 'Pending' || transaction?.paymentStatus === 'Pending';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* STATUS ICON */}
        <View style={styles.statusHeader}>
          <View style={[
            styles.iconBg, 
            isSuccess ? styles.successBg : isPending ? styles.pendingBg : styles.failBg
          ]}>
            {isSuccess ? (
              <CheckCircle2 size={48} color="#10b981" />
            ) : isPending ? (
              <Clock size={48} color="#f59e0b" />
            ) : (
              <XCircle size={48} color="#ef4444" />
            )}
          </View>
          <Text style={[
            styles.statusTitle, 
            { color: isSuccess ? '#10b981' : isPending ? '#f59e0b' : '#ef4444' }
          ]}>
            {isSuccess ? 'Thanh toán thành công!' : isPending ? 'Đang xử lý thanh toán' : 'Thanh toán thất bại'}
          </Text>
          <Text style={styles.statusDesc}>
            {isSuccess 
              ? 'Đơn hàng của bạn đã được xác nhận.' 
              : isPending 
                ? 'Giao dịch đang được hệ thống xử lý.' 
                : 'Đã xảy ra lỗi trong quá trình thanh toán.'}
          </Text>
        </View>

        {/* DETAILS CARD */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Chi tiết giao dịch</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mã đơn hàng</Text>
            <Text style={styles.detailValue}>#{transaction?.orderId || 'N/A'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Số tiền</Text>
            <Text style={styles.amountValue}>
              {(transaction?.amount || transaction?.totalAmount || 0).toLocaleString('vi-VN')}đ
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phương thức</Text>
            <Text style={styles.detailValue}>{transaction?.paymentMethod || 'PayOS'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Thời gian</Text>
            <Text style={styles.detailValue}>
              {transaction?.createdAt ? new Date(transaction.createdAt).toLocaleString('vi-VN') : 'Vừa xong'}
            </Text>
          </View>

          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Trạng thái</Text>
            <Text style={[
              styles.statusBadge,
              { color: isSuccess ? '#10b981' : isPending ? '#f59e0b' : '#ef4444' }
            ]}>
              {transaction?.status || transaction?.paymentStatus || 'Failed'}
            </Text>
          </View>
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.actionContainer}>
          {isSuccess && (
            <TouchableOpacity 
              style={styles.primaryBtn}
              onPress={() => {
                if (transaction?.orderId) {
                  router.replace({ pathname: '/order-details/[id]', params: { id: transaction.orderId } } as any);
                } else {
                  router.replace('/');
                }
              }}
            >
              <FileText size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Theo dõi đơn hàng</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={isSuccess ? styles.secondaryBtn : styles.primaryBtn}
            onPress={() => router.replace('/')}
          >
            {!isSuccess && <Home size={20} color="#fff" />}
            <Text style={isSuccess ? styles.secondaryBtnText : styles.primaryBtnText}>
              {isSuccess ? 'Về trang chủ' : 'Thử lại'}
            </Text>
          </TouchableOpacity>
        </View>

        {isSuccess && (
          <View style={styles.noticeBox}>
            <Info size={16} color="#6b7280" />
            <Text style={styles.noticeText}>
              Hệ thống sẽ cập nhật trạng thái chuẩn bị mâm sớm nhất. Bạn có thể theo dõi tại mục Đơn hàng.
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 24, alignItems: 'center' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 16, fontSize: 14, color: '#6b7280', fontWeight: '500' },
  
  statusHeader: { alignItems: 'center', marginVertical: 32 },
  iconBg: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successBg: { backgroundColor: '#f0fdf4' },
  pendingBg: { backgroundColor: '#fffbeb' },
  failBg: { backgroundColor: '#fef2f2' },
  statusTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  statusDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },

  detailsCard: { 
    width: '100%', 
    backgroundColor: '#f8fafc', 
    borderRadius: 24, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: '#f1f5f9' 
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 20 },
  detailRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  detailLabel: { fontSize: 14, color: '#64748b' },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  amountValue: { fontSize: 16, fontWeight: '900', color: '#000' },
  statusBadge: { fontSize: 14, fontWeight: '800' },

  actionContainer: { width: '100%', marginTop: 32, gap: 12 },
  primaryBtn: { 
    flexDirection: 'row', 
    backgroundColor: '#000', 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10 
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { 
    paddingVertical: 18, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  secondaryBtnText: { color: '#64748b', fontSize: 15, fontWeight: '700' },

  noticeBox: { 
    flexDirection: 'row', 
    gap: 8, 
    marginTop: 24, 
    backgroundColor: '#f8fafc', 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  noticeText: { flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 18 },

  errorContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorTitle: { fontSize: 20, fontWeight: '900', color: '#000', marginTop: 20, marginBottom: 12 },
  errorDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32 },
  homeBtn: { backgroundColor: '#000', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  homeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
