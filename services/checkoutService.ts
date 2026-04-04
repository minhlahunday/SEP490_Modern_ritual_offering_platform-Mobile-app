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
  private toNumber(...values: any[]): number {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return 0;
  }

  private normalizeVendorOrders(raw: any): VendorOrderSummary[] {
    const source = Array.isArray(raw?.vendorOrders)
      ? raw.vendorOrders
      : Array.isArray(raw?.vendorOrderSummaries)
        ? raw.vendorOrderSummaries
        : [];

    return source.map((vendor: any) => {
      const vendorItems = Array.isArray(vendor?.items) ? vendor.items : [];
      return {
        vendorId: String(vendor?.vendorId || vendor?.profileId || ''),
        shopName: String(vendor?.shopName || vendor?.vendorName || ''),
        subTotal: this.toNumber(vendor?.subTotal, vendor?.subtotal, vendor?.pricing?.subTotal),
        shippingFee: this.toNumber(vendor?.shippingFee, vendor?.deliveryFee, vendor?.pricing?.shippingFee),
        totalDiscount: this.toNumber(vendor?.totalDiscount, vendor?.discountAmount, vendor?.pricing?.totalDiscount),
        totalAmount: this.toNumber(vendor?.totalAmount, vendor?.finalAmount, vendor?.pricing?.totalAmount),
        shippingDistanceKm: this.toNumber(vendor?.shippingDistanceKm, vendor?.distanceKm),
        items: vendorItems,
      };
    });
  }

  private normalizeSummary(raw: any): CheckoutSummary | null {
    if (!raw || typeof raw !== 'object') return null;

    const vendorOrders = this.normalizeVendorOrders(raw);
    const fallbackItems = vendorOrders.flatMap((vendor) => Array.isArray(vendor.items) ? vendor.items : []);
    const items = Array.isArray(raw?.items) ? raw.items : fallbackItems;

    const subTotal = this.toNumber(
      raw?.subTotal,
      raw?.subtotal,
      raw?.pricing?.subTotal,
      raw?.pricing?.subtotal
    );

    const shippingFee = this.toNumber(
      raw?.shippingFee,
      raw?.deliveryFee,
      raw?.totalShippingFee,
      raw?.pricing?.shippingFee,
      raw?.pricing?.deliveryFee,
      vendorOrders.reduce((sum, vendor) => sum + this.toNumber(vendor.shippingFee), 0)
    );

    const totalDiscount = this.toNumber(
      raw?.totalDiscount,
      raw?.discountAmount,
      raw?.pricing?.totalDiscount,
      raw?.pricing?.discountAmount
    );

    const totalAmount = this.toNumber(
      raw?.totalAmount,
      raw?.finalAmount,
      raw?.grandTotal,
      raw?.pricing?.totalAmount,
      raw?.pricing?.finalAmount,
      subTotal + shippingFee - totalDiscount
    );

    const totalItems = this.toNumber(
      raw?.totalItems,
      raw?.itemCount,
      items.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0)
    );

    return {
      subTotal,
      shippingFee,
      totalDiscount,
      totalAmount,
      totalItems,
      totalHoldFee: this.toNumber(raw?.totalHoldFee, raw?.holdFee, raw?.pricing?.totalHoldFee),
      deliveryAddress: raw?.deliveryAddress || raw?.addressText || raw?.shippingAddress || raw?.address?.fullAddress,
      items,
      vendorOrders,
    };
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    const fallback = `HTTP error! status: ${response.status}`;
    const raw = await response.text().catch(() => '');
    if (!raw) return fallback;

    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data?.errorMessages) && data.errorMessages.length > 0) {
        return String(data.errorMessages[0]);
      }
      if (typeof data?.message === 'string' && data.message.trim()) {
        return data.message.trim();
      }
    } catch {
      // keep raw text fallback
    }

    return raw || fallback;
  }

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

      const rawData: any = await response.json();
      const payloadData =
        rawData && typeof rawData === 'object' && 'isSuccess' in rawData
          ? (rawData.isSuccess ? rawData.result : null)
          : (rawData?.result ?? rawData);

      return this.normalizeSummary(payloadData);
    } catch (error) {
      console.error('❌ Failed to fetch checkout summary:', error);
      throw error;
    }
  }

  async processCheckout(request: CheckoutRequest): Promise<CheckoutResult | null> {
    try {
      const formattedTime = String(request.deliveryTime || '').length > 5
        ? String(request.deliveryTime).substring(0, 5)
        : String(request.deliveryTime || '');

      const formattedRequest: CheckoutRequest = {
        ...request,
        deliveryTime: formattedTime.endsWith(':00') ? formattedTime : `${formattedTime}:00`,
      };

      const parseCheckoutResponse = async (response: Response): Promise<CheckoutResult | null> => {
        const rawText = await response.text().catch(() => '');
        if (!rawText) return null;

        let parsed: any = null;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          return null;
        }

        const isEnvelope = parsed && typeof parsed === 'object' && ('isSuccess' in parsed || 'result' in parsed);
        if (isEnvelope) {
          if (parsed.isSuccess === false) {
            const message = Array.isArray(parsed.errorMessages) && parsed.errorMessages.length > 0
              ? String(parsed.errorMessages[0])
              : 'Đặt hàng thất bại';
            throw new Error(message);
          }
          return (parsed.result ?? null) as CheckoutResult | null;
        }

        return parsed as CheckoutResult;
      };

      const candidates: Array<{ url: string; body: any; bodyType: 'direct' | 'wrapped' }> = [
        { url: `${API_BASE_URL}/checkout/process`, body: formattedRequest, bodyType: 'direct' },
        { url: `${API_BASE_URL}/checkout/process`, body: { request: formattedRequest }, bodyType: 'wrapped' },
        { url: `${API_BASE_URL}/checkout`, body: formattedRequest, bodyType: 'direct' },
        { url: `${API_BASE_URL}/checkout`, body: { request: formattedRequest }, bodyType: 'wrapped' },
      ];

      let lastMessage = '';

      for (const candidate of candidates) {
        const response = await fetch(candidate.url, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(candidate.body),
        });

        if (response.ok) {
          return await parseCheckoutResponse(response);
        }

        const message = await this.extractErrorMessage(response);
        lastMessage = message;

        const isRouteMismatch =
          (response.status === 404 || response.status === 405) &&
          /not found|http error! status:\s*404|http error! status:\s*405/i.test(message);

        const needsWrappedRequest =
          candidate.bodyType === 'direct' &&
          /the request field is required|request field is required|request is required/i.test(message);

        if (isRouteMismatch || needsWrappedRequest) {
          continue;
        }

        throw new Error(message);
      }

      throw new Error(lastMessage || 'Không thể xử lý đơn hàng. Vui lòng thử lại.');
    } catch (error) {
      console.warn('⚠️ Checkout failed:', error);
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
      const response = await fetch(`${API_BASE_URL}/payos/create-topup-link`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ amount, type: 'Customer' }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<CheckoutResult> = await response.json();
      if (!data?.isSuccess) return null;

      const result: any = data.result || {};
      return {
        orderId: result.orderId,
        paymentUrl: result.paymentUrl || result.checkoutUrl,
        checkoutUrl: result.checkoutUrl || result.paymentUrl,
      };
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
