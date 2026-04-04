import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';

export default function PaymentWebViewScreen() {
  const router = useRouter();
  const { url, returnPath } = useLocalSearchParams<{ url: string; returnPath?: string }>();

  const decodedUrl = decodeURIComponent(String(url || ''));
  const safeReturnPath = String(returnPath || '/checkout');

  const goBackAsCanceled = () => {
    const separator = safeReturnPath.includes('?') ? '&' : '?';
    router.replace(`${safeReturnPath}${separator}payosCanceled=1` as any);
  };

  const handleNavChange = (navState: any) => {
    const currentUrl = String(navState?.url || '');
    if (!currentUrl) return;

    if (currentUrl.includes('payment-success') || currentUrl.includes('transactionId=')) {
      const query = currentUrl.includes('?') ? currentUrl.split('?')[1] : '';
      router.replace(`/payment-success${query ? `?${query}` : ''}` as any);
      return;
    }

    if (!currentUrl.includes('pay.payos.vn')) {
      goBackAsCanceled();
    }
  };

  if (!decodedUrl) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Không thể mở trang thanh toán</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.title}>Thanh toán</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={goBackAsCanceled}>
          <X size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <WebView
        source={{ uri: decodedUrl }}
        onNavigationStateChange={handleNavChange}
        startInLoadingState
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  errorText: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  header: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
});
