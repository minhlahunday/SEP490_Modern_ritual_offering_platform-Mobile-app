import { getAuthToken } from './auth';
import { API_BASE_URL } from './api';

export interface CreateReviewRequest {
    itemId: string;
    rating: number;
    comment?: string;
    reviewImages?: File[];
}

export interface ReviewResponse {
    reviewId: string;
    itemId: string;
    rating: number;
    comment: string;
    reviewImages: string[];
    createdAt: string;
}

export interface Review {
    reviewId: string;
    itemId: string;
    variantId: number;
    variantName: string;
    customerId: string;
    customerName: string;
    customerAvatar: string | null;
    vendorId: string;
    rating: number;
    comment: string;
    reviewImageUrls: string[];
    vendorReply: string | null;
    isVisible: boolean;
    createdAt: string;
}

class ReviewService {
    private extractReviewArray(data: any): Review[] {
        if (Array.isArray(data)) return data as Review[];
        if (Array.isArray(data?.result)) return data.result as Review[];
        if (Array.isArray(data?.result?.reviews)) return data.result.reviews as Review[];
        if (Array.isArray(data?.data)) return data.data as Review[];
        if (Array.isArray(data?.items)) return data.items as Review[];
        return [];
    }

    private getHeaders(isMultipart = false): HeadersInit {
        const token = getAuthToken();
        const headers: HeadersInit = {
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
        
        if (!isMultipart) {
            headers['Content-Type'] = 'application/json';
        }
        
        return headers;
    }

    async createReview(request: CreateReviewRequest): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append('ItemId', request.itemId);
            formData.append('Rating', request.rating.toString());
            
            if (request.comment) formData.append('Comment', request.comment);
            
            if (request.reviewImages && request.reviewImages.length > 0) {
                request.reviewImages.forEach((image) => {
                    formData.append('ReviewImages', image);
                });
            }

            const response = await fetch(`${API_BASE_URL}/reviews`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.errorMessages?.[0] || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.isSuccess || data.statusCode === 'OK' || data.isSucceeded;
        } catch (error) {
            console.error('Failed to create review:', error);
            throw error;
        }
    }

    async getReviewsByPackageId(packageId: number): Promise<Review[]> {
        try {
            if (!Number.isFinite(packageId) || packageId <= 0) return [];
            const qs = new URLSearchParams({ PageNumber: '1', PageSize: '50' });
            const response = await fetch(`${API_BASE_URL}/reviews/package/${packageId}?${qs.toString()}`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                if (response.status === 404) return [];
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.extractReviewArray(data);
        } catch (error) {
            console.error('❌ Failed to fetch reviews by package:', error);
            return [];
        }
    }

    async getVendorReviews(): Promise<Review[]> {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews/vendor`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.extractReviewArray(data);
        } catch (error) {
            console.error('Failed to fetch vendor reviews:', error);
            return [];
        }
    }

    async getReviewsByVendorId(vendorId: string): Promise<Review[]> {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews/vendor/${vendorId}`, {
                method: 'GET',
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.extractReviewArray(data);
        } catch (error) {
            console.error('Failed to fetch reviews by vendor ID:', error);
            return [];
        }
    }

    async updateVendorReply(reviewId: string | number, vendorReply: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/vendor-reply`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ vendorReply }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.errorMessages?.[0] || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.isSuccess || data.statusCode === 'OK' || data.isSucceeded;
        } catch (error) {
            console.error('Failed to update vendor reply:', error);
            throw error;
        }
    }

    async updateReviewVisibility(reviewId: string | number, isVisible: boolean): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/visibility`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ isVisible }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.errorMessages?.[0] || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.isSuccess || data.statusCode === 'OK' || data.isSucceeded;
        } catch (error) {
            console.error('Failed to update review visibility:', error);
            throw error;
        }
    }
}

export const reviewService = new ReviewService();
