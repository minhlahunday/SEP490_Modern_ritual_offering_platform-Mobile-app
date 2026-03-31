import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { confirmEmail } from '@/services/auth';
import toast from '@/services/toast';
import { CheckCircle2, XCircle, Loader2, Mail, Key, Sparkles, ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const [manualEmail, setManualEmail] = useState<string>('');
  const [manualToken, setManualToken] = useState<string>('');
  
  const hasVerified = useRef(false);

  const handleManualVerify = async () => {
    if (!manualEmail.trim() || !manualToken.trim()) {
      toast.error('Vui lòng nhập đầy đủ email và mã xác thực');
      return;
    }

    try {
      setStatus('loading');
      setShowManualForm(false);
      const response = await confirmEmail({ email: manualEmail, token: manualToken });
      
      setStatus('success');
      setMessage(response.message || 'Xác nhận email thành công! Bạn có thể đăng nhập ngay bây giờ.');
      toast.success('Xác nhận thành công!');
      
      setTimeout(() => {
        router.replace('/login');
      }, 3000);
    } catch (err: any) {
      console.error('Manual email verification failed:', err);
      setStatus('error');
      setShowManualForm(true);
      setMessage(err.message || 'Không thể xác nhận email. Vui lòng kiểm tra lại thông tin.');
      toast.error('Xác nhận thất bại');
    }
  };

  useEffect(() => {
    const verifyEmail = async () => {
      if (hasVerified.current) return;

      const email = params.email as string;
      const tokenRaw = params.token as string;

      if (!email || !tokenRaw) {
        setShowManualForm(true);
        setStatus('error');
        setMessage('Không tìm thấy thông tin xác thực tự động. Vui lòng nhập thủ công bên dưới.');
        return;
      }

      hasVerified.current = true;

      // Fix URL decode '+' into space issue
      const token = tokenRaw.replace(/ /g, '+');
      
      setManualEmail(email);
      setManualToken(token);

      try {
        setStatus('loading');
        const response = await confirmEmail({ email, token });
        
        setStatus('success');
        setMessage(response.message || 'Xác nhận email thành công! Bạn có thể đăng nhập ngay bây giờ.');
        toast.success('Xác nhận thành công!');
        
        setTimeout(() => {
          router.replace('/login');
        }, 3000);
      } catch (err: any) {
        console.error('Email verification failed:', err);
        setStatus('error');
        setShowManualForm(true);
        setMessage(err.message || 'Không thể xác nhận email. Link có thể đã hết hạn hoặc không hợp lệ.');
        toast.error('Xác nhận thất bại');
      }
    };

    verifyEmail();
  }, [params]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#f8fafc', '#f1f5f9', '#e2e8f0']}
        style={StyleSheet.absoluteFill}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <ChevronLeft color="#334155" size={24} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoInner}>
                <Image
                  source={require('@/assets/images/favicon-circle.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.title}>Modern Ritual</Text>
            <Text style={styles.subtitle}>Nền tảng mâm cúng hiện đại</Text>
          </View>

          <View style={styles.card}>
            {status === 'loading' && (
              <View style={styles.statusContent}>
                <ActivityIndicator size="large" color="#0f172a" />
                <Text style={styles.statusTitle}>Đang xác nhận email...</Text>
                <Text style={styles.statusDesc}>Vui lòng đợi trong giây lát</Text>
              </View>
            )}

            {status === 'success' && (
              <View style={styles.statusContent}>
                <View style={styles.iconSuccess}>
                  <CheckCircle2 color="#059669" size={48} />
                </View>
                <Text style={styles.statusTitle}>Xác nhận thành công!</Text>
                <Text style={styles.statusDesc}>{message}</Text>
                
                <TouchableOpacity 
                  style={styles.primaryButton}
                  onPress={() => router.replace('/login')}
                >
                  <Text style={styles.primaryButtonText}>Đăng nhập ngay</Text>
                </TouchableOpacity>
              </View>
            )}

            {status === 'error' && (
              <View style={styles.statusContent}>
                <View style={styles.iconError}>
                  <XCircle color="#dc2626" size={48} />
                </View>
                <Text style={styles.statusTitle}>Xác nhận thất bại</Text>
                <Text style={styles.statusDesc}>{message}</Text>
                
                {showManualForm && (
                  <View style={styles.manualForm}>
                    <View style={styles.tipBox}>
                      <Sparkles size={16} color="#1e40af" />
                      <Text style={styles.tipText}>Xác nhận thủ công</Text>
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Email</Text>
                      <View style={styles.inputWrapper}>
                        <Mail size={18} color="#64748b" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          value={manualEmail}
                          onChangeText={setManualEmail}
                          placeholder="example@email.com"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Mã xác nhận (Token)</Text>
                      <View style={styles.inputWrapperArea}>
                        <Key size={18} color="#64748b" style={styles.inputIcon} />
                        <TextInput
                          style={styles.inputArea}
                          value={manualToken}
                          onChangeText={setManualToken}
                          placeholder="Dán mã từ email..."
                          multiline
                          numberOfLines={4}
                          autoCapitalize="none"
                        />
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={styles.primaryButton}
                      onPress={handleManualVerify}
                    >
                      <Text style={styles.primaryButtonText}>Xác nhận thủ công</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={styles.secondaryButton}
                    onPress={() => router.replace('/login')}
                  >
                    <Text style={styles.secondaryButtonText}>Về trang đăng nhập</Text>
                  </TouchableOpacity>
                  
                  {!showManualForm && (
                    <TouchableOpacity 
                      style={styles.ghostButton}
                      onPress={() => setShowManualForm(true)}
                    >
                      <Text style={styles.ghostButtonText}>Nhập mã thủ công</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2025 Modern Ritual. Thành tâm – Tin trực</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoInner: {
    width: 64,
    height: 64,
    backgroundColor: '#fff',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 1,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  statusContent: {
    alignItems: 'center',
    width: '100%',
  },
  iconSuccess: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconError: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  statusDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '600',
  },
  ghostButton: {
    marginTop: 16,
    padding: 8,
  },
  ghostButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  manualForm: {
    width: '100%',
    marginTop: 8,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  tipText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputWrapperArea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 100,
  },
  inputIcon: {
    marginTop: Platform.OS === 'ios' ? 0 : 4,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  inputArea: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlignVertical: 'top',
  },
  actionRow: {
    width: '100%',
    alignItems: 'center',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
