'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiCall } from '../../utils/api';
import { 
  Package,
  Search,
  Filter,
  ArrowLeft,
  Eye,
  MapPin,
  Calendar,
  DollarSign,
  BookOpen,
  Music,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
  AlertTriangle,
  Package2,
  Settings,
  Edit3,
  CheckCircle
} from 'lucide-react';

interface Item {
  id: number;
  isbn: string;
  conditionGrade: string;
  conditionNotes: string;
  costCents: number;
  intakeDate: string;
  listedDate?: string | null;
  soldDate?: string | null;
  currentStatus: string;
  currentLocation: string | null;
  lotNumber: number | null;
  dvdMetadata?: {
    genre?: string | null;
    rating?: string | null;
    runtime?: number | null;
    region?: string | null;
    season?: string | null;
    videoFormat?: string | null;
  } | null;
  isbnMaster: {
    title: string;
    author: string;
    publisher: string;
    pubYear: number | null;
    binding: string;
    imageUrl: string | null;
  } | null;
  statusHistory?: any[];
  listings?: any[];
}

interface InventoryData {
  items: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function InventoryPage() {
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [titleSearch, setTitleSearch] = useState('');
  const [isbnSearch, setIsbnSearch] = useState('');
  const [idSearch, setIdSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('id_desc'); // 'id_desc' = ID high to low (newest first), 'id_asc' = ID low to high, '' = default (lot first)
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper function to format DVD title with season info
  const formatItemTitle = (item: Item): string => {
    const baseTitle = item.isbnMaster?.title || 'Unknown Title';
    
    // For DVDs/Blu-ray/4K, add season info in brackets if available
    const isVideoFormat = item.isbnMaster?.binding && 
      ['DVD', 'Blu-ray', '4K'].includes(item.isbnMaster.binding);
    
    if (isVideoFormat && item.dvdMetadata?.season) {
      return `${baseTitle} (${item.dvdMetadata.season})`;
    }
    
    return baseTitle;
  };

  // Helper function to format author/creator info
  const formatItemAuthor = (item: Item): string => {
    // For DVDs/Blu-ray/4K, show format and region instead of director
    const isVideoFormat = item.isbnMaster?.binding && 
      ['DVD', 'Blu-ray', '4K'].includes(item.isbnMaster.binding);
    
    if (isVideoFormat && item.dvdMetadata) {
      const format = item.isbnMaster.binding || 'DVD';
      let region = item.dvdMetadata.region || 'Unknown';
      
      // Clean up region display - remove "Region " prefix if present
      if (region.startsWith('Region ')) {
        region = region.replace('Region ', '');
      }
      
      return `${format}, Region ${region}`;
    }
    
    // For other items, show author/artist
    return item.isbnMaster?.author || 'Unknown Author';
  };
  const [showLotModal, setShowLotModal] = useState(false);
  const [lotItems, setLotItems] = useState<Item[]>([]);
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [isCreatingLot, setIsCreatingLot] = useState(false);
  const [showManageLotsModal, setShowManageLotsModal] = useState(false);
  const [allLots, setAllLots] = useState<any[]>([]);
  const [editingLot, setEditingLot] = useState<any>(null);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [isDeletingLot, setIsDeletingLot] = useState<number | null>(null);
  
  // Lot pagination state
  const [lotCurrentPage, setLotCurrentPage] = useState(1);
  const [lotTotalPages, setLotTotalPages] = useState(1);
  const [lotTotalCount, setLotTotalCount] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdLot, setCreatedLot] = useState<any>(null);
  const [showCOGModal, setShowCOGModal] = useState(false);
  const [cogData, setCogData] = useState({
    startDate: '',
    endDate: '',
    totalSpent: ''
  });
  const [isProcessingCOG, setIsProcessingCOG] = useState(false);
  const [cogSuccess, setCogSuccess] = useState<any>(null);
  
  // Update Dates functionality
  const [showUpdateDatesModal, setShowUpdateDatesModal] = useState(false);
  const [updateDatesStep, setUpdateDatesStep] = useState<'type' | 'items' | 'date' | 'success'>(
    'type'
  );
  const [updateDatesData, setUpdateDatesData] = useState({
    dateType: '' as 'listed' | 'sold' | '',
    itemIds: '',
    date: new Date().toISOString().split('T')[0] // Today's date as default
  });
  const [isProcessingDates, setIsProcessingDates] = useState(false);
  const [updateDatesResult, setUpdateDatesResult] = useState<any>(null);

  // Fetch inventory data
  const fetchInventory = async (page = 1, status = '', title = '', isbn = '', id = '', lotNumber = '', sort = '') => {
    setIsLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (status) params.append('status', status);
      if (lotNumber) params.append('lotNumber', lotNumber);
      if (sort) params.append('sort', sort);
      
      // Add separate search parameters
      if (title.trim()) params.append('title', title.trim());
      if (isbn.trim()) params.append('isbn', isbn.trim());
      if (id.trim()) params.append('search', id.trim());

      const response = await apiCall(`/api/items?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch inventory');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setInventoryData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch inventory');
      }
      
    } catch (err) {
      console.error('Inventory fetch error:', err);
      setError('Failed to load inventory. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount and when non-search filters change
  useEffect(() => {
    fetchInventory(currentPage, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
  }, [currentPage, statusFilter, sortOrder]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchInventory(1, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
  };

  // Handle individual search field changes
  const handleTitleSearch = () => {
    setCurrentPage(1);
    fetchInventory(1, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
  };

  const handleIsbnSearch = () => {
    setCurrentPage(1);
    fetchInventory(1, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
  };

  const handleIdSearch = () => {
    setCurrentPage(1);
    fetchInventory(1, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
  };

  // Handle Enter key press in search fields
  const handleKeyPress = (e: React.KeyboardEvent, searchFunction: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchFunction();
    }
  };

  // Handle status filter change
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Handle lot filter change
  const handleLotFilter = () => {
    setCurrentPage(1);
    fetchInventory(1, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setTitleSearch('');
    setIsbnSearch('');
    setIdSearch('');
    setStatusFilter('');
    setLotFilter('');
    setSortOrder('id_desc'); // Reset to default sort (newest first)
    setCurrentPage(1);
  };

  // Export all inventory as CSV (Excel-compatible)
  const handleExportAll = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (lotFilter) params.append('lotNumber', lotFilter);
      if (sortOrder) params.append('sort', sortOrder);
      if (titleSearch.trim()) params.append('title', titleSearch.trim());
      if (isbnSearch.trim()) params.append('isbn', isbnSearch.trim());
      if (idSearch.trim()) params.append('search', idSearch.trim());

      const url = `/api/items/export?${params.toString()}`;
      const res = await apiCall(url);
      if (!res.ok) throw new Error('Failed to export');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `inventory_export_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export inventory. Please try again.');
    }
  };

  // Format currency
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Generate SKU in LOCATION-ID format
  const generateSKU = (item: Item) => {
    const location = item.currentLocation || 'TBD';
    return `${location}-${item.id}`;
  };

  // Handle item deletion
  const handleDeleteItem = async (item: Item) => {
    setIsDeleting(true);
    try {
      const response = await apiCall(`/api/items/${item.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // Remove item from current data
        setInventoryData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.filter(i => i.id !== item.id),
            pagination: {
              ...prev.pagination,
              total: prev.pagination.total - 1
            }
          };
        });
        setShowDeleteConfirm(null);
      } else {
        setError(result.error || 'Failed to delete item');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete item. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle view item details
  const handleViewItem = async (item: Item) => {
    try {
      const response = await apiCall(`/api/items/${item.id}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedItem(result.data);
      } else {
        setError('Failed to load item details');
      }
    } catch (err) {
      console.error('View item error:', err);
      setError('Failed to load item details');
    }
  };

  // Handle lot item scanning
  const handleLotItemScan = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    try {
      const trimmedSearch = searchTerm.trim();
      const isNumeric = /^\d+$/.test(trimmedSearch);
      
      let url;
      if (isNumeric && trimmedSearch.length <= 6) {
        // It's a short number (ID)
        url = `/api/items?search=${trimmedSearch}`;
      } else {
        // It's an ISBN/barcode
        url = `/api/items?isbn=${trimmedSearch}`;
      }

      const response = await apiCall(url);
      const result = await response.json();
      
      if (result.success && result.data.items.length > 0) {
        const item = result.data.items[0]; // Take the first item
        
        // Check if item is already in the lot
        if (!lotItems.find(lotItem => lotItem.id === item.id)) {
          setLotItems(prev => [...prev, item]);
          setLotSearchTerm(''); // Clear the search after successful scan
        } else {
          setError('Item is already in the lot');
        }
      } else {
        setError('Item not found');
      }
    } catch (err) {
      console.error('Lot scan error:', err);
      setError('Failed to scan item');
    }
  };

