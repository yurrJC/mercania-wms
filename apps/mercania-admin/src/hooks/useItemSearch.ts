import { useState, useCallback } from 'react';
import { apiCall } from '../utils/api';

// Types
export interface ItemData {
  id: number;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  currentStatus: string;
  currentLocation: string | null;
  sku: string;
}

export interface SearchResult {
  loading: boolean;
  data: ItemData | null;
  error: string | null;
  lastSearchTerm: string;
}

// Custom error class
class ApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generate SKU in LOCATION-ID format (same as inventory page)
const generateSKU = (item: any): string => {
  const location = item.currentLocation || 'TBD';
  return `${location}-${item.id}`;
};

// Transform API response to our format
const transformItemData = (apiItem: any): ItemData => ({
  id: apiItem.id,
  title: apiItem.isbnMaster?.title || 'Unknown Title',
  author: apiItem.isbnMaster?.author || 'Unknown Author',
  publisher: apiItem.isbnMaster?.publisher || 'Unknown Publisher',
  isbn: apiItem.isbn || '',
  currentStatus: apiItem.currentStatus || 'UNKNOWN',
  currentLocation: apiItem.currentLocation,
  sku: generateSKU(apiItem)
});

// API client with error handling
class ApiClient {
  private static async request<T>(url: string, options?: RequestInit): Promise<T> {
    try {
      const response = await apiCall(`http://localhost:3001${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new ApiError(result.error || 'API request failed');
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    }
  }

  static async searchByBarcode(barcode: string): Promise<ItemData> {
    const result = await this.request<any>(`/api/items?isbn=${encodeURIComponent(barcode)}&limit=1`);
    
    if (!result.data || result.data.items?.length === 0) {
      throw new ApiError('No item found with this barcode');
    }

    return transformItemData(result.data.items[0]);
  }

  static async searchById(id: number): Promise<ItemData> {
    const result = await this.request<any>(`/api/items/${id}`);
    
    if (!result.data) {
      throw new ApiError('Item not found with this internal ID');
    }

    return transformItemData(result.data);
  }
}

// Custom hook for item search
export const useItemSearch = () => {
  const [barcodeSearch, setBarcodeSearch] = useState<SearchResult>({
    loading: false,
    data: null,
    error: null,
    lastSearchTerm: ''
  });

  const [idSearch, setIdSearch] = useState<SearchResult>({
    loading: false,
    data: null,
    error: null,
    lastSearchTerm: ''
  });

  const searchByBarcode = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return;

    setBarcodeSearch({
      loading: true,
      data: null,
      error: null,
      lastSearchTerm: barcode
    });

    try {
      const itemData = await ApiClient.searchByBarcode(barcode);
      setBarcodeSearch({
        loading: false,
        data: itemData,
        error: null,
        lastSearchTerm: barcode
      });
      return itemData;
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Failed to search for item';
      
      setBarcodeSearch({
        loading: false,
        data: null,
        error: errorMessage,
        lastSearchTerm: barcode
      });
      throw error;
    }
  }, []);

  const searchById = useCallback(async (id: string) => {
    const numericId = parseInt(id);
    if (isNaN(numericId) || numericId <= 0) {
      setIdSearch({
        loading: false,
        data: null,
        error: 'Please enter a valid internal ID number',
        lastSearchTerm: id
      });
      return;
    }

    setIdSearch({
      loading: true,
      data: null,
      error: null,
      lastSearchTerm: id
    });

    try {
      const itemData = await ApiClient.searchById(numericId);
      setIdSearch({
        loading: false,
        data: itemData,
        error: null,
        lastSearchTerm: id
      });
      return itemData;
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Failed to search for item';
      
      setIdSearch({
        loading: false,
        data: null,
        error: errorMessage,
        lastSearchTerm: id
      });
      throw error;
    }
  }, []);

  const resetBarcodeSearch = useCallback(() => {
    setBarcodeSearch({
      loading: false,
      data: null,
      error: null,
      lastSearchTerm: ''
    });
  }, []);

  const resetIdSearch = useCallback(() => {
    setIdSearch({
      loading: false,
      data: null,
      error: null,
      lastSearchTerm: ''
    });
  }, []);

  return {
    barcodeSearch,
    idSearch,
    searchByBarcode,
    searchById,
    resetBarcodeSearch,
    resetIdSearch
  };
};
