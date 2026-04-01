import { ApiResponse } from '../types';
import { getAuthToken } from './auth';
import { API_BASE_URL } from './api';

export interface CheckoutItem {
  cartItemId: number;
  packageId: number;
  packageName: string;
  variantId: number;
  variantName: string;
  price: number;
  quantity: number;
  imageUrl: string;
  vendorId: string;
  vendorName: string;
  lineTotal?: number;
}

export interface VendorOrderSummary {
  vendorId: string;
  shopName: string;
  subTotal: number;
  shippingFee: number;
  totalDiscount: number;
  totalAmount: number;
  shippingDistanceKm?: number;
  items: CheckoutItem[];
}

export interface CheckoutSummary {
  subTotal: number;
  shippingFee: number;
  totalDiscount: number;
  totalAmount: number;
  totalItems: number;
  totalHoldFee?: number;
  deliveryAddress?: string;
  items: CheckoutItem[];
  vendorOrders?: VendorOrderSummary[];
}

export interface CheckoutRequestItem {
  cartItemId: number;
  decorationNote: string;
}

export interface CheckoutRequest {
  deliveryDate: string;
  deliveryTime: string;
  paymentMethod: string;
  items: CheckoutRequestItem[];
}

export interface CheckoutResult {
  orderId?: number;
  paymentUrl?: string;
  checkoutUrl?: string; // Some APIs use checkoutUrl
}

class CheckoutService {
  private getHeaders(): HeadersInit {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async getSummary(cartItemIds: number[]): Promise<CheckoutSummary | null> {
    try {
      const payload = cartItemIds.map(id => ({ cartItemId: id }));
      const response = await fetch(`${API_BASE_URL}/checkout/summary`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<CheckoutSummary> = await response.json();
      return data.isSuccess ? data.result : null;
    } catch (error) {
      console.error('❌ Failed to fetch checkout summary:', error);
      throw error;
    }
  }

  async processCheckout(request: CheckoutRequest): Promise<CheckoutResult | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/checkout`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<CheckoutResult> = await response.json();
      return data.isSuccess ? data.result : null;
    } catch (error) {
      console.error('❌ Checkout failed:', error);
      throw error;
    }
  }

  async processTransaction(orderId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/order/${orderId}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Transaction processing failed:', error);
      return false;
    }
  }

  async initiatePayOSPayment(amount: number): Promise<CheckoutResult | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/payments/payos/initiate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ amount }),
      });
      const data: ApiResponse<CheckoutResult> = await response.json();
      return data.isSuccess ? data.result : null;
    } catch (error) {
      console.error('❌ PayOS initiation failed:', error);
      return null;
    }
  }

  async getPaymentReturnUrl(): Promise<string> {
    // In mobile, we probably return a deep link or a internal route
    return 'vietritual://checkout-callback';
  }

  async getTransaction(transactionId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/payments/${transactionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<any> = await response.json();
      return data.isSuccess ? data.result : null;
    } catch (error) {
      console.error('❌ Failed to fetch transaction:', error);
      throw error;
    }
  }
}

export const checkoutService = new CheckoutService();
export default checkoutService;
