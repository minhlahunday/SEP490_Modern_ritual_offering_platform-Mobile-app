import { getAuthToken } from './auth';
import { API_BASE_URL } from './api';

export interface NotificationItem {
  notificationId: string | number;
  title: string;
  message: string;
  type: string;
  target: string;
  redirectUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

interface NotificationApiItem {
  notificationId?: string | number;
  title?: string;
  message?: string;
  type?: string;
  target?: string;
  redirectUrl?: string;
  isRead?: boolean;
  createdAt?: string;
  createAt?: string;
}

interface NotificationListApiResponse {
  items?: NotificationApiItem[];
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
}

interface ApiEnvelope<T> {
  statusCode?: string;
  isSuccess?: boolean;
  isSucceeded?: boolean;
  result?: T;
  errorMessages?: string[];
}

function normalizeNotificationItem(raw: NotificationApiItem): NotificationItem {
  return {
    notificationId: raw.notificationId ?? '',
    title: raw.title ?? 'Thong bao',
    message: raw.message ?? '',
    type: raw.type ?? 'system',
    target: raw.target ?? '',
    redirectUrl: raw.redirectUrl ?? null,
    isRead: Boolean(raw.isRead),
    createdAt: raw.createdAt ?? raw.createAt ?? '',
  };
}

function normalizeNotificationList(raw: NotificationListApiResponse | undefined): NotificationListResult {
  const items = (raw?.items ?? []).map(normalizeNotificationItem);
  return {
    items,
    totalCount: raw?.totalCount ?? items.length,
    currentPage: raw?.currentPage ?? 1,
    pageSize: raw?.pageSize ?? (items.length || 20),
  };
}

export async function fetchNotifications(pageNumber = 1, pageSize = 20): Promise<NotificationListResult> {
  const token = getAuthToken();
  if (!token) {
    return { items: [], totalCount: 0, currentPage: pageNumber, pageSize };
  }

  const url = `${API_BASE_URL}/notifications?pageNumber=${pageNumber}&pageSize=${pageSize}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errorData = JSON.parse(text) as ApiEnvelope<unknown>;
      if (errorData.errorMessages && errorData.errorMessages.length > 0) {
        message = errorData.errorMessages.join(', ');
      }
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  let data: ApiEnvelope<NotificationListApiResponse>;
  try {
    data = JSON.parse(text) as ApiEnvelope<NotificationListApiResponse>;
  } catch {
    const rawList = JSON.parse(text) as NotificationListApiResponse;
    return normalizeNotificationList(rawList);
  }

  const looksLikeDirectList =
    data &&
    typeof data === 'object' &&
    (Array.isArray((data as NotificationListApiResponse).items) ||
      typeof (data as NotificationListApiResponse).totalCount === 'number');

  if (looksLikeDirectList && data.result === undefined && data.isSuccess === undefined && data.isSucceeded === undefined) {
    return normalizeNotificationList(data as unknown as NotificationListApiResponse);
  }

  const isSuccess = data.isSuccess ?? data.isSucceeded;
  if (isSuccess === false) {
    const message = data.errorMessages && data.errorMessages.length > 0
      ? data.errorMessages.join(', ')
      : 'Khong the tai danh sach thong bao';
    throw new Error(message);
  }

  return normalizeNotificationList(data.result ?? (data as unknown as NotificationListApiResponse));
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const token = getAuthToken();
  if (!token) return 0;

  const url = `${API_BASE_URL}/notifications/unread-count`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    console.warn('Failed to fetch unread notification count:', response.status);
    return 0;
  }

  try {
    const raw = JSON.parse(text) as
      | ApiEnvelope<number | { unreadCount?: number }>
      | { unreadCount?: number }
      | number;

    if (typeof raw === 'number') {
      return raw;
    }

    if (typeof (raw as { unreadCount?: number }).unreadCount === 'number') {
      return (raw as { unreadCount: number }).unreadCount;
    }

    const envelope = raw as ApiEnvelope<number | { unreadCount?: number }>;
    const result = envelope.result;

    if (typeof result === 'number') {
      return result;
    }

    if (result && typeof result === 'object' && typeof (result as { unreadCount?: number }).unreadCount === 'number') {
      return (result as { unreadCount: number }).unreadCount;
    }

    return 0;
  } catch {
    console.warn('Error parsing unread notification count response');
    return 0;
  }
}

export async function markNotificationAsRead(notificationId: string | number): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  const url = `${API_BASE_URL}/notifications/${notificationId}/read`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function markAllNotificationsAsReadApi(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  const url = `${API_BASE_URL}/notifications/read-all`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
