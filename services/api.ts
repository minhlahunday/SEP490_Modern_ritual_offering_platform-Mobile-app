export const API_BASE_URL = 'https://vietritual.click/api';

export interface PackageVariant {
  variantId: string;
  packageId: string;
  tier: string;
  price: number;
  description: string;
  items: string[];
}

export interface ApiPackage {
  packageId: string;
  packageName: string;
  description: string;
  vendorProfileId: string;
  categoryId: string;
  isActive: boolean;
  createdAt: string;
  variants?: PackageVariant[];
}

export interface ApiResponse<T> {
  statusCode: string;
  isSuccess: boolean;
  errorMessages: string[];
  result: T;
}

