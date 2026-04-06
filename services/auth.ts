import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'current_user';

// In-memory cache for synchronous access
let _token: string | null = null;
let _refreshToken: string | null = null;
let _currentUser: LoginResponse | null = null;

// Helper to save to SecureStore
async function saveAuthData(data: LoginResponse) {
  _token = data.token;
  _refreshToken = data.refreshToken;
  _currentUser = data;

  try {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, data.token),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(data)),
    ]);
  } catch (error) {
    console.error('❌ SecureStore save error:', error);
  }
}

// Helper to clear SecureStore
async function clearAuthData() {
  _token = null;
  _refreshToken = null;
  _currentUser = null;

  try {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, ''),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, ''),
      SecureStore.setItemAsync(USER_KEY, ''),
    ]);
    // More robust removal
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (error) {
    console.error('❌ SecureStore clear error:', error);
  }
}

/**
 * Initialize Auth State from SecureStore
 * Should be called at app startup
 */
export async function initAuth(): Promise<void> {
  try {
    const [token, refreshToken, userJson] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);

    if (token && refreshToken && userJson) {
      _token = token;
      _refreshToken = refreshToken;
      _currentUser = JSON.parse(userJson);
      console.log('✅ Auth session restored for:', _currentUser?.email);
    } else {
      console.log('ℹ️ No existing auth session found');
    }
  } catch (error) {
    console.error('❌ initAuth error:', error);
  }
}

const window = { location: { href: '', hostname: '' } };

const API_BASE_URL = 'https://vietritual.click';

// API Response Types
export interface ApiResponse<T> {
  statusCode: string;
  isSuccess: boolean;
  errorMessages: string[];
  result: T;
}

// ==================== LOGIN ====================

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

// API Response from backend
interface LoginApiResponse {
  token: string;
  refreshToken: string;
}

function normalizeRoleClaim(roleClaim: unknown): string {
  if (typeof roleClaim === 'string') {
    return roleClaim.toLowerCase();
  }

  if (Array.isArray(roleClaim)) {
    const firstStringRole = roleClaim.find((item): item is string => typeof item === 'string');
    return (firstStringRole || 'customer').toLowerCase();
  }

  if (roleClaim && typeof roleClaim === 'object' && 'value' in roleClaim) {
    const value = (roleClaim as { value?: unknown }).value;
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
  }

  return 'customer';
}

function extractNormalizedRoles(roleClaim: unknown): string[] {
  if (typeof roleClaim === 'string') {
    return [roleClaim.toLowerCase()];
  }

  if (Array.isArray(roleClaim)) {
    return roleClaim
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.toLowerCase());
  }

  if (roleClaim && typeof roleClaim === 'object' && 'value' in roleClaim) {
    const value = (roleClaim as { value?: unknown }).value;
    if (typeof value === 'string') {
      return [value.toLowerCase()];
    }
  }

  return [];
}

// Response we return to the app (with decoded JWT data)
export interface LoginResponse {
  token: string;
  refreshToken: string;
  userId: string;
  email: string;
  role: string;
  roles: string[];
  name?: string;
}

// Helper function to decode JWT token
function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('❌ Error decoding JWT:', error);
    return {};
  }
}

