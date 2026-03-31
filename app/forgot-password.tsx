import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { forgotPassword, resetPassword } from '@/services/auth';
import toast from '@/services/toast';
import { ChevronLeft, Mail, Lock, Key, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if URL/Params has email and token (automatic flow from deep link)
  useEffect(() => {
    const emailParam = params.email as string;
    let tokenParam = params.token as string;
    
    if (tokenParam) {
      // Fix: Replace spaces with + (URL encoding issue)
      tokenParam = tokenParam.replace(/ /g, '+');
    }
    
    if (emailParam && tokenParam) {
      setEmail(emailParam);
      setToken(tokenParam);
      setStep('reset');
      toast.success('Đã nhận mã xác thực từ liên kết.');
    }
  }, [params]);

  const handleRequestReset = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Vui lòng nhập email hợp lệ');
      return;
    }

    try {
      setLoading(true);
      const response = await forgotPassword(email);
      toast.success(response.message || 'Mã xác thực đã được gửi đến email của bạn.');
      
      // Delay switching to reset step to let user read toast
      setTimeout(() => {
        setStep('reset');
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!token.trim()) {
      toast.error('Vui lòng nhập mã xác thực');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setLoading(true);
      const response = await resetPassword({
        email,
        token,
        newPassword,
      });
      toast.success(response.message || 'Đặt lại mật khẩu thành công!');
      
      setTimeout(() => {
        router.replace('/login');
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#f8fafc', '#f1f5f9']}
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
              <Image
                source={require('@/assets/images/favicon-circle.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Modern Ritual</Text>
            <Text style={styles.subtitle}>
              {step === 'request' ? 'Khôi phục mật khẩu' : 'Đặt lại mật khẩu'}
            </Text>
          </View>

          <View style={styles.card}>
            {step === 'request' ? (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Quên mật khẩu?</Text>
                <Text style={styles.formDescription}>
                  Nhập email của bạn và chúng tôi sẽ gửi mã xác thực để đặt lại mật khẩu.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="example@email.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleRequestReset}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Gửi mã xác thực</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setStep('reset')}
                >
                  <Text style={styles.secondaryButtonText}>
                    Đã có mã xác thực? <Text style={styles.underline}>Nhập mã ngay</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Đặt lại mật khẩu</Text>
                <Text style={styles.formDescription}>
                  Nhập mã xác thực từ email và mật khẩu mới của bạn.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Email đã đăng ký"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mã xác thực</Text>
                  <View style={styles.inputWrapper}>
                    <Key size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.monoInput]}
                      value={token}
                      onChangeText={setToken}
                      placeholder="Nhập mã từ email"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mật khẩu mới</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="••••••••"
                      secureTextEntry
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Xác nhận mật khẩu</Text>
                  <View style={styles.inputWrapper}>
                    <ShieldCheck size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      secureTextEntry
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Cập nhật mật khẩu</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setStep('request')}
                >
                  <Text style={styles.secondaryButtonText}>
                    Chưa nhận được mã? <Text style={styles.underline}>Gửi lại ngay</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2025 Modern Ritual. Thành tâm – Tin trực</Text>
            <View style={styles.footerLinks}>
              <Text style={styles.footerLink}>Bảo mật</Text>
              <Text style={styles.footerDot}>•</Text>
              <Text style={styles.footerLink}>SSL</Text>
              <Text style={styles.footerDot}>•</Text>
              <Text style={styles.footerLink}>Riêng tư</Text>
            </View>
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
    backgroundColor: '#fff',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  form: {
    width: '100%',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  formDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00d084',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#64748b',
  },
  underline: {
    textDecorationLine: 'underline',
    fontWeight: 'bold',
    color: '#0f172a',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLink: {
    fontSize: 12,
    color: '#64748b',
  },
  footerDot: {
    fontSize: 12,
    color: '#cbd5e1',
  },
});
