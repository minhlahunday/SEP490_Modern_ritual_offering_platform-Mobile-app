import { ApiResponse } from '../types';
import { getAuthToken } from './auth';

import { API_BASE_URL } from './api';

export interface VendorProfile {
  profileId: string;
  shopName: string;
  shopDescription?: string;
  avatarUrl?: string | null;
  shopAvatarUrl?: string | null;
  businessType?: string;
  shopAddressText?: string;
  shopLatitude?: number;
  shopLongitude?: number;
  ratingAvg?: number;
  dailyCapacity?: number;
  tierName?: string;
  createdAt: string;
  
  // Optional/Legacy fields (keep for compatibility or if used elsewhere)
  vendorProfileId?: string; 
  responseRate?: number;
  joinedDate?: string;
  productCount?: number;
  responseTime?: string;
  followerCount?: number;
  rating?: number; // legacy
  isActive?: boolean; // legacy
}

export interface VendorTier {
  tierId: number;
  tierName: string;
  commissionRate: number;
  minCompletedOrders: number;
  minRevenueAmount: number;
  minRatingAvg: number;
  description: string;
  isActive: boolean;
}

class VendorService {
  // Feature flag: enable vendor API since it is now available
  private enableVendorApi = true;

  private buildVendorIdCandidates(rawVendorId: string): string[] {
    const id = String(rawVendorId || '').trim();
    if (!id) return [];

    const decoded = (() => {
      try {
        return decodeURIComponent(id).trim();
      } catch {
        return id;
      }
    })();

    const candidates = new Set<string>();
    candidates.add(id);
    candidates.add(decoded);

    if (!decoded.startsWith('profile-')) {
      candidates.add(`profile-${decoded}`);
    }

    if (decoded.startsWith('profile-')) {
      candidates.add(decoded.replace(/^profile-/, ''));
    }

    return Array.from(candidates).filter(Boolean);
  }

  private normalizeCompareText(value: string | undefined | null): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private async fetchVendorBySingleId(vendorProfileId: string): Promise<VendorProfile | null> {
    const response = await fetch(`${API_BASE_URL}/vendors/${vendorProfileId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ApiResponse<VendorProfile> = await response.json();
    if (!data.isSuccess || !data.result) {
      return null;
    }

    const raw = data.result as VendorProfile;
    return {
      ...raw,
      avatarUrl: raw.avatarUrl || raw.shopAvatarUrl || null,
      shopAvatarUrl: raw.shopAvatarUrl || raw.avatarUrl || null,
    };
  }
  
  /**
   * Lấy thông tin vendor theo ID
   * @param vendorProfileId - Vendor Profile ID
   * @returns Promise<VendorProfile | null>
   */
  async getVendorById(vendorProfileId: string): Promise<VendorProfile | null> {
    // Return null if vendor API is disabled
    if (!this.enableVendorApi) {
      console.log('⚠️ Vendor API is disabled');
      return null;
    }
    
    const candidates = this.buildVendorIdCandidates(vendorProfileId);

    for (const candidate of candidates) {
      try {
        const vendor = await this.fetchVendorBySingleId(candidate);
        if (vendor) {
          return vendor;
        }
      } catch (error: any) {
        const msg = String(error?.message || '');
        if (!msg.includes('404')) {
          console.warn(`⚠️ Failed to fetch vendor by id ${candidate}:`, error);
        }
      }
    }

    console.warn(`⚠️ Vendor not found for id: ${vendorProfileId}`);
    return null;
  }

  async resolveVendorProfileId(rawVendorId?: string, shopName?: string): Promise<string | null> {
    const directCandidates = this.buildVendorIdCandidates(String(rawVendorId || ''));

    for (const candidate of directCandidates) {
      const fromCache = this.vendorCache.get(candidate);
      if (fromCache?.profileId) {
        return fromCache.profileId;
      }

      const vendor = await this.getVendorById(candidate);
      if (vendor?.profileId) {
        this.vendorCache.set(vendor.profileId, vendor);
        this.vendorCache.set(candidate, vendor);
        return vendor.profileId;
      }
    }

    try {
      const all = await this.getAllVendors();
      const targetId = this.normalizeCompareText(rawVendorId);
      const targetName = this.normalizeCompareText(shopName);

      const matchedById = all.find((v) => {
        const pid = this.normalizeCompareText(v.profileId);
        if (!targetId) return false;
        return pid === targetId || pid.endsWith(targetId) || pid.includes(targetId);
      });

      if (matchedById?.profileId) {
        return matchedById.profileId;
      }

      const matchedByName = all.find((v) => this.normalizeCompareText(v.shopName) === targetName);
      if (matchedByName?.profileId) {
        return matchedByName.profileId;
      }
    } catch (error) {
      console.warn('⚠️ Unable to resolve vendor profile id from vendors list:', error);
    }

    return null;
  }

  /**
   * Lấy tất cả vendors
   * @returns Promise<VendorProfile[]>
   */
  async getAllVendors(): Promise<VendorProfile[]> {
    try {
      console.log('📦 Fetching all vendors...');
      const response = await fetch(`${API_BASE_URL}/vendors`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<VendorProfile[]> = await response.json();
      
      if (data.isSuccess && data.result) {
        const normalized = data.result.map((raw) => {
          const profile = raw as VendorProfile;
          return {
            ...profile,
            avatarUrl: profile.avatarUrl || profile.shopAvatarUrl || null,
            shopAvatarUrl: profile.shopAvatarUrl || profile.avatarUrl || null,
          } as VendorProfile;
        });

        console.log('✅ Vendors loaded:', normalized.length);
        return normalized;
      } else {
        console.error('❌ API Error:', data.errorMessages);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to fetch vendors:', error);
      return [];
    }
  }

  /**
   * Lấy danh sách tất cả hạng vendor.
   * GET /api/vendor-tiers
   */
  async getVendorTiers(): Promise<VendorTier[]> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/vendor-tiers`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<VendorTier[]> = await response.json();
      
      if (data.isSuccess && data.result) {
        return data.result;
      } else {
        console.error('❌ API Error:', data.errorMessages);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to fetch vendor tiers:', error);
      return [];
    }
  }

  /**
   * Lấy chi tiết 1 hạng vendor.
   * GET /api/vendor-tiers/{id}
   */
  async getVendorTierById(id: number): Promise<VendorTier | null> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/vendor-tiers/${id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<VendorTier> = await response.json();
      return data.isSuccess ? data.result : null;
    } catch (error) {
      console.error(`❌ Failed to fetch vendor tier ${id}:`, error);
      return null;
    }
  }