/**
 * Login API
 * POST /api/auth/login
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  try {
    console.log(' Calling login API...');
    console.log(' Request payload:', credentials);

    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    console.log(' Response status:', response.status);

    // Đọc response text trước để debug
    const responseText = await response.text();
    console.log(' Response text:', responseText);

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errorMessages && errorData.errorMessages.length > 0) {
          errorMessage = errorData.errorMessages.join(', ');
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Nếu không parse được JSON, dùng text gốc
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: ApiResponse<LoginApiResponse> = JSON.parse(responseText);
    console.log(' Login API Response:', data);

    if (data.isSuccess && data.result) {
      // Decode JWT to get user info
      const decodedToken = decodeJWT(data.result.token);
      console.log(' Decoded JWT:', decodedToken);

      // Get role from JWT and normalize to lowercase
      const rawRole =
        decodedToken.role ??
        decodedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
        decodedToken.roles;

      const role = normalizeRoleClaim(rawRole);
      const roles = extractNormalizedRoles(rawRole);
      const normalizedRoles = roles.length > 0 ? Array.from(new Set(roles)) : [role];

      const loginResponse: LoginResponse = {
        token: data.result.token,
        refreshToken: data.result.refreshToken,
        userId: decodedToken.sub || decodedToken.userId || '',
        email: decodedToken.email || credentials.usernameOrEmail,
        role: role,
        roles: normalizedRoles,
        name: decodedToken.name || decodedToken.given_name || decodedToken.email || credentials.usernameOrEmail,
      };

      console.log(' Login Response (normalized):', loginResponse);
      
      // PERSIST DATA
      await saveAuthData(loginResponse);
      
      return loginResponse;
    } else {
      console.error(' Login failed:', data.errorMessages);
      throw new Error(data.errorMessages.join(', ') || 'Đăng nhập thất bại');
    }
  } catch (error) {
    console.error(' Login error:', error);
    throw error;
  }
}

// ==================== REGISTER ====================

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

// Backend trả về string message, không phải object
export interface RegisterResponse {
  userId?: string;
  email?: string;
  username?: string;
  message?: string;
}

/**
 * Register API
 * POST /api/auth/register
 */
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  try {
    console.log('📝 Calling register API...');
    console.log('🌐 API_BASE_URL:', API_BASE_URL);
    console.log('📤 Request data:', data);

    const endpointCandidates = [
      `${API_BASE_URL}/api/auth/register`,
      `${API_BASE_URL}/auth/register`,
    ];

    let lastError = 'Đăng ký thất bại';

    for (const endpoint of endpointCandidates) {
      console.log('🔗 Register URL:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('📡 Response status:', response.status);

      const responseText = await response.text();
      console.log('📥 Response text:', responseText);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          if (Array.isArray(errorData?.errorMessages) && errorData.errorMessages.length > 0) {
            errorMessage = errorData.errorMessages.join(', ');
          } else if (typeof errorData?.message === 'string' && errorData.message.trim()) {
            errorMessage = errorData.message.trim();
          }
        } catch {
          errorMessage = responseText || errorMessage;
        }

        lastError = errorMessage;
        if (response.status === 404 || response.status === 405) {
          continue;
        }
        throw new Error(errorMessage);
      }

      const responseData: ApiResponse<RegisterResponse | string> = JSON.parse(responseText);
      console.log('✅ Register API Response:', responseData);

      if (!responseData.isSuccess) {
        const serverError = responseData.errorMessages?.join(', ') || 'Đăng ký thất bại';
        throw new Error(serverError);
      }

      if (typeof responseData.result === 'string') {
        return {
          message: responseData.result,
          userId: '',
          email: data.email,
          username: data.username,
        };
      }

      if (responseData.result) {
        return responseData.result;
      }

      return {
        message: 'Đăng ký thành công',
        email: data.email,
        username: data.username,
      };
    }

    throw new Error(lastError);
  } catch (error) {
    console.error('❌ Register error:', error);
    throw error;
  }
}

// ==================== CONFIRM EMAIL ====================

export interface ConfirmEmailRequest {
  email: string;
  token: string;
}

export interface ConfirmEmailResponse {
  success: boolean;
  message: string;
}

/**
 * Confirm Email API
 * POST /api/auth/confirm-email
 */
