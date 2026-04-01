import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, SafeAreaView, ScrollView } from 'react-native';
import { UserProfile, updateProfile, changePassword, logout } from '../services/auth';
import { useRouter } from 'expo-router';
import { Camera, MapPin, Map, CheckCircle2, ChevronDown, User as UserIcon, X, Calendar as CalendarIcon, Phone, History, Lock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import toast from '../services/toast';
import { getProvinces, getDistrictsByProvince, getWardsByDistrict, Province, District, Ward } from '../services/vietnamAddressApi';
import SelectModal from './SelectModal';

interface ProfileInfoTabProps {
  profile: UserProfile | null;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  onReload: () => Promise<void>;
}

export default function ProfileInfoTab({ profile, isEditing, setIsEditing, onReload }: ProfileInfoTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<any>(null); // Type any for expo-image-picker asset
  
  const [form, setForm] = useState({
    fullName: profile?.fullName || '',
    gender: profile?.gender || 'None',
    phoneNumber: profile?.phoneNumber || '',
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
    addressText: profile?.addressText || '',
    latitude: profile?.latitude || 0,
    longitude: profile?.longitude || 0,
  });

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);
  const [detailedAddress, setDetailedAddress] = useState('');

  // Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    // Only fetch address data if editing and user needs to input
    if (isEditing && provinces.length === 0) {
      getProvinces().then(setProvinces).catch(console.error);
    }
  }, [isEditing]);

  useEffect(() => {
    if (selectedProvince) {
      getDistrictsByProvince(selectedProvince).then(setDistricts).catch(console.error);
      setSelectedDistrict(null);
      setSelectedWard(null);
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedDistrict) {
      getWardsByDistrict(selectedDistrict).then(setWards).catch(console.error);
      setSelectedWard(null);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedProvince || selectedDistrict || selectedWard || detailedAddress) {
      const pName = provinces.find(p => p.code === selectedProvince)?.name || '';
      const dName = districts.find(d => d.code === selectedDistrict)?.name || '';
      const wName = wards.find(w => w.code === selectedWard)?.name || '';
      const combined = [detailedAddress, wName, dName, pName].filter(Boolean).join(', ');
      setForm(prev => ({ ...prev, addressText: combined }));
    }
  }, [selectedProvince, selectedDistrict, selectedWard, detailedAddress, provinces, districts, wards]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Cần quyền truy cập thư viện ảnh để đổi Avatar');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setAvatarPreview(result.assets[0].uri);
      setAvatarFile(result.assets[0]);
    }
  };

  const handleGetLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Quyền vị trí bị từ chối');
        setLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setForm(prev => ({
        ...prev,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }));
      toast.success('Đã lấy vị trí hiện tại thành công');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lấy vị trí hiện tại');
    } finally {
      setLoading(false);
    }
  };

  const parseDateForAPI = (dateString: string) => {
    if (!dateString) return '';
    try {
      const parts = dateString.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))).toISOString();
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  const validateForm = () => {
    if (!form.fullName.trim()) return 'Họ tên không được để trống';
    if (!form.phoneNumber.trim() || !/^\d{10,11}$/.test(form.phoneNumber)) return 'Số điện thoại không hợp lệ';
    if (!form.dateOfBirth.trim()) return 'Ngày sinh không được để trống (YYYY-MM-DD)';
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(form.dateOfBirth)) return 'Ngày sinh phải theo định dạng YYYY-MM-DD';
    if (!form.addressText.trim()) return 'Địa chỉ không được để trống';
    if (form.latitude === 0 || form.longitude === 0) return 'Vị trí bản đồ chưa được cập nhật. Vui lòng lấy vị trí hiện tại.';
    return null;
  };

  const handleSubmit = async () => {
    const errObj = validateForm();
    if (errObj) {
      toast.error(errObj);
      return;
    }

    try {
      setLoading(true);

      const requestPayload: any = {
        fullName: form.fullName,
        gender: form.gender,
        phoneNumber: form.phoneNumber,
        dateOfBirth: parseDateForAPI(form.dateOfBirth),
        addressText: form.addressText,
        latitude: form.latitude,
        longitude: form.longitude,
      };

      if (avatarFile) {
        requestPayload.avatarFile = {
          uri: avatarFile.uri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        };
      }

      await updateProfile(requestPayload);
      toast.success('Cập nhật thông tin thành công!');
      setIsEditing(false);
      await onReload();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwdForm.oldPassword || !pwdForm.newPassword) {
      toast.error('Vui lòng nhập đầy đủ Mật khẩu cũ và Mật khẩu mới');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    try {
      setPwdLoading(true);
      await changePassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword });
      toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
      setShowPasswordModal(false);
      setTimeout(() => logout(), 1000);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đổi mật khẩu');
    } finally {
      setPwdLoading(false);
    }
  };

  // View Mode Component
  if (!isEditing) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Thông tin cá nhân</Text>
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Text style={styles.editBtnText}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Họ và tên</Text>
          <Text style={styles.infoValue}>{profile?.fullName || 'Chưa thiết lập'}</Text>
        </View>
        <View style={styles.divider} />
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Giới tính</Text>
          <Text style={styles.infoValue}>{profile?.gender === 'Male' ? 'Nam' : profile?.gender === 'Female' ? 'Nữ' : 'Khác'}</Text>
        </View>
        <View style={styles.divider} />
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Số điện thoại</Text>
          <Text style={styles.infoValue}>{profile?.phoneNumber || 'Chưa thiết lập'}</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Ngày sinh</Text>
          <Text style={styles.infoValue}>{profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : 'Chưa thiết lập'}</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Địa chỉ</Text>
          <Text style={styles.infoValue}>{profile?.addressText || 'Chưa thiết lập'}</Text>
        </View>
        <View style={styles.divider} />

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}
            onPress={() => router.push('/wallet/history')}
          >
            <History color="#0284c7" size={18} />
            <Text style={[styles.actionBtnText, { color: '#0284c7' }]}>Giao dịch</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }]}
            onPress={() => setShowPasswordModal(true)}
          >
            <Lock color="#111827" size={18} />
            <Text style={[styles.actionBtnText, { color: '#111827' }]}>Đổi mật khẩu</Text>
          </TouchableOpacity>
        </View>

        {/* Password Modal */}
        <Modal visible={showPasswordModal} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
                <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                  <X color="#374151" size={24} />
                </TouchableOpacity>
              </View>
              
              <View style={{ padding: 16 }}>
                <Text style={styles.inputLabel}>Mật khẩu cũ</Text>
                <TextInput 
                  style={styles.input} 
                  secureTextEntry 
                  value={pwdForm.oldPassword} 
                  onChangeText={(t) => setPwdForm(p => ({...p, oldPassword: t}))} 
                />
                
                <Text style={styles.inputLabel}>Mật khẩu mới</Text>
                <TextInput 
                  style={styles.input} 
                  secureTextEntry 
                  value={pwdForm.newPassword} 
                  onChangeText={(t) => setPwdForm(p => ({...p, newPassword: t}))} 
                />
                
                <Text style={styles.inputLabel}>Xác nhận mật khẩu mới</Text>
                <TextInput 
                  style={styles.input} 
                  secureTextEntry 
                  value={pwdForm.confirmPassword} 
                  onChangeText={(t) => setPwdForm(p => ({...p, confirmPassword: t}))} 
                />

                <TouchableOpacity 
                  style={styles.submitBtn} 
                  onPress={handleChangePassword} 
                  disabled={pwdLoading}
                >
                  {pwdLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Xác nhận đổi</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    );
  }

  // Edit Mode Component
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Chỉnh sửa thông tin</Text>
      
      {/* Upload Avatar */}
      <View style={styles.avatarEditContainer}>
        <TouchableOpacity style={styles.avatarPlaceholder} onPress={handlePickImage}>
          {avatarPreview ? (
            <Text style={{color: '#000', fontWeight: 'bold'}}>Đã chọn ảnh mới</Text>
          ) : (
            <>
              <Camera color="#9ca3af" size={32} />
              <Text style={{color: '#6b7280', fontSize: 12, marginTop: 4}}>Đổi Avatar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Họ và tên <Text style={styles.required}>*</Text></Text>
        <TextInput 
          style={styles.input}
          value={form.fullName}
          onChangeText={(t) => setForm(p => ({...p, fullName: t}))}
          placeholder="Nhập họ và tên"
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.inputLabel}>Số điện thoại <Text style={styles.required}>*</Text></Text>
          <TextInput 
            style={styles.input}
            value={form.phoneNumber}
            onChangeText={(t) => setForm(p => ({...p, phoneNumber: t}))}
            placeholder="0912..."
            keyboardType="phone-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.inputLabel}>Giới tính</Text>
          <View style={styles.genderRow}>
            <TouchableOpacity 
              style={[styles.genderBtn, form.gender === 'Male' && styles.genderBtnActive]}
              onPress={() => setForm(p => ({...p, gender: 'Male'}))}
            >
              <Text style={[styles.genderText, form.gender === 'Male' && styles.genderTextActive]}>Nam</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.genderBtn, form.gender === 'Female' && styles.genderBtnActive]}
              onPress={() => setForm(p => ({...p, gender: 'Female'}))}
            >
              <Text style={[styles.genderText, form.gender === 'Female' && styles.genderTextActive]}>Nữ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Ngày sinh (YYYY-MM-DD) <Text style={styles.required}>*</Text></Text>
        <TextInput 
          style={styles.input}
          value={form.dateOfBirth}
          onChangeText={(t) => setForm(p => ({...p, dateOfBirth: t}))}
          placeholder="Ví dụ: 1999-12-30"
        />
      </View>

      {/* Address Selection Section */}
      <View style={styles.sectionHeader}>
        <MapPin color="#000" size={18} />
        <Text style={styles.sectionTitle}>Địa chỉ liên lạc</Text>
      </View>

      <SelectModal
        label="Tỉnh / Thành phố"
        placeholder="Chọn tỉnh/thành"
        value={selectedProvince}
        options={provinces.map(p => ({ value: p.code, label: p.name }))}
        onSelect={(val) => setSelectedProvince(val as number)}
      />
      
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <SelectModal
            label="Quận / Huyện"
            placeholder="Chọn quận/huyện"
            value={selectedDistrict}
            options={districts.map(d => ({ value: d.code, label: d.name }))}
            onSelect={(val) => setSelectedDistrict(val as number)}
            disabled={!selectedProvince}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SelectModal
            label="Phường / Xã"
            placeholder="Chọn phường/xã"
            value={selectedWard}
            options={wards.map(w => ({ value: w.code, label: w.name }))}
            onSelect={(val) => setSelectedWard(val as number)}
            disabled={!selectedDistrict}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Số nhà, Tên đường</Text>
        <TextInput 
          style={styles.input}
          value={detailedAddress}
          onChangeText={setDetailedAddress}
          placeholder="Ví dụ: Số 12, Đường Lê Lợi"
        />
      </View>

      <View style={styles.addressPreviewBox}>
        <Text style={styles.addressPreviewText}>📍 {form.addressText || 'Chưa có thông tin địa chỉ đầy đủ'}</Text>
      </View>

      {/* GPS Location Box */}
      <View style={styles.gpsBox}>
        <View>
          <Text style={{ fontWeight: '600', color: '#374151' }}>Tọa độ GPS <Text style={styles.required}>*</Text></Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {form.latitude !== 0 ? `Lat: ${form.latitude.toFixed(4)}, Lng: ${form.longitude.toFixed(4)}` : 'Chưa thiết lập'}
          </Text>
        </View>
        <TouchableOpacity style={styles.gpsBtn} onPress={handleGetLocation} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <MapPin color="#fff" size={16} />}
          <Text style={styles.gpsBtnText}>Lấy vị trí</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.cancelBtn} 
          onPress={() => setIsEditing(false)}
          disabled={loading}
        >
          <Text style={styles.cancelBtnText}>Hủy</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Lưu thay đổi</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  editBtnText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Edit Mode Styles
  avatarEditContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  genderBtnActive: {
    borderColor: '#000',
    backgroundColor: '#f8fafc',
  },
  genderText: {
    color: '#374151',
    fontWeight: '500',
  },
  genderTextActive: {
    color: '#000',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  addressPreviewBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  addressPreviewText: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  gpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  gpsBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#4b5563',
    fontWeight: '600',
    fontSize: 16,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '90%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  submitBtn: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
