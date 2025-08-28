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
  RefreshCw
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
  isbnMaster: {
    title: string;
    author: string;
    publisher: string;
    pubYear: number | null;
    binding: string;
    imageUrl: string | null;
  } | null;
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

  // Fetch inventory data
  const fetchInventory = async (page = 1, status = '', search = '') => {
    setIsLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (status) params.append('status', status);
      if (search) params.append('isbn', search);

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
                  placeholder="Search by ISBN..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
                          <button
                            onClick={() => window.alert(`Item #${item.id} details (feature coming soon)`)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
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
      </main>
    </div>
  );
}
