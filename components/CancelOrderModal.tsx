import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

const CANCEL_REASONS = [
  'Thay đổi địa chỉ giao hàng',
  'Thay đổi món / số lượng',
  'Thủ tục thanh toán rắc rối',
  'Tìm thấy chỗ khác phù hợp hơn',
  'Không có nhu cầu mua nữa',
  'Lý do khác',
];

type Props = {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export default function CancelOrderModal({ visible, loading = false, onClose, onConfirm }: Props) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (!visible) {
      setSelectedReason('');
      setCustomReason('');
    }
  }, [visible]);

  const finalReason = useMemo(() => {
    if (selectedReason === 'Lý do khác') {
      return customReason.trim();
    }
    return selectedReason.trim();
  }, [selectedReason, customReason]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Xác nhận hủy đơn hàng</Text>
          <Text style={styles.subtitle}>Vui lòng chọn lý do mà bạn muốn hủy đơn:</Text>

          <ScrollView style={styles.reasonList} contentContainerStyle={styles.reasonListContent}>
            {CANCEL_REASONS.map((reason) => {
              const isActive = selectedReason === reason;
              return (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonItem, isActive && styles.reasonItemActive]}
                  onPress={() => setSelectedReason(reason)}
                  disabled={loading}
                >
                  <Text style={[styles.reasonText, isActive && styles.reasonTextActive]}>{reason}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedReason === 'Lý do khác' && (
            <TextInput
              style={styles.input}
              value={customReason}
              onChangeText={setCustomReason}
              placeholder="Nhập lý do của bạn..."
              placeholderTextColor="#94a3b8"
              editable={!loading}
              multiline
            />
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Bỏ qua</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!finalReason || loading) && styles.confirmBtnDisabled]}
              onPress={() => onConfirm(finalReason)}
              disabled={!finalReason || loading}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmBtnText}>Hủy đơn</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 14,
  },
  reasonList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
  },
  reasonListContent: {
    padding: 8,
    gap: 6,
  },
  reasonItem: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  reasonItemActive: {
    borderColor: '#334155',
    backgroundColor: '#eef2ff',
  },
  reasonText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '600',
  },
  reasonTextActive: {
    color: '#111827',
    fontWeight: '700',
  },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
