import { ApiResponse } from '../types';
import { getAuthToken } from './auth';
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
  raw?: any;
}

export interface TransactionFilter {
  type?: string;
  status?: string;
  from?: string;
  to?: string;
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
      const endpoints = [
        `${API_BASE_URL}/api/wallets/me?type=${type}`,
        `${API_BASE_URL}/api/wallets/my-wallet?type=${type}`,
        `${API_BASE_URL}/api/wallets/me`,
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

      const data: ApiResponse<WalletInfo> = await response.json();
      if (data.isSuccess) {
        return data.result;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to fetch wallet info:', error);
      return null;
    }
  }

  async getMyTransactions(filter?: TransactionFilter): Promise<WalletTransaction[]> {
    try {
      const queryParams = new URLSearchParams();
      if (filter?.type) queryParams.append('type', filter.type);
      if (filter?.status) queryParams.append('status', filter.status);
      if (filter?.from) queryParams.append('from', filter.from);
      if (filter?.to) queryParams.append('to', filter.to);

      const queryString = queryParams.toString();
      const suffix = queryString ? `?${queryString}` : '';
      
      const endpoints = [
        `${API_BASE_URL}/api/wallets/me/transactions`,
        `${API_BASE_URL}/api/wallets/my-transactions`,
        `${API_BASE_URL}/wallets/me/transactions`,
        `${API_BASE_URL}/wallets/my-transactions`,
      ];

      let response;
      for (const url of endpoints) {
        try {
          response = await fetch(url + suffix, { method: 'GET', headers: this.getHeaders() });
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

      const data: ApiResponse<WalletTransaction[]> = await response.json();
      if (data.isSuccess) {
        return data.result || [];
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch wallet transactions:', error);
      throw error;
    }
  }

  async getTransactionById(id: string): Promise<WalletTransaction> {
    try {
      let response = await fetch(`${API_BASE_URL}/api/wallets/transactions/${id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        response = await fetch(`${API_BASE_URL}/wallets/transactions/${id}`, {
          method: 'GET',
          headers: this.getHeaders(),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<WalletTransaction> = await response.json();
      if (data.isSuccess) {
        return data.result;
      }
      throw new Error(data.errorMessages?.[0] || 'Không thể lấy thông tin giao dịch');
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
      const response = await fetch(`${API_BASE_URL}/api/payos/create-payment-link`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ amount, walletType }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.errorMessages?.[0] || `Lỗi tạo link nạp tiền (${response.status})`);
      }

      const data: ApiResponse<any> = await response.json();
      return data.isSuccess ? data.result : null;
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
