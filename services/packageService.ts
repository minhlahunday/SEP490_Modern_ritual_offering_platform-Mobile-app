import { ApiPackage, ApiResponse, Product, PackageVariant, CeremonyCategory, PaginatedResult } from '../types';
import { vendorService, VendorProfile } from './vendorService';
import { getAuthToken } from './auth';


import { API_BASE_URL } from './api';

class PackageService {
  /**
   * Lấy danh sách packages theo trạng thái từ endpoint by-status
   * @param status - Draft | Pending | Approved | Rejected | ''
   * @returns Promise<ApiPackage[]>
   */
  async getPackagesByStatus(status?: string): Promise<ApiPackage[]> {
    try {
      const token = getAuthToken();
      const normalizedStatus = String(status || '').trim();

      // Nếu không có status và có token (Staff/Vendor), sử dụng endpoint management chung
      // thay vì getAllPackages (Public) để lấy đúng list scoped theo role và đầy đủ variant.
      if (!normalizedStatus && token) {
        return this.getManagementPackages(1, 100);
      }

      // Fallback cho khách (không token) hoặc nếu phía trên fail
      if (!normalizedStatus) {
        return this.getAllPackages(1, 50);
      }

      const endpoint = `${API_BASE_URL}/packages/management/by-status?pageNumber=1&pageSize=100&status=${normalizedStatus}`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        // Fallback cho endpoint by-status (nếu bị 404/403)
        if (response.status === 404 || response.status === 403) {
          console.warn(`⚠️ Management by-status endpoint failed (${response.status}). Falling back to management collection...`);
          const allPackages = token ? await this.getManagementPackages() : await this.getAllPackages();
          
          if (!normalizedStatus) return allPackages;
          return allPackages.filter(pkg =>
            (pkg as any).status === normalizedStatus ||
            (pkg as any).packageStatus === normalizedStatus ||
            (pkg as any).approvalStatus === normalizedStatus ||
            (normalizedStatus === 'Approved' && pkg.isActive) ||
            (normalizedStatus === 'Inactive' && !pkg.isActive)
          );
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();

      if (Array.isArray(data)) {
        return data as ApiPackage[];
      }

      if (data?.isSuccess && data.result) {
        if (Array.isArray(data.result)) {
          return data.result as ApiPackage[];
        }
        if (data.result.items && Array.isArray(data.result.items)) {
          return data.result.items as ApiPackage[];
        }
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch packages by status:', error);
      // Final fallback
      try {
        const token = getAuthToken();
        const all = token ? await this.getManagementPackages() : await this.getAllPackages();
        const normalizedStatus = String(status || '').trim();
        if (!normalizedStatus) return all;
        return all.filter(pkg =>
          (pkg as any).status === normalizedStatus ||
          (pkg as any).packageStatus === normalizedStatus ||
          (normalizedStatus === 'Approved' && pkg.isActive)
        );
      } catch (innerError) {
        return [];
      }
    }
  }

  /**
   * Lấy danh sách packages từ management endpoint (Vendor/Staff)
   * GET /api/packages/management
   */
  async getManagementPackages(pageNumber: number = 1, pageSize: number = 100): Promise<ApiPackage[]> {
    try {
      const token = getAuthToken();
      if (!token) return this.getAllPackages(pageNumber, pageSize);

      console.log(`📦 Fetching management packages (page ${pageNumber}, size ${pageSize})...`);
      const response = await fetch(`${API_BASE_URL}/packages/management?PageNumber=${pageNumber}&PageSize=${pageSize}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Nếu 404 thì có thể dùng by-status không filter? 
        // Backend thường không hỗ trợ /management chung mà bắt status, nên fallback về public là an toàn nhất.
        if (response.status === 404) {
          console.warn('⚠️ Management collection endpoint not found (404). Falling back to public API...');
          return this.getAllPackages(pageNumber, pageSize);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();
      const isSuccess = data.isSuccess || data.isSucceeded || data.statusCode === 'OK';
      
      if (isSuccess && data.result) {
        const payload = data.result;
        const packages = Array.isArray(payload) ? payload : (payload.items || payload.data || []);
        console.log(`✅ Management packages loaded: ${packages.length}`);
        return packages;
      }
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(' Failed to fetch management packages:', error);
      return this.getAllPackages(pageNumber, pageSize); // Final safety fallback
    }
  }

  /**
   * Lấy danh sách tất cả packages có phân trang
   * @param pageNumber - Số trang (bắt đầu từ 1)
   * @param pageSize - Số lượng item trên mỗi trang
   * @returns Promise<ApiPackage[]>
   */
  async getAllPackages(pageNumber: number = 1, pageSize: number = 50): Promise<ApiPackage[]> {
    try {
      console.log(` Fetching packages from API (page ${pageNumber}, size ${pageSize})...`);
      const response = await fetch(`${API_BASE_URL}/packages?PageNumber=${pageNumber}&PageSize=${pageSize}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
        },
      });

      console.log(' Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();
      console.log(' API Response:', data);

      if (Array.isArray(data)) {
        console.log('✅ Packages received (array):', data.length);
        return data as ApiPackage[];
      }

      const isSuccess = data.isSuccess || data.isSucceeded || data.statusCode === 'OK';
      if (isSuccess && data.result) {
        // Handle both direct array and paginated objects with common field names
        const payload = data.result;
        const packages = Array.isArray(payload)
          ? payload
          : (payload.items || payload.data || payload.list || []);

        console.log('✅ Packages received (result):', packages.length);
        return packages;
      } else {
        console.error('❌ API Error fetching packages:', data.errorMessages || 'Unknown error');
        return [];
      }
    } catch (error) {
      console.error(' Failed to fetch packages:', error);
      return [];
    }
  }

  /**
   * Lấy danh sách packages với đầy đủ thông tin phân trang
   * @param pageNumber - Số trang
   * @param pageSize - Số lượng item trên mỗi trang
   * @returns Promise<PaginatedResult<ApiPackage> | null>
   */
  async getPackages(pageNumber: number = 1, pageSize: number = 12): Promise<PaginatedResult<ApiPackage> | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/packages?pageNumber=${pageNumber}&pageSize=${pageSize}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: any = await response.json();
      if (data.isSuccess && data.result) {
        // Nếu API trả về mảng trực tiếp thay vì bọc trong items
        if (Array.isArray(data.result)) {
          return {
            items: data.result,
            pageNumber: 1,
            pageSize: data.result.length,
            totalCount: data.result.length,
            totalPages: 1,
            hasPreviousPage: false,
            hasNextPage: false
          };
        }
        return data.result as PaginatedResult<ApiPackage>;
      }
      return null;
    } catch (error) {
      console.error(' Failed to fetch paginated packages:', error);
      return null;
    }
  }

  /**
   * Lấy chi tiết package theo ID
   * @param id - Package ID
   * @param useManagement - Sử dụng endpoint management (Staff/Vendor)
   * @returns Promise<ApiPackage | null>
   */
  async getPackageById(id: string | number, useManagement: boolean = false): Promise<ApiPackage | null> {
    try {
      const token = getAuthToken();
      const normalizedId = Number(String(id).trim());
      if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
        throw new Error(`Invalid package id: ${id}`);
      }

      console.log(' Fetching package detail for ID:', normalizedId, useManagement ? '(Management Mode)' : '(Public Mode)');

      // Attempt primary endpoint
      const primaryEndpoint = (useManagement && token)
        ? `${API_BASE_URL}/packages/management/${normalizedId}`
        : `${API_BASE_URL}/packages/${normalizedId}`;

      let response = await fetch(primaryEndpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      console.log(' Primary response status:', response.status);

      // Fallback to public endpoint if management fails (e.g. 403 or 404)
      if (!response.ok && useManagement) {
        console.warn(`⚠️ Management endpoint failed (${response.status}). Falling back to public endpoint...`);
        response = await fetch(`${API_BASE_URL}/packages/${normalizedId}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json, text/plain, */*',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        console.log(' Fallback response status:', response.status);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();
      console.log(' Raw API response data:', data);

      let result: any = null;

      // Case 1: Package is inside result wrapper (Standard ApiResponse)
      if (data.result && typeof data.result === 'object') {
        console.log(' Package loaded successfully from data.result');
        result = data.result;
      }
      // Case 2: Root object is the package (Raw object)
      else if (data.packageId !== undefined || data.id !== undefined || data.packageName !== undefined || data.name !== undefined) {
        console.log(' Package loaded successfully from root object');
        result = data;
      }
      // Case 3: data.isSuccess is true but no result and not a package object
      else if (data.isSuccess === true) {
        console.warn('⚠️ API returned isSuccess: true but no recognizable package data. Returning raw data as fallback.');
        result = data;
      }

      if (result) {
        // Normalize fields (Public API uses different names than Management API)
        if (!result.imageUrls && result.packageImages) {
          result.imageUrls = result.packageImages;
        }
        if (!result.packageVariants && result.variants) {
          result.packageVariants = result.variants;
        }
        if (result.packageId === undefined && result.id !== undefined) {
          result.packageId = result.id;
        }
        return result as ApiPackage;
      }

      console.error('❌ Could not find package data in response:', data.errorMessages || 'Unknown structure');
      return null;
    } catch (error) {
      console.error('❌ Failed to fetch package:', error);
      return null;
    }
  }

  /**
   * Phê duyệt package (Staff/Admin)
   * @param id - Package ID
   */
  async approvePackage(id: string | number): Promise<boolean> {
    try {
      const token = getAuthToken();
      const normalizedId = Number(String(id).trim());
      const response = await fetch(`${API_BASE_URL}/packages/management/${normalizedId}/approve`, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return true;
    } catch (error) {
      console.error('Failed to approve package:', error);
      return false;
    }
  }

  /**
   * Từ chối package (Staff/Admin)
   * @param id - Package ID
   * @param reason - Lý do từ chối
   */
  async rejectPackage(id: string | number, reason: string): Promise<boolean> {
    try {
      const token = getAuthToken();
      const normalizedId = Number(String(id).trim());
      const response = await fetch(`${API_BASE_URL}/packages/management/${normalizedId}/reject`, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return true;
    } catch (error) {
      console.error('Failed to reject package:', error);
      return false;
    }
  }

  /**
   * Lấy packages theo category
   * @param categoryId - Category ID (string hoặc number)
   * @returns Promise<ApiPackage[]>
   */
  async getPackagesByCategory(categoryId: string | number): Promise<ApiPackage[]> {
    try {
      const allPackages = await this.getAllPackages();
      const categoryIdNum = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
      return allPackages.filter(pkg => pkg.categoryId === categoryIdNum);
    } catch (error) {
      console.error('Failed to filter packages by category:', error);
      return [];
    }
  }

  /**
   * Lấy packages của vendor
   * @param vendorId - Vendor Profile ID
   * @returns Promise<ApiPackage[]>
   */
  async getPackagesByVendor(vendorId: string): Promise<ApiPackage[]> {
    try {
      const allPackages = await this.getAllPackages();
      return allPackages.filter(pkg => (pkg.vendorProfileId === vendorId || (pkg as any).vendorId === vendorId));
    } catch (error) {
      console.error('Failed to filter packages by vendor:', error);
      return [];
    }
  }

  /**
   * Lấy packages đang active
   * @returns Promise<ApiPackage[]>
   */
  async getActivePackages(): Promise<ApiPackage[]> {
    try {
      const allPackages = await this.getAllPackages();
      return allPackages.filter(pkg => pkg.isActive);
    } catch (error) {
      console.error('Failed to get active packages:', error);
      return [];
    }
  }

  /**
   * Chuyển đổi ApiPackage sang Product type (để tương thích với UI hiện tại)
   * @param apiPackage - API Package object
   * @param vendorMap - Optional map of vendorProfileId to VendorProfile
   * @returns Product
   */
  mapToProduct(apiPackage: ApiPackage, vendorMap?: Map<string, VendorProfile>): Product {
    // Find default variant or use first variant for pricing
    const variantsSource = apiPackage.packageVariants || (apiPackage as any).variants || [];
    const defaultVariant = variantsSource[0];

    // Helper to fix dead storage.vietritual.com URLs
    const fixUrl = (url: string | undefined): string => {
      if (!url) return '';
      if (url.includes('storage.vietritual.com')) {
        // storage.vietritual.com is dead. Use a high-quality product placeholder.
        return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000';
      }
      return url;
    };

    // Parse variants và chuyển description thành items array
    const packageId = apiPackage.packageId ?? (apiPackage as any).id;
    const parsedVariants = variantsSource.map((variant: any) => {
      console.log('🔍 Processing variant:', variant.variantName, 'Description:', variant.description);

      const rawVariantId = (variant as any).variantId ?? (variant as any).id ?? (variant as any).packageVariantId;
      const resolvedVariantId = (variant as any).id && packageId != null && Number((variant as any).variantId) === Number(packageId)
        ? (variant as any).id
        : rawVariantId;

      // Extract items from description
      let items: string[] = [];

      if (variant.description) {
        // Thử nhiều patterns khác nhau
        const patterns = [
          /(?:Bao gồm|bao gồm)\s+(.+?)(?:\.|$)/is,          // "Bao gồm ..."
          /(?:gồm|Gồm):\s*(.+?)(?:\.|$)/is,                 // "gồm: ..."
          /(?:Đầy đủ lễ vật cơ bản|lễ vật):\s*(.+?)(?:\.|$)/is,  // "Đầy đủ lễ vật cơ bản: ..."
          /(?:với|Với)\s+(.+?)(?:\.|$)/is,                  // "với ..." (NEW)
          /:\s*(.+?)(?:\.|$)/is                              // Fallback: lấy mọi thứ sau dấu hai chấm
        ];

        let itemsText = '';
        for (const pattern of patterns) {
          const match = variant.description.match(pattern);
          if (match && match[1]) {
            itemsText = match[1];
            console.log('🔍 Pattern matched! Items text:', itemsText);
            break;
          }
        }

        if (itemsText) {
          // Split theo dấu phẩy và trim
          items = itemsText
            .split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0 && item !== 'và');
          console.log('✅ Parsed items:', items);
        } else {
          console.warn('⚠️ No items found in description');
        }
      }

      return {
        variantId: resolvedVariantId,
        packageId: variant.packageId,
        tier: variant.variantName,
        price: variant.price,
        description: variant.description,
        items: items.length > 0 ? items : []
      };
    });

    console.log('📦 Final parsed variants:', parsedVariants || []);

    // Get vendor info from map if available
    const vendorId = apiPackage.vendorProfileId || (apiPackage as any).vendorId;
    const vendor = vendorId ? vendorMap?.get(vendorId) : undefined;

    // Fallbacks for missing fields
    const pkgId = apiPackage.packageId?.toString() || (apiPackage as any).id?.toString() || defaultVariant?.packageId?.toString() || '';
    const pkgName = apiPackage.packageName || (apiPackage as any).name || defaultVariant?.variantName || 'Mâm cúng truyền thống';

    // Support multiple image field names from API (Management vs Public)
    const rawImageUrls = (apiPackage as any).imageUrls || (apiPackage as any).packageImages || [];
    const primaryImgIdx = (apiPackage as any).primaryImageIndex || 0;
    const fallbackImg = apiPackage.packageAvatarUrl || (apiPackage as any).imageUrl || this.generatePlaceholderImage(pkgId);

    const finalImage = fixUrl((Array.isArray(rawImageUrls) && rawImageUrls.length > 0)
      ? (rawImageUrls[primaryImgIdx] || rawImageUrls[0])
      : fallbackImg);

    const finalGallery = (Array.isArray(rawImageUrls) && rawImageUrls.length > 0)
      ? rawImageUrls.map((url: string) => fixUrl(url))
      : (apiPackage.packageAvatarUrl ? [fixUrl(apiPackage.packageAvatarUrl)] : this.generateGalleryImages(pkgId));

    return {
      id: pkgId,
      name: pkgName,
      description: apiPackage.description || 'Mâm cúng truyền thống với đầy đủ lễ vật',
      category: (apiPackage as any).categoryName || (apiPackage as any).ceremonyCategory?.name || this.mapCategoryIdToOccasion(apiPackage.categoryId?.toString() || '1'),
      price: defaultVariant?.price || 2500000,
      image: finalImage,
      gallery: finalGallery,
      rating: apiPackage.ratingAvg || 0,
      reviews: apiPackage.reviewCount || 0,
      totalSold: Number((apiPackage as any).totalSold || 0),
      orders: 0,
      status: apiPackage.isActive ? 'active' : 'inactive',
      tag: undefined,
      variants: parsedVariants || [],
      vendorId: vendorId,
      vendorName: vendor?.shopName || (vendorId ? `Shop ${vendorId.substring(0, 8)}` : 'Shop'),
    };
  }

  /**
   * Chuyển đổi nhiều ApiPackages sang Products
   * @param apiPackages - Array of API Packages
   * @returns Product[]
   */
  mapToProducts(apiPackages: ApiPackage[]): Product[] {
    return apiPackages.map(pkg => this.mapToProduct(pkg));
  }

  /**
   * Chuyển đổi nhiều ApiPackages sang Products với thông tin vendor
   * @param apiPackages - Array of API Packages
   * @returns Promise<Product[]>
   */
  async mapToProductsWithVendors(apiPackages: ApiPackage[]): Promise<Product[]> {
    try {
      // Lấy danh sách unique vendor IDs
      const vendorIds = [...new Set(apiPackages.map(pkg => pkg.vendorProfileId || (pkg as any).vendorId).filter(id => id))];
      console.log('🏪 Fetching vendors for IDs:', vendorIds);

      // Fetch tất cả vendors với error handling cho từng vendor
      const vendorPromises = vendorIds.map(async (id) => {
        try {
          return await vendorService.getVendorCached(id);
        } catch (err) {
          console.warn(`⚠️ Failed to fetch vendor ${id}:`, err);
          return null;
        }
      });
      const vendors = await Promise.all(vendorPromises);

      // Tạo vendor map
      const vendorMap = new Map<string, VendorProfile>();
      vendors.forEach((vendor, index) => {
        if (vendor) {
          vendorMap.set(vendorIds[index], vendor);
          console.log(`✅ Loaded vendor: ${vendor.shopName}`);
        }
      });

      console.log(`✅ Vendor map created with ${vendorMap.size}/${vendorIds.length} vendors`);

      // Map packages to products với vendor info
      return apiPackages.map(pkg => this.mapToProduct(pkg, vendorMap));
    } catch (error) {
      console.error('❌ Error mapping products with vendors:', error);
      // Fallback: map without vendor info (will show vendorProfileId)
      return apiPackages.map(pkg => this.mapToProduct(pkg));
    }
  }

  /**
   * Map categoryId sang Occasion type
   * TODO: Update này khi có mapping chính xác từ backend
   */
  private mapCategoryIdToOccasion(categoryId: string): any {
    const categoryMap: Record<string, string> = {
      '1': 'Cúng Rằm',
      '2': 'Tân Gia',
      '3': 'Khai Trương',
      '4': 'Cúng Giỗ',
      '5': 'Cúng Tết',
    };
    return categoryMap[categoryId] || 'Khác';
  }

  /**
   * Generate placeholder image URL
   * TODO: Replace với actual image URLs từ API
   */
  private generatePlaceholderImage(packageId: string): string {
    return `https://picsum.photos/600/600?random=${packageId}`;
  }

  /**
   * Generate gallery images
   * TODO: Replace với actual gallery từ API
   */
  private generateGalleryImages(packageId: string): string[] {
    return [
      `https://picsum.photos/400/400?random=${packageId}1`,
      `https://picsum.photos/400/400?random=${packageId}2`,
      `https://picsum.photos/400/400?random=${packageId}3`,
      `https://picsum.photos/400/400?random=${packageId}4`,
    ];
  }

  /**
   * Cập nhật package (Vendor) - PUT /api/packages/{id}
   */
  async updatePackage(
    id: string | number,
    payload: {
      packageName: string;
      description: string;
      categoryId: number;
      packageImageUrls: string[];
      primaryImageIndex: number;
      action: string;
      variants: { variantName: string; description: string; price: number }[];
    }
  ): Promise<any> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/packages/management/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errText = await response.text();
      try {
        const errObj = JSON.parse(errText);
        // Handle common backend error formats
        if (errObj.errorMessages && Array.isArray(errObj.errorMessages) && errObj.errorMessages.length > 0) {
          throw new Error(errObj.errorMessages[0]);
        }
        if (errObj.errors && typeof errObj.errors === 'object') {
          const firstError = Object.values(errObj.errors)[0];
          if (Array.isArray(firstError) && firstError.length > 0) throw new Error(firstError[0] as string);
        }
        if (errObj.message) throw new Error(errObj.message);
        // Handle the specific format in screenshot: {"statusCode":"BadRequest", "errors": ["..."]}
        if (Array.isArray(errObj.errors) && errObj.errors.length > 0) throw new Error(errObj.errors[0]);
      } catch (e) {
        if (e instanceof Error && e.name === 'Error' && e.message !== 'Unexpected token') throw e;
      }
      throw new Error(errText || `HTTP error! status: ${response.status}`);
    }
    const data: any = await response.json().catch(() => ({}));
    return data;
  }

  /**
   * Tạo package mới (Draft hoặc Submit) - POST /api/packages
   */
  async createPackage(payload: {
    packageName: string;
    description: string;
    categoryId: number;
    packageImageUrls: string[];
    primaryImageIndex: number;
    action: string;
    variants: { variantName: string; description: string; price: number }[];
  }): Promise<any> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errText = await response.text();
      try {
        const errObj = JSON.parse(errText);
        // Handle common backend error formats
        if (errObj.errorMessages && Array.isArray(errObj.errorMessages) && errObj.errorMessages.length > 0) {
          throw new Error(errObj.errorMessages[0]);
        }
        if (errObj.errors && typeof errObj.errors === 'object') {
          const firstError = Object.values(errObj.errors)[0];
          if (Array.isArray(firstError) && firstError.length > 0) throw new Error(firstError[0] as string);
        }
        if (errObj.message) throw new Error(errObj.message);
        // Handle the specific format in screenshot: {"statusCode":"BadRequest", "errors": ["..."]}
        if (Array.isArray(errObj.errors) && errObj.errors.length > 0) throw new Error(errObj.errors[0]);
      } catch (e) {
        if (e instanceof Error && e.name === 'Error' && e.message !== 'Unexpected token') throw e;
      }
      throw new Error(errText || `HTTP error! status: ${response.status}`);
    }
    const data: any = await response.json().catch(() => ({}));
    return data;
  }

  /**
   * Upload nhiều ảnh package, trả về danh sách URL ảnh - POST /api/packages/upload-images
   */
  async uploadPackageImages(files: File[]): Promise<string[]> {
    const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB 
    const isAnyFileLarge = files.some(f => f.size > MAX_FILE_SIZE);
    if (isAnyFileLarge) {
      throw new Error('Dung lượng ảnh tải lên vượt quá giới hạn 1MB. Vui lòng nén hoặc chọn ảnh nhẹ hơn.');
    }

    const token = getAuthToken();
    const formData = new FormData();
    files.forEach((file) => formData.append('Images', file));

    return new Promise<string[]>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/packages/upload-images`, true);
      xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data?.result?.imageUrls && Array.isArray(data.result.imageUrls)) { resolve(data.result.imageUrls); return; }
            if (Array.isArray(data?.result)) { resolve(data.result); return; }
            if (Array.isArray(data?.urls)) { resolve(data.urls); return; }
            if (Array.isArray(data)) { resolve(data); return; }
            resolve([]);
          } catch {
            resolve([]);
          }
        } else {
          try {
            const errObj = JSON.parse(xhr.responseText);
            reject(new Error(errObj.message || errObj.title || `HTTP error! status: ${xhr.status}`));
          } catch {
            reject(new Error(xhr.responseText || `HTTP error! status: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        console.error('XHR Upload Error');
        reject(new Error('Lỗi mạng khi upload ảnh (Vite Proxy ProxyRes Error). Hãy chắc chắn server Backend đang chạy và ổn định.'));
      };

      xhr.send(formData);
    });
  }

  /**
   * Lấy danh sách danh mục đang hoạt động
   * @returns Promise<CeremonyCategory[]>
   */
  async getCeremonyCategories(): Promise<CeremonyCategory[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/ceremony-categories`, {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();

      // Handle ApiResponse format
      if (data?.isSuccess && Array.isArray(data.result)) {
        return data.result as CeremonyCategory[];
      }

      // Handle raw array format
      if (Array.isArray(data)) {
        return data as CeremonyCategory[];
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch ceremony categories:', error);
      return [];
    }
  }
}

// Export singleton instance
export const packageService = new PackageService();

// Export class for testing purposes
export { PackageService };
