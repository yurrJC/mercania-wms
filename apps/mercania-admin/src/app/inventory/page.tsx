'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Plus,
  RefreshCw,
  Trash2,
  X,
  AlertTriangle,
  Package2,
  Settings,
  Edit3
} from 'lucide-react';

interface Item {
  id: number;
  isbn: string;
  conditionGrade: string;
  conditionNotes: string;
  costCents: number;
  intakeDate: string;
  currentStatus: string;
  currentLocation: string | null;
  lotNumber: number | null;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showLotModal, setShowLotModal] = useState(false);
  const [lotItems, setLotItems] = useState<Item[]>([]);
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [isCreatingLot, setIsCreatingLot] = useState(false);
  const [showManageLotsModal, setShowManageLotsModal] = useState(false);
  const [allLots, setAllLots] = useState<any[]>([]);
  const [editingLot, setEditingLot] = useState<any>(null);
  const [isLoadingLots, setIsLoadingLots] = useState(false);

  // Fetch inventory data
  const fetchInventory = async (page = 1, status = '', search = '') => {
    setIsLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (status) params.append('status', status);
      
      // Smart search: determine if it's an ID or ISBN
      if (search) {
        const trimmedSearch = search.trim();
        const isNumeric = /^\d+$/.test(trimmedSearch);
        
        if (isNumeric && trimmedSearch.length <= 6) {
          // It's a short number (1-6 digits), likely an internal ID
          params.append('search', trimmedSearch);
        } else {
          // It's either non-numeric or a long number (likely ISBN) - use isbn parameter
          params.append('isbn', trimmedSearch);
        }
      }

      const response = await fetch(`/api/items?${params.toString()}`);
      
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

  // Load data on mount and when filters change
  useEffect(() => {
    fetchInventory(currentPage, statusFilter, searchTerm);
  }, [currentPage, statusFilter, searchTerm]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchInventory(1, statusFilter, searchTerm);
  };

  // Handle status filter change
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Format currency
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Handle item deletion
  const handleDeleteItem = async (item: Item) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/items/${item.id}`, {
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
      const response = await fetch(`/api/items/${item.id}`);
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

      const response = await fetch(url);
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

      const response = await fetch('/api/lots', {
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

  // Fetch all lots
  const fetchAllLots = async () => {
    setIsLoadingLots(true);
    try {
      const response = await fetch('/api/lots');
      const result = await response.json();
      
      if (result.success) {
        setAllLots(result.data);
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
    await fetchAllLots();
    // Also refresh inventory to ensure consistency
    await fetchInventory(currentPage, statusFilter, searchTerm);
  };

  // Delete entire lot
  const handleDeleteLot = async (lotNumber: number) => {
    try {
      const response = await fetch(`/api/lots/${lotNumber}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorResult = await response.json();
        setError(errorResult.error || `Failed to delete lot (${response.status})`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        // 1. Remove lot from the list
        setAllLots(prev => prev.filter(lot => lot.lotNumber !== lotNumber));
        
        // 2. Update all visible inventory items that were in this lot
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
        
        // 3. For items not visible on current page, they'll be updated when/if they're loaded
        // No need to refresh entire inventory - lot column will show correctly when items appear
      } else {
        setError(result.error || 'Failed to delete lot');
      }
    } catch (err) {
      console.error('Delete lot error:', err);
      setError('Failed to delete lot');
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
      
      const response = await fetch(`/api/lots/${lotNumber}/remove`, {
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
            const response = await fetch(`/api/items/${itemId}`);
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
      case 'LISTED': return 'bg-green-100 text-green-800';
      case 'SOLD': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              <Package className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/intake"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                <Plus className="h-4 w-4 inline mr-2" />
                Add New Item
              </Link>
              <button
                onClick={() => setShowLotModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
              >
                <Package2 className="h-4 w-4 inline mr-2" />
                Create Lot
              </button>
              <button
                onClick={openManageLotsModal}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium"
              >
                <Settings className="h-4 w-4 inline mr-2" />
                Manage Lots
              </button>
              <button
                onClick={() => fetchInventory(currentPage, statusFilter, searchTerm)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
              >
                <RefreshCw className="h-4 w-4 inline mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        
        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by ID or ISBN..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter item ID (1-6 digits, e.g., "9") or ISBN (10-13 digits, e.g., "9780812693768")
              </p>
            </form>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="INTAKE">Intake</option>
                <option value="STORED">Stored</option>
                <option value="LISTED">Listed</option>
                <option value="SOLD">Sold</option>
              </select>
            </div>
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
              {searchTerm || statusFilter 
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Book Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Condition
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Intake Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventoryData.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-lg font-bold text-gray-900">#{item.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              {item.isbnMaster?.imageUrl ? (
                                <img 
                                  src={item.isbnMaster.imageUrl} 
                                  alt="Book cover"
                                  className="h-16 w-12 object-cover rounded"
                                />
                              ) : (
                                <div className="h-16 w-12 bg-gray-200 rounded flex items-center justify-center">
                                  <BookOpen className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {item.isbnMaster?.title || 'Unknown Title'}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {item.isbnMaster?.author || 'Unknown Author'}
                              </p>
                              <p className="text-xs text-gray-400">
                                ISBN: {item.isbn}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {item.conditionGrade || 'Not Set'}
                          </div>
                          {item.conditionNotes && (
                            <div className="text-xs text-gray-500 truncate max-w-32">
                              {item.conditionNotes}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.currentStatus)}`}>
                            {item.currentStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.currentLocation ? (
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                              {item.currentLocation}
                            </div>
                          ) : (
                            <span className="text-gray-400">Not assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.lotNumber ? (
                            <div className="flex items-center">
                              <Package2 className="h-4 w-4 text-purple-400 mr-1" />
                              <span className="text-purple-600 font-medium">#{item.lotNumber}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Individual</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                            {formatCurrency(item.costCents)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                            {formatDate(item.intakeDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
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
                          alt="Book cover"
                          className="h-32 w-24 object-cover rounded shadow-md"
                        />
                      ) : (
                        <div className="h-32 w-24 bg-gray-200 rounded shadow-md flex items-center justify-center">
                          <BookOpen className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {selectedItem.isbnMaster?.title || 'Unknown Title'}
                        </h3>
                        <p className="text-gray-600 mb-1">
                          <span className="font-medium">Author:</span> {selectedItem.isbnMaster?.author || 'Unknown'}
                        </p>
                        <p className="text-gray-600 mb-1">
                          <span className="font-medium">Publisher:</span> {selectedItem.isbnMaster?.publisher || 'Unknown'}
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
                  </div>
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
                                  alt="Book cover"
                                  className="h-16 w-12 object-cover rounded shadow-sm"
                                />
                              ) : (
                                <div className="h-16 w-12 bg-gray-200 rounded shadow-sm flex items-center justify-center">
                                  <BookOpen className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {item.isbnMaster?.title || 'Unknown Title'}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {item.isbnMaster?.author || 'Unknown Author'}
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
                                alt="Book cover"
                                className="h-16 w-12 object-cover rounded shadow-sm"
                              />
                            ) : (
                              <div className="h-16 w-12 bg-gray-200 rounded shadow-sm flex items-center justify-center">
                                <BookOpen className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.isbnMaster?.title || 'Unknown Title'}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {item.isbnMaster?.author || 'Unknown Author'}
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
                                onClick={() => {
                                  // Fetch full lot details for editing
                                  fetch(`/api/lots/${lot.lotNumber}`)
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
                                className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 font-medium text-sm"
                              >
                                <Trash2 className="h-4 w-4 inline mr-1" />
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
