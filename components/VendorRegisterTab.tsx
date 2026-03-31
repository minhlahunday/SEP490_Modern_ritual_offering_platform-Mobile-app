import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { getVendorRegistration, VendorRegistrationResponse, registerVendor, VendorDocumentRequest } from '../services/auth';
import { Camera, MapPin, Store, CheckCircle, Clock, XCircle, FileIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import toast from '../services/toast';
import { getProvinces, getDistrictsByProvince, getWardsByDistrict, Province, District, Ward } from '../services/vietnamAddressApi';
import SelectModal from './SelectModal';

export default function VendorRegisterTab() {
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<VendorRegistrationResponse | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  
  const [form, setForm] = useState({
    shopName: '',
    shopDescription: '',
    shopAvatarUrl: null as any,
    businessType: '1', // 1: Cá nhân, 2: Doanh nghiệp
    taxCode: '',
    shopAddressText: '',
    shopLatitude: 0,
    shopLongitude: 0,
    dailyCapacity: 5,
  });

  const [documents, setDocuments] = useState([
    { documentType: 1, file: null as any, label: 'CMND/CCCD mặt trước', mandatory: true },
    { documentType: 2, file: null as any, label: 'CMND/CCCD mặt sau', mandatory: true },
    { documentType: 3, file: null as any, label: 'Ảnh selfie cầm CMND/CCCD', mandatory: true },
    { documentType: 4, file: null as any, label: 'Giấy chứng nhận đăng ký thuế', mandatory: false },
    { documentType: 5, file: null as any, label: 'Giấy phép kinh doanh', mandatory: false },
  ]);

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);
  const [detailedAddress, setDetailedAddress] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getVendorRegistration();
      setVendorData(data);
    } catch (err: any) {
      // 404 is fine (not registered yet)
      if (err.message && !err.message.includes('404')) {
        console.error(err);
      }
    } finally {
      setLoading(false);
      // Load provinces for form
      getProvinces().then(setProvinces).catch(console.error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      setForm(prev => ({ ...prev, shopAddressText: combined }));
    }
  }, [selectedProvince, selectedDistrict, selectedWard, detailedAddress, provinces, districts, wards]);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Cần quyền truy cập thư viện ảnh');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setForm(prev => ({ ...prev, shopAvatarUrl: result.assets[0] }));
    }
  };

  const handlePickDocument = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Cần quyền truy cập thư viện ảnh');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newDocs = [...documents];
      newDocs[index].file = result.assets[0];
      setDocuments(newDocs);
    }
  };

  const handleGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Quyền vị trí bị từ chối');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setForm(prev => ({
        ...prev,
        shopLatitude: location.coords.latitude,
        shopLongitude: location.coords.longitude,
      }));
      toast.success('Đã lấy vị trí cửa hàng thành công');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lấy vị trí');
    }
  };

  const validateForm = () => {
    if (!form.shopName.trim()) return 'Nhập tên hiển thị của cửa hàng';
    if (!form.shopDescription.trim()) return 'Nhập mô tả của cửa hàng';
    if (!form.taxCode.trim()) return 'Nhập CMND/Mã số thuế';
    if (!form.shopAddressText.trim()) return 'Nhập địa chỉ cửa hàng';
    if (form.shopLatitude === 0 || form.shopLongitude === 0) return 'Vui lòng lấy tọa độ GPS cho gian hàng';
    if (!form.shopAvatarUrl) return 'Vui lòng chọn Ảnh đại diện Cửa hàng';
    
    // Check mandatory docs
    for (const doc of documents) {
      if (doc.mandatory && !doc.file) {
        return `Vui lòng tải lên tài liệu: ${doc.label}`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const errObj = validateForm();
    if (errObj) {
      toast.error(errObj);
      return;
    }
    try {
      setIsRegistering(true);
      
      const payload: any = {
        shopName: form.shopName,
        shopDescription: form.shopDescription,
        businessType: form.businessType,
        taxCode: form.taxCode,
        shopAddressText: form.shopAddressText,
        shopLatitude: form.shopLatitude,
        shopLongitude: form.shopLongitude,
        dailyCapacity: form.dailyCapacity,
        shopAvatarUrl: {
          uri: form.shopAvatarUrl.uri,
          name: 'shop_avatar.jpg',
          type: 'image/jpeg',
        },
        documents: documents.filter(d => d.file).map(d => ({
          documentType: d.documentType,
          file: {
            uri: d.file.uri,
            name: `document_${d.documentType}.jpg`,
            type: 'image/jpeg',
          }
        })) as VendorDocumentRequest[],
      };

      await registerVendor(payload);
      toast.success('Đã nộp đơn đăng ký thành công! Vui lòng chờ xét duyệt.');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi gửi hồ sơ đăng ký');
    } finally {
      setIsRegistering(false);
    }
  };

  if (loading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator color="#000" size="large" />
      </View>
    );
  }

  // STATUS VIEW (ALREADY REGISTERED)
  if (vendorData) {
    const isApproved = vendorData.verificationStatus === 'Verified';
    const isPending = vendorData.verificationStatus === 'Pending';
    const isRejected = vendorData.verificationStatus === 'Rejected';

    return (
      <View style={styles.card}>
        <View style={styles.statusHeader}>
          {isApproved && <CheckCircle color="#10b981" size={48} />}
          {isPending && <Clock color="#f59e0b" size={48} />}
          {isRejected && <XCircle color="#ef4444" size={48} />}
          
          <Text style={styles.statusTitle}>
            {isApproved ? 'Đăng ký thành công' : 
             isPending ? 'Đang chờ xét duyệt' : 'Đăng ký bị từ chối'}
          </Text>
          <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 8 }}>
            {isApproved ? 'Tài khoản của bạn đã được nâng cấp thành Cửa hàng.' : 
             isPending ? 'Hồ sơ của bạn đang được quản trị viên kiểm tra.' : 
             'Vui lòng kiểm tra lại thông tin và nộp lại hồ sơ.'}
          </Text>
        </View>

        <View style={styles.divider} />
        
        <View style={{ marginVertical: 12 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 16 }}>Thông tin đã khai báo</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tên cửa hàng</Text>
            <Text style={styles.infoValue}>{vendorData.shopName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mã số</Text>
            <Text style={styles.infoValue}>{vendorData.taxCode}</Text>
          </View>
        </View>

        {isRejected && (
          <TouchableOpacity style={styles.resubmitBtn} onPress={() => setIsResubmitting(true)}>
            <Text style={styles.resubmitBtnText}>Nộp lại hồ sơ</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // REGISTRATION FORM
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Đăng ký trở thành Người Bán</Text>
      <Text style={styles.cardDesc}>Điền thông tin và tải lên các giấy tờ cần thiết để thiết lập gian hàng của bạn.</Text>
      
      {/* Upload Avatar */}
      <View style={styles.avatarEditContainer}>
        <TouchableOpacity style={styles.avatarPlaceholder} onPress={handlePickAvatar}>
          {form.shopAvatarUrl ? (
            <Image source={{ uri: form.shopAvatarUrl.uri }} style={styles.avatarImg} />
          ) : (
            <>
              <Store color="#9ca3af" size={32} />
              <Text style={{color: '#6b7280', fontSize: 12, marginTop: 4}}>Ảnh Shop</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Tên gian hàng hiển thị <Text style={styles.required}>*</Text></Text>
        <TextInput 
          style={styles.input}
          value={form.shopName}
          onChangeText={(t) => setForm(p => ({...p, shopName: t}))}
          placeholder="Nhập tên"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Mô tả gian hàng <Text style={styles.required}>*</Text></Text>
        <TextInput 
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={form.shopDescription}
          onChangeText={(t) => setForm(p => ({...p, shopDescription: t}))}
          placeholder="Viết một đoạn giới thiệu ngắn"
          multiline
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.inputLabel}>Loại hình <Text style={styles.required}>*</Text></Text>
          <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {/* Simple fallback since we don't have standard Select list */}
            <TouchableOpacity style={{ padding: 12, backgroundColor: form.businessType === '1' ? '#000' : '#fff' }} onPress={() => setForm(p => ({...p, businessType: '1'}))}>
              <Text style={{ color: form.businessType === '1' ? '#fff' : '#000', textAlign: 'center' }}>Cá nhân</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 12, backgroundColor: form.businessType === '2' ? '#000' : '#fff' }} onPress={() => setForm(p => ({...p, businessType: '2'}))}>
              <Text style={{ color: form.businessType === '2' ? '#fff' : '#000', textAlign: 'center' }}>Doanh nghiệp</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.inputLabel}>CMND/MST <Text style={styles.required}>*</Text></Text>
          <TextInput 
            style={styles.input}
            value={form.taxCode}
            onChangeText={(t) => setForm(p => ({...p, taxCode: t}))}
            placeholder="0123..."
          />
        </View>
      </View>

      {/* Address Selection Section */}
      <View style={styles.sectionHeader}>
        <MapPin color="#000" size={18} />
        <Text style={styles.sectionTitle}>Vị trí cửa hàng</Text>
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

      {/* GPS Location Box */}
      <View style={styles.gpsBox}>
        <View>
          <Text style={{ fontWeight: '600', color: '#374151' }}>Tọa độ Cửa hàng <Text style={styles.required}>*</Text></Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {form.shopLatitude !== 0 ? `Lat: ${form.shopLatitude.toFixed(4)}, Lng: ${form.shopLongitude.toFixed(4)}` : 'Chưa thiết lập'}
          </Text>
        </View>
        <TouchableOpacity style={styles.gpsBtn} onPress={handleGetLocation}>
          <MapPin color="#fff" size={16} />
          <Text style={styles.gpsBtnText}>Lấy vị trí</Text>
        </TouchableOpacity>
      </View>

      {/* Documents */}
      <View style={styles.sectionHeader}>
        <FileIcon color="#000" size={18} />
        <Text style={styles.sectionTitle}>Hồ sơ chứng thực</Text>
      </View>

      <View style={styles.documentsContainer}>
        {documents.map((doc, index) => (
          <TouchableOpacity 
            key={doc.documentType} 
            style={[styles.docItem, doc.file && styles.docItemFilled]}
            onPress={() => handlePickDocument(index)}
          >
            <View style={styles.docInfo}>
              <Text style={styles.docLabel}>
                {doc.label} {doc.mandatory && <Text style={styles.required}>*</Text>}
              </Text>
              <Text style={styles.docStatus}>
                {doc.file ? 'Đã đính kèm ảnh' : 'Chưa có file'}
              </Text>
            </View>
            <View style={[styles.docAction, doc.file && { backgroundColor: '#10b981' }]}>
              {doc.file ? <CheckCircle color="#fff" size={20} /> : <Camera color="#6b7280" size={20} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={styles.submitBtn} 
        onPress={handleSubmit}
        disabled={isRegistering}
      >
        {isRegistering ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Gửi hồ sơ đăng ký</Text>}
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  cardDesc: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  statusHeader: { alignItems: 'center', paddingVertical: 20 },
  statusTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginTop: 12 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { color: '#6b7280', fontSize: 14, flex: 1 },
  infoValue: { color: '#111827', fontSize: 14, fontWeight: '500', flex: 2, textAlign: 'right' },
  resubmitBtn: { backgroundColor: '#000', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  resubmitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  avatarEditContainer: { alignItems: 'center', marginBottom: 20 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 50 },
  
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  required: { color: '#ef4444' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827' },
  
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  
  gpsBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 24 },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, gap: 6 },
  gpsBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  documentsContainer: { marginBottom: 24, gap: 12 },
  docItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  docItemFilled: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  docInfo: { flex: 1 },
  docLabel: { fontSize: 14, fontWeight: '500', color: '#111827' },
  docStatus: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  docAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },

  submitBtn: { backgroundColor: '#000', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
