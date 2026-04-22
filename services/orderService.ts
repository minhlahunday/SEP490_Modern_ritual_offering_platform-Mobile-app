import { API_BASE_URL, ApiResponse } from './api';
import { getAuthToken } from './auth';
import { vendorService } from './vendorService';
import { packageService } from './packageService';

export interface OrderItem {
  itemId: string;
  reviewItemId?: string;
  packageId: string;
  packageName: string;
  variantId: string;
  variantName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  lineTotal?: number;
  status?: string;
  refundStatus?: string;
  isRefunded?: boolean;
  isReturned?: boolean;
  refundAmount?: number;
  refundedAmount?: number;
  refundedQuantity?: number;
  isRequestRefund?: boolean;
  swaps?: {
    swapId: string;
    originalItemName: string;
    replacementItemName: string;
    replacementDescription?: string;
    surcharge: number;
    lineTotal?: number;
    originalItemAllocatedPrice?: number;
    refundableAmount?: number;
  }[];
  addOns?: {
    addOnId: string;
    itemName: string;
    quantity: number;
    retailPrice: number;
    lineTotal: number;
  }[];
  variantSubTotal?: number;
  swapSubTotal?: number;
  addOnSubTotal?: number;
  totalAmount?: number;
  subTotal?: number;
}

export interface Order {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  createdAt: string;
  updatedAt: string;
  pricing: {
    subTotal: number;
    shippingFee: number;
    totalAmount: number;
    discountAmount?: number;
    finalAmount?: number;
  };
  delivery: {
    deliveryAddress: string;
    deliveryDate: string;
    deliveryTime: string;
    customerName: string;
    customerPhone: string;
    preparationProofImages?: string[];
    deliveryProofImages?: string[];
  };
  customer: {
    fullName: string;
    phoneNumber: string;
  };
  vendor: {
    profileId: string;
    shopName: string;
    shopAvatarUrl?: string;
  };
  items: OrderItem[];
  trackingLists?: {
    trackingId: string;
    title: string;
    description: string;
    createdAt: string;
  }[];
}

class OrderService {
  private toNumber(...values: any[]): number {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const raw = value.trim();
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) return parsed;

        const cleaned = raw.replace(/\s|₫|đ|vnd|VND|\+/g, '');

        // 1.400.000 or 1,400,000
        if (/^-?\d{1,3}([.,]\d{3})+$/.test(cleaned)) {
          const grouped = Number(cleaned.replace(/[.,]/g, ''));
          if (Number.isFinite(grouped)) return grouped;
        }

