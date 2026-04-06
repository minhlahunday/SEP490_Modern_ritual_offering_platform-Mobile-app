import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';

const normalizeMessage = (message: string): string => {
  const text = String(message || '').trim();
  if (!text) return 'Đã xảy ra lỗi';

  return text
    .replace(/^checkout failed:\s*/i, '')
    .replace(/^error:\s*/i, '')
    .trim();
};

export const showSuccess = (message: string) => {
  Toast.show({ type: 'success', text1: 'Thành công', text2: normalizeMessage(message), position: 'top' });
};

export const showError = (message: string) => {
  Toast.show({ type: 'error', text1: 'Lỗi', text2: normalizeMessage(message), position: 'top' });
};

export const showWarning = (message: string) => {
  Toast.show({ type: 'info', text1: 'Cảnh báo', text2: normalizeMessage(message), position: 'top' });
};

export const showInfo = (message: string) => {
  Toast.show({ type: 'info', text1: 'Thông tin', text2: normalizeMessage(message), position: 'top' });
};

export const showConfirm = async (options: {
  title: string;
  text?: string;
  icon?: 'warning' | 'question' | 'info';
  confirmButtonText?: string;
  cancelButtonText?: string;
}) => {
  return new Promise<{ isConfirmed: boolean }>((resolve) => {
    Alert.alert(
      options.title,
      options.text || '',
      [
        {
          text: options.cancelButtonText || 'Hủy',
          onPress: () => resolve({ isConfirmed: false }),
          style: 'cancel',
        },
        {
          text: options.confirmButtonText || 'Xác nhận',
          onPress: () => resolve({ isConfirmed: true }),
        },
      ],
      { cancelable: true }
    );
  });
};

export const showMessage = (options: {
  title: string;
  html?: string;
  text?: string;
  icon?: 'success' | 'error' | 'warning' | 'info' | 'question';
  confirmButtonText?: string;
}) => {
  Alert.alert(options.title, options.text || options.html || '');
};

export const showPrompt = async (options: {
  title: string;
  text?: string;
  inputPlaceholder?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}) => {
  // Simple fallback for prompt since React Native's Alert.prompt is iOS only
  return new Promise<{ isConfirmed: boolean, value?: string }>((resolve) => {
    Alert.alert(
      options.title,
      'Chức năng nhập liệu đang được phát triển trên phiên bản Mobile',
      [{ text: 'OK', onPress: () => resolve({ isConfirmed: true, value: '' }) }]
    );
  });
};

export const showSelectPrompt = async () => {
  return { isConfirmed: false };
};

export default {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  confirm: showConfirm,
  message: showMessage,
  prompt: showPrompt,
  selectPrompt: showSelectPrompt
};
