import { ApiResponse } from '../types';
import { getAuthToken, getCurrentUser } from './auth';
import { API_BASE_URL } from './api';

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  status: string;
  createdAt: string;
  walletType?: string;
  relatedTransactionId?: string | null;
  relatedTransactions?: WalletTransaction[];
  raw?: any;
}

export interface TransactionFilter {
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  walletType?: WalletType;
}

export type WalletType = 'Customer' | 'Vendor' | 'System';

export interface WalletInfo {
  id: string;
  userId: string;
  balance: number;
  availableBalance?: number;
  heldBalance?: number;
  debt?: number;
  walletType: WalletType;
  isActive: boolean;
  [key: string]: any;
}

class WalletService {
  private resolveActiveRole(type?: WalletType): 'Customer' | 'Vendor' | 'Admin' | 'Staff' {
    if (type === 'Vendor') return 'Vendor';
    if (type === 'Customer') return 'Customer';

    const role = String(getCurrentUser()?.role || '').trim().toLowerCase();
    if (role === 'vendor') return 'Vendor';
    if (role === 'admin') return 'Admin';
    if (role === 'staff') return 'Staff';
    return 'Customer';
  }

  private toNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  private readField<T>(source: Record<string, unknown>, keys: string[], fallback: T): T {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null) {
        return value as T;
      }
    }
    return fallback;
  }

  private unwrapResultArray(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;

    if (payload && typeof payload === 'object') {
      const envelope = payload as Record<string, unknown>;
      const result = envelope.result;

      if (Array.isArray(result)) return result;

      if (result && typeof result === 'object') {
        const resultObject = result as Record<string, unknown>;
        const nestedArray = resultObject.items ?? resultObject.data ?? resultObject.records;
        if (Array.isArray(nestedArray)) return nestedArray;
      }
    }

    return [];
  }

  private normalizeTransactionItem(item: unknown, index: number): WalletTransaction {
    const source = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const tx = (source.transaction || source.Transaction || source) as Record<string, unknown>;

    const id = String(this.readField(tx, ['transactionId', 'TransactionId', 'id', 'Id'], `TX-${index + 1}`));
    const type = String(this.readField(tx, ['type', 'Type', 'transactionType', 'TransactionType'], ''));
    const status = String(this.readField(tx, ['status', 'Status'], ''));

    const amountRaw = this.readField(tx, ['amount', 'Amount', 'value', 'Value'], 0);
    const amount = this.toNumber(amountRaw, 0);

    const description = String(this.readField(tx, ['description', 'Description', 'note', 'Note'], ''));
    const createdAt = String(
      this.readField(
        tx,
        ['createdAt', 'CreatedAt', 'createdDate', 'CreatedDate', 'timestamp', 'Timestamp'],
        ''
      )
    );

    const walletId = String(this.readField(tx, ['walletId', 'WalletId'], '') || this.readField(source, ['walletId', 'WalletId'], ''));
    const walletType = String(this.readField(tx, ['walletType', 'WalletType'], '') || this.readField(source, ['walletType', 'WalletType'], ''));

    const balanceBeforeRaw = this.readField(tx, ['balanceBefore', 'BalanceBefore'], 0);
    const balanceAfterRaw = this.readField(tx, ['balanceAfter', 'BalanceAfter'], 0);

    return {
      id,
      type,
      status,
      amount,
      description,
      createdAt,
      walletId: walletId || '',
      walletType: walletType || undefined,
      balanceBefore: this.toNumber(balanceBeforeRaw, 0),
      balanceAfter: this.toNumber(balanceAfterRaw, 0),
      relatedTransactionId: String(this.readField(tx, ['relatedTransactionId', 'RelatedTransactionId'], '') || '') || null,
      relatedTransactions: Array.isArray(tx.relatedTransactions || tx.RelatedTransactions)
        ? ((tx.relatedTransactions || tx.RelatedTransactions) as unknown[]).map((rt, i) => this.normalizeTransactionItem(rt, i))
        : undefined,
      raw: source,
    };
  }

  private extractMainResult(payload: any): any {
    if (payload && typeof payload === 'object' && 'result' in payload) {
      return payload.result;
    }
    return payload;
  }

  private normalizeWallet(raw: any, requestedType: WalletType): WalletInfo {
    const source = raw && typeof raw === 'object' ? raw : {};

    const balance = this.toNumber(
      source.balance ?? source.Balance ?? source.currentBalance ?? source.CurrentBalance,
      0,
    );
    const heldBalance = this.toNumber(source.heldBalance ?? source.HeldBalance, 0);
    const debt = this.toNumber(source.debt ?? source.Debt, 0);
    const availableBalanceRaw = source.availableBalance ?? source.AvailableBalance;
    const availableBalance =
      availableBalanceRaw !== undefined && availableBalanceRaw !== null
        ? this.toNumber(availableBalanceRaw, 0)
        : Math.max(0, balance - heldBalance - debt);

    return {
      id: String(source.id ?? source.walletId ?? source.WalletId ?? ''),
      userId: String(source.userId ?? source.profileId ?? source.ProfileId ?? ''),
      balance,
      availableBalance,
      heldBalance,
      debt,
      walletType: (source.walletType ?? source.type ?? requestedType) as WalletType,
      isActive: Boolean(source.isActive ?? source.status === 'Active' ?? true),
      ...source,
    };
  }

  private getHeaders(): HeadersInit {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async getMyWallet(type: WalletType = 'Customer'): Promise<WalletInfo | null> {
    try {
      const activeRole = this.resolveActiveRole(type);
      const endpoints = [
        `${API_BASE_URL}/wallets/me?ActiveRole=${encodeURIComponent(activeRole)}`,
        `${API_BASE_URL}/wallets/me?type=${encodeURIComponent(type)}`,
        `${API_BASE_URL}/wallets/my-wallet?type=${encodeURIComponent(type)}`,
        `${API_BASE_URL}/wallets/me`,
      ];

      let response;
      for (const url of endpoints) {
        try {
          response = await fetch(url, { method: 'GET', headers: this.getHeaders() });
          if (response.ok) break;
        } catch (e) { /* continue */ }
      }

      if (!response || !response.ok) {
        if (response?.status === 404 || response?.status === 403) return null;
        throw new Error(`HTTP error! status: ${response?.status || 'unknown'}`);
      }

      const payload = await response.json().catch(() => null);

      const isEnvelope = payload && typeof payload === 'object' && ('isSuccess' in payload || 'result' in payload);
      if (isEnvelope) {
        const env = payload as ApiResponse<any>;
        if (env.isSuccess === false) return null;
        const source = env.result ?? payload;
        return this.normalizeWallet(source, type);
      }

      return this.normalizeWallet(payload, type);
    } catch (error) {
      console.error('❌ Failed to fetch wallet info:', error);
      return null;
    }
  }

  async getMyTransactions(filter?: TransactionFilter): Promise<WalletTransaction[]> {
    try {
      const params = new URLSearchParams();
      params.append('ActiveRole', this.resolveActiveRole(filter?.walletType));
      if (filter?.type && filter.type.trim()) params.append('Type', filter.type.trim());
      if (filter?.status && filter.status.trim()) params.append('Status', filter.status.trim());
      if (filter?.from && filter.from.trim()) params.append('From', filter.from.trim());
      if (filter?.to && filter.to.trim()) params.append('To', filter.to.trim());
      params.append('PageNumber', '1');
      params.append('PageSize', '100');

      const suffix = `?${params.toString()}`;

      const endpoints = [
        `${API_BASE_URL}/transactions/me${suffix}`,
        `${API_BASE_URL}/api/transactions/me${suffix}`,
        `${API_BASE_URL}/api/wallets/me/transactions${suffix}`,
        `${API_BASE_URL}/wallets/me/transactions${suffix}`,
      ];

      let response;
      for (const url of endpoints) {
        try {
          response = await fetch(url, { method: 'GET', headers: this.getHeaders() });
          if (response.ok) break;
        } catch (e) { /* continue */ }
      }

      if (!response || !response.ok) {
        // If 404, treat as empty history (user might not have transactions yet)
        if (response?.status === 404) {
          console.log('ℹ️ Wallet history not found (404), treating as empty list');
          return [];
        }
        throw new Error(`HTTP error! status: ${response?.status || 'unknown'}`);
      }

      const payload = await response.json().catch(() => null);
      if (payload && typeof payload === 'object') {
        const envelope = payload as Record<string, unknown>;
        if (envelope.isSuccess === false || envelope.isSucceeded === false) {
          const messages = Array.isArray(envelope.errorMessages)
            ? envelope.errorMessages.filter((m): m is string => typeof m === 'string')
            : [];
          const message = messages.join(', ') || String(envelope.message || 'Không thể tải lịch sử giao dịch');
          throw new Error(message);
        }
      }

      const items = this.unwrapResultArray(payload);
      return items.map((item, index) => this.normalizeTransactionItem(item, index));
    } catch (error) {
      console.error('❌ Failed to fetch wallet transactions:', error);
      throw error;
    }
  }

  async getTransactionById(id: string): Promise<WalletTransaction> {
    try {
      const safeId = encodeURIComponent(id);
      const role = this.resolveActiveRole('Customer');

      const endpoints = [
        `${API_BASE_URL}/transactions/${safeId}?ActiveRole=${encodeURIComponent(role)}`,
        `${API_BASE_URL}/api/transactions/${safeId}?ActiveRole=${encodeURIComponent(role)}`,
        `${API_BASE_URL}/api/wallets/transactions/${safeId}`,
        `${API_BASE_URL}/wallets/transactions/${safeId}`,
      ];

      let response;
      for (const url of endpoints) {
        try {
          response = await fetch(url, { method: 'GET', headers: this.getHeaders() });
          if (response.ok) break;
        } catch (e) {
          // try next endpoint
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const payload = await response.json().catch(() => null);
      if (payload && typeof payload === 'object') {
        const envelope = payload as Record<string, unknown>;
        if (envelope.isSuccess === false || envelope.isSucceeded === false) {
          const messages = Array.isArray(envelope.errorMessages)
            ? envelope.errorMessages.filter((m): m is string => typeof m === 'string')
            : [];
          const message = messages.join(', ') || String(envelope.message || 'Không thể lấy thông tin giao dịch');
          throw new Error(message);
        }
      }

      const main = this.extractMainResult(payload);
      return this.normalizeTransactionItem(main, 0);
    } catch (error) {
      console.error('❌ Failed to fetch transaction detail:', error);
      throw error;
    }
  }

  async getRelatedTransactions(id: string): Promise<WalletTransaction[]> {
    try {
      let response = await fetch(`${API_BASE_URL}/api/wallets/transactions/${id}/related`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        response = await fetch(`${API_BASE_URL}/wallets/transactions/${id}/related`, {
          method: 'GET',
          headers: this.getHeaders(),
        });
      }

      if (!response.ok) {
        // If still 404, it might just mean no related transactions exist
        if (response.status === 404) return [];
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<WalletTransaction[]> = await response.json();
      if (data.isSuccess) {
        return data.result || [];
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch related transactions:', error);
      return []; // Return empty instead of throwing for related items
    }
  }

  async createTopupLink(amount: number, walletType: WalletType = 'Customer'): Promise<any> {
    try {
      // Backend pattern for PayOS top-up from Web code
      const response = await fetch(`${API_BASE_URL}/payos/create-topup-link`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ amount, type: walletType, walletType }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.errorMessages?.[0] || `Lỗi tạo link nạp tiền (${response.status})`);
      }

      const data: ApiResponse<any> = await response.json();
      if (!data.isSuccess) return null;

      const result = data.result || {};
      return {
        ...result,
        checkoutUrl: result.checkoutUrl || result.paymentUrl || result.payUrl || result.url || result.link,
        paymentUrl: result.paymentUrl || result.checkoutUrl || result.payUrl || result.url || result.link,
      };
    } catch (error) {
      console.error('❌ Failed to create topup link:', error);
      throw error;
    }
  }

  async cancelPayosTopup(orderCode: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payos/cancel-payment-link/${orderCode}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Failed to cancel topup:', error);
      return false;
    }
  }
}

export const walletService = new WalletService();
export const getMyWallet = (type: WalletType = 'Customer') => walletService.getMyWallet(type);
export const createTopupLink = (amount: number, type: WalletType = 'Customer') => walletService.createTopupLink(amount, type);
export const cancelPayosTopup = (orderCode: string) => walletService.cancelPayosTopup(orderCode);
export const getMyTransactions = (filter?: TransactionFilter) => walletService.getMyTransactions(filter);
export const getTransactionById = (id: string) => walletService.getTransactionById(id);
export const getRelatedTransactions = (id: string) => walletService.getRelatedTransactions(id);