  /**
   * Cập nhật hạng vendor (Admin only).
   * PUT /api/vendor-tiers/{id}
   */
  async updateVendorTier(id: number, tierData: Partial<VendorTier>): Promise<boolean> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/vendor-tiers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(tierData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<unknown> = await response.json();
      return data.isSuccess;
    } catch (error) {
      console.error(`❌ Failed to update vendor tier ${id}:`, error);
      return false;
    }
  }

  /**
   * Tạo hạng vendor mới (Admin only).
   * POST /api/vendor-tiers
   */
  async createVendorTier(tierData: Partial<VendorTier>): Promise<boolean> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/vendor-tiers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(tierData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<unknown> = await response.json();
      return data.isSuccess;
    } catch (error) {
      console.error('❌ Failed to create vendor tier:', error);
      return false;
    }
  }

  /**
   * Xóa hạng vendor (Admin only).
   * DELETE /api/vendor-tiers/{id}
   */
  async deleteVendorTier(id: number): Promise<boolean> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/vendor-tiers/${id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<unknown> = await response.json();
      return data.isSuccess;
    } catch (error) {
      console.error(`❌ Failed to delete vendor tier ${id}:`, error);
      throw error; // Rethrow to handle specific error message in UI
    }
  }

  /**
   * Yêu cầu đóng cửa hàng.
   * POST /api/vendor/closure/request
   */
  async requestStoreClosure(reason: string): Promise<ApiResponse<any>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/vendor/closure/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to request store closure:', error);
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi kết nối hệ thống'], result: null };
    }
  }

  async getStoreClosureStatus(): Promise<ApiResponse<any>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/vendor/closure/status?ActiveRole=Vendor`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      // Handle non-200 responses safely
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          isSuccess: false, 
          statusCode: String(response.status), 
          errorMessages: [errorData.message || `Lỗi hệ thống (${response.status})`], 
          result: null 
        };
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get store closure status:', error);
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi kết nối hệ thống'], result: null };
    }
  }

  /**
   * Hủy yêu cầu đóng cửa hàng.
   * POST /api/vendor/closure/cancel
   */
  async cancelStoreClosure(): Promise<ApiResponse<any>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/vendor/closure/cancel?ActiveRole=Vendor`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to cancel store closure:', error);
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi kết nối hệ thống'], result: null };
    }
  }

  // Cache để tránh gọi API nhiều lần
  private vendorCache: Map<string, VendorProfile> = new Map();

  /**
   * Lấy vendor từ cache hoặc API
   */
  async getVendorCached(vendorProfileId: string): Promise<VendorProfile | null> {
    if (this.vendorCache.has(vendorProfileId)) {
      return this.vendorCache.get(vendorProfileId)!;
    }

    const vendor = await this.getVendorById(vendorProfileId);
    if (vendor) {
      this.vendorCache.set(vendorProfileId, vendor);
    }
    return vendor;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.vendorCache.clear();
  }
}

export const vendorService = new VendorService();