  // Remove item from lot
  const handleRemoveFromLot = (itemId: number) => {
    setLotItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Create lot
  const handleCreateLot = async () => {
    if (lotItems.length === 0) {
      setError('No items in lot to create');
      return;
    }

    setIsCreatingLot(true);
    try {
      // The lot number will be the first (lowest) internal ID
      const lotNumber = Math.min(...lotItems.map(item => item.id));
      const itemIds = lotItems.map(item => item.id);

      const response = await apiCall('/api/lots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lotNumber,
          itemIds
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Store the created lot data for the success modal
        setCreatedLot({
          lotNumber: lotNumber,
          itemCount: lotItems.length,
          items: lotItems,
          createdAt: new Date().toISOString()
        });
        
        // Clear the lot and close modal
        setLotItems([]);
        setShowLotModal(false);
        setLotSearchTerm('');
        
        // Update specific items in inventory to show new lot number
        setInventoryData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map(item => 
          itemIds.includes(item.id) 
            ? { ...item, lotNumber: lotNumber }
            : item
            )
          };
        });
        
        // Refresh lots list to include the new lot
        fetchAllLots();
        
        // Show success modal
        setShowSuccessModal(true);
      } else {
        setError(result.error || 'Failed to create lot');
      }
    } catch (err) {
      console.error('Create lot error:', err);
      setError('Failed to create lot');
    } finally {
      setIsCreatingLot(false);
    }
  };

  // Fetch lots with pagination
  const fetchAllLots = async (page = 1) => {
    setIsLoadingLots(true);
    try {
      const response = await apiCall(`/api/lots?page=${page}&limit=20`);
      const result = await response.json();
      
      if (result.success) {
        setAllLots(result.data);
        setLotCurrentPage(result.pagination.page);
        setLotTotalPages(result.pagination.pages);
        setLotTotalCount(result.pagination.total);
      } else {
        setError('Failed to load lots');
      }
    } catch (err) {
      console.error('Fetch lots error:', err);
      setError('Failed to load lots');
    } finally {
      setIsLoadingLots(false);
    }
  };

  // Open manage lots modal and refresh data
  const openManageLotsModal = async () => {
    setShowManageLotsModal(true);
    setLotCurrentPage(1); // Reset to first page
    await fetchAllLots(1);
    // Also refresh inventory to ensure consistency
    await fetchInventory(currentPage, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
  };

  // Delete entire lot
  const handleDeleteLot = async (lotNumber: number) => {
    // Prevent double-clicks
    if (isDeletingLot === lotNumber) return;
    
    try {
      setIsDeletingLot(lotNumber);
      
      // Optimistically remove from UI immediately
      setAllLots(prev => prev.filter(lot => lot.lotNumber !== lotNumber));
      
      // Update inventory items immediately
      setInventoryData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(item => 
            item.lotNumber === lotNumber 
              ? { ...item, lotNumber: null }
              : item
          )
        };
      });

      const response = await apiCall(`/api/lots/${lotNumber}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // If deletion failed, revert the optimistic updates
        await fetchAllLots();
        await fetchInventory(currentPage, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
        
        const errorResult = await response.json();
        setError(errorResult.error || `Failed to delete lot (${response.status})`);
        return;
      }

      const result = await response.json();

      if (!result.success) {
        // If deletion failed, revert the optimistic updates
        await fetchAllLots();
        await fetchInventory(currentPage, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
        setError(result.error || 'Failed to delete lot');
      }
      // If successful, the optimistic updates are already applied - no need for additional API calls
    } catch (err) {
      console.error('Delete lot error:', err);
      // If deletion failed, revert the optimistic updates
      await fetchAllLots();
      await fetchInventory(currentPage, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
      setError('Failed to delete lot');
    } finally {
      setIsDeletingLot(null);
    }
  };

  // Remove item from existing lot
  const handleRemoveItemFromLot = async (itemId: number, lotNumber: number) => {
    try {
      // Prevent double-clicks by checking if item still exists in the editing lot
      if (editingLot && !editingLot.items.some((item: Item) => item.id === itemId)) {
        setError('Item has already been removed from this lot');
        return;
      }
      
      const response = await apiCall(`/api/lots/${lotNumber}/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        setError(errorResult.error || `Failed to remove item from lot (${response.status})`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Update the editing lot items
        if (editingLot && editingLot.lotNumber === lotNumber) {
          const updatedItems = editingLot.items.filter((item: Item) => item.id !== itemId);
          
          if (updatedItems.length === 0) {
            // If no items left, go back to lots list
            setEditingLot(null);
          } else {
            setEditingLot({
              ...editingLot,
              items: updatedItems
            });
          }
        }
        
        // 1. Update the specific item in inventory immediately (if visible)
        setInventoryData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map(item => 
          item.id === itemId 
            ? { ...item, lotNumber: null }
            : item
            )
          };
        });
        
        // 2. Refresh lots list for accurate counts
        await fetchAllLots();
        
        // 3. If item not visible on current page, fetch its updated data specifically
        const isItemVisible = inventoryData?.items.some(item => item.id === itemId) || false;
        if (!isItemVisible) {
          // Fetch the specific item's updated data
          try {
            const response = await apiCall(`/api/items/${itemId}`);
            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                // Update this specific item if it appears in inventory later
                setInventoryData(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    items: prev.items.map(item => 
                  item.id === itemId 
                    ? { ...item, lotNumber: result.data.lotNumber }
                    : item
                    )
                  };
                });
              }
            }
          } catch (err) {
            console.log('Item-specific update failed, item not on current page');
          }
        }
      } else {
        setError(result.error || 'Failed to remove item from lot');
      }
    } catch (err) {
      console.error('Remove item from lot error:', err);
      setError('Failed to remove item from lot');
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'INTAKE': return 'bg-yellow-100 text-yellow-800';
      case 'STORED': return 'bg-blue-100 text-blue-800';
      case 'LISTED': return 'bg-orange-100 text-orange-800';
      case 'SOLD': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Print intake label for individual item using new 80x40mm format
  const handlePrintIntakeLabel = async (item: Item) => {
    try {
      // Use the same formatting functions as the inventory display
      const itemTitle = formatItemTitle(item);
      const itemAuthor = formatItemAuthor(item);
      
      // Use new 80x40mm label endpoint with POST method
      const response = await apiCall('/labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          internalID: item.id.toString(),
          title: itemTitle,
          author: itemAuthor,
          qty: 1
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate label');
      }
      
      const pdfBlob = await response.blob();
      const url = window.URL.createObjectURL(pdfBlob);
      
      // Open PDF in new window for printing
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        // Fallback: download the PDF
        const a = document.createElement('a');
        a.href = url;
        a.download = `label_${item.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        alert('PDF label downloaded. Open in Preview and print for best results.');
      }
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating label:', error);
      alert('Error generating label. Please try again.');
    }
  };

  // Print lot label (80x40mm format) using new API endpoint
  const handlePrintLabel = async (lot: any) => {
    try {
      // Use new 80x40mm lot label endpoint with POST method
      const response = await apiCall('/lot-labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lotNumber: lot.lotNumber,
          itemCount: lot.itemCount,
          qty: 1
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate lot label');
      }
      
      const pdfBlob = await response.blob();
      const url = window.URL.createObjectURL(pdfBlob);
      
      // Open PDF in new window for printing
      const printWindow = window.open(url, '_blank');
      
    if (printWindow) {
        printWindow.onload = () => {
        printWindow.print();
        };
      } else {
        // Fallback: download the PDF
        const a = document.createElement('a');
        a.href = url;
        a.download = `lot_label_${lot.lotNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        alert('PDF lot label downloaded. Open in Preview and print for best results.');
      }
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating lot label:', error);
      alert('Error generating lot label. Please try again.');
    }
  };

  // Handle COG calculation and processing
  const handleCOGProcessing = async () => {
    if (!cogData.startDate || !cogData.endDate || !cogData.totalSpent) {
      setError('Please fill in all COG fields');
      return;
    }

    const totalAmount = parseFloat(cogData.totalSpent);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      setError('Please enter a valid total amount');
      return;
    }

    setIsProcessingCOG(true);
    setError('');

    try {
      const response = await apiCall('/api/cog/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: cogData.startDate,
          endDate: cogData.endDate,
          totalSpent: totalAmount
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process COG calculation');
      }

      const result = await response.json();

      if (result.success) {
        setCogSuccess({
          recordDate: new Date().toISOString(),
          startDate: cogData.startDate,
          endDate: cogData.endDate,
          totalAmount: totalAmount,
          itemsUpdated: result.data.itemsUpdated,
          averagePerItem: result.data.averagePerItem
        });
        
        // Reset form and close modal
        setCogData({ startDate: '', endDate: '', totalSpent: '' });
        setShowCOGModal(false);
        
        // Refresh inventory to show updated costs
        await fetchInventory(currentPage, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
      } else {
        throw new Error(result.error || 'Failed to process COG calculation');
      }
    } catch (err) {
      console.error('COG processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process COG calculation');
    } finally {
      setIsProcessingCOG(false);
    }
  };

  // Reset COG modal
  const resetCOGModal = () => {
    setCogData({ startDate: '', endDate: '', totalSpent: '' });
    setShowCOGModal(false);
    setError('');
  };

  // Handle update dates processing
  const handleUpdateDatesProcessing = async () => {
    if (!updateDatesData.dateType || !updateDatesData.itemIds.trim() || !updateDatesData.date) {
      setError('Please fill in all fields');
      return;
    }

    setIsProcessingDates(true);
    setError('');

    try {
      // Parse and validate item IDs
      const itemIds = updateDatesData.itemIds
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id) && id > 0);

      if (itemIds.length === 0) {
        throw new Error('Please enter valid item IDs (e.g. 7, 3, 10)');
      }

      const response = await apiCall('/api/items/update-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemIds,
          dateType: updateDatesData.dateType,
          date: updateDatesData.date
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update item dates: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setUpdateDatesResult(result.data);
        setUpdateDatesStep('success');
        
        // Refresh inventory to show updated items
        await fetchInventory(currentPage, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder);
      } else {
        throw new Error(result.error || 'Failed to update item dates');
      }
    } catch (err) {
      console.error('Update dates error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update item dates');
    } finally {
      setIsProcessingDates(false);
    }
  };

  const resetUpdateDatesModal = () => {
    setShowUpdateDatesModal(false);
    setUpdateDatesStep('type');
    setUpdateDatesData({
      dateType: '',
      itemIds: '',
      date: new Date().toISOString().split('T')[0]
    });
    setIsProcessingDates(false);
    setUpdateDatesResult(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 sm:px-8 lg:px-10">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              <div className="flex items-center space-x-3">
                <Package className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href="/intake"
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Item
              </Link>
              <button
                onClick={() => setShowLotModal(true)}
                className="bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 font-medium transition-colors flex items-center"
              >
                <Package2 className="h-4 w-4 mr-2" />
                Create Lot
              </button>
              <button
                onClick={openManageLotsModal}
                className="bg-orange-600 text-white px-5 py-2.5 rounded-lg hover:bg-orange-700 font-medium transition-colors flex items-center"
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Lots
              </button>
              <button
                onClick={() => setShowCOGModal(true)}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center"
              >
                <Settings className="h-4 w-4 mr-2" />
                COG
              </button>
              <button
                onClick={() => setShowUpdateDatesModal(true)}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Update Dates
              </button>
              <button
                onClick={() => fetchInventory(currentPage, statusFilter, titleSearch, isbnSearch, idSearch, lotFilter, sortOrder)}
                className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium transition-colors flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={handleExportAll}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 font-medium transition-colors flex items-center"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="py-6 px-4 sm:px-6 lg:px-8">
        
        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="space-y-4">
            {/* Search Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
              {/* Title Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search by Title
                </label>
              <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-400" />
                <input
                  type="text"
                    value={titleSearch}
                    onChange={(e) => setTitleSearch(e.target.value)}
                    onBlur={handleTitleSearch}
                    onKeyPress={(e) => handleKeyPress(e, handleTitleSearch)}
                    placeholder="Enter book title..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Type and click outside to search
                </p>
              </div>

              {/* ISBN/Barcode Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search by ISBN/Barcode
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400" />
                  <input
                    type="text"
                    value={isbnSearch}
                    onChange={(e) => setIsbnSearch(e.target.value)}
                    onBlur={handleIsbnSearch}
                    onKeyPress={(e) => handleKeyPress(e, handleIsbnSearch)}
                    placeholder="Enter ISBN or barcode..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                  Type and click outside to search
                </p>
              </div>

              {/* Internal ID Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search by Internal ID
                </label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400" />
                  <input
                    type="text"
                    value={idSearch}
                    onChange={(e) => setIdSearch(e.target.value)}
                    onBlur={handleIdSearch}
                    onKeyPress={(e) => handleKeyPress(e, handleIdSearch)}
                    placeholder="Enter internal ID..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Type and click outside to search
                </p>
              </div>

              {/* Search All Button */}
              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search All
                </button>
              </div>
            </div>

            {/* Second Row - Lot Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Lot Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search by Lot
                </label>
                <div className="relative">
                  <Package2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400" />
                  <input
                    type="text"
                    value={lotFilter}
                    onChange={(e) => setLotFilter(e.target.value)}
                    onBlur={handleLotFilter}
                    onKeyPress={(e) => handleKeyPress(e, handleLotFilter)}
                    placeholder="Enter lot number..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Type and click outside to search
              </p>
              </div>

            {/* Status Filter */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status Filter
                </label>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="INTAKE">Intake</option>
                <option value="STORED">Stored</option>
                <option value="LISTED">Listed</option>
                <option value="SOLD">Sold</option>
              </select>
            </div>
              </div>

              {/* Sort Order */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort by ID
                </label>
                <div className="flex items-center space-x-2">
                  <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="id_desc">ID: High to Low (Default)</option>
                    <option value="id_asc">ID: Low to High</option>
                    <option value="">Lot first</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Active Filters & Clear Button */}
            {(titleSearch || isbnSearch || idSearch || statusFilter || lotFilter || sortOrder) && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="font-medium">Active filters:</span>
                  {titleSearch && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                      Title: {titleSearch}
                    </span>
                  )}
                  {isbnSearch && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      ISBN: {isbnSearch}
                    </span>
                  )}
                  {idSearch && (
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                      ID: {idSearch}
                    </span>
                  )}
                  {lotFilter && (
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                      Lot: #{lotFilter}
                    </span>
                  )}
                  {statusFilter && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                      Status: {statusFilter}
                    </span>
                  )}
                  {sortOrder && (
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                      Sort: {sortOrder === 'id_asc' ? 'ID Low→High' : sortOrder === 'id_desc' ? 'ID High→Low' : sortOrder}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Loading inventory...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && inventoryData && inventoryData.items.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Items Found</h3>
            <p className="text-gray-600 mb-6">
              {titleSearch || isbnSearch || idSearch || statusFilter || lotFilter
                ? "No items match your current filters." 
                : "Your inventory is empty. Start by adding some items!"
              }
            </p>
            <Link
              href="/intake"
              className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Your First Item
            </Link>
          </div>
        )}

        {/* Inventory Table */}
        {!isLoading && !error && inventoryData && inventoryData.items.length > 0 && (
          <>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="w-full">
                <table className="w-full table-auto divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="w-80 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Book Details
                      </th>
                      <th className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Condition
                      </th>
                      <th className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lot
                      </th>
                      <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Intaked
                      </th>
                      <th className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Listed
                      </th>
                      <th className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Sold
                      </th>
                      <th className="w-28 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventoryData.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="text-sm font-bold text-gray-900">#{item.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              {item.isbnMaster?.imageUrl ? (
                                <img 
                                  src={item.isbnMaster.imageUrl} 
                                  alt={`${item.isbnMaster.binding || 'Product'} cover`}
                                  className="h-16 w-12 object-cover rounded"
                                  onError={(e) => {
                                    console.log('Image failed to load:', item.isbnMaster.imageUrl);
                                    console.log('Item data:', item);
                                    e.currentTarget.style.display = 'none';
                                  }}
                                  onLoad={() => {
                                    console.log('Image loaded successfully:', item.isbnMaster.imageUrl);
                                  }}
                                />
                              ) : (
                                <div className="h-16 w-12 bg-gray-200 rounded flex items-center justify-center">
                                  {item.isbnMaster?.binding === 'CD' ? (
                                    <Music className="h-6 w-6 text-gray-400" />
                                  ) : item.isbnMaster?.binding === 'DVD' ? (
                                    <Play className="h-6 w-6 text-gray-400" />
                                  ) : (
                                  <BookOpen className="h-6 w-6 text-gray-400" />
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {formatItemTitle(item)}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {formatItemAuthor(item)}
                              </p>
                              <p className="text-xs text-gray-400">
                                ISBN: {item.isbn}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs font-medium text-gray-900">
                            {item.conditionGrade || 'Not Set'}
                          </div>
                          {item.conditionNotes && (
                            <div className="text-xs text-gray-400 truncate" title={item.conditionNotes}>
                              Notes
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="inline-flex items-center font-mono text-sm font-semibold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                            <span className="tracking-wide">{generateSKU(item)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex px-1 py-1 text-xs font-semibold rounded ${getStatusColor(item.currentStatus)}`}>
                            {item.currentStatus.slice(0,3)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-900">
                          {item.currentLocation ? (
                            item.currentLocation
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-900">
                          {item.lotNumber ? (
                            <span className="bg-purple-100 text-purple-800 px-1 py-1 rounded text-xs font-semibold">#{item.lotNumber}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-900">
                            {formatCurrency(item.costCents)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-500">
                            {formatDate(item.intakeDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-500">
                          {item.listedDate ? formatDate(item.listedDate) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center text-xs text-gray-500">
                          {item.soldDate ? formatDate(item.soldDate) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium">
                          <div className="flex items-center justify-end space-x-1">
                          <button
                              onClick={() => handleViewItem(item)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                              title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                            <button
                              onClick={() => setShowDeleteConfirm(item)}
                              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                              title="Delete item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {inventoryData.pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6 rounded-lg shadow-md">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(inventoryData.pagination.pages, currentPage + 1))}
                    disabled={currentPage === inventoryData.pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">
                        {((currentPage - 1) * inventoryData.pagination.limit) + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * inventoryData.pagination.limit, inventoryData.pagination.total)}
                      </span>{' '}
                      of{' '}
                      <span className="font-medium">{inventoryData.pagination.total}</span>{' '}
                      items
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        Page {currentPage} of {inventoryData.pagination.pages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(inventoryData.pagination.pages, currentPage + 1))}
                        disabled={currentPage === inventoryData.pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Summary Stats */}
        {!isLoading && !error && inventoryData && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Inventory Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-800">Total Items:</span>
                <span className="text-blue-700 ml-2">{inventoryData.pagination.total}</span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Current Page:</span>
                <span className="text-blue-700 ml-2">
                  {currentPage} of {inventoryData.pagination.pages || 1}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Items per Page:</span>
                <span className="text-blue-700 ml-2">{inventoryData.pagination.limit}</span>
              </div>
            </div>
          </div>
        )}

        {/* Item Details Modal */}
        {selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Item Details #{selectedItem.id}</h2>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Book Information */}
                  <div className="space-y-4">
                    <div className="flex items-start space-x-4">
                      {selectedItem.isbnMaster?.imageUrl ? (
                        <img 
                          src={selectedItem.isbnMaster.imageUrl} 
                          alt={`${selectedItem.isbnMaster.binding || 'Product'} cover`}
                          className="h-32 w-24 object-cover rounded shadow-md"
                          onError={(e) => {
                            console.log('Detail image failed to load:', selectedItem.isbnMaster.imageUrl);
                            e.currentTarget.style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log('Detail image loaded successfully:', selectedItem.isbnMaster.imageUrl);
                          }}
                        />
                      ) : (
                        <div className="h-32 w-24 bg-gray-200 rounded shadow-md flex items-center justify-center">
                          {selectedItem.isbnMaster?.binding === 'CD' ? (
                            <Music className="h-8 w-8 text-gray-400" />
                          ) : selectedItem.isbnMaster?.binding === 'DVD' ? (
                            <Play className="h-8 w-8 text-gray-400" />
                          ) : (
                          <BookOpen className="h-8 w-8 text-gray-400" />
                          )}
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {formatItemTitle(selectedItem)}
                        </h3>
                        <p className="text-gray-600 mb-1">
                          <span className="font-medium">
                            {['DVD', 'Blu-ray', '4K'].includes(selectedItem.isbnMaster?.binding || '') ? 'Format & Region:' : 'Author:'}
                          </span> {formatItemAuthor(selectedItem)}
                        </p>
                        <p className="text-gray-600 mb-1">
                          <span className="font-medium">
                            {['DVD', 'Blu-ray', '4K'].includes(selectedItem.isbnMaster?.binding || '') ? 'Studio:' : 'Publisher:'}
                          </span> {selectedItem.isbnMaster?.publisher || 'Unknown'}
                        </p>
                        <p className="text-gray-600">
                          <span className="font-medium">Year:</span> {selectedItem.isbnMaster?.pubYear || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Item Details */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                      <p className="text-gray-900">{selectedItem.isbn}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                      <p className="text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded border text-sm">
                        {generateSKU(selectedItem)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Location-ID Format</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedItem.currentStatus)}`}>
                        {selectedItem.currentStatus}
                      </span>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                      <p className="text-gray-900">{selectedItem.conditionGrade || 'Not Set'}</p>
                      {selectedItem.conditionNotes && (
                        <p className="text-sm text-gray-600 mt-1">{selectedItem.conditionNotes}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <p className="text-gray-900">{selectedItem.currentLocation || 'Not assigned'}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                      <p className="text-gray-900">{formatCurrency(selectedItem.costCents)}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Intake Date</label>
                      <p className="text-gray-900">{formatDate(selectedItem.intakeDate)}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Listed Date</label>
                      <p className="text-gray-900">
                        {selectedItem.listedDate ? formatDate(selectedItem.listedDate) : 'Not listed yet'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sold Date</label>
                      <p className="text-gray-900">
                        {selectedItem.soldDate ? formatDate(selectedItem.soldDate) : 'Not sold yet'}
                      </p>
                    </div>
                  </div>

                  {/* DVD-specific metadata */}
                  {['DVD', 'Blu-ray', '4K'].includes(selectedItem.isbnMaster?.binding || '') && selectedItem.dvdMetadata && (
                    <div className="mt-6 border-t pt-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">DVD Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedItem.dvdMetadata.season && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
                            <p className="text-gray-900">{selectedItem.dvdMetadata.season}</p>
                          </div>
                        )}
                        {selectedItem.dvdMetadata.videoFormat && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Video Format</label>
                            <p className="text-gray-900">{selectedItem.dvdMetadata.videoFormat}</p>
                          </div>
                        )}
                        {selectedItem.dvdMetadata.genre && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                            <p className="text-gray-900">{selectedItem.dvdMetadata.genre}</p>
                          </div>
                        )}
                        {selectedItem.dvdMetadata.rating && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                            <p className="text-gray-900">{selectedItem.dvdMetadata.rating}</p>
                          </div>
                        )}
                        {selectedItem.dvdMetadata.runtime && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Runtime</label>
                            <p className="text-gray-900">{selectedItem.dvdMetadata.runtime} minutes</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status History */}
                {selectedItem.statusHistory && selectedItem.statusHistory.length > 0 && (
                  <div className="mt-6 border-t pt-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Status History</h4>
                    <div className="space-y-2">
                      {selectedItem.statusHistory.slice(0, 5).map((history: any, index: number) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-900">
                            {history.fromStatus && `${history.fromStatus} → `}{history.toStatus}
                          </span>
                          <span className="text-gray-500">
                            {formatDate(history.changedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Listings */}
                {selectedItem.listings && selectedItem.listings.length > 0 && (
                  <div className="mt-6 border-t pt-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Active Listings</h4>
                    <div className="space-y-2">
                      {selectedItem.listings.map((listing: any) => (
                        <div key={listing.id} className="flex justify-between items-center text-sm bg-gray-50 p-3 rounded">
                          <span className="text-gray-900">{listing.channel}</span>
                          <span className="text-gray-900 font-medium">{formatCurrency(listing.priceCents)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer with Actions */}
              <div className="bg-gray-50 px-6 py-4 border-t flex flex-col sm:flex-row gap-3 sm:justify-between">
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Reprint the original intake label for this item
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handlePrintIntakeLabel(selectedItem)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                    </svg>
                    Print Intake Label
                  </button>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Delete Item</h3>
                </div>
                
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete item #{showDeleteConfirm.id}? This action cannot be undone.
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <p className="text-sm font-medium text-gray-900">
                    {showDeleteConfirm.isbnMaster?.title || 'Unknown Title'}
                  </p>
                  <p className="text-sm text-gray-600">
                    ISBN: {showDeleteConfirm.isbn}
                  </p>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteItem(showDeleteConfirm)}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Item
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lot Creation Modal */}
        {showLotModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Create Item Lot</h2>
                <button
                  onClick={() => {
                    setShowLotModal(false);
                    setLotItems([]);
                    setLotSearchTerm('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Scanning Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Scan Items</h3>
                    
                    <div className="space-y-3">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        handleLotItemScan(lotSearchTerm);
                      }}>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={lotSearchTerm}
                            onChange={(e) => setLotSearchTerm(e.target.value)}
                            placeholder="Scan ID or ISBN/Barcode..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
                            autoFocus
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 font-medium"
                        >
                          Add to Lot
                        </button>
                      </form>
                      
                      <p className="text-xs text-gray-500">
                        Scan internal ID (e.g., "9") or ISBN/barcode (e.g., "9780812693768")
                      </p>
                    </div>

                    {lotItems.length > 0 && (
                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-md font-medium text-gray-900">
                            Lot Preview ({lotItems.length} items)
                          </h4>
                          <p className="text-sm text-gray-600">
                            Lot Number: {Math.min(...lotItems.map(item => item.id))}
                          </p>
                        </div>
                        
                        <button
                          onClick={handleCreateLot}
                          disabled={isCreatingLot || lotItems.length === 0}
                          className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          {isCreatingLot ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Creating Lot...
                            </>
                          ) : (
                            <>
                              <Package2 className="h-4 w-4 mr-2" />
                              Create Lot ({lotItems.length} items)
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Items List Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Items in Lot</h3>
                    
                    {lotItems.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Package2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No items scanned yet</p>
                        <p className="text-sm">Start scanning items to add them to the lot</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {lotItems.map((item) => (
                          <div key={item.id} className="bg-gray-50 rounded-lg p-4 flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              {item.isbnMaster?.imageUrl ? (
                                <img 
                                  src={item.isbnMaster.imageUrl} 
                                  alt={`${item.isbnMaster.binding || 'Product'} cover`}
                                  className="h-16 w-12 object-cover rounded shadow-sm"
                                />
                              ) : (
                                <div className="h-16 w-12 bg-gray-200 rounded shadow-sm flex items-center justify-center">
                                  {item.isbnMaster?.binding === 'CD' ? (
                                    <Music className="h-6 w-6 text-gray-400" />
                                  ) : item.isbnMaster?.binding === 'DVD' ? (
                                    <Play className="h-6 w-6 text-gray-400" />
                                  ) : (
                                  <BookOpen className="h-6 w-6 text-gray-400" />
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {formatItemTitle(item)}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {formatItemAuthor(item)}
                              </p>
                              <div className="flex items-center space-x-4 mt-1">
                                <span className="text-xs font-bold text-purple-600">
                                  ID: #{item.id}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ISBN: {item.isbn}
                                </span>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleRemoveFromLot(item.id)}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                              title="Remove from lot"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manage Lots Modal */}
        {showManageLotsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Manage Lots</h2>
                <button
                  onClick={() => {
                    setShowManageLotsModal(false);
                    setEditingLot(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6">
                {editingLot ? (
                  /* Edit Lot View */
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          Edit Lot #{editingLot.lotNumber}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {editingLot.items.length} items • Created {formatDate(editingLot.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => setEditingLot(null)}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
                      >
                        ← Back to Lots
                      </button>
                    </div>

                    <div className="space-y-4">
                      {editingLot.items.map((item: Item) => (
                        <div key={item.id} className="bg-gray-50 rounded-lg p-4 flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            {item.isbnMaster?.imageUrl ? (
                              <img 
                                src={item.isbnMaster.imageUrl} 
                                alt={`${item.isbnMaster.binding || 'Product'} cover`}
                                className="h-16 w-12 object-cover rounded shadow-sm"
                              />
                            ) : (
                              <div className="h-16 w-12 bg-gray-200 rounded shadow-sm flex items-center justify-center">
                                {item.isbnMaster?.binding === 'CD' ? (
                                  <Music className="h-6 w-6 text-gray-400" />
                                ) : item.isbnMaster?.binding === 'DVD' ? (
                                  <Play className="h-6 w-6 text-gray-400" />
                                ) : (
                                <BookOpen className="h-6 w-6 text-gray-400" />
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {formatItemTitle(item)}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {formatItemAuthor(item)}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-xs font-bold text-purple-600">
                                ID: #{item.id}
                              </span>
                              <span className="text-xs text-gray-500">
                                ISBN: {item.isbn}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(item.currentStatus)}`}>
                                {item.currentStatus}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleRemoveItemFromLot(item.id, editingLot.lotNumber)}
                            className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50"
                            title="Remove from lot"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {editingLot.items.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <Package2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No items left in this lot</p>
                          <p className="text-sm">The lot will be automatically deleted when empty</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Lots List View */
                  <div>
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">All Lots</h3>
                      <p className="text-sm text-gray-600">
                        Manage your item lots. Items in lots are tracked together for location changes, listing, and sales.
                      </p>
                    </div>

                    {isLoadingLots ? (
                      <div className="text-center py-12">
                        <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
                        <p className="text-gray-600">Loading lots...</p>
                      </div>
                    ) : allLots.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Package2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No lots created yet</p>
                        <p className="text-sm">Create your first lot using the "Create Lot" button</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {allLots.map((lot) => (
                          <div key={lot.lotNumber} className="bg-gray-50 rounded-lg p-6 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="bg-purple-100 p-3 rounded-lg">
                                <Package2 className="h-6 w-6 text-purple-600" />
                              </div>
                              <div>
                                <h4 className="text-lg font-medium text-gray-900">
                                  Lot #{lot.lotNumber}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {lot.itemCount} items • Created {formatDate(lot.createdAt)}
                                </p>
                                <div className="flex items-center space-x-4 mt-1">
                                  <span className="text-xs text-gray-500">
                                    Sample items: {lot.sampleTitles.slice(0, 2).join(', ')}
                                    {lot.sampleTitles.length > 2 && ` and ${lot.sampleTitles.length - 2} more...`}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handlePrintLabel({
                                  lotNumber: lot.lotNumber,
                                  itemCount: lot.itemCount,
                                  createdAt: lot.createdAt
                                })}
                                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 font-medium text-sm"
                                title="Print lot label"
                              >
                                <svg className="h-4 w-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                                </svg>
                                Print
                              </button>
                              <button
                                onClick={() => {
                                  // Fetch full lot details for editing
                                  apiCall(`/api/lots/${lot.lotNumber}`)
                                    .then(res => res.json())
                                    .then(result => {
                                      if (result.success) {
                                        setEditingLot({
                                          ...result.data,
                                          createdAt: lot.createdAt
                                        });
                                      }
                                    });
                                }}
                                className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
                              >
                                <Edit3 className="h-4 w-4 inline mr-1" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete Lot #${lot.lotNumber}? This will ungroup all ${lot.itemCount} items.`)) {
                                    handleDeleteLot(lot.lotNumber);
                                  }
                                }}
                                disabled={isDeletingLot === lot.lotNumber}
                                className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isDeletingLot === lot.lotNumber ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 inline mr-1 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                <Trash2 className="h-4 w-4 inline mr-1" />
                                Delete
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Pagination Controls */}
                    {lotTotalPages > 1 && (
                      <div className="mt-6 flex items-center justify-between border-t pt-4">
                        <div className="flex items-center text-sm text-gray-700">
                          <span>
                            Showing {((lotCurrentPage - 1) * 20) + 1} to {Math.min(lotCurrentPage * 20, lotTotalCount)} of {lotTotalCount} lots
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => fetchAllLots(lotCurrentPage - 1)}
                            disabled={lotCurrentPage === 1 || isLoadingLots}
                            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: Math.min(5, lotTotalPages) }, (_, i) => {
                              const pageNum = Math.max(1, Math.min(lotTotalPages - 4, lotCurrentPage - 2)) + i;
                              if (pageNum > lotTotalPages) return null;
                              
                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => fetchAllLots(pageNum)}
                                  disabled={isLoadingLots}
                                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                                    pageNum === lotCurrentPage
                                      ? 'bg-purple-600 text-white'
                                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                          </div>
                          
                          <button
                            onClick={() => fetchAllLots(lotCurrentPage + 1)}
                            disabled={lotCurrentPage === lotTotalPages || isLoadingLots}
                            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && createdLot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Lot Created Successfully!</h3>
                    <p className="text-sm text-gray-500">Your lot has been created and items have been grouped.</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Lot Number:</span>
                    <span className="text-lg font-bold text-purple-600">#{createdLot.lotNumber}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Items in Lot:</span>
                    <span className="text-sm font-semibold text-gray-900">{createdLot.itemCount} items</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Created:</span>
                    <span className="text-sm text-gray-900">{formatDate(createdLot.createdAt)}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handlePrintLabel(createdLot)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                    </svg>
                    Print Label
                  </button>
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      setCreatedLot(null);
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Done
                  </button>
                </div>

                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    💡 Tip: You can also print labels later from the "Manage Lots" section
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COG (Cost of Goods) Modal */}
        {showCOGModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Cost of Goods Calculation</h2>
                <button
                  onClick={resetCOGModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Intake Date
                    </label>
                    <input
                      type="date"
                      value={cogData.startDate}
                      onChange={(e) => setCogData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={isProcessingCOG}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Intake Date
                    </label>
                    <input
                      type="date"
                      value={cogData.endDate}
                      onChange={(e) => setCogData(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={isProcessingCOG}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Amount Spent ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={cogData.totalSpent}
                      onChange={(e) => setCogData(prev => ({ ...prev, totalSpent: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={isProcessingCOG}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Average Cost Calculation</p>
                      <p>The total amount will be divided equally among all items within the date range.</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={resetCOGModal}
                    disabled={isProcessingCOG}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCOGProcessing}
                    disabled={isProcessingCOG || !cogData.startDate || !cogData.endDate || !cogData.totalSpent}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isProcessingCOG ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 mr-2" />
                        Calculate COG
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COG Success Modal */}
        {cogSuccess && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">COG Updated Successfully!</h3>
                    <p className="text-sm text-gray-500">Cost of goods has been calculated and applied.</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Date Range:</span>
                      <span className="text-gray-900">
                        {formatDate(cogSuccess.startDate)} - {formatDate(cogSuccess.endDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Total Amount:</span>
                      <span className="text-gray-900">${cogSuccess.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Items Updated:</span>
                      <span className="text-gray-900">{cogSuccess.itemsUpdated} items</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Average per Item:</span>
                      <span className="text-lg font-bold text-green-600">
                        ${cogSuccess.averagePerItem.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/reporting"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    View Reports
                  </Link>
                  <button
                    onClick={() => setCogSuccess(null)}
                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Update Dates Modal */}
        {showUpdateDatesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">
                  {updateDatesStep === 'type' && 'Update Item Dates'}
                  {updateDatesStep === 'items' && 'Enter Item IDs'}
                  {updateDatesStep === 'date' && 'Select Date'}
                  {updateDatesStep === 'success' && 'Update Complete'}
                </h2>
                <button
                  onClick={resetUpdateDatesModal}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={isProcessingDates}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {/* Step 1: Date Type Selection */}
              {updateDatesStep === 'type' && (
                <div className="p-6">
                  <p className="text-gray-600 mb-6">
                    Are you entering a Listed Date or Sold Date for items?
                  </p>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setUpdateDatesData(prev => ({ ...prev, dateType: 'listed' }));
                        setUpdateDatesStep('items');
                      }}
                      className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-orange-100 rounded-full mr-3 flex items-center justify-center">
                          <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">Listed Date</div>
                          <div className="text-sm text-gray-500">Items being marked as listed</div>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => {
                        setUpdateDatesData(prev => ({ ...prev, dateType: 'sold' }));
                        setUpdateDatesStep('items');
                      }}
                      className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-green-100 rounded-full mr-3 flex items-center justify-center">
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">Sold Date</div>
                          <div className="text-sm text-gray-500">Items being marked as sold</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Item IDs Input */}
              {updateDatesStep === 'items' && (
                <div className="p-6">
                  <div className="mb-4">
                    <div className="flex items-center mb-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        updateDatesData.dateType === 'listed' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {updateDatesData.dateType === 'listed' ? 'Listed Date' : 'Sold Date'}
                      </span>
                    </div>
                    <p className="text-gray-600">
                      Enter the item IDs separated by commas
                    </p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Item IDs (e.g. 7, 3, 10)
                    </label>
                    <input
                      type="text"
                      placeholder="7, 3, 10"
                      value={updateDatesData.itemIds}
                      onChange={(e) => setUpdateDatesData(prev => ({ ...prev, itemIds: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      autoFocus
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">Example: 7, 3, 10</p>
                        <p>Enter multiple item IDs separated by commas. Spaces are optional.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between space-x-3">
                    <button
                      onClick={() => setUpdateDatesStep('type')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setUpdateDatesStep('date')}
                      disabled={!updateDatesData.itemIds.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Date Selection */}
              {updateDatesStep === 'date' && (
                <div className="p-6">
                  <div className="mb-4">
                    <div className="flex items-center mb-2 space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        updateDatesData.dateType === 'listed' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {updateDatesData.dateType === 'listed' ? 'Listed Date' : 'Sold Date'}
                      </span>
                      <span className="text-xs text-gray-500">
                        Items: {updateDatesData.itemIds}
                      </span>
                    </div>
                    <p className="text-gray-600">
                      Select the {updateDatesData.dateType} date for these items
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {updateDatesData.dateType === 'listed' ? 'Listed' : 'Sold'} Date
                    </label>
                    <input
                      type="date"
                      value={updateDatesData.date}
                      onChange={(e) => setUpdateDatesData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}
                  
                  <div className="flex justify-between space-x-3">
                    <button
                      onClick={() => {
                        setUpdateDatesStep('items');
                        setError('');
                      }}
                      disabled={isProcessingDates}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleUpdateDatesProcessing}
                      disabled={isProcessingDates || !updateDatesData.date}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {isProcessingDates ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Update Dates
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Success */}
              {updateDatesStep === 'success' && updateDatesResult && (
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">Dates Updated Successfully!</h3>
                      <p className="text-sm text-gray-500">
                        {updateDatesResult.itemsUpdated} items have been updated.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Date Type:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          updateDatesData.dateType === 'listed' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {updateDatesData.dateType === 'listed' ? 'Listed Date' : 'Sold Date'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Date Set:</span>
                        <span className="text-gray-900">{formatDate(updateDatesData.date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Items Updated:</span>
                        <span className="text-gray-900">{updateDatesResult.itemsUpdated} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Status Changes:</span>
                        <span className="text-gray-900">{updateDatesResult.statusChanges} items</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={resetUpdateDatesModal}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