export async function confirmEmail(data: ConfirmEmailRequest): Promise<ConfirmEmailResponse> {
  try {
    console.log('✉️ Calling confirm-email API...');
    console.log('📤 Request data:', { email: data.email, token: data.token.substring(0, 20) + '...' });

    const response = await fetch(`${API_BASE_URL}/api/auth/confirm-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
      },
      body: JSON.stringify(data),
    });

    console.log('📡 Response status:', response.status);

    // Read response text first for debugging
    const responseText = await response.text();
    console.log('📥 Response text:', responseText);

    // Special case: 409 = Email already confirmed (treat as success)
    if (response.status === 409) {
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errorMessages && errorData.errorMessages.length > 0) {
          const message = errorData.errorMessages[0];
          if (message.includes('đã được xác nhận') || message.includes('already confirmed')) {
            console.log('✅ Email already verified, treating as success');
            return {
              success: true,
              message: 'Email đã được xác nhận trước đó. Bạn có thể đăng nhập ngay.'
            };
          }
        }
      } catch (e) {
        // Continue to error handling below
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errorMessages && errorData.errorMessages.length > 0) {
          const message = errorData.errorMessages[0];

          // Special case: Concurrency failure = email was just verified (treat as success)
          if (message.includes('Optimistic concurrency failure') ||
            message.includes('object has been modified')) {
            console.log('✅ Concurrency error detected - email was already verified, treating as success');
            return {
              success: true,
              message: 'Email đã được xác nhận thành công! Bạn có thể đăng nhập ngay.'
            };
          }

          errorMessage = errorData.errorMessages.join(', ');
        }
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const responseData: ApiResponse<ConfirmEmailResponse | string> = JSON.parse(responseText);
    console.log('✅ Confirm Email API Response:', responseData);

    if (responseData.isSuccess) {
      // Backend might return string message or object
      if (typeof responseData.result === 'string') {
        return {
          success: true,
          message: responseData.result
        };
      } else if (responseData.result) {
        return responseData.result;
      } else {
        return {
          success: true,
          message: 'Email đã được xác nhận thành công'
        };
      }
    } else {
      console.error('❌ Confirm email failed:', responseData.errorMessages);
      throw new Error(responseData.errorMessages?.join(', ') || 'Xác nhận email thất bại');
    }
  } catch (error) {
    console.error('❌ Confirm email error:', error);
    throw error;
  }
}

// ==================== LOGOUT ====================

/**
 * Logout API call - Send logout request to server
 */
export async function logoutApi(): Promise<void> {
  try {
    console.log('🔄 Calling Logout API...');

    const token = getAuthToken();
    if (!token) {
      console.warn('⚠️ No token found, skipping API logout');
      return;
    }

    // Get refresh token from cache
    const refreshToken = _refreshToken;
    if (!refreshToken) {
      console.warn('⚠️ No refresh token found, proceeding with logout');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        refreshToken: refreshToken || ''
      })
    });

    console.log('📡 Logout API status:', response.status);

    if (!response.ok) {
      console.warn('⚠️ Logout API failed, but proceeding with local logout');
    } else {
      console.log('✅ Logout API successful');
    }
  } catch (error) {
    console.error('❌ Logout API Error:', error);
    console.warn('⚠️ API logout failed, but proceeding with local logout');
  }
}

/**
 * Logout - Clear persistent storage and cache
 */
export async function logout(): Promise<void> {
  try {
    // 1. Optional API logout call (don't let it block local clear)
    await logoutApi().catch(err => console.warn('⚠️ API logout failed:', err));
    
    // 2. Clear local storage and cache
    await clearAuthData();
    
    console.log('✅ Logged out successfully');
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Force clear memory cache even if storage fails
    _token = null;
    _refreshToken = null;
    _currentUser = null;
  }
}

/**
 * Get current user from memory cache
 */
export function getCurrentUser(): LoginResponse | null {
  return _currentUser;
}

/**
 * Get current token from memory cache
 */
export function getAuthToken(): string | null {
  return _token;
}

/**
 * Get refresh token from memory cache
 */
export function getRefreshToken(): string | null {
  return _refreshToken;
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
  return !!_token;
}


// ==================== GET CURRENT USER ====================

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
}

// ==================== PROFILE ====================

export interface UserProfile {
  profileId: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  avatarUrl: string | null;
  gender: string;
  dateOfBirth: string;
  addressText: string;
  latitude: number;
  longitude: number;
  isVendor: boolean;
  shopName: string | null;
  businessLicenseNo: string | null;
  verificationStatus: string | null;
  ratingAvg: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorCurrentProfile {
  isVendor: boolean;
  shopName: string | null;
  shopDescription: string | null;
  avatarUrl?: string | null;
  shopAvatarUrl?: string | null;
  shopAddressText?: string | null;
  shopLatitude?: number | null;
  shopLongitude?: number | null;
  businessType: string | null;
  taxCode: string | null;
  verificationStatus: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  vendorStatus: string | null;
  dailyCapacity: number | null;
  ratingAvg: number;
  tierId: number | null;
  tierName: string | null;
  tierAssignedAt: string | null;
  rejectionCount: number;
  vendorSuspendedUntil: string | null;
  updatedAt: string | null;
}

export interface UpdateVendorProfileRequest {
  shopName?: string;
  shopDescription?: string;
  shopAddressText?: string;
  shopLatitude?: number;
  shopLongitude?: number;
  dailyCapacity?: number;
  taxCode?: string;
  businessType?: 'Individual' | 'Company' | string;
  shopAvatarFile?: any;
}

export interface VendorDocument {
  documentId: string;
  documentType: string;
  documentTypeName: string;
  fileUrl: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  uploadedAt: string;
}

export interface VendorRegistrationResponse {
  shopName: string;
  shopDescription: string;
  shopAvatarUrl: string;
  businessType: string;
  taxCode: string;
  shopAddressText: string;
  shopLatitude: number;
  shopLongitude: number;
  dailyCapacity: number;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected' | 'None' | string;
  vendorStatus: number;
  documents: VendorDocument[];
}

export interface VendorDocumentRequest {
  documentType: number;
  file: any;
}

export interface RegisterVendorRequest {
  shopName: string;
  shopDescription: string;
  shopAvatarUrl: any;
  businessType: string;
  taxCode: string;
  shopAddressText: string;
  shopLatitude: number;
  shopLongitude: number;
  dailyCapacity: number;
  documents: VendorDocumentRequest[];
}

/**
 * Fetch user profile from backend
 * GET /api/profile
 */
export async function getProfile(): Promise<UserProfile> {
  console.log('📱 Fetching user profile...');

  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'accept': '*/*'
      }
    });

    console.log('📱 Profile response status:', response.status);

    // If 404, profile doesn't exist yet - return empty profile
    if (response.status === 404) {
      console.log('⚠️ Profile not found (404) - returning empty profile for first-time setup');
      const currentUser = getCurrentUser();
      return {
        profileId: '',
        userId: currentUser?.userId || '',
        fullName: '',
        phoneNumber: '',
        avatarUrl: null,
        gender: '',
        dateOfBirth: '',
        addressText: '',
        latitude: 0,
        longitude: 0,
        isVendor: false,
        shopName: null,
        businessLicenseNo: null,
        verificationStatus: null,
        ratingAvg: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }

    const data: ApiResponse<UserProfile> = await response.json();
    console.log('📱 Profile API response:', data);

    if (!data.isSuccess) {
      throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch profile');
    }

    console.log('✅ Profile fetched successfully:', data.result);
    return data.result;
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    throw error;
  }
}

/**
 * Fetch current vendor profile from backend
 * GET /api/profile/vendor
 */
export async function getVendorProfile(): Promise<VendorCurrentProfile> {
  console.log('🏪 Fetching vendor profile...');

  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/vendor`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'accept': '*/*'
      }
    });

    console.log('🏪 Vendor profile response status:', response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch vendor profile: ${response.status}`);
    }

    const data: ApiResponse<VendorCurrentProfile> = await response.json();
    console.log('🏪 Vendor profile API response:', data);

    if (!data.isSuccess || !data.result) {
      throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch vendor profile');
    }

    return data.result;
  } catch (error) {
    console.error('❌ Error fetching vendor profile:', error);
    throw error;
  }
}

/**
 * Update current vendor profile (partial update)
 * PUT /api/profile/vendor
 */
export async function updateVendorProfile(profileData: UpdateVendorProfileRequest): Promise<VendorCurrentProfile | null> {
  console.log('🏪 Updating vendor profile via FormData...');

  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  try {
    const formData = new FormData();
    if (profileData.shopName !== undefined) formData.append('ShopName', profileData.shopName);
    if (profileData.shopDescription !== undefined) formData.append('ShopDescription', profileData.shopDescription);
    if (profileData.shopAddressText !== undefined) formData.append('ShopAddressText', profileData.shopAddressText);
    if (profileData.shopLatitude !== undefined) formData.append('ShopLatitude', profileData.shopLatitude.toString());
    if (profileData.shopLongitude !== undefined) formData.append('ShopLongitude', profileData.shopLongitude.toString());
    if (profileData.dailyCapacity !== undefined) formData.append('DailyCapacity', profileData.dailyCapacity.toString());
    if (profileData.taxCode !== undefined) formData.append('TaxCode', profileData.taxCode);
    if (profileData.businessType !== undefined) formData.append('BusinessType', profileData.businessType);
    if (profileData.shopAvatarFile) {
      formData.append('ShopAvatarUrl', profileData.shopAvatarFile);
    }

    const response = await fetch(`${API_BASE_URL}/api/profile/vendor`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': '*/*'
      },
      body: formData,
    });

    console.log('🏪 Update vendor profile response status:', response.status);

    const responseText = await response.text();

    if (!response.ok) {
      let parsedMessage = '';
      try {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed?.errorMessages) && parsed.errorMessages.length > 0) {
          parsedMessage = parsed.errorMessages.join(', ');
        } else if (typeof parsed?.message === 'string' && parsed.message.trim()) {
          parsedMessage = parsed.message.trim();
        }
      } catch {
        // Keep raw text fallback
      }

      const fallbackText = responseText?.trim();
      throw new Error(parsedMessage || fallbackText || `Failed to update vendor profile: ${response.status}`);
    }

    if (!responseText.trim()) {
      return null;
    }

    const data: ApiResponse<VendorCurrentProfile> = JSON.parse(responseText);
    if (!data.isSuccess) {
      throw new Error(data.errorMessages?.join(', ') || 'Failed to update vendor profile');
    }

    return data.result || null;
  } catch (error) {
    console.error('❌ Error updating vendor profile:', error);
    throw error;
  }
}

/**
 * Register as a vendor
 * POST /api/profile/vendor/register
 */
export async function registerVendor(registerData: RegisterVendorRequest): Promise<any> {
  console.log('🏪 Registering as vendor...');

  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }
  try {
    const formData = new FormData();
    formData.append('ShopName', registerData.shopName);
    formData.append('ShopDescription', registerData.shopDescription);
    formData.append('ShopAvatarUrl', registerData.shopAvatarUrl);
    formData.append('BusinessType', registerData.businessType);
    formData.append('TaxCode', registerData.taxCode);
    formData.append('ShopAddressText', registerData.shopAddressText);
    formData.append('ShopLatitude', registerData.shopLatitude.toString());
    formData.append('ShopLongitude', registerData.shopLongitude.toString());
    formData.append('DailyCapacity', registerData.dailyCapacity.toString());

    registerData.documents.forEach((doc, index) => {
      // Using indexed syntax with LOWERCASE properties as shown in Swagger JSON
      formData.append(`Documents[${index}].documentType`, doc.documentType.toString());
      formData.append(`Documents[${index}].file`, doc.file);
    });

    // Log FormData keys and total size for debugging
    console.log('📤 Register Vendor FormData Keys:');
    let totalSize = 0;
    for (const [key, value] of (formData as any).entries()) {
      if (value instanceof File) {
        console.log(`  [FILE] ${key}: ${value.name} (${(value.size / 1024 / 1024).toFixed(2)} MB)`);
        totalSize += value.size;
      } else {
        console.log(`  [FIELD] ${key}: ${value}`);
      }
    }
    console.log(`📦 Total Payload Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    const response = await fetch(`${API_BASE_URL}/api/profile/vendor/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': '*/*',
      },
      body: formData,
    });

    console.log('🏪 Register vendor response status:', response.status);
    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `Failed to register vendor: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.errorMessages?.join(', ') || errorData.message || errorMessage;
      } catch (e) {
        if (responseText) errorMessage = responseText;
      }
      throw new Error(errorMessage);
    }

    if (!responseText.trim()) return null;
    const data: ApiResponse<any> = JSON.parse(responseText);

    if (!data.isSuccess) {
      throw new Error(data.errorMessages?.join(', ') || 'Đăng ký thất bại');
    }

    return data.result || null;
  } catch (error) {
    console.error('❌ Error registering vendor:', error);
    throw error;
  }
}