        // Generic fallback: strip non-digit separators that usually represent grouping.
        const fallbackNumeric = Number(
          cleaned
            .replace(/[^0-9,.-]/g, '')
            .replace(/[.,](?=\d{3}(\D|$))/g, '')
            .replace(',', '.')
        );
        if (Number.isFinite(fallbackNumeric)) return fallbackNumeric;
      }
    }
    return 0;
  }

  private normalizeOrder(raw: any): Order {
    const vendorOrders = Array.isArray(raw?.vendorOrders)
      ? raw.vendorOrders
      : (Array.isArray(raw?.orderVendors) ? raw.orderVendors : []);

    const items =
      (Array.isArray(raw?.items) && raw.items)
      || (Array.isArray(raw?.orderItems) && raw.orderItems)
      || (Array.isArray(raw?.details) && raw.details)
      || (Array.isArray(raw?.orderDetails) && raw.orderDetails)
      || (Array.isArray(raw?.ritualItems) && raw.ritualItems)
      || (vendorOrders.length > 0
        ? vendorOrders.flatMap((vendor: any) => Array.isArray(vendor?.items) ? vendor.items : [])
        : [])
      || [];
    const normalizedItems: OrderItem[] = items.map((item: any) => {
      const quantity = this.toNumber(item?.quantity, item?.qty, 1) || 1;
      const price = this.toNumber(
        item?.price,
        item?.unitPrice,
        item?.variantPrice,
        item?.retailPrice,
        item?.basePrice,
        item?.packagePrice,
      );
      const variantSubTotalRaw = this.toNumber(
        item?.variantSubTotal,
        item?.variantTotal,
        item?.baseSubTotal,
        item?.baseTotal,
        item?.packageSubTotal,
        item?.packageTotal,
        item?.productSubTotal,
        item?.productTotal,
        price * quantity,
      );
      const lineTotal = this.toNumber(
        item?.lineTotal,
        item?.totalPrice,
        item?.totalAmount,
        item?.finalAmount,
        item?.subTotal,
        item?.amount,
        item?.extendedPrice,
        item?.pricing?.totalAmount,
        item?.pricing?.lineTotal,
      );
      const rawSwaps = Array.isArray(item?.swaps)
        ? item.swaps
        : (Array.isArray(item?.orderItemSwaps)
          ? item.orderItemSwaps
          : (Array.isArray(item?.cartItemSwaps) ? item.cartItemSwaps : []));

      const swaps = Array.isArray(rawSwaps)
        ? rawSwaps.map((swap: any) => ({
            swapId: String(swap?.swapId || swap?.id || '').trim(),
            originalItemName: String(
              swap?.originalItemName
              || swap?.originalName
              || swap?.fromItemName
              || swap?.sourceItemName
              || swap?.oldItemName
              || ''
            ).trim(),
            replacementItemName: String(
              swap?.replacementItemName
              || swap?.replacementName
              || swap?.toItemName
              || swap?.targetItemName
              || swap?.newItemName
              || ''
            ).trim(),
            replacementDescription: String(
              swap?.replacementDescription
              || swap?.description
              || swap?.displayName
              || ''
            ).trim() || undefined,
            originalItemAllocatedPrice: this.toNumber(swap?.originalItemAllocatedPrice, swap?.originalAllocatedPrice),
            refundableAmount: this.toNumber(swap?.refundableAmount, swap?.replacementAllocatedPrice),
            surcharge: this.toNumber(
              swap?.surcharge,
              swap?.surchargeAmount,
              swap?.surchargeTotal,
              swap?.totalSurcharge,
              swap?.additionalPrice,
              swap?.extraPrice,
              swap?.extraFee,
              swap?.priceDiff,
              swap?.differencePrice,
              swap?.differenceAmount,
              swap?.deltaPrice,
              swap?.amount,
              swap?.swapPrice,
              swap?.optionPrice,
              swap?.replacementPrice,
              swap?.price,
              swap?.pricing?.surcharge,
              swap?.pricing?.amount,
              swap?.swapOption?.surcharge,
              swap?.swapOption?.price,
              this.toNumber(swap?.refundableAmount, swap?.replacementAllocatedPrice)
                - this.toNumber(swap?.originalItemAllocatedPrice, swap?.originalAllocatedPrice),
            ),
            lineTotal: this.toNumber(
              swap?.lineTotal,
              swap?.totalPrice,
              swap?.totalAmount,
              swap?.finalAmount,
              swap?.amount,
              swap?.pricing?.lineTotal,
              this.toNumber(swap?.refundableAmount, swap?.replacementAllocatedPrice)
                - this.toNumber(swap?.originalItemAllocatedPrice, swap?.originalAllocatedPrice),
            ),
          }))
        : [];

      const rawAddOns = Array.isArray(item?.addOns)
        ? item.addOns
        : (Array.isArray(item?.orderItemAddOns)
          ? item.orderItemAddOns
          : (Array.isArray(item?.cartItemAddOns) ? item.cartItemAddOns : []));

      const addOns = Array.isArray(rawAddOns)
        ? rawAddOns.map((addOn: any) => ({
            addOnId: String(addOn?.addOnId || addOn?.id || '').trim(),
            itemName: String(
              addOn?.itemName
              || addOn?.name
              || addOn?.addOnName
              || addOn?.title
              || ''
            ).trim(),
            quantity: this.toNumber(addOn?.quantity, 0),
            retailPrice: this.toNumber(addOn?.retailPrice, addOn?.price),
            lineTotal: this.toNumber(
              addOn?.lineTotal,
              addOn?.totalAmount,
              addOn?.subTotal,
              this.toNumber(addOn?.retailPrice, addOn?.price) * this.toNumber(addOn?.quantity, 0)
            ),
          }))
        : [];

      const swapSubTotal = this.toNumber(
        item?.swapSubTotal,
        item?.swapsSubTotal,
        item?.swapTotal,
        item?.swapsTotal,
        item?.totalSwapAmount,
        item?.totalSwapSurcharge,
        swaps.reduce((sum: number, swap: any) => sum + this.toNumber(swap?.lineTotal, swap?.surcharge), 0)
      );

      const addOnSubTotal = this.toNumber(
        item?.addOnSubTotal,
        item?.addOnsSubTotal,
        item?.addOnTotal,
        item?.addOnsTotal,
        item?.totalAddOnAmount,
        addOns.reduce((sum: number, addOn: any) => sum + this.toNumber(addOn?.lineTotal), 0)
      );

      const resolvedLineTotal = this.toNumber(
        lineTotal,
        item?.totalAmount,
        item?.finalAmount,
        item?.amount,
        variantSubTotalRaw + swapSubTotal + addOnSubTotal,
        price * quantity
      );

      const variantSubTotal = this.toNumber(
        variantSubTotalRaw,
        Math.max(0, resolvedLineTotal - swapSubTotal - addOnSubTotal),
        price * quantity,
      );

      const reviewItemId = String(
        item?.orderItemId
        || item?.itemId
        || item?.id
        || item?.orderDetailId
        || item?.detailId
        || item?.orderItem?.orderItemId
        || item?.orderItem?.itemId
        || ''
      ).trim();

      return {
        itemId: String(item?.itemId || item?.orderItemId || item?.id || '').trim(),
        reviewItemId,
        packageId: String(item?.packageId || item?.ritualPackageId || ''),
        packageName: String(item?.packageName || item?.name || 'Goi le vat'),
        variantId: String(item?.variantId || ''),
        variantName: String(item?.variantName || item?.tierName || ''),
        price,
        quantity,
        imageUrl:
          item?.imageUrl
          || item?.packageImageUrl
          || item?.packageAvatarUrl
          || item?.image
          || item?.thumbnailUrl
          || (Array.isArray(item?.imageUrls) ? item.imageUrls[0] : undefined)
          || item?.package?.packageAvatarUrl
          || item?.package?.imageUrl
          || (Array.isArray(item?.package?.imageUrls) ? item.package.imageUrls[0] : undefined)
          || undefined,
        lineTotal: resolvedLineTotal,
        status: String(item?.status || item?.orderItemStatus || ''),
        refundStatus: String(item?.refundStatus || item?.refund?.status || ''),
        isRefunded: Boolean(item?.isRefunded),
        isReturned: Boolean(item?.isReturned),
        refundAmount: this.toNumber(item?.refundAmount),
        refundedAmount: this.toNumber(item?.refundedAmount),
        refundedQuantity: this.toNumber(item?.refundedQuantity),
        isRequestRefund: Boolean(item?.isRequestRefund),
        swaps,
        addOns,
        variantSubTotal,
        swapSubTotal,
        addOnSubTotal,
        totalAmount: this.toNumber(item?.totalAmount, resolvedLineTotal),
        subTotal: this.toNumber(item?.subTotal, resolvedLineTotal),
      };
    });

    const pricingRaw = raw?.pricing || {};
    const subTotal = this.toNumber(pricingRaw?.subTotal, raw?.subTotal);
    const shippingFee = this.toNumber(pricingRaw?.shippingFee, raw?.shippingFee);
    const discountAmount = this.toNumber(pricingRaw?.discountAmount, raw?.discountAmount);
    const totalAmount = this.toNumber(
      pricingRaw?.totalAmount,
      raw?.totalAmount,
      subTotal + shippingFee - discountAmount
    );
    const finalAmount = this.toNumber(
      pricingRaw?.finalAmount,
      raw?.finalAmount,
      totalAmount
    );

    return {
      orderId: String(raw?.orderId || raw?.id || ''),
      orderNumber: String(raw?.orderNumber || ''),
      orderStatus: String(raw?.orderStatus || raw?.status || 'Pending'),
      createdAt: String(raw?.createdAt || raw?.orderDate || ''),
      updatedAt: String(raw?.updatedAt || ''),
      pricing: {
        subTotal,
        shippingFee,
        totalAmount,
        discountAmount,
        finalAmount,
      },
      delivery: {
        deliveryAddress: String(raw?.delivery?.deliveryAddress || raw?.deliveryAddress || ''),
        deliveryDate: String(raw?.delivery?.deliveryDate || raw?.deliveryDate || ''),
        deliveryTime: String(raw?.delivery?.deliveryTime || raw?.deliveryTime || ''),
        customerName: String(raw?.delivery?.customerName || raw?.customer?.fullName || ''),
        customerPhone: String(raw?.delivery?.customerPhone || raw?.customer?.phoneNumber || ''),
        preparationProofImages: Array.isArray(raw?.delivery?.preparationProofImages)
          ? raw.delivery.preparationProofImages
          : (Array.isArray(raw?.delivery?.preparationProofImageUrl) ? raw.delivery.preparationProofImageUrl : []),
        deliveryProofImages: Array.isArray(raw?.delivery?.deliveryProofImages)
          ? raw.delivery.deliveryProofImages
          : (Array.isArray(raw?.delivery?.deliveryProofImageUrl) ? raw.delivery.deliveryProofImageUrl : []),
      },
      customer: {
        fullName: String(raw?.customer?.fullName || raw?.delivery?.customerName || ''),
        phoneNumber: String(raw?.customer?.phoneNumber || raw?.delivery?.customerPhone || ''),
      },
      vendor: {
        profileId: String(raw?.vendor?.profileId || raw?.vendor?.vendorId || raw?.vendorProfileId || raw?.vendorId || ''),
        shopName: String(raw?.vendor?.shopName || raw?.shopName || 'Cua hang Viet Ritual'),
        shopAvatarUrl:
          raw?.vendor?.shopAvatarUrl
          || raw?.vendor?.avatarUrl
          || raw?.vendor?.profileImageUrl
          || raw?.vendor?.imageUrl
          || raw?.shopAvatarUrl
          || raw?.vendorAvatarUrl
          || undefined,
      },
      items: normalizedItems,
      trackingLists: Array.isArray(raw?.trackingLists) ? raw.trackingLists : [],
    };
  }

  private normalizeOrders(rawOrders: any[]): Order[] {
    if (!Array.isArray(rawOrders)) return [];
    return rawOrders.map((raw) => this.normalizeOrder(raw));
  }

  private async enrichOrdersWithVendorProfiles(orders: Order[]): Promise<Order[]> {
    if (!Array.isArray(orders) || orders.length === 0) return orders;

    const uniqueVendors = new Map<string, { rawId: string; shopName: string }>();

    orders.forEach((order) => {
      const rawId = String(order?.vendor?.profileId || '').trim();
      const shopName = String(order?.vendor?.shopName || '').trim();
      const key = `${rawId}::${shopName}`;
      if (!uniqueVendors.has(key)) {
        uniqueVendors.set(key, { rawId, shopName });
      }
    });

    const resolvedByKey = new Map<string, { profileId?: string; shopName?: string; shopAvatarUrl?: string }>();

    await Promise.all(
      Array.from(uniqueVendors.entries()).map(async ([key, info]) => {
        try {
          const resolvedProfileId = await vendorService.resolveVendorProfileId(info.rawId, info.shopName);
          if (!resolvedProfileId) return;

          const vendor = await vendorService.getVendorCached(resolvedProfileId);
          if (!vendor) return;

          resolvedByKey.set(key, {
            profileId: vendor.profileId,
            shopName: vendor.shopName,
            shopAvatarUrl: vendor.shopAvatarUrl || vendor.avatarUrl || undefined,
          });
        } catch {
          // Keep original vendor payload if resolving fails.
        }
      })
    );

    return orders.map((order) => {
      const rawId = String(order?.vendor?.profileId || '').trim();
      const shopName = String(order?.vendor?.shopName || '').trim();
      const key = `${rawId}::${shopName}`;
      const resolved = resolvedByKey.get(key);

      if (!resolved) return order;

      return {
        ...order,
        vendor: {
          ...order.vendor,
          profileId: resolved.profileId || order.vendor.profileId,
          shopName: resolved.shopName || order.vendor.shopName,
          shopAvatarUrl: resolved.shopAvatarUrl || order.vendor.shopAvatarUrl,
        },
      };
    });
  }

  private resolvePackageImage(pkg: any): string | undefined {
    if (!pkg) return undefined;

    const avatar = pkg?.packageAvatarUrl || pkg?.imageUrl;
    const imageUrls = Array.isArray(pkg?.imageUrls) ? pkg.imageUrls : [];
    const primaryIndexRaw = Number(pkg?.primaryImageIndex);
    const primaryIndex = Number.isFinite(primaryIndexRaw) && primaryIndexRaw >= 0
      ? primaryIndexRaw
      : 0;

    return avatar || imageUrls[primaryIndex] || imageUrls[0] || undefined;
  }

  private async enrichOrdersWithPackageImages(orders: Order[]): Promise<Order[]> {
    if (!Array.isArray(orders) || orders.length === 0) return orders;

    const uniquePackageIds = Array.from(new Set(
      orders.flatMap((order) =>
        (order.items || [])
          .map((item) => Number(String(item.packageId || '').trim()))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    ));

    if (uniquePackageIds.length === 0) return orders;

    const imageByPackageId = new Map<number, string>();

    await Promise.all(uniquePackageIds.map(async (packageId) => {
      try {
        const pkg = await packageService.getPackageById(packageId);
        const image = this.resolvePackageImage(pkg as any);
        if (image) {
          imageByPackageId.set(packageId, image);
        }
      } catch {
        // Keep original image if package details cannot be fetched.
      }
    }));

    if (imageByPackageId.size === 0) return orders;

    return orders.map((order) => ({
      ...order,
      items: (order.items || []).map((item) => {
        const packageId = Number(String(item.packageId || '').trim());
        const canonicalImage = Number.isInteger(packageId) ? imageByPackageId.get(packageId) : undefined;

        if (!canonicalImage) return item;

        return {
          ...item,
          imageUrl: canonicalImage,
        };
      }),
    }));
  }

  private async enrichOrdersForDisplay(orders: Order[]): Promise<Order[]> {
    const withVendors = await this.enrichOrdersWithVendorProfiles(orders);
    return await this.enrichOrdersWithPackageImages(withVendors);
  }

  private extractOrders(payload: any): Order[] {
    if (!payload) return [];

    if (Array.isArray(payload)) {
      return this.normalizeOrders(payload);
    }

    if (Array.isArray(payload?.result)) {
      return this.normalizeOrders(payload.result);
    }

    if (Array.isArray(payload?.result?.items)) {
      return this.normalizeOrders(payload.result.items);
    }

    if (Array.isArray(payload?.result?.data)) {
      return this.normalizeOrders(payload.result.data);
    }

    if (Array.isArray(payload?.items)) {
      return this.normalizeOrders(payload.items);
    }

    if (Array.isArray(payload?.data)) {
      return this.normalizeOrders(payload.data);
    }

    if (Array.isArray(payload?.orders)) {
      return this.normalizeOrders(payload.orders);
    }

    return [];
  }

  private getHeaders(): HeadersInit {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  private async getCustomerOrdersPaged(pageSize: number = 20): Promise<Order[] | null> {
    let pageNumber = 1;
    const all: Order[] = [];

    while (true) {
      const url = `${API_BASE_URL}/orders/customer?PageNumber=${pageNumber}&PageSize=${pageSize}`;
      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        if (pageNumber === 1) {
          return null;
        }
        break;
      }

      const raw = await response.text().catch(() => '');
      if (!raw) {
        break;
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }

      const pageItems = this.extractOrders(parsed);
      all.push(...pageItems);

      const result = parsed?.result;
      const hasNextByFlag = typeof result?.hasNextPage === 'boolean' ? result.hasNextPage : null;
      const totalPages = Number(result?.totalPages || 0);

      if (hasNextByFlag === false) {
        break;
      }

      if (hasNextByFlag === true) {
        pageNumber += 1;
        continue;
      }

      if (totalPages > 0) {
        if (pageNumber >= totalPages) {
          break;
        }
        pageNumber += 1;
        continue;
      }

      if (!pageItems.length || pageItems.length < pageSize) {
        break;
      }

      pageNumber += 1;
    }

    return all;
  }

  async getOrderDetails(orderId: string): Promise<Order | null> {
    try {
      const normalizedOrderId = String(orderId || '').trim();
      if (!normalizedOrderId) return null;

      const extractRawOrder = (data: any) => {
        if (!data) return null;
        if (data && typeof data === 'object' && 'isSuccess' in data) {
          if (data.isSuccess === false) return null;
          const result = data.result;
          if (result && typeof result === 'object') return result;
          return null;
        }
        if (data?.result && typeof data.result === 'object') return data.result;
        if (data?.data && typeof data.data === 'object') return data.data;
        if (data?.order && typeof data.order === 'object') return data.order;
        if (typeof data === 'object' && (data?.orderId || data?.id)) return data;
        return null;
      };

      const candidates = [
        `${API_BASE_URL}/orders/${encodeURIComponent(normalizedOrderId)}`,
        `${API_BASE_URL}/orders/detail/${encodeURIComponent(normalizedOrderId)}`,
        `${API_BASE_URL}/orders?orderId=${encodeURIComponent(normalizedOrderId)}`,
      ];

      for (const url of candidates) {
        const response = await fetch(url, { headers: this.getHeaders() });
        if (!response.ok) continue;

        const data: any = await response.json().catch(() => null);
        const rawOrder = extractRawOrder(data);
        if (!rawOrder) continue;

        const normalized = this.normalizeOrder(rawOrder);
        const [enriched] = await this.enrichOrdersForDisplay([normalized]);
        return enriched || normalized;
      }

      // Final fallback: load my orders and find the one requested.
      const myOrders = await this.getMyOrders();
      const found = myOrders.find((order) => String(order.orderId).trim() === normalizedOrderId);
      if (found) {
        const [enriched] = await this.enrichOrdersForDisplay([found]);
        return enriched || found;
      }

      throw new Error('Failed to fetch order details');
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw error;
    }
  }

  async cancelOrder(orderId: string, reason: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ cancelReason: reason })
      });

      if (!response.ok) {
        const raw = await response.text().catch(() => '');
        let message = 'Hủy đơn hàng thất bại';
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.errorMessages) && parsed.errorMessages.length > 0) {
              message = String(parsed.errorMessages[0]);
            } else if (typeof parsed?.message === 'string' && parsed.message.trim()) {
              message = parsed.message.trim();
            }
          } catch {
            message = raw;
          }
        }
        throw new Error(message);
      }

      return true;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<boolean> {
    try {
      const statusCandidates = Array.from(new Set([
        String(status || '').trim(),
        String(status || '').toUpperCase(),
        String(status || '').toLowerCase(),
      ].filter(Boolean)));

      for (const value of statusCandidates) {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ status: value })
        });

        if (response.ok) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error updating order status:', error);
      return false;
    }
  }

  async getMyOrders(): Promise<Order[]> {
    try {
      const customerOrders = await this.getCustomerOrdersPaged(20);
      if (customerOrders !== null) {
        return await this.enrichOrdersForDisplay(customerOrders);
      }

      const candidates = [
        `${API_BASE_URL}/orders/my-orders`,
        `${API_BASE_URL}/orders/my-orders?ActiveRole=Customer`,
        `${API_BASE_URL}/orders/my`,
        `${API_BASE_URL}/orders?ActiveRole=Customer`,
        `${API_BASE_URL}/orders?activeRole=Customer`,
      ];

      let lastError = '';

      for (const url of candidates) {
        const response = await fetch(url, {
          headers: this.getHeaders()
        });

        if (!response.ok) {
          const rawText = await response.text().catch(() => '');
          let parsedMessage = '';

          try {
            const parsed = rawText ? JSON.parse(rawText) : null;
            if (Array.isArray(parsed?.errorMessages) && parsed.errorMessages.length > 0) {
              parsedMessage = parsed.errorMessages.join(', ');
            } else if (typeof parsed?.message === 'string') {
              parsedMessage = parsed.message;
            }
          } catch {
            // Keep raw text fallback.
          }

          lastError = parsedMessage || rawText || `Failed to fetch orders (${response.status})`;

          const looksLikeRouteBindingMismatch =
            /value\s*'my-orders'\s*is not valid|not valid/i.test(lastError);

          // Try next candidate for route mismatch/authorization-by-role scenarios.
          if (response.status === 404 || response.status === 405 || response.status === 403 || looksLikeRouteBindingMismatch) {
            continue;
          }

          if (response.status === 401) {
            return [];
          }

          throw new Error(lastError);
        }

        const raw = await response.text().catch(() => '');
        if (!raw) return [];

        let parsed: any = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }

        const extracted = this.extractOrders(parsed);
        if (extracted.length > 0) {
          return await this.enrichOrdersForDisplay(extracted);
        }

        // If endpoint succeeded but there are genuinely no orders.
        if (parsed?.isSuccess === true || Array.isArray(parsed?.result) || Array.isArray(parsed?.items)) {
          return extracted;
        }
      }

      if (lastError) {
        console.warn('No compatible my-orders response found:', lastError);
      }
      return [];
    } catch (error) {
      console.warn('Fetch my orders failed:', error);
      return [];
    }
  }
}

export const orderService = new OrderService();
export default orderService;
