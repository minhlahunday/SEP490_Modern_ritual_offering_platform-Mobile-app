
export interface CeremonyCategory {
  categoryId: number;
  name: string;
  description?: string;
  isActive: boolean;
}

export type Occasion = 'Full Moon' | 'House Warming' | 'Grand Opening' | 'Ancestral' | 'Year End' | string;

export type UserRole = 'customer' | 'vendor' | 'admin' | 'staff' | 'guest';

export interface Product {
  id: string;
  name: string;
  category: Occasion;
  price: number;
  originalPrice?: number;
  image: string;
  gallery?: string[]; // Additional product images
  description: string;
  rating: number;
  reviews: number;
  orders: number;
  totalSold?: number;
  status: 'active' | 'inactive' | 'draft';
  tag?: string;
  variants?: ProductVariant[]; // UI variants
  vendorId?: string;
  vendorName?: string;
  distanceKm?: number;
}

// API Types
export interface PackageVariant {
  variantId: number;
  packageId: number;
  variantName: string;
  price: number;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiPackage {
  packageId: number;
  packageName: string;
  description: string;
  vendorProfileId: string;
  categoryId: number;
  isActive: boolean;
  createdAt: string;
  packageVariants?: PackageVariant[];
  imageUrls?: string[];
  packageAvatarUrl?: string;
  primaryImageIndex?: number;
  ratingAvg?: number;
  reviewCount?: number;
}

// Product Variant for UI (parsed from API)
export interface ProductVariant {
  variantId: number;
  packageId: number;
  tier: string;
  price: number;
  description: string;
  items: string[];
}

export interface ApiResponse<T> {
  statusCode: string;
  isSuccess: boolean;
  errorMessages: string[];
  result: T;
}

export interface PaginatedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  tier: 'Standard' | 'Special' | 'Premium';
  style: 'Classic' | 'Modern';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export enum AppRoute {
  // Shared Routes
  Home = 'home',
  Auth = 'auth',
  
  // Customer Routes
  Shop = 'shop',
  Detail = 'detail',
  Checkout = 'checkout',
  Tracking = 'tracking',
  Profile = 'profile',
  Cart = 'cart',
  
  // Vendor Routes
  VendorDashboard = 'vendor-dashboard',
  VendorShop = 'vendor-shop',
  VendorProducts = 'vendor-products',
  VendorOrders = 'vendor-orders',
  VendorAnalytics = 'vendor-analytics',
  VendorSettings = 'vendor-settings',
  
  // Admin Routes
  AdminDashboard = 'admin-dashboard',
  AdminVendors = 'admin-vendors',
  AdminUsers = 'admin-users',
  AdminOrders = 'admin-orders',
  AdminDisputes = 'admin-disputes',
  AdminContent = 'admin-content',
  AdminFinance = 'admin-finance',
}

// Utility function to convert AppRoute enum to URL path
export const getPath = (route: AppRoute | string): string => {
  const pathMap: Record<string, string> = {
    [AppRoute.Home]: '/',
    [AppRoute.Auth]: '/auth',
    [AppRoute.Shop]: '/shop',
    [AppRoute.Detail]: '/product',
    [AppRoute.Checkout]: '/checkout',
    [AppRoute.Tracking]: '/tracking',
    [AppRoute.Profile]: '/profile',
    [AppRoute.Cart]: '/checkout',
    [AppRoute.VendorDashboard]: '/vendor/dashboard',
    [AppRoute.VendorShop]: '/vendor/shop',
    [AppRoute.VendorProducts]: '/vendor/products',
    [AppRoute.VendorOrders]: '/vendor/orders',
    [AppRoute.VendorAnalytics]: '/vendor/analytics',
    [AppRoute.VendorSettings]: '/vendor/settings',
    [AppRoute.AdminDashboard]: '/admin/dashboard',
    [AppRoute.AdminVendors]: '/admin/dashboard',
    [AppRoute.AdminUsers]: '/admin/dashboard',
    [AppRoute.AdminOrders]: '/admin/dashboard',
    [AppRoute.AdminDisputes]: '/admin/dashboard',
    [AppRoute.AdminContent]: '/admin/dashboard',
    [AppRoute.AdminFinance]: '/admin/dashboard',
  };
  return pathMap[route] || '/';
};
