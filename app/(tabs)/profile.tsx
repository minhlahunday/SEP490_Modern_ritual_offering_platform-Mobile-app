import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Image } from 'react-native';
import { User, LogOut, Star, Store, MapPin, ChevronLeft, Package } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { getCurrentUser, UserProfile, getProfile, logout } from '@/services/auth';
import toast from '@/services/toast';

import ProfileInfoTab from '@/components/ProfileInfoTab';
import VendorRegisterTab from '@/components/VendorRegisterTab';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isFirstTimeSetup = params.firstTime === 'true';

  const isFocused = useIsFocused();
  const [user, setUser] = useState(getCurrentUser());
  const [activeTab, setActiveTab] = useState<'info' | 'reviews' | 'vendor-register'>(
    (params.tab as any) || 'info'
  );
  
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(isFirstTimeSetup);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Refresh user state when tab is focused
  useEffect(() => {
    if (isFocused) {
      const currentUser = getCurrentUser();
      setUser(currentUser);
      
      // If we just logged in, we should reload the profile data
      if (currentUser && !profile) {
        setLoading(true);
      }
    }
  }, [isFocused]);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getProfile();
        if (mounted) {
          setProfile(data);
          
          const isProfileIncomplete = !data.fullName || !data.phoneNumber;
          if (isFirstTimeSetup && isProfileIncomplete) {
            setIsEditing(true);
          } else if (isFirstTimeSetup && !isProfileIncomplete) {
            // Already complete, remove firstTime
            router.replace('/profile');
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Không thể tải thông tin cá nhân. Vui lòng thử lại.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, [user, isFirstTimeSetup]);

  const handleLogout = async () => {
    const { isConfirmed } = await toast.confirm({
      title: 'Đăng xuất',
      text: 'Bạn có chắc chắn muốn đăng xuất?',
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Đóng',
    });
    if (isConfirmed) {
      logout();
      setUser(null);
      toast.success('Đã đăng xuất thành công');
      router.replace('/login');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 12, color: '#6b7280' }}>Đang tải thông tin...</Text>
      </View>
    );
  }

  // GUEST STATE
  if (!user) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: '#f9fafb' }]}>
        <User color="#b45309" size={80} style={{ marginBottom: 20 }} />
        <Text style={styles.notLoggedInTitle}>Bạn chưa đăng nhập</Text>
        <Text style={styles.notLoggedInDesc}>
          Vui lòng đăng nhập để xem thông tin cá nhân và quản lý đơn hàng.
        </Text>
        <TouchableOpacity 
          style={styles.loginBtn}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.avatarContainer} onPress={() => {}}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User color="#fff" size={40} />
              </View>
            )}
            <View style={styles.editAvatarBadge}>
              <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>EDIT</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{profile?.fullName || user.name}</Text>
            {profile?.isVendor && (
              <View style={styles.vendorBadge}>
                <Store size={12} color="#fff" />
                <Text style={styles.vendorText}>Tài khoản Cửa hàng</Text>
              </View>
            )}
            <Text style={styles.headerEmail}>{user.email || 'N/A'}</Text>
          </View>
          
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut color="#ef4444" size={24} />
          </TouchableOpacity>
        </View>

        {/* TAB NAVIGATION */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'info' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('info')}
          >
            <User size={18} color={activeTab === 'info' ? '#000' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>Cá nhân</Text>
          </TouchableOpacity>
           <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'reviews' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('reviews')}
          >
            <Star size={18} color={activeTab === 'reviews' ? '#000' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>Đánh giá</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabBtn} 
            onPress={() => router.push('/orders' as any)}
          >
            <Package size={18} color="#6b7280" />
            <Text style={styles.tabText}>Đơn hàng</Text>
          </TouchableOpacity>

          {profile?.isVendor === false && (
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'vendor-register' && styles.tabBtnActive]} 
              onPress={() => setActiveTab('vendor-register')}
            >
              <Store size={18} color={activeTab === 'vendor-register' ? '#000' : '#6b7280'} />
              <Text style={[styles.tabText, activeTab === 'vendor-register' && styles.tabTextActive]}>Bán hàng</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* TAB CONTENT */}
        <View style={styles.tabContent}>
          {activeTab === 'info' && (
            <ProfileInfoTab 
              profile={profile} 
              isEditing={isEditing} 
              setIsEditing={setIsEditing} 
              onReload={async () => {
                const updated = await getProfile();
                setProfile(updated);
              }}
            />
          )}
          
          {activeTab === 'reviews' && (
             <View style={styles.emptyTab}>
               <Star color="#d1d5db" size={48} />
               <Text style={{ marginTop: 16, color: '#9ca3af' }}>Chưa có đánh giá nào</Text>
             </View>
          )}

          {activeTab === 'vendor-register' && (
            <VendorRegisterTab />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  notLoggedInTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 10 },
  notLoggedInDesc: { fontSize: 14, color: '#6b7280', marginHorizontal: 40, textAlign: 'center', marginBottom: 30 },
  loginBtn: { backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 24, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb' 
  },
  avatarContainer: { position: 'relative', width: 80, height: 80, borderRadius: 40, marginRight: 16 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#9ca3af', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  editAvatarBadge: { 
    position: 'absolute', bottom: 0, right: 0, backgroundColor: '#111827', 
    width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff'
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  vendorBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 4, gap: 4 },
  vendorText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  headerEmail: { fontSize: 14, color: '#6b7280' },
  logoutBtn: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 12 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#000' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#000' },
  tabContent: { padding: 16 },
  emptyTab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, backgroundColor: '#fff', borderRadius: 16 }
});
