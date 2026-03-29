import { ApiResponse } from '../types';
import { getAuthToken } from './auth';
import { API_BASE_URL } from './api';

export interface CustomerAddress {
  addressId: string | number;
  customerId: string;
  addressText: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

class AddressService {
  private getHeaders(): HeadersInit {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async getAddresses(): Promise<CustomerAddress[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/addresses`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) return data;
      if (data.isSuccess && Array.isArray(data.result)) {
        return data.result;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
      return [];
    }
  }

  async setDefaultAddress(addressId: string | number): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/addresses/${addressId}/set-default`, {
        method: 'PUT',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.isSuccess || data.statusCode === 'OK';
    } catch (error) {
      console.error('Failed to set default address:', error);
      return false;
    }
  }
}

export const addressService = new AddressService();
