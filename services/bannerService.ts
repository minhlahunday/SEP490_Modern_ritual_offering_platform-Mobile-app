import { ApiResponse } from '../types';
import { getAuthToken } from './auth';

import { API_BASE_URL } from './api';
export const DEFAULT_BANNER_IMAGE = 'https://images.unsplash.com/photo-1528459801416-a7e992795770?auto=format&fit=crop&q=80&w=2000';

export interface BannerResponse {
  bannerId: number;
  title: string;
  imageUrl: string;
  linkUrl: string;
  linkType: 'Ritual' | 'Package' | 'Vendor' | string;
  linkTargetId: number;
  position: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  vendorId?: string | null;
}

class BannerService {
  private fixUrl(url: string | undefined): string {
    if (!url) return DEFAULT_BANNER_IMAGE;
    if (url.includes('storage.vietritual.com')) {
      // storage.vietritual.com is dead and vietritual.click/banners is also returning 404.
      // Return fallback directly to avoid console noise and broken UI.
      return DEFAULT_BANNER_IMAGE;
    }
    return url;
  }

  /**
   * Helper to handle image errors in components
   */
  handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
    const target = e.target as HTMLImageElement;
    if (target.src !== DEFAULT_BANNER_IMAGE) {
      target.src = DEFAULT_BANNER_IMAGE;
    }
  }

  /**
   * Lấy danh sách banner đang hoạt động cho trang chủ.
   * @param vendorId - Nếu vào trang cá nhân của vendor thì truyền vendorId vào
   */
  async getActiveBanners(vendorId?: string): Promise<ApiResponse<BannerResponse[]>> {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = `${API_BASE_URL}/banners/active`;
      if (vendorId) {
        url += `?vendorId=${vendorId}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiResponse<BannerResponse[]> = await response.json();
      if (data.isSuccess && data.result) {
        data.result = data.result.map(b => ({
          ...b,
          imageUrl: this.fixUrl(b.imageUrl)
        }));
      }
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch active banners:', error);
      return { 
        isSuccess: false, 
        statusCode: '500', 
        errorMessages: ['Không thể tải danh sách banner'], 
        result: [] 
      };
    }
  }

  /**
   * Lấy TẤT CẢ banner (dành cho Staff/Admin)
   */
  async getAllBanners(): Promise<ApiResponse<BannerResponse[]>> {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch(`${API_BASE_URL}/banners`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiResponse<BannerResponse[]> = await response.json();
      if (data.isSuccess && data.result) {
        data.result = data.result.map(b => ({
          ...b,
          imageUrl: this.fixUrl(b.imageUrl)
        }));
      }
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch all banners:', error);
      return { 
        isSuccess: false, 
        statusCode: '500', 
        errorMessages: ['Không thể tải toàn bộ danh sách banner'], 
        result: [] 
      };
    }
  }

  /**
   * Lấy chi tiết 1 banner
   */
  async getBannerById(id: number): Promise<ApiResponse<BannerResponse>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/banners/${id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      if (!response.ok) return await response.json();
      const data: ApiResponse<BannerResponse> = await response.json();
      if (data.isSuccess && data.result) {
        data.result.imageUrl = this.fixUrl(data.result.imageUrl);
      }
      return data;
    } catch (error) {
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi khi lấy chi tiết banner'], result: undefined as any };
    }
  }

  /**
   * Tạo banner mới
   */
  async createBanner(formData: FormData): Promise<ApiResponse<BannerResponse>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/banners`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // KHÔNG đặt Content-Type khi gửi FormData để trình duyệt tự thêm boundary
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error response:', response.status, errorData);
        return { 
          isSuccess: false, 
          statusCode: response.status.toString(), 
          errorMessages: errorData.errorMessages || ['Lỗi khi tạo banner'], 
          result: undefined as any 
        };
      }

      const data: ApiResponse<BannerResponse> = await response.json();
      if (data.isSuccess && data.result) {
        data.result.imageUrl = this.fixUrl(data.result.imageUrl);
      }
      return data;
    } catch (error) {
      console.error('❌ Request failed:', error);
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi kết nối hoặc kích thước ảnh quá lớn'], result: undefined as any };
    }
  }

  /**
   * Cập nhật banner
   */
  async updateBanner(id: number, formData: FormData): Promise<ApiResponse<BannerResponse>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/banners/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
          // KHÔNG đặt Content-Type ở đây
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          isSuccess: false, 
          statusCode: response.status.toString(), 
          errorMessages: errorData.errorMessages || ['Lỗi khi cập nhật banner'], 
          result: undefined as any 
        };
      }

      const data: ApiResponse<BannerResponse> = await response.json();
      if (data.isSuccess && data.result) {
        data.result.imageUrl = this.fixUrl(data.result.imageUrl);
      }
      return data;
    } catch (error) {
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi kết nối khi cập nhật banner'], result: undefined as any };
    }
  }

  /**
   * Xóa banner
   */
  async deleteBanner(id: number): Promise<ApiResponse<boolean>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/banners/${id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { 
          isSuccess: false, 
          statusCode: response.status.toString(), 
          errorMessages: errData.errorMessages || ['Lỗi khi xóa banner'], 
          result: false 
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Delete failed:', error);
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi kết nối khi xóa banner'], result: false };
    }
  }

  /**
   * Vendor lấy danh sách banner của mình
   */
  async getMyBanners(): Promise<ApiResponse<BannerResponse[]>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/banners/vendor/my-banners`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiResponse<BannerResponse[]> = await response.json();
      if (data.isSuccess && data.result) {
        data.result = data.result.map(b => ({
          ...b,
          imageUrl: this.fixUrl(b.imageUrl)
        }));
      }
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch vendor banners:', error);
      return { isSuccess: false, statusCode: '500', errorMessages: ['Không thể tải danh sách banner của bạn'], result: [] };
    }
  }

  /**
   * Vendor tạo banner mới
   */
  async createVendorBanner(formData: FormData): Promise<ApiResponse<BannerResponse>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/banners/vendor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          isSuccess: false, 
          statusCode: response.status.toString(), 
          errorMessages: errorData.errorMessages || ['Lỗi khi tạo banner'], 
          result: undefined as any 
        };
      }

      const data: ApiResponse<BannerResponse> = await response.json();
      if (data.isSuccess && data.result) {
        data.result.imageUrl = this.fixUrl(data.result.imageUrl);
      }
      return data;
    } catch (error) {
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi kết nối khi tạo banner'], result: undefined as any };
    }
  }

  /**
   * Vendor cập nhật banner
   */
  async updateVendorBanner(id: number, formData: FormData): Promise<ApiResponse<BannerResponse>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/banners/vendor/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          isSuccess: false, 
          statusCode: response.status.toString(), 
          errorMessages: errorData.errorMessages || ['Lỗi khi cập nhật banner'], 
          result: undefined as any 
        };
      }

      const data: ApiResponse<BannerResponse> = await response.json();
      if (data.isSuccess && data.result) {
        data.result.imageUrl = this.fixUrl(data.result.imageUrl);
      }
      return data;
    } catch (error) {
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi kết nối khi cập nhật banner'], result: undefined as any };
    }
  }

  /**
   * Vendor xóa banner của mình
   */
  async deleteVendorBanner(id: number): Promise<ApiResponse<boolean>> {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/banners/vendor/${id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { isSuccess: false, statusCode: response.status.toString(), errorMessages: errData.errorMessages || ['Lỗi khi xóa banner'], result: false };
      }

      return await response.json();
    } catch (error) {
      return { isSuccess: false, statusCode: '500', errorMessages: ['Lỗi kết nối khi xóa banner'], result: false };
    }
  }

  /**
   * Tiện ích URL
   */
  getNavigationUrl(banner: BannerResponse): string {
    const { linkType, linkTargetId, linkUrl } = banner;
    if (linkUrl && linkUrl.startsWith('http')) return linkUrl;
    switch (linkType) {
      case 'Ritual': return `/ritual/${linkTargetId}`;
      case 'Package': return `/package/${linkTargetId}`;
      case 'Vendor': return `/vendor/${linkTargetId}`;
      default: return linkUrl || '/';
    }
  }
}

export const bannerService = new BannerService();
