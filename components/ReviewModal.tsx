import React, { useState } from 'react';
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
import { X, Star, Plus, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { reviewService } from '../services/reviewService';
import toast from '../services/toast';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  itemId: string;
  packageName: string;
}

export default function ReviewModal({ isOpen, onClose, onSuccess, itemId, packageName }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string; name: string; type: string }>>([]);

  const handlePickImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error('Bạn cần cấp quyền thư viện ảnh để tải ảnh lên');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.4,
        exif: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const mapped = result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `review-${Date.now()}-${index + 1}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      }));

      setSelectedImages((prev) => {
        const merged = [...prev, ...mapped];
        const unique = merged.filter((img, idx, arr) => arr.findIndex((x) => x.uri === img.uri) === idx);
        return unique.slice(0, 5);
      });
    } catch (error) {
      toast.error('Không thể chọn ảnh');
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const normalizedItemId = String(itemId || '').trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(normalizedItemId)) {
      toast.error('ItemId khong hop le de danh gia. Vui long mo lai chi tiet don hang.');
      return;
    }

    setSubmitting(true);
    try {
      const success = await reviewService.createReview({
        itemId: normalizedItemId,
        rating,
        comment: comment.trim(),
        reviewImages: selectedImages,
      });
      
      if (success) {
        toast.success('Gửi đánh giá thành công');
        setComment('');
        setRating(5);
        setSelectedImages([]);
        onSuccess();
        onClose();
      } else {
        toast.error('Gửi đánh giá thất bại');
      }
    } catch (error: any) {
      const message = String(error?.message || '');
      console.log('[ReviewModal] submit failed', { itemId: normalizedItemId, rating, imageCount: selectedImages.length, message });
      if (/401|403|forbidden|unauthorized|khong co quyen|không có quyền/i.test(message)) {
        toast.error('Bạn chưa có quyền đánh giá mục này hoặc phiên đăng nhập đã hết hạn.');
      } else if (/network request failed|failed to fetch/i.test(message)) {
        toast.error('Tải ảnh thất bại. Hãy thử chọn ít ảnh hơn hoặc ảnh nhẹ hơn.');
      } else {
        toast.error(error.message || 'Lỗi khi gửi đánh giá');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="fade" transparent={true}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Đánh giá sản phẩm</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.packageName} numberOfLines={2}>{packageName}</Text>
            
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity 
                  key={s} 
                  onPress={() => setRating(s)}
                  style={styles.starBtn}
                >
                  <Star 
                    size={36} 
                    color={s <= rating ? '#fbbf24' : '#d1d5db'} 
                    fill={s <= rating ? '#fbbf24' : 'none'} 
                  />
                </TouchableOpacity>
              ))}
              <Text style={styles.ratingLabel}>
                {rating === 5 ? 'Tuyệt vời' : rating === 4 ? 'Hài lòng' : rating === 3 ? 'Bình thường' : rating === 2 ? 'Không hài lòng' : 'Tệ'}
              </Text>
            </View>

            <Text style={styles.label}>Cảm nhận của bạn</Text>
            <TextInput
              style={styles.input}
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
              multiline
              numberOfLines={6}
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Thêm hình ảnh thực tế</Text>
            <View style={styles.imagesWrap}>
              {selectedImages.map((img, index) => (
                <View key={`${img.uri}-${index}`} style={styles.previewItem}>
                  <Image source={{ uri: img.uri }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <Trash2 size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}

              {selectedImages.length < 5 && (
                <TouchableOpacity style={styles.addImageBtn} onPress={handlePickImages}>
                  <Plus size={20} color="#94a3b8" />
                  <Text style={styles.addImageText}>Thêm</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.imageHint}>Tối đa 5 ảnh, chọn từng ảnh một</Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Gửi đánh giá</Text>
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
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
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
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  starBtn: {
    padding: 4,
  },
  ratingLabel: {
    width: '100%',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#fbbf24',
    fontWeight: 'bold',
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
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
    gap: 10,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageHint: {
    marginTop: 8,
    marginBottom: 4,
    color: '#94a3b8',
    fontSize: 12,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  submitBtn: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
