import { API_BASE_URL } from './api';
import { getAuthToken } from './auth';

export interface ChatMessage {
  messageId: string;
  sessionId: string;
  role: 'User' | 'AI' | string;
  content: string;
  timestamp: string;
  isRead?: boolean;
  extractedIntent?: string | null;
  extractedEntities?: string | null;
}

export interface ChatSession {
  sessionId: string;
  customerId: string;
  vendorId: string | null;
  sessionType: 'AI' | string;
  startedAt: string;
  lastActiveAt: string;
  resolvedIntent: string | null;
  convertedToOrder: boolean;
  closedAt: string | null;
  messages: ChatMessage[];
}

export interface SuggestedPackage {
  packageId: number;
  packageName: string;
  description: string;
  minVariantPrice: number;
}

export interface SendMessageResult {
  sessionId: string;
  assistantText: string;
  assistantMessage: ChatMessage | null;
  resolvedIntent: string | null;
  extractedEntities: string | null;
  suggestedPackages: SuggestedPackage[];
}

interface ApiEnvelope<T> {
  isSuccess?: boolean;
  isSucceeded?: boolean;
  errorMessages?: string[];
  message?: string;
  result?: T;
}

class AiChatService {
  private normalizeAssistantText(raw: unknown): string {
    if (typeof raw !== 'string') return '';

    let text = raw.trim();
    if (!text) return '';

    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced?.[1]) {
      text = fenced[1].trim();
    }

    if (/^json\s*\{/i.test(text)) {
      text = text.replace(/^json\s*/i, '').trim();
    }

    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try {
        const parsed = JSON.parse(text) as any;
        if (typeof parsed === 'string') return parsed.trim();
        if (parsed && typeof parsed === 'object') {
          const candidate = parsed.answer || parsed.content || parsed.message || parsed.text;
          if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
          }
        }
      } catch {
        // keep original
      }
    }

    return text;
  }

  private async parseJsonOrThrow<T>(response: Response): Promise<ApiEnvelope<T>> {
    const text = await response.text();

    let parsed: ApiEnvelope<T> | null = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as ApiEnvelope<T>;
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      const message =
        (Array.isArray(parsed?.errorMessages) ? parsed?.errorMessages.join(', ') : '')
        || (typeof parsed?.message === 'string' ? parsed.message : '')
        || (response.status === 401 ? 'Vui long dang nhap de su dung tro ly AI.' : `Request failed (${response.status})`);
      throw new Error(message);
    }

    if (!parsed) {
      throw new Error('Du lieu tra ve khong hop le');
    }

    return parsed;
  }

  private getAuthHeaders(json = false): HeadersInit {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Vui long dang nhap de su dung tro ly AI.');
    }

    return {
      Accept: 'application/json',
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    };
  }

  async createSession(): Promise<ChatSession> {
    const response = await fetch(`${API_BASE_URL}/ai-chat/sessions`, {
      method: 'POST',
      headers: this.getAuthHeaders(false),
      body: '',
    });

    const data = await this.parseJsonOrThrow<ChatSession>(response);
    const ok = data?.isSuccess ?? data?.isSucceeded;
    if (ok && data.result?.sessionId) {
      return data.result;
    }

    throw new Error((data?.errorMessages || []).join(', ') || 'Khong the tao phien chat AI');
  }

  async sendMessage(sessionId: string, content: string): Promise<SendMessageResult> {
    const response = await fetch(`${API_BASE_URL}/ai-chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      headers: this.getAuthHeaders(true),
      body: JSON.stringify({ content }),
    });

    const data = await this.parseJsonOrThrow<any>(response);
    const ok = data?.isSuccess ?? data?.isSucceeded;

    if (ok && data.result) {
      const assistantMessage = (data.result.assistantMessage || null) as ChatMessage | null;
      const normalizedAssistantText = this.normalizeAssistantText(assistantMessage?.content || '');

      return {
        sessionId: data.result.sessionId || sessionId,
        assistantText: normalizedAssistantText,
        assistantMessage,
        resolvedIntent: data.result.resolvedIntent || null,
        extractedEntities: data.result.extractedEntities || null,
        suggestedPackages: Array.isArray(data.result.suggestedPackages) ? data.result.suggestedPackages as SuggestedPackage[] : [],
      };
    }

    throw new Error((data?.errorMessages || []).join(', ') || 'Khong the nhan phan hoi tu tro ly AI');
  }

  async closeSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/ai-chat/sessions/${encodeURIComponent(sessionId)}/close`, {
        method: 'POST',
        headers: this.getAuthHeaders(false),
      });

      const data = await this.parseJsonOrThrow<string>(response);
      return Boolean(data?.isSuccess ?? data?.isSucceeded);
    } catch {
      return false;
    }
  }
}

export const aiChatService = new AiChatService();
export default aiChatService;
