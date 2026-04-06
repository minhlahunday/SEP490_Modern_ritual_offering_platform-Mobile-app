import { API_BASE_URL } from './api';
import { getAuthToken } from './auth';

const BASE_PATH = `${API_BASE_URL}/vendor-chat/sessions`;

export interface ChatMessage {
  messageId: string;
  sessionId: string;
  role: 'Customer' | 'Vendor';
  content: string;
  timestamp: string;
  isRead: boolean;
  extractedIntent?: string | null;
  extractedEntities?: string | null;
}

export interface ChatSession {
  sessionId: string;
  customerId: string;
  vendorId: string;
  sessionType: string;
  startedAt: string;
  lastActiveAt: string;
  resolvedIntent: string | null;
  convertedToOrder: boolean;
  closedAt: string | null;
  messages: ChatMessage[];
  counterPartyName?: string;
  counterPartyAvatar?: string;
  unreadCount?: number;
}

class VendorChatService {
  private async parseJsonOrThrow(response: Response): Promise<any> {
    const text = await response.text();

    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      const message =
        (Array.isArray(parsed?.errorMessages) && parsed.errorMessages.filter((m: unknown) => typeof m === 'string').join(', '))
        || (typeof parsed?.message === 'string' ? parsed.message : '')
        || `Loi he thong (${response.status})`;
      throw new Error(message);
    }

    if (!parsed) {
      throw new Error('Du lieu tra ve khong hop le');
    }

    return parsed;
  }

  private getHeaders(withJson = false): HeadersInit {
    const token = getAuthToken();
    return {
      Accept: 'application/json',
      ...(withJson ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async createSession(vendorId: string, packageId?: number): Promise<string> {
    const queryParams = new URLSearchParams();
    queryParams.append('vendorId', String(vendorId));
    if (packageId && Number.isInteger(packageId) && packageId > 0) {
      queryParams.append('packageId', String(packageId));
    }

    const response = await fetch(`${BASE_PATH}?${queryParams.toString()}`, {
      method: 'POST',
      headers: this.getHeaders(false),
    });

    const data = await this.parseJsonOrThrow(response);
    if ((data?.isSuccess || data?.isSucceeded) && data?.result?.sessionId) {
      return String(data.result.sessionId);
    }
    throw new Error('Khong the tao phien chat');
  }

  async getSessions(role: 'customer' | 'vendor' = 'customer'): Promise<ChatSession[]> {
    try {
      const rolePath = role === 'vendor' ? '/vendor' : '/customer';
      const response = await fetch(`${BASE_PATH}${rolePath}`, {
        method: 'GET',
        headers: this.getHeaders(false),
      });

      if (!response.ok) {
        return [];
      }

      const data = await this.parseJsonOrThrow(response);
      return Array.isArray(data?.result) ? data.result : [];
    } catch {
      return [];
    }
  }

  async getSessionDetails(sessionId: string): Promise<ChatSession> {
    const response = await fetch(`${BASE_PATH}/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: this.getHeaders(false),
    });

    const data = await this.parseJsonOrThrow(response);
    return data?.result;
  }

  async sendMessage(sessionId: string, content: string): Promise<ChatMessage> {
    const response = await fetch(`${BASE_PATH}/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ content }),
    });

    const data = await this.parseJsonOrThrow(response);
    return data?.result;
  }

  async markAsRead(sessionId: string): Promise<boolean> {
    const response = await fetch(`${BASE_PATH}/${encodeURIComponent(sessionId)}/read`, {
      method: 'POST',
      headers: this.getHeaders(false),
    });
    return response.ok;
  }
}

export const vendorChatService = new VendorChatService();
export default vendorChatService;
