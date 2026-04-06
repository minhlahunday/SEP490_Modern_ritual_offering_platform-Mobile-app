import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, AlertCircle } from 'lucide-react-native';

import { login, register, LoginRequest, RegisterRequest } from '../services/auth';
import toast from '../services/toast';

const PROFILE_SETUP_REQUIRED_KEY = 'modern-ritual-profile-setup-required';
const REMEMBER_LOGIN_KEY = 'modern-ritual-remember-login';

export default function LoginScreen() {
  const router = useRouter();
  
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rememberLogin, setRememberLogin] = useState(false);
  
  // Show/Hide Passwords
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  // Mock checking local storage
  useEffect(() => {
    // Note: React Native's async storage would normally be used here.
    // Assuming services/auth.ts provides some global mock localStorage fallback
    try {
      // @ts-ignore
      if (typeof localStorage !== 'undefined') {
        // @ts-ignore
        const rememberedRaw = localStorage.getItem(REMEMBER_LOGIN_KEY);
        if (rememberedRaw) {
          const remembered = JSON.parse(rememberedRaw);
          if (remembered.email && remembered.password) {
            setRememberLogin(true);
            setFormData((prev) => ({
              ...prev,
              email: String(remembered.email),
              password: String(remembered.password),
            }));
          }
        }
      }
    } catch (e) {
      console.warn('Could not read remember login state:', e);
    }
  }, []);

  const handleInputChange = (field: string, value: string | boolean) => {
    if (error) setError(null);
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const switchToRegister = () => {
    setIsLogin(false);
    setError(null);
    setShowRegisterPassword(false);
    setShowRegisterConfirmPassword(false);
    setFormData((prev) => ({ ...prev, confirmPassword: '', agreeTerms: false }));
  };

  const switchToLogin = () => {
    setIsLogin(true);
    setError(null);
    setShowLoginPassword(false);
  };

  const handleSubmit = async () => {
    if (isLogin) {
      if (!formData.email || !formData.password) {
        setError('Vui lòng nhập email và mật khẩu');
        return;
      }

      try {
        setError(null);
        const credentials: LoginRequest = {
          usernameOrEmail: formData.email,
          password: formData.password,
        };

        const response = await login(credentials);

        // Save mock functionality as provided in auth.ts
        const userData = {
          id: response.userId,
          name: response.name,
          email: response.email,
          role: response.role,
          roles: response.roles
        };

        // @ts-ignore
        if (typeof localStorage !== 'undefined') {
          // @ts-ignore
          localStorage.setItem('smart-child-token', response.token);
          // @ts-ignore
          localStorage.setItem('smart-child-refresh-token', response.refreshToken);
          // @ts-ignore
          localStorage.setItem('smart-child-user', JSON.stringify(userData));

          if (rememberLogin) {
            // @ts-ignore
            localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({
              email: formData.email,
              password: formData.password,
            }));
          } else {
            // @ts-ignore
            localStorage.removeItem(REMEMBER_LOGIN_KEY);
          }
        }

        const normalizedRole = String(response.role || '').toLowerCase();
        if (normalizedRole === 'customer') {
          // Check Profile logic
          try {
            const { getProfile } = await import('../services/auth');
            const profile = await getProfile();
            const hasFullName = !!profile.fullName?.trim();
            const hasPhoneNumber = !!profile.phoneNumber?.trim();
            const isProfileIncomplete = !(hasFullName && hasPhoneNumber);

            if (isProfileIncomplete) {
              // @ts-ignore
              if (typeof localStorage !== 'undefined') localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, 'true');
              
              toast.message({
                title: 'Chào mừng bạn!',
                text: 'Để tiếp tục, vui lòng hoàn thành thông tin cá nhân của bạn.',
                icon: 'info',
                confirmButtonText: 'Đồng ý'
              });
              router.replace('/profile?firstTime=true');
              return;
            }
          } catch (e) {
            console.warn('Profile check error:', e);
          }
        }

        // @ts-ignore
        if (typeof localStorage !== 'undefined') localStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, 'false');

        toast.success('Đăng nhập thành công!');
        router.replace('/(tabs)'); // Redirect to main app

      } catch (err: any) {
        setError(err.message || 'Đăng nhập thất bại');
      }
    } else {
      // Register
      if (!formData.email || !formData.password) {
        setError('Vui lòng điền đầy đủ thông tin');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Mật khẩu không khớp');
        return;
      }
      if (!formData.agreeTerms) {
        setError('Vui lòng đồng ý với điều khoản sử dụng');
        return;
      }

      try {
        setError(null);
        const username = String(formData.email || '').split('@')[0].trim() || 'customer';
        const registerData: RegisterRequest = {
          username,
          email: formData.email,
          password: formData.password,
        };

        await register(registerData);
        
        toast.message({
          title: 'Đăng ký thành công!',
          text: `Chúng tôi đã gửi email xác nhận đến: ${formData.email}. Vui lòng kiểm tra hộp thư.`,
          icon: 'success',
          confirmButtonText: 'Đã hiểu'
        });

        switchToLogin();
      } catch (err: any) {
        setError(err.message || 'Đăng ký thất bại');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('@/assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Modern Ritual</Text>
              <Text style={styles.subtitle}>Nền tảng mâm cúng hiện đại</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                onPress={switchToLogin}
                style={[styles.tabBtn, isLogin && styles.activeTabBtn]}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
                  Đăng Nhập
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={switchToRegister}
                style={[styles.tabBtn, !isLogin && styles.activeTabBtn]}
              >
                <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>
                  Đăng Ký
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Validation Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <AlertCircle size={20} color="#dc2626" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.errorTitle}>
                    {isLogin ? 'Đăng nhập thất bại' : 'Đăng ký thất bại'}
                  </Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.formSpace}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="example@email.com"
                  value={formData.email}
                  onChangeText={(val) => handleInputChange('email', val)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mật khẩu</Text>
                <View style={styles.relative}>
                  <TextInput
                    style={styles.inputWrapper}
                    placeholder="••••••••"
                    value={formData.password}
                    onChangeText={(val) => handleInputChange('password', val)}
                    secureTextEntry={isLogin ? !showLoginPassword : !showRegisterPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => {
                      if (isLogin) setShowLoginPassword(!showLoginPassword);
                      else setShowRegisterPassword(!showRegisterPassword);
                    }}
                  >
                    {(isLogin ? showLoginPassword : showRegisterPassword) ? (
                      <Eye size={20} color="#6b7280" />
                    ) : (
                      <EyeOff size={20} color="#6b7280" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {!isLogin && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Xác nhận mật khẩu</Text>
                  <View style={styles.relative}>
                    <TextInput
                      style={styles.inputWrapper}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChangeText={(val) => handleInputChange('confirmPassword', val)}
                      secureTextEntry={!showRegisterConfirmPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                    >
                      {showRegisterConfirmPassword ? (
                        <Eye size={20} color="#6b7280" />
                      ) : (
                        <EyeOff size={20} color="#6b7280" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Login Extra Controls */}
              {isLogin && (
                <View style={styles.loginSpaceBetween}>
                  <TouchableOpacity
                    style={styles.checkboxWrapper}
                    onPress={() => setRememberLogin(!rememberLogin)}
                  >
                    <View style={[styles.checkbox, rememberLogin && styles.checkboxChecked]}>
                      {rememberLogin && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                    <Text style={styles.textGray}>Ghi nhớ đăng nhập</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                    <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Register Terms */}
              {!isLogin && (
                <TouchableOpacity
                  style={[styles.checkboxWrapper, { marginTop: 10 }]}
                  onPress={() => handleInputChange('agreeTerms', !formData.agreeTerms)}
                >
                  <View style={[styles.checkbox, formData.agreeTerms && styles.checkboxChecked]}>
                    {formData.agreeTerms && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={[styles.textGray, { flex: 1, fontSize: 13 }]} numberOfLines={2}>
                    Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật
                  </Text>
                </TouchableOpacity>
              )}

              {/* Submit Button */}
              <TouchableOpacity style={styles.submitBtnOpacity} onPress={handleSubmit} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#1f2937', '#111827']}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitBtnText}>
                    {isLogin ? 'Đăng Nhập' : 'Tạo tài khoản'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Back to Home Button */}
              {isLogin && (
                <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)')}>
                  <Text style={styles.backBtnText}>← Quay lại trang chủ</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          <Text style={styles.footerText}>© 2026 Modern Ritual Offering. Thành tâm - Tín trực.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.6)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    marginBottom: 8,
  },
  logoImage: {
    width: 280,
    height: 140,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 4,
    borderRadius: 12,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabBtn: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  tabText: {
    fontWeight: '600',
    color: '#6b7280',
    fontSize: 15,
  },
  activeTabText: {
    color: '#111827',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991b1b',
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    marginTop: 2,
  },
  formSpace: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  relative: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  inputWrapper: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 48, // space for eye icon
    fontSize: 15,
    color: '#111827',
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
  },
  loginSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 8,
  },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  textGray: {
    fontSize: 14,
    color: '#4b5563',
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  submitBtnOpacity: {
    marginTop: 8,
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  backBtnText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#6b7280',
    marginTop: 24,
    fontWeight: '500',
  },
});
