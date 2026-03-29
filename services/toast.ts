import { Alert } from 'react-native';

export const showSuccess = (message: string) => {
  Alert.alert('Thành công', message);
};

export const showError = (message: string) => {
  Alert.alert('Lỗi', message);
};

export const showWarning = (message: string) => {
  Alert.alert('Cảnh báo', message);
};

export const showInfo = (message: string) => {
  Alert.alert('Thông tin', message);
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
