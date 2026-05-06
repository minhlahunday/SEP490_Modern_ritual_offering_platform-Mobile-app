import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import { UserProfile, updateProfile, changePassword, logout, getAuthToken } from '../services/auth';
import { useRouter } from 'expo-router';
import { Camera, MapPin, Map, CheckCircle2, ChevronDown, User as UserIcon, X, Calendar as CalendarIcon, Phone, History, Lock, Eye, EyeOff } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import toast from '../services/toast';
import { getProvinces, getDistrictsByProvince, getWardsByDistrict, Province, District, Ward } from '../services/vietnamAddressApi';
import { geocodingService, AddressSuggestion } from '../services/geocodingService';
import { API_BASE_URL } from '../services/api';
import SelectModal from './SelectModal';
import AddressMapPicker from './AddressMapPicker';

interface ProfileInfoTabProps {
  profile: UserProfile | null;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  requiredSetup?: boolean;
  onReload: () => Promise<void>;
}

export default function ProfileInfoTab({ profile, isEditing, setIsEditing, requiredSetup = false, onReload }: ProfileInfoTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<any>(null); // Type any for expo-image-picker asset
  
  const [form, setForm] = useState({
    fullName: profile?.fullName || '',
    gender: profile?.gender || 'None',
    phoneNumber: profile?.phoneNumber || '',
    dateOfBirth: profile?.dateOfBirth
      ? (() => {
          const raw = profile.dateOfBirth.split('T')[0];
          const parts = raw.split('-');
          if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
          return raw;
        })()
      : '',
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
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [loadingAddressSuggestions, setLoadingAddressSuggestions] = useState(false);
  const [mapConfirmLoading, setMapConfirmLoading] = useState(false);

  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedExistingAddressId, setSelectedExistingAddressId] = useState<string | number | null>(null);

  // Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  interface CustomerAddress {
    addressId?: string | number;
    addressText?: string;
    fullAddress?: string;
    latitude?: number;
    longitude?: number;
    isDefault?: boolean;
  }

  const isSameAddressId = (
    left: string | number | null | undefined,
    right: string | number | null | undefined
  ): boolean => {
    if (left === null || left === undefined || right === null || right === undefined) {
      return false;
    }
    return String(left) === String(right);
  };

  const normalizeAddressText = (value?: string | null): string => {
    if (!value) return '';
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(tinh|thanh pho|quan|huyen|phuong|xa|thi tran|thi xa|tp\.?|q\.?|p\.?)\b/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isNameMatch = (left?: string, right?: string): boolean => {
    const leftNorm = normalizeAddressText(left);
    const rightNorm = normalizeAddressText(right);
    if (!leftNorm || !rightNorm) return false;
    return leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm);
  };

  const normalizeVietnamPhoneNumber = (value: string): string => {
    return String(value || '').replace(/\D/g, '');
  };

  const isValidVietnamPhoneNumber = (value: string): boolean => {
    const normalized = normalizeVietnamPhoneNumber(value);
    return /^\d{9,11}$/.test(normalized);
  };

  const fetchCustomerAddresses = async (): Promise<CustomerAddress[]> => {
    try {
      const token = getAuthToken();
      if (!token) return [];

      const response = await fetch(`${API_BASE_URL}/addresses`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`Failed to fetch addresses: ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) return data as CustomerAddress[];
      if (data?.isSuccess && Array.isArray(data.result)) return data.result as CustomerAddress[];

      return [];
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
      return [];
    }
  };

  const createCustomerAddress = async (payload: {
    addressText: string;
    latitude: number;
    longitude: number;
    isDefault: boolean;
  }): Promise<CustomerAddress | null> => {
    try {
      const token = getAuthToken();
      if (!token) return null;

      const response = await fetch(`${API_BASE_URL}/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Failed to create address: ${response.status}`);
      }

      const data = await response.json().catch(() => null);
      if (data && typeof data === 'object' && (data.addressId || data.addressText || data.fullAddress)) {
        return data as CustomerAddress;
      }
      if (data?.isSuccess && data.result) {
        return data.result as CustomerAddress;
      }

      return null;
    } catch (error) {
      console.error('Failed to create address:', error);
      return null;
    }
  };

  const deleteCustomerAddress = async (addressId: string | number): Promise<boolean> => {
    try {
      const token = getAuthToken();
      if (!token) return false;

      const response = await fetch(`${API_BASE_URL}/addresses/${addressId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Failed to delete address: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete address:', error);
      return false;
    }
  };

  const setDefaultCustomerAddress = async (addressId: string | number): Promise<boolean> => {
    try {
      const token = getAuthToken();
      if (!token) return false;

      const response = await fetch(`${API_BASE_URL}/addresses/${addressId}/set-default`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Failed to set default address: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to set default address:', error);
      return false;
    }
  };

  useEffect(() => {
    // Only fetch address data if editing and user needs to input
    if (isEditing && provinces.length === 0) {
      getProvinces().then(setProvinces).catch(console.error);
    }
  }, [isEditing]);

  useEffect(() => {
    const loadAddresses = async () => {
      const data = await fetchCustomerAddresses();
      setCustomerAddresses(data);

      if (!isEditing) {
        return;
      }

      const defaultAddress = data.find((item) => item.isDefault) || data[0];
      if (defaultAddress) {
        const selectedId = defaultAddress.addressId ?? null;
        const selectedAddressText = defaultAddress.addressText || defaultAddress.fullAddress || '';
        setSelectedExistingAddressId(selectedId);
        setDetailedAddress(selectedAddressText);
        setForm((prev) => ({
          ...prev,
          addressText: selectedAddressText,
          latitude: typeof defaultAddress.latitude === 'number' ? defaultAddress.latitude : prev.latitude,
          longitude: typeof defaultAddress.longitude === 'number' ? defaultAddress.longitude : prev.longitude,
        }));
      }
    };

    loadAddresses();
  }, [isEditing, profile?.profileId, profile?.updatedAt]);

  const defaultSavedAddress = customerAddresses.find((item) => item.isDefault) || customerAddresses[0];
  const resolvedProfileAddress =
    profile?.addressText?.trim() ||
    defaultSavedAddress?.addressText ||
    defaultSavedAddress?.fullAddress ||
    '';

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

  useEffect(() => {
    if (!isEditing || selectedExistingAddressId !== null) {
      setAddressSuggestions([]);
      setLoadingAddressSuggestions(false);
      return;
    }

    const keyword = detailedAddress.trim();
    if (keyword.length < 3) {
      setAddressSuggestions([]);
      setLoadingAddressSuggestions(false);
      return;
    }

    const districtName = districts.find((d) => d.code === selectedDistrict)?.name;
    const provinceName = provinces.find((p) => p.code === selectedProvince)?.name;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoadingAddressSuggestions(true);
        const suggestions = await geocodingService.suggestAddresses(keyword, districtName, provinceName);
        if (!cancelled) {
          setAddressSuggestions(suggestions);
        }
      } catch {
        if (!cancelled) {
          setAddressSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingAddressSuggestions(false);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isEditing, selectedExistingAddressId, detailedAddress, selectedDistrict, selectedProvince, districts, provinces]);

  useEffect(() => {
    if (!isEditing || selectedExistingAddressId !== null) return;

    const provinceName = provinces.find((p) => p.code === selectedProvince)?.name;
    const districtName = districts.find((d) => d.code === selectedDistrict)?.name;
    const wardName = wards.find((w) => w.code === selectedWard)?.name;
    const hasEnoughAddress = !!detailedAddress.trim() && !!provinceName && !!districtName;
    if (!hasEnoughAddress) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await geocodingService.geocodeAddressComponents({
          detailedAddress: detailedAddress.trim(),
          wardName,
          districtName,
          provinceName,
        });

        if (!cancelled && result) {
          setForm((prev) => ({
            ...prev,
            latitude: result.latitude,
            longitude: result.longitude,
          }));
        }
      } catch {
        // Keep current coordinates if geocoding fails.
      }
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isEditing, selectedExistingAddressId, selectedProvince, selectedDistrict, selectedWard, detailedAddress, provinces, districts, wards]);

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
      const message = err instanceof Error ? err.message : '';
      const isUnavailable = /Current location is unavailable|LOCATION_UNAVAILABLE|E_LOCATION_UNAVAILABLE/i.test(message);
      console.warn('Get current location failed:', message || err);
      toast.error(
        isUnavailable
          ? 'Không lấy được vị trí hiện tại. Hãy bật GPS hoặc chọn trực tiếp trên bản đồ.'
          : 'Lỗi khi lấy vị trí hiện tại.'
      );
    } finally {
      setLoading(false);
    }
  };

  const parseDateForAPI = (dateString: string) => {
    if (!dateString) return '';
    try {
      const dmy = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        const year = Number(dmy[3]);
        const yyyy = String(year).padStart(4, '0');
        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }

      const parts = dateString.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        const yyyy = String(year).padStart(4, '0');
        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  const validateForm = () => {
    if (!form.fullName.trim()) return 'Họ tên không được để trống';
    if (!form.phoneNumber.trim() || !isValidVietnamPhoneNumber(form.phoneNumber)) {
      return 'Số điện thoại không hợp lệ';
    }
    if (!form.dateOfBirth.trim()) return 'Ngày sinh không được để trống (DD/MM/YYYY)';
    const dobRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dobRegex.test(form.dateOfBirth)) return 'Ngày sinh phải theo định dạng DD/MM/YYYY';

    const [dayRaw, monthRaw, yearRaw] = form.dateOfBirth.split('/');
    const day = Number(dayRaw);
    const month = Number(monthRaw);
    const year = Number(yearRaw);
    const dobDate = new Date(year, month - 1, day);
    if (
      !Number.isFinite(day) ||
      !Number.isFinite(month) ||
      !Number.isFinite(year) ||
      dobDate.getFullYear() !== year ||
      dobDate.getMonth() !== month - 1 ||
      dobDate.getDate() !== day
    ) {
      return 'Ngày sinh không hợp lệ';
    }

    const today = new Date();
    if (dobDate > today) return 'Ngày sinh không được lớn hơn ngày hiện tại';

    if (!form.addressText.trim()) return 'Địa chỉ không được để trống';
    if (form.latitude === 0 || form.longitude === 0) return 'Vị trí bản đồ chưa được cập nhật. Vui lòng chọn địa chỉ cụ thể hoặc dùng vị trí hiện tại.';
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

      if (selectedExistingAddressId === null && selectedProvince && selectedDistrict) {
        const selectedProvinceName = provinces.find((p) => p.code === selectedProvince)?.name;
        const selectedDistrictName = districts.find((d) => d.code === selectedDistrict)?.name;
        const selectedWardName = wards.find((w) => w.code === selectedWard)?.name;

        if (selectedProvinceName && selectedDistrictName && detailedAddress.trim()) {
          try {
            const geoResult = await geocodingService.geocodeAddressComponents({
              detailedAddress: detailedAddress.trim(),
              wardName: selectedWardName,
              districtName: selectedDistrictName,
              provinceName: selectedProvinceName,
            });

            if (geoResult) {
              form.latitude = geoResult.latitude;
              form.longitude = geoResult.longitude;
            }
          } catch {
            // Continue with manually selected current coordinates.
          }
        }
      }

      const requestPayload: any = {
        fullName: form.fullName,
        gender: form.gender,
        phoneNumber: normalizeVietnamPhoneNumber(form.phoneNumber),
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

      const normalizedAddress = (requestPayload.addressText || '').trim().toLowerCase();
      const selectedAddress = selectedExistingAddressId !== null
        ? customerAddresses.find((item) => isSameAddressId(item.addressId, selectedExistingAddressId))
        : undefined;
      const matchedAddress = customerAddresses.find((item) => {
        const text = (item.addressText || item.fullAddress || '').trim().toLowerCase();
        return normalizedAddress && text === normalizedAddress;
      });

      if (selectedAddress?.addressId !== undefined && selectedAddress?.addressId !== null) {
        if (!selectedAddress.isDefault) {
          await setDefaultCustomerAddress(selectedAddress.addressId);
        }
      } else if (matchedAddress?.addressId !== undefined && matchedAddress?.addressId !== null) {
        if (!matchedAddress.isDefault) {
          await setDefaultCustomerAddress(matchedAddress.addressId);
        }
      } else if (normalizedAddress) {
        const created = await createCustomerAddress({
          addressText: requestPayload.addressText,
          latitude: requestPayload.latitude,
          longitude: requestPayload.longitude,
          isDefault: customerAddresses.length === 0,
        });

        if (created?.addressId !== undefined && created?.addressId !== null && customerAddresses.length > 0) {
          await setDefaultCustomerAddress(created.addressId);
        }
      }

      await updateProfile(requestPayload);
      toast.success('Cập nhật thông tin thành công!');
      setIsEditing(false);
      await onReload();

      const refreshedAddresses = await fetchCustomerAddresses();
      setCustomerAddresses(refreshedAddresses);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePickAddressSuggestion = async (suggestion: AddressSuggestion) => {
    setSelectedExistingAddressId(null);
    setAddressSuggestions([]);

    let resolvedDetailedAddress = suggestion.displayName.split(',')[0]?.trim() || suggestion.displayName;
    let composedAddress = suggestion.displayName;

    try {
      const reverseData = await geocodingService.reverseGeocodeDetails(suggestion.latitude, suggestion.longitude);

      if (reverseData) {
        const matchedProvince = provinces.find((province) => (
          isNameMatch(reverseData.provinceName, province.name) ||
          isNameMatch(reverseData.provinceName, province.full_name) ||
          isNameMatch(reverseData.formattedAddress, province.name) ||
          isNameMatch(reverseData.formattedAddress, province.full_name)
        ));

        let matchedDistrict: District | undefined;
        let matchedWard: Ward | undefined;

        if (matchedProvince) {
          setSelectedProvince(matchedProvince.code);
          const provinceDistricts = await getDistrictsByProvince(matchedProvince.code);
          setDistricts(provinceDistricts);

          matchedDistrict = provinceDistricts.find((district) => (
            isNameMatch(reverseData.districtName, district.name) ||
            isNameMatch(reverseData.districtName, district.full_name) ||
            isNameMatch(reverseData.formattedAddress, district.name) ||
            isNameMatch(reverseData.formattedAddress, district.full_name)
          ));

          if (matchedDistrict) {
            setSelectedDistrict(matchedDistrict.code);
            const districtWards = await getWardsByDistrict(matchedDistrict.code);
            setWards(districtWards);

            matchedWard = districtWards.find((ward) => (
              isNameMatch(reverseData.wardName, ward.name) ||
              isNameMatch(reverseData.wardName, ward.full_name) ||
              isNameMatch(reverseData.formattedAddress, ward.name) ||
              isNameMatch(reverseData.formattedAddress, ward.full_name)
            ));

            if (matchedWard) {
              setSelectedWard(matchedWard.code);
            }
          }
        }

        resolvedDetailedAddress =
          reverseData.detailedAddress ||
          reverseData.formattedAddress.split(',')[0]?.trim() ||
          resolvedDetailedAddress;

        const provinceText = matchedProvince?.name || reverseData.provinceName || '';
        const districtText = matchedDistrict?.name || reverseData.districtName || '';
        const wardText = matchedWard?.name || reverseData.wardName || '';

        composedAddress = [resolvedDetailedAddress, wardText, districtText, provinceText]
          .filter(Boolean)
          .join(', ') || reverseData.formattedAddress || suggestion.displayName;
      }
    } catch {
      // Keep fallback suggestion text when reverse geocoding/matching fails.
    }

    setDetailedAddress(resolvedDetailedAddress);
    setForm((prev) => ({
      ...prev,
      addressText: composedAddress,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    }));
  };

  const mapPickerPosition = {
    latitude: Number(form.latitude) || 10.8231,
    longitude: Number(form.longitude) || 106.6297,
  };

  const handleMapPositionChange = ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    setSelectedExistingAddressId(null);
    setForm((prev) => ({
      ...prev,
      latitude,
      longitude,
    }));
  };

  const handleConfirmMapSelection = async () => {
    try {
      setMapConfirmLoading(true);
      setSelectedExistingAddressId(null);

      const reverseData = await geocodingService.reverseGeocodeDetails(mapPickerPosition.latitude, mapPickerPosition.longitude);
      if (!reverseData) {
        toast.error('Không thể xác định địa chỉ từ vị trí đã chọn.');
        return;
      }

      const matchedProvince = provinces.find((province) => (
        isNameMatch(reverseData.provinceName, province.name) ||
        isNameMatch(reverseData.provinceName, province.full_name) ||
        isNameMatch(reverseData.formattedAddress, province.name) ||
        isNameMatch(reverseData.formattedAddress, province.full_name)
      ));

      let matchedDistrict: District | undefined;
      let matchedWard: Ward | undefined;

      if (matchedProvince) {
        setSelectedProvince(matchedProvince.code);
        const provinceDistricts = await getDistrictsByProvince(matchedProvince.code);
        setDistricts(provinceDistricts);

        matchedDistrict = provinceDistricts.find((district) => (
          isNameMatch(reverseData.districtName, district.name) ||
          isNameMatch(reverseData.districtName, district.full_name) ||
          isNameMatch(reverseData.formattedAddress, district.name) ||
          isNameMatch(reverseData.formattedAddress, district.full_name)
        ));

        if (matchedDistrict) {
          setSelectedDistrict(matchedDistrict.code);
          const districtWards = await getWardsByDistrict(matchedDistrict.code);
          setWards(districtWards);

          matchedWard = districtWards.find((ward) => (
            isNameMatch(reverseData.wardName, ward.name) ||
            isNameMatch(reverseData.wardName, ward.full_name) ||
            isNameMatch(reverseData.formattedAddress, ward.name) ||
            isNameMatch(reverseData.formattedAddress, ward.full_name)
          ));

          if (matchedWard) {
            setSelectedWard(matchedWard.code);
          }
        }
      }

      const resolvedDetailedAddress =
        reverseData.detailedAddress ||
        reverseData.formattedAddress.split(',')[0]?.trim() ||
        detailedAddress ||
        '';

      const provinceText = matchedProvince?.name || reverseData.provinceName || '';
      const districtText = matchedDistrict?.name || reverseData.districtName || '';
      const wardText = matchedWard?.name || reverseData.wardName || '';

      const composedAddress = [resolvedDetailedAddress, wardText, districtText, provinceText]
        .filter(Boolean)
        .join(', ');

      setDetailedAddress(resolvedDetailedAddress);
      setForm((prev) => ({
        ...prev,
        latitude: mapPickerPosition.latitude,
        longitude: mapPickerPosition.longitude,
        addressText: composedAddress || reverseData.formattedAddress || prev.addressText,
      }));

      toast.success('Đã xác nhận vị trí trên bản đồ.');
    } catch (error) {
      console.error('Failed to confirm map selection:', error);
      toast.error('Không thể xác nhận vị trí trên bản đồ.');
    } finally {
      setMapConfirmLoading(false);
    }
  };

  const handleDeleteAddress = (addressId: string | number, idForSelect: string | number) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc muốn xóa địa chỉ này không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteCustomerAddress(addressId);
          if (!ok) {
            toast.error('Không thể xóa địa chỉ. Vui lòng thử lại.');
            return;
          }

          const remaining = customerAddresses.filter((item) => !isSameAddressId(item.addressId, addressId));
          setCustomerAddresses(remaining);

          if (isSameAddressId(selectedExistingAddressId, idForSelect)) {
            const next = remaining.find((item) => item.isDefault) || remaining[0];
            if (next) {
              const nextId = next.addressId ?? null;
              const nextText = next.addressText || next.fullAddress || '';
              setSelectedExistingAddressId(nextId);
              setDetailedAddress(nextText);
              setForm((prev) => ({
                ...prev,
                addressText: nextText,
                latitude: typeof next.latitude === 'number' ? next.latitude : prev.latitude,
                longitude: typeof next.longitude === 'number' ? next.longitude : prev.longitude,
              }));
            } else {
              setSelectedExistingAddressId(null);
              setDetailedAddress('');
              setForm((prev) => ({ ...prev, addressText: '', latitude: 0, longitude: 0 }));
            }
          }

          toast.success('Đã xóa địa chỉ.');
        },
      },
    ]);
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
          <Text style={styles.infoLabel}>Khóa đặt hàng tới ngày</Text>
          <Text style={styles.infoValue}>
            {profile?.orderBlockedUntil ? new Date(profile.orderBlockedUntil).toLocaleDateString() : 'Không bị khóa'}
          </Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Số lần hủy đơn trong tháng</Text>
          <Text style={styles.infoValue}>{profile?.canceledOrdersCount || 0} đơn</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Địa chỉ</Text>
          <Text style={styles.infoValue}>{resolvedProfileAddress || 'Chưa thiết lập'}</Text>
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
            onPress={() => {
              setShowOldPassword(false);
              setShowNewPassword(false);
              setShowConfirmPassword(false);
              setShowPasswordModal(true);
            }}
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
                <TouchableOpacity
                  onPress={() => {
                    setShowOldPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                    setShowPasswordModal(false);
                  }}
                >
                  <X color="#374151" size={24} />
                </TouchableOpacity>
              </View>
              
              <View style={{ padding: 16 }}>
                <Text style={styles.inputLabel}>Mật khẩu cũ</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput 
                    style={styles.passwordInput}
                    secureTextEntry={!showOldPassword}
                    value={pwdForm.oldPassword} 
                    onChangeText={(t) => setPwdForm(p => ({...p, oldPassword: t}))}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowOldPassword((prev) => !prev)}>
                    {showOldPassword ? <EyeOff color="#64748b" size={18} /> : <Eye color="#64748b" size={18} />}
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.inputLabel}>Mật khẩu mới</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput 
                    style={styles.passwordInput}
                    secureTextEntry={!showNewPassword}
                    value={pwdForm.newPassword} 
                    onChangeText={(t) => setPwdForm(p => ({...p, newPassword: t}))}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNewPassword((prev) => !prev)}>
                    {showNewPassword ? <EyeOff color="#64748b" size={18} /> : <Eye color="#64748b" size={18} />}
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.inputLabel}>Xác nhận mật khẩu mới</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput 
                    style={styles.passwordInput}
                    secureTextEntry={!showConfirmPassword}
                    value={pwdForm.confirmPassword} 
                    onChangeText={(t) => setPwdForm(p => ({...p, confirmPassword: t}))}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword((prev) => !prev)}>
                    {showConfirmPassword ? <EyeOff color="#64748b" size={18} /> : <Eye color="#64748b" size={18} />}
                  </TouchableOpacity>
                </View>

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
            <Image source={{ uri: avatarPreview }} style={styles.avatarPreviewImage} />
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
            onChangeText={(t) => setForm(p => ({...p, phoneNumber: t.replace(/\D/g, '')}))}
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
        <Text style={styles.inputLabel}>Ngày sinh (DD/MM/YYYY) <Text style={styles.required}>*</Text></Text>
        <TextInput 
          style={styles.input}
          value={form.dateOfBirth}
          onChangeText={(t) => setForm(p => ({...p, dateOfBirth: t.replace(/[^\d/]/g, '')}))}
          placeholder="Ví dụ: 29/04/2006"
          keyboardType="number-pad"
        />
      </View>

      {/* Address Selection Section */}
      <View style={styles.sectionHeader}>
        <MapPin color="#000" size={18} />
        <Text style={styles.sectionTitle}>Địa chỉ liên lạc</Text>
      </View>

      {customerAddresses.length > 0 && (
        <View style={styles.savedAddressSection}>
          <View style={styles.savedAddressHeader}>
            <Text style={styles.inputLabel}>Địa chỉ đã lưu</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedExistingAddressId(null);
                setSelectedProvince(null);
                setSelectedDistrict(null);
                setSelectedWard(null);
                setDetailedAddress('');
                setAddressSuggestions([]);
                setForm((prev) => ({
                  ...prev,
                  addressText: '',
                  latitude: 0,
                  longitude: 0,
                }));
              }}
            >
              <Text style={styles.linkBtnText}>
                {selectedExistingAddressId === null ? 'Đang nhập địa chỉ mới' : 'Nhập địa chỉ mới'}
              </Text>
            </TouchableOpacity>
          </View>

          {customerAddresses.map((addr, index) => {
            const id = addr.addressId ?? `address-${index}`;
            const label = addr.addressText || addr.fullAddress || 'Địa chỉ chưa rõ';
            const isSelected = isSameAddressId(selectedExistingAddressId, id);
            return (
              <TouchableOpacity
                key={String(id)}
                style={[styles.savedAddressItem, isSelected && styles.savedAddressItemActive]}
                onPress={() => {
                  setSelectedExistingAddressId(id);
                  setSelectedProvince(null);
                  setSelectedDistrict(null);
                  setSelectedWard(null);
                  setDetailedAddress(label);
                  setAddressSuggestions([]);
                  setForm((prev) => ({
                    ...prev,
                    addressText: label,
                    latitude: typeof addr.latitude === 'number' ? addr.latitude : prev.latitude,
                    longitude: typeof addr.longitude === 'number' ? addr.longitude : prev.longitude,
                  }));
                }}
              >
                <View style={styles.savedAddressTopRow}>
                  <View style={styles.savedAddressBadges}>
                    {!!addr.isDefault && <Text style={styles.defaultBadge}>Mặc định</Text>}
                    {isSelected && <Text style={styles.selectedBadge}>Đang dùng</Text>}
                  </View>
                </View>
                <Text style={styles.savedAddressText}>{label}</Text>

                {isSelected && (
                  <View style={styles.savedAddressActionRow}>
                    {!!addr.addressId && !addr.isDefault && (
                      <TouchableOpacity
                        style={styles.savedAddressActionBtn}
                        onPress={async () => {
                          const ok = await setDefaultCustomerAddress(addr.addressId as string | number);
                          if (!ok) {
                            toast.error('Không thể đặt mặc định.');
                            return;
                          }

                          setCustomerAddresses((prev) => prev.map((item) => ({
                            ...item,
                            isDefault: isSameAddressId(item.addressId, addr.addressId),
                          })));
                          toast.success('Đã đặt địa chỉ mặc định.');
                        }}
                      >
                        <Text style={styles.savedAddressActionText}>Đặt mặc định</Text>
                      </TouchableOpacity>
                    )}

                    {!!addr.addressId && !addr.isDefault && (
                      <TouchableOpacity
                        style={[styles.savedAddressActionBtn, styles.savedAddressDeleteBtn]}
                        onPress={() => handleDeleteAddress(addr.addressId as string | number, id)}
                      >
                        <Text style={[styles.savedAddressActionText, styles.savedAddressDeleteText]}>Xóa</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <SelectModal
        label="Tỉnh / Thành phố"
        placeholder="Chọn tỉnh/thành"
        value={selectedProvince}
        options={provinces.map(p => ({ value: p.code, label: p.name }))}
        onSelect={(val) => {
          setSelectedExistingAddressId(null);
          setSelectedProvince(val as number);
        }}
      />
      
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <SelectModal
            label="Quận / Huyện"
            placeholder="Chọn quận/huyện"
            value={selectedDistrict}
            options={districts.map(d => ({ value: d.code, label: d.name }))}
            onSelect={(val) => {
              setSelectedExistingAddressId(null);
              setSelectedDistrict(val as number);
            }}
            disabled={!selectedProvince}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SelectModal
            label="Phường / Xã"
            placeholder="Chọn phường/xã"
            value={selectedWard}
            options={wards.map(w => ({ value: w.code, label: w.name }))}
            onSelect={(val) => {
              setSelectedExistingAddressId(null);
              setSelectedWard(val as number);
            }}
            disabled={!selectedDistrict}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Số nhà, Tên đường</Text>
        <TextInput 
          style={styles.input}
          value={detailedAddress}
          onChangeText={(value) => {
            setSelectedExistingAddressId(null);
            setDetailedAddress(value);
          }}
          placeholder="Ví dụ: Số 12, Đường Lê Lợi"
        />
      </View>

      {loadingAddressSuggestions && (
        <Text style={styles.suggestionLoadingText}>Đang tìm gợi ý địa chỉ...</Text>
      )}
      {!loadingAddressSuggestions && addressSuggestions.length > 0 && (
        <View style={styles.suggestionBox}>
          {addressSuggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={`${suggestion.latitude}-${suggestion.longitude}-${index}`}
              style={styles.suggestionItem}
              onPress={() => handlePickAddressSuggestion(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion.displayName}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.addressPreviewBox}>
        <Text style={styles.addressPreviewText}>📍 {form.addressText || 'Chưa có thông tin địa chỉ đầy đủ'}</Text>
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.mapHeaderRow}>
          <Text style={styles.inputLabel}>Bản đồ vị trí</Text>
          <TouchableOpacity style={styles.mapCurrentLocationBtn} onPress={handleGetLocation} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <MapPin color="#fff" size={14} />}
            <Text style={styles.mapCurrentLocationText}>Dùng vị trí hiện tại</Text>
          </TouchableOpacity>
        </View>
        <AddressMapPicker
          position={mapPickerPosition}
          onPositionChange={handleMapPositionChange}
          height={260}
        />
        <View style={styles.mapActionRow}>
          <TouchableOpacity
            style={styles.mapConfirmBtn}
            onPress={handleConfirmMapSelection}
            disabled={mapConfirmLoading}
          >
            <Text style={styles.mapConfirmBtnText}>
              {mapConfirmLoading ? 'Đang xác nhận...' : 'Xác nhận vị trí đã chọn'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.mapHintText}>Nhấn vào bản đồ hoặc kéo ghim để chỉnh vị trí. Tọa độ sẽ tự cập nhật theo vị trí đã chọn.</Text>
      </View>

      <View style={styles.actionRow}>
        {!requiredSetup && (
          <TouchableOpacity 
            style={styles.cancelBtn} 
            onPress={() => setIsEditing(false)}
            disabled={loading}
          >
            <Text style={styles.cancelBtnText}>Hủy</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.saveBtn, requiredSetup && { flex: 1 }]} 
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
    overflow: 'hidden',
  },
  avatarPreviewImage: {
    width: '100%',
    height: '100%',
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
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingRight: 10,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  eyeBtn: {
    padding: 6,
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
  savedAddressSection: {
    marginBottom: 16,
    gap: 10,
  },
  savedAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkBtnText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  savedAddressItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  savedAddressItemActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#eff6ff',
  },
  savedAddressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedAddressBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  defaultBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  selectedBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  savedAddressText: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  savedAddressActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  savedAddressActionBtn: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  savedAddressActionText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  savedAddressDeleteBtn: {
    borderColor: '#fecaca',
  },
  savedAddressDeleteText: {
    color: '#b91c1c',
  },
  suggestionLoadingText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: -4,
    marginBottom: 8,
  },
  suggestionBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionText: {
    fontSize: 13,
    color: '#374151',
  },
  mapActionRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  mapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  mapCurrentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  mapCurrentLocationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  mapConfirmBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mapConfirmBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  mapHintText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
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
