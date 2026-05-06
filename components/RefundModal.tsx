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
import { X, AlertCircle, Plus, Square, CheckSquare, Circle, CheckCircle2 } from 'lucide-react-native';
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

const typeConfig = [
  { id: 'Full', label: 'Hoàn toàn bộ', desc: 'Hoàn 100% đơn hàng' },
  { id: 'SpecificItems', label: 'Các sản phẩm cụ thể', desc: 'Chọn đơn hàng bạn muốn hoàn' },
  { id: 'PartialItem', label: 'Hoàn một phần', desc: 'Chọn 1 đơn hàng và thương lượng giá' },
] as const;

export default function RefundModal({ isOpen, onClose, onSuccess, order }: RefundModalProps) {
  const [refundType, setRefundType] = useState<'Full' | 'SpecificItems' | 'PartialItem'>('Full');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [proofImages, setProofImages] = useState<Array<{ uri: string; name: string; type: string }>>([]);

  const [targetItemId, setTargetItemId] = useState<string>('');
  const [targetMaxAmount, setTargetMaxAmount] = useState<number>(0);
  const [partialAmountStr, setPartialAmountStr] = useState<string>('');

  const getOrderItemId = (item: any): string => String(item?.reviewItemId || item?.itemId || '').trim();

  const getOrderItemTotal = (item: any) => {
    const qty = Number(item?.quantity || 1) || 1;
    const unit = Number(item?.price || item?.unitPrice || item?.variantPrice || 0) || 0;
    const basePrice = unit * qty;
    
    const swapTotal = (item?.swaps || []).reduce((sum: number, sw: any) => sum + (Number(sw.surcharge) || 0), 0);
    const addOnTotal = (item?.addOns || []).reduce((sum: number, ad: any) => sum + (Number(ad.lineTotal) || 0), 0);
    
    const calculated = basePrice + swapTotal + addOnTotal;
    const apiTotal = Number(item?.lineTotal || item?.totalPrice) || 0;
    
    return Math.max(calculated, apiTotal);
  };

  useEffect(() => {
    if (!isOpen) {
      setRefundType('Full');
      setReason('');
      setSelectedItemIds([]);
      setTargetItemId('');
      setPartialAmountStr('');
      setProofImages([]);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedItemIds([]);
    setTargetItemId('');
    setTargetMaxAmount(0);
    setPartialAmountStr('');
  }, [refundType]);

  const selectedAmount = useMemo(() => {
    if (refundType === 'Full') return order?.pricing?.finalAmount || order?.pricing?.totalAmount || 0;
    if (refundType === 'PartialItem') {
      const parsed = parseInt(partialAmountStr.replace(/\D/g, ''), 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return (order?.items || []).reduce((sum, item: any) => {
      const id = getOrderItemId(item);
      if (!selectedItemIds.includes(id)) return sum;
      return sum + getOrderItemTotal(item);
    }, 0);
  }, [order?.items, order?.pricing, selectedItemIds, refundType, partialAmountStr]);

  const allSelectableIds = useMemo(() => {
    return (order?.items || []).map((item: any) => getOrderItemId(item)).filter((id: string) => id.length > 0);
  }, [order?.items]);

  const isAllSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedItemIds.includes(id));

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedItemIds(isAllSelected ? [] : allSelectableIds);
  };

  const selectTargetItem = (id: string, maxAmount: number) => {
    setTargetItemId(id);
    setTargetMaxAmount(maxAmount);
    setPartialAmountStr(Math.max(0, maxAmount - 1000).toString());
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
        return unique.slice(0, 10);
      });
    } catch {
      toast.error('Không thể chọn ảnh');
    }
  };

  const removeImage = (index: number) => {
    setProofImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (refundType === 'SpecificItems' && selectedItemIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 sản phẩm cần hoàn tiền');
      return;
    }

    if (refundType === 'PartialItem') {
      if (!targetItemId) {
        toast.error('Vui lòng chọn một món để thương lượng');
        return;
      }
      const partialAmount = parseInt(partialAmountStr.replace(/\D/g, ''), 10);
      if (isNaN(partialAmount) || partialAmount <= 0) {
        toast.error('Số tiền thương lượng phải lớn hơn 0');
        return;
      }
      if (partialAmount >= targetMaxAmount) {
        toast.error(`Số tiền phải nhỏ hơn ${targetMaxAmount.toLocaleString('vi-VN')}đ`);
        return;
      }
    }

    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do hoàn tiền');
      return;
    }

    if (proofImages.length === 0) {
      toast.error('Vui lòng tải lên ít nhất 1 ảnh bằng chứng');
      return;
    }

    setSubmitting(true);
    try {
      const partialAmount = parseInt(partialAmountStr.replace(/\D/g, ''), 10) || 0;

      const result = await refundService.createRefund({
        orderId: order.orderId,
        reason: reason.trim(),
        proofImages,
        refundType,
        createRefundItems: refundType === 'SpecificItems' ? selectedItemIds.map((id) => ({ orderItemId: id })) : undefined,
        targetItemId: refundType === 'PartialItem' ? targetItemId : undefined,
        partialAmount: refundType === 'PartialItem' ? partialAmount : undefined,
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
                Đơn hàng #{order?.orderId?.substring(0, 8).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.label}>Loại hoàn tiền</Text>
            <View style={styles.typeContainer}>
              {typeConfig.map((type) => {
                const isActive = refundType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setRefundType(type.id)}
                    style={[styles.typeCard, isActive && styles.typeCardActive]}
                  >
                    {isActive && (
                      <View style={styles.checkIconBadge}>
                        <CheckCircle2 size={12} color="#f97316" />
                      </View>
                    )}
                    <Text style={[styles.typeLabel, isActive && styles.typeLabelActive]}>{type.label}</Text>
                    <Text style={[styles.typeDesc, isActive && styles.typeDescActive]}>{type.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {refundType === 'SpecificItems' && (
              <View style={styles.sectionMargin}>
                <View style={styles.sectionRow}>
                  <Text style={styles.label}>Chọn sản phẩm hoàn tiền</Text>
                  <TouchableOpacity onPress={toggleSelectAll}>
                    <Text style={styles.selectAllText}>{isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</Text>
                  </TouchableOpacity>
                </View>

                {(order?.items || []).map((item: any, idx: number) => {
                  const itemId = getOrderItemId(item);
                  if (!itemId) return null;

                  const qty = Number(item?.quantity || 1) || 1;
                  const lineTotal = getOrderItemTotal(item);
                  const selected = selectedItemIds.includes(itemId);

                  const hasExtras = item?.swaps?.length > 0 || item?.addOns?.length > 0;

                  return (
                    <View key={`${itemId}-${idx}`} style={[styles.itemCard, selected && styles.itemCardActive]}>
                      <TouchableOpacity style={[styles.itemSelectRow, selected && styles.itemSelectRowActive]} onPress={() => toggleItem(itemId)}>
                        {selected ? <CheckSquare size={20} color="#f97316" /> : <Square size={20} color="#d1d5db" />}
                        <View style={styles.itemSelectMeta}>
                          <Text style={styles.itemSelectName} numberOfLines={2}>{item.packageName}</Text>
                          <Text style={styles.itemSelectVariant}>Gói {item.variantName} x{qty}</Text>
                        </View>
                        <Text style={styles.itemSelectPrice}>{lineTotal.toLocaleString('vi-VN')}đ</Text>
                      </TouchableOpacity>

                      {hasExtras && (
                        <View style={styles.extrasBox}>
                          {(item.swaps || []).map((sw: any, i: number) => (
                            <View key={`sw-${i}`} style={styles.extraRow}>
                              <View style={styles.dotAmber} />
                              <Text style={styles.extraTextAmber} numberOfLines={2}>
                                {sw.replacementDescription || `${sw.originalItemName} -> ${sw.replacementItemName}`}
                              </Text>
                              {sw.surcharge > 0 && (
                                <Text style={styles.extraPriceAmber}>+{sw.surcharge.toLocaleString('vi-VN')}đ</Text>
                              )}
                            </View>
                          ))}
                          {(item.addOns || []).map((ad: any, i: number) => (
                            <View key={`ad-${i}`} style={styles.extraRow}>
                              <View style={styles.dotEmerald} />
                              <Text style={styles.extraTextEmerald} numberOfLines={2}>
                                + {ad.addOnName || ad.itemName} x{ad.quantity}
                              </Text>
                              <Text style={styles.extraPriceEmerald}>{(ad.lineTotal || 0).toLocaleString('vi-VN')}đ</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}

                {selectedItemIds.length > 0 && (
                  <View style={styles.expectedRefundBox}>
                    <Text style={styles.expectedRefundLabel}>
                      Dự kiến hoàn ({selectedItemIds.length} sản phẩm)
                    </Text>
                    <Text style={styles.expectedRefundValue}>
                      {selectedAmount.toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                )}
              </View>
            )}

            {refundType === 'PartialItem' && (
              <View style={styles.sectionMargin}>
                <Text style={styles.label}>Chọn sản phẩm thương lượng</Text>
                {(order?.items || []).map((item: any, idx: number) => {
                  const itemId = getOrderItemId(item);
                  if (!itemId) return null;

                  const qty = Number(item?.quantity || 1) || 1;
                  const lineTotal = getOrderItemTotal(item);
                  const selected = targetItemId === itemId;

                  const hasExtras = item?.swaps?.length > 0 || item?.addOns?.length > 0;

                  return (
                    <View key={`${itemId}-${idx}`} style={[styles.itemCard, selected && styles.itemCardActive]}>
                      <TouchableOpacity style={[styles.itemSelectRow, selected && styles.itemSelectRowActive]} onPress={() => selectTargetItem(itemId, lineTotal)}>
                        {selected ? <Circle size={20} color="#f97316" fill="#f97316" /> : <Circle size={20} color="#d1d5db" />}
                        <View style={styles.itemSelectMeta}>
                          <Text style={styles.itemSelectName} numberOfLines={2}>{item.packageName}</Text>
                          <Text style={styles.itemSelectVariant}>Gói {item.variantName} x{qty}</Text>
                        </View>
                        <Text style={styles.itemSelectPrice}>{lineTotal.toLocaleString('vi-VN')}đ</Text>
                      </TouchableOpacity>

                      {hasExtras && (
                        <View style={styles.extrasBox}>
                          {(item.swaps || []).map((sw: any, i: number) => (
                            <View key={`sw-${i}`} style={styles.extraRow}>
                              <View style={styles.dotAmber} />
                              <Text style={styles.extraTextAmber} numberOfLines={2}>
                                {sw.replacementDescription || `${sw.originalItemName} -> ${sw.replacementItemName}`}
                              </Text>
                              {sw.surcharge > 0 && (
                                <Text style={styles.extraPriceAmber}>+{sw.surcharge.toLocaleString('vi-VN')}đ</Text>
                              )}
                            </View>
                          ))}
                          {(item.addOns || []).map((ad: any, i: number) => (
                            <View key={`ad-${i}`} style={styles.extraRow}>
                              <View style={styles.dotEmerald} />
                              <Text style={styles.extraTextEmerald} numberOfLines={2}>
                                + {ad.addOnName || ad.itemName} x{ad.quantity}
                              </Text>
                              <Text style={styles.extraPriceEmerald}>{(ad.lineTotal || 0).toLocaleString('vi-VN')}đ</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}

                {targetItemId !== '' && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.label}>Số tiền thương lượng</Text>
                    <View style={styles.partialInputWrapper}>
                      <TextInput
                        style={styles.partialInput}
                        keyboardType="numeric"
                        value={partialAmountStr ? Number(partialAmountStr).toLocaleString('vi-VN') : ''}
                        onChangeText={(t) => setPartialAmountStr(t.replace(/\D/g, ''))}
                        placeholder="Nhập số tiền..."
                      />
                      <Text style={styles.currencySymbol}>đ</Text>
                    </View>
                    <Text style={styles.hintText}>* Phải nhỏ hơn {targetMaxAmount.toLocaleString('vi-VN')}đ</Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.label}>Lý do hoàn tiền</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập lý do cụ thể..."
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

              {proofImages.length < 10 && (
                <TouchableOpacity style={styles.addImageBtn} onPress={handlePickImage}>
                  <Plus size={20} color="#94a3b8" />
                  <Text style={styles.addImageText}>Tải lên</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dự kiến hoàn lại:</Text>
              <Text style={styles.infoValue}>
                {selectedAmount.toLocaleString('vi-VN')}đ
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
    fontWeight: '900',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#4b5563',
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  typeCardActive: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
  },
  typeLabelActive: {
    color: '#f97316',
  },
  typeDesc: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
  typeDescActive: {
    color: '#fdba74',
  },
  checkIconBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  sectionMargin: {
    marginBottom: 20,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  selectAllText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '700',
  },
  itemCard: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  itemCardActive: {
    borderColor: '#f97316',
  },
  itemSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    backgroundColor: '#fff',
  },
  itemSelectRowActive: {
    backgroundColor: '#fff7ed',
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
  extrasBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotAmber: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fbbf24',
  },
  extraTextAmber: {
    flex: 1,
    fontSize: 11,
    color: '#b45309',
  },
  extraPriceAmber: {
    fontSize: 11,
    color: '#f59e0b',
  },
  dotEmerald: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  extraTextEmerald: {
    flex: 1,
    fontSize: 11,
    color: '#047857',
  },
  extraPriceEmerald: {
    fontSize: 11,
    color: '#10b981',
  },
  partialInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  partialInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9ca3af',
  },
  hintText: {
    fontSize: 12,
    color: '#ea580c',
    marginTop: 6,
    fontWeight: '500',
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 20,
  },
  imagesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  addImageText: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  previewItem: {
    width: 80,
    height: 80,
    borderRadius: 16,
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
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f97316',
  },
  expectedRefundBox: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
  },
  expectedRefundLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4b5563',
  },
  expectedRefundValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fafafa',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4b5563',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
