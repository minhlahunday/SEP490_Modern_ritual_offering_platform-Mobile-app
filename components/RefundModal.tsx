import React, { useEffect, useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Image
} from 'react-native';
import { X, AlertCircle, Plus, Square, CheckSquare } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { refundService } from '../services/refundService';
import { Order } from '../services/orderService';
import toast from '../services/toast';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  order: Order;
}

export default function RefundModal({ isOpen, onClose, onSuccess, order }: RefundModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [proofImages, setProofImages] = useState<Array<{ uri: string; name: string; type: string }>>([]);

  const getOrderItemId = (item: any): string => String(item?.reviewItemId || item?.itemId || '').trim();

  useEffect(() => {
    if (!isOpen) return;

    const defaultIds = (order?.items || [])
      .map((item: any) => getOrderItemId(item))
      .filter((id: string) => id.length > 0);
    setSelectedItemIds(defaultIds);
    setReason('');
    setProofImages([]);
  }, [isOpen, order?.orderId]);

  const selectedAmount = useMemo(() => {
    return (order?.items || []).reduce((sum, item: any) => {
      const id = getOrderItemId(item);
      if (!selectedItemIds.includes(id)) return sum;

      const qty = Number(item?.quantity || 1) || 1;
      const unit = Number(item?.price || item?.unitPrice || item?.variantPrice || 0) || 0;
      const line = Number(item?.lineTotal || item?.totalPrice || unit * qty) || 0;
      return sum + line;
    }, 0);
  }, [order?.items, selectedItemIds]);

  const allSelectableIds = useMemo(() => {
    return (order?.items || [])
      .map((item: any) => getOrderItemId(item))
      .filter((id: string) => id.length > 0);
  }, [order?.items]);

  const isAllSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedItemIds.includes(id));

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedItemIds(isAllSelected ? [] : allSelectableIds);
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error('Bạn cần cấp quyền thư viện ảnh để tải ảnh lên');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.5,
      });

      if (result.canceled || !result.assets?.length) return;

      const mapped = result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `refund-${Date.now()}-${index + 1}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      }));

      setProofImages((prev) => {
        const merged = [...prev, ...mapped];
        const unique = merged.filter((img, idx, arr) => arr.findIndex((x) => x.uri === img.uri) === idx);
        return unique.slice(0, 5);
      });
    } catch {
      toast.error('Không thể chọn ảnh');
    }
  };

  const removeImage = (index: number) => {
    setProofImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do hoàn tiền');
      return;
    }

    if (proofImages.length === 0) {
      toast.error('Vui lòng tải lên ít nhất 1 ảnh bằng chứng');
      return;
    }

    if (selectedItemIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 sản phẩm cần hoàn tiền');
      return;
    }

    setSubmitting(true);
    try {
      const result = await refundService.createRefund({
        orderId: order.orderId,
        reason: reason.trim(),
        proofImages,
        createRefundItems: selectedItemIds.map((id) => ({ orderItemId: id })),
      });

      if (result.success) {
        toast.success('Gửi yêu cầu hoàn tiền thành công');
        onSuccess();
        onClose();
      } else {
        toast.error('Gửi yêu cầu hoàn tiền thất bại');
      }
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi gửi yêu cầu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent={true}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Yêu cầu hoàn tiền</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <View style={styles.warningBox}>
              <AlertCircle size={20} color="#000" />
              <Text style={styles.warningText}>
                Yêu cầu hoàn tiền chỉ được chấp nhận trong vòng 2 giờ sau khi đơn hàng được giao.
              </Text>
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Chọn sản phẩm hoàn tiền</Text>
              <TouchableOpacity onPress={toggleSelectAll}>
                <Text style={styles.selectAllText}>{isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</Text>
              </TouchableOpacity>
            </View>

            {(order?.items || []).map((item: any, idx: number) => {
              const itemId = getOrderItemId(item);
              if (!itemId) return null;

              const qty = Number(item?.quantity || 1) || 1;
              const unit = Number(item?.price || item?.unitPrice || item?.variantPrice || 0) || 0;
              const lineTotal = Number(item?.lineTotal || item?.totalPrice || unit * qty) || 0;
              const selected = selectedItemIds.includes(itemId);

              return (
                <TouchableOpacity key={`${itemId}-${idx}`} style={styles.itemSelectRow} onPress={() => toggleItem(itemId)}>
                  {selected ? <CheckSquare size={20} color="#111827" /> : <Square size={20} color="#9ca3af" />}
                  <View style={styles.itemSelectMeta}>
                    <Text style={styles.itemSelectName} numberOfLines={2}>{item.packageName}</Text>
                    <Text style={styles.itemSelectVariant}>Gói {item.variantName} x{qty}</Text>
                  </View>
                  <Text style={styles.itemSelectPrice}>{lineTotal.toLocaleString('vi-VN')}đ</Text>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.label}>Lý do hoàn tiền</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập lý do cụ thể (vd: giao thiếu đồ, hàng không đúng mô tả...)"
              multiline
              numberOfLines={4}
              value={reason}
              onChangeText={setReason}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Hình ảnh bằng chứng</Text>
            <View style={styles.imagesWrap}>
              {proofImages.map((img, index) => (
                <View key={`${img.uri}-${index}`} style={styles.previewItem}>
                  <Image source={{ uri: img.uri }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(index)}>
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}

              {proofImages.length < 5 && (
                <TouchableOpacity style={styles.addImageBtn} onPress={handlePickImage}>
                  <Plus size={20} color="#94a3b8" />
                  <Text style={styles.addImageText}>Tải lên</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Số tiền hoàn lại:</Text>
              <Text style={styles.infoValue}>
                {(selectedAmount || order.pricing?.finalAmount || order.pricing?.totalAmount || 0).toLocaleString('vi-VN')}đ
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Gửi yêu cầu</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  selectAllText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  itemSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
    gap: 10,
    marginBottom: 8,
  },
  itemSelectMeta: {
    flex: 1,
  },
  itemSelectName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  itemSelectVariant: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  itemSelectPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 20,
  },
  imagesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  addImageBtn: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  addImageText: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  previewItem: {
    width: 84,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e5e7eb',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
});