/**
 * Get current vendor registration details
 * GET /api/profile/vendor/registration
 */
export async function getVendorRegistration(): Promise<VendorRegistrationResponse | null> {
  console.log('🏪 Fetching vendor registration details...');

  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/vendor/registration`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'accept': '*/*'
      }
    });

    console.log('🏪 Registration detail response status:', response.status);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch registration details: ${response.status}`);
    }

    const data: ApiResponse<VendorRegistrationResponse> = await response.json();
    console.log('🏪 Registration API response:', data);

    if (!data.isSuccess) {
      // If result is null but isSuccess is true, it means no registration yet
      if (!data.result) return null;
      throw new Error(data.errorMessages?.join(', ') || 'Failed to fetch registration details');
    }

    return data.result;
  } catch (error) {
    console.error('❌ Error fetching registration details:', error);
    return null;
  }
}

/**
 * Resubmit vendor registration (after rejection)
 * PUT /api/profile/vendor/resubmit
 */
export async function resubmitVendorRegistration(registerData: Partial<RegisterVendorRequest>): Promise<any> {
  console.log('🏪 Resubmitting vendor registration...');

  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  try {
    const formData = new FormData();
    if (registerData.shopName) formData.append('ShopName', registerData.shopName);
    if (registerData.shopDescription) formData.append('ShopDescription', registerData.shopDescription);
    if (registerData.shopAvatarUrl) formData.append('ShopAvatarUrl', registerData.shopAvatarUrl);
    if (registerData.businessType) formData.append('BusinessType', registerData.businessType);
    if (registerData.taxCode) formData.append('TaxCode', registerData.taxCode);
    if (registerData.shopAddressText) formData.append('ShopAddressText', registerData.shopAddressText);
    if (registerData.shopLatitude !== undefined) formData.append('ShopLatitude', registerData.shopLatitude.toString());
    if (registerData.shopLongitude !== undefined) formData.append('ShopLongitude', registerData.shopLongitude.toString());
    if (registerData.dailyCapacity !== undefined) formData.append('DailyCapacity', registerData.dailyCapacity.toString());

    if (registerData.documents && registerData.documents.length > 0) {
      registerData.documents.forEach((doc, index) => {
        formData.append(`UpdatedDocuments[${index}].documentType`, doc.documentType.toString());
        formData.append(`UpdatedDocuments[${index}].file`, doc.file);
      });
    }

    const response = await fetch(`${API_BASE_URL}/api/profile/vendor/resubmit`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': '*/*',
      },
      body: formData,
    });

    console.log('🏪 Resubmit vendor response status:', response.status);
    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `Failed to resubmit registration: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.errorMessages?.join(', ') || errorData.message || errorMessage;
      } catch (e) {
        if (responseText) errorMessage = responseText;
      }
      throw new Error(errorMessage);
    }

    if (!responseText.trim()) return null;
    const data: ApiResponse<any> = JSON.parse(responseText);

    if (!data.isSuccess) {
      throw new Error(data.errorMessages?.join(', ') || 'Gửi lại đơn thất bại');
    }

    return data.result || null;
  } catch (error) {
    console.error('❌ Error resubmitting vendor registration:', error);
    throw error;
  }
}

/**
 * Update user profile
 * PUT /api/profile
 */
export interface UpdateProfileRequest {
  fullName: string;
  gender: string;
  phoneNumber: string;
  dateOfBirth: string;
  addressText: string;
  latitude: number;
  longitude: number;
  avatarFile?: any;
}

export async function updateProfile(profileData: UpdateProfileRequest): Promise<UserProfile> {
  console.log('✏️ Updating user profile...');

  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  try {
    // Create FormData for multipart/form-data
    const formData = new FormData();
    formData.append('FullName', profileData.fullName);
    formData.append('Gender', profileData.gender);
    formData.append('PhoneNumber', profileData.phoneNumber);
    formData.append('DateOfBirth', profileData.dateOfBirth);
    formData.append('AddressText', profileData.addressText);
    formData.append('Latitude', profileData.latitude.toString());
    formData.append('Longitude', profileData.longitude.toString());

    if (profileData.avatarFile) {
      formData.append('AvatarFile', profileData.avatarFile);
    }

    console.log('📤 Updating profile with data:', {
      fullName: profileData.fullName,
      gender: profileData.gender,
      phoneNumber: profileData.phoneNumber,
      dateOfBirth: profileData.dateOfBirth,
      addressText: profileData.addressText,
      latitude: profileData.latitude,
      longitude: profileData.longitude,
      hasAvatar: !!profileData.avatarFile
    });

    const response = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': '*/*'
        // Note: Do NOT set Content-Type for FormData, browser will set it automatically with boundary
      },
      body: formData
    });

    console.log('✏️ Update profile response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Update failed:', errorText);

      let parsedMessage = '';
      try {
        const parsed = JSON.parse(errorText);
        if (Array.isArray(parsed?.errorMessages) && parsed.errorMessages.length > 0) {
          parsedMessage = parsed.errorMessages.join(', ');
        } else if (typeof parsed?.message === 'string' && parsed.message.trim()) {
          parsedMessage = parsed.message.trim();
        }
      } catch {
        // Keep raw text fallback when response is not JSON.
      }

      const fallbackText = errorText?.trim();
      throw new Error(parsedMessage || fallbackText || `Failed to update profile: ${response.status}`);
    }

    const data: ApiResponse<UserProfile> = await response.json();
    console.log('✏️ Update profile API response:', data);

    if (!data.isSuccess) {
      throw new Error(data.errorMessages?.join(', ') || 'Failed to update profile');
    }

    console.log('✅ Profile updated successfully:', data.result);
    return data.result;
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    throw error;
  }
}

// ==================== FORGOT PASSWORD ====================

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

/**
 * Forgot Password API
 * POST /api/auth/forget-password
 */
export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  try {
    console.log('📧 Calling forgot password API...');
    console.log('🔗 Full URL:', `${API_BASE_URL}/api/auth/forget-password`);
    console.log('📤 Request data:', { email });

    const response = await fetch(`${API_BASE_URL}/api/auth/forget-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    console.log('📡 Response status:', response.status);

    const responseText = await response.text();
    console.log('📥 Response text:', responseText);

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errorMessages && errorData.errorMessages.length > 0) {
          errorMessage = errorData.errorMessages.join(', ');
        }
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const responseData: ApiResponse<any> = JSON.parse(responseText);
    console.log('✅ Forgot Password API Response:', responseData);

    if (responseData.isSuccess) {
      const resultMessage = typeof responseData.result === 'string'
        ? responseData.result
        : responseData.result?.message || 'Email đặt lại mật khẩu đã được gửi đến địa chỉ email của bạn.';

      return {
        message: resultMessage,
      };
    } else {
      const errorMsg = responseData.errorMessages?.join(', ') || 'Không thể gửi email đặt lại mật khẩu.';
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error('❌ Forgot Password API Error:', error);
    throw error;
  }
}

// ==================== RESET PASSWORD ====================

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

/**
 * Reset Password API
 * POST /api/auth/reset-password
 */
export async function resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  try {
    console.log('🔑 Calling reset password API...');
    console.log('🔗 Full URL:', `${API_BASE_URL}/api/auth/reset-password`);
    console.log('📤 Request data:', { email: data.email, token: data.token });

    const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    });

    console.log('📡 Response status:', response.status);

    const responseText = await response.text();
    console.log('📥 Response text:', responseText);

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errorMessages && errorData.errorMessages.length > 0) {
          errorMessage = errorData.errorMessages.join(', ');
        }
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const responseData: ApiResponse<any> = JSON.parse(responseText);
    console.log('✅ Reset Password API Response:', responseData);

    if (responseData.isSuccess) {
      const resultMessage = typeof responseData.result === 'string'
        ? responseData.result
        : responseData.result?.message || 'Mật khẩu đã được đặt lại thành công.';

      return {
        message: resultMessage,
      };
    } else {
      const errorMsg = responseData.errorMessages?.join(', ') || 'Không thể đặt lại mật khẩu.';
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error('❌ Reset Password API Error:', error);
    throw error;
  }
}

// Change Password (for logged-in users)
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export async function changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
  try {
    console.log('🔄 Calling Change Password API...');
    console.log('📤 Request:', { oldPassword: '***', newPassword: '***' });

    const token = getAuthToken();
    if (!token) {
      throw new Error('Vui lòng đăng nhập để đổi mật khẩu');
    }

    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        oldPassword: data.oldPassword,
        newPassword: data.newPassword
      })
    });

    console.log('📡 Response status:', response.status);

    const responseText = await response.text();
    console.log('📥 Response text:', responseText);

    const responseData: ApiResponse<any> = JSON.parse(responseText);

    if (responseData.isSuccess) {
      const resultMessage = typeof responseData.result === 'string'
        ? responseData.result
        : responseData.result?.message || 'Mật khẩu đã được thay đổi thành công!';

      console.log('✅ Change Password successful');
      return { message: resultMessage };
    } else {
      const errorMessage = responseData.errorMessages?.join(', ') || 'Đổi mật khẩu không thành công';
      console.error('❌ Change Password failed:', errorMessage);
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    console.error('❌ Change Password API Error:', error);
    throw error;
  }
}

