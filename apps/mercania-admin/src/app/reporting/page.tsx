'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiCall } from '../../utils/api';
import { 
  ArrowLeft,
  BarChart3,
  DollarSign,
  Calendar,
  TrendingUp,
  RefreshCw,
  Settings,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface COGRecord {
  id: number;
  recordDate: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  itemsUpdated: number;
  averagePerItem: number;
  createdAt: string;
}

interface COGData {
  records: COGRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface COGSSummary {
  allTime: {
    totalCostCents: number;
    totalItems: number;
    averageCostCents: number;
  };
  currentFinancialYear: {
    year: number;
    totalCostCents: number;
    totalItems: number;
    averageCostCents: number;
    yoyGrowthPercent: number;
    periodStart: string;
    periodEnd: string;
  };
}

interface COGSMonthlyData {
  financialYear: number;
  months: {
    month: number;
    monthName: string;
    totalCostCents: number;
    itemCount: number;
    averageCostCents: number;
  }[];
  yearTotal: {
    totalCostCents: number;
    totalItems: number;
  };
}

interface SalesSummary {
  allTime: {
    totalItemsSold: number;
  };
  currentFinancialYear: {
    financialYear: number;
    totalItemsSold: number;
    yoyGrowthPercent: number;
  };
  currentMonth: {
    month: string;
    year: number;
    totalItemsSold: number;
  };
}

interface SalesMonthlyData {
  financialYear: number;
  months: {
    month: number;
    monthName: string;
    totalItemsSold: number;
  }[];
  totalItemsSold: number;
}

interface RecentSalesData {
  recentSales: {
    id: number;
    isbn: string;
    title: string;
    author: string;
    soldDate: string;
  }[];
  timeline: {
    date: string;
    count: number;
  }[];
  totalRecentCount: number;
}

// Helper function to calculate current financial year
const getCurrentFinancialYear = (): number => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // getMonth() returns 0-11
  
  // If the month is July (7) or later, it's the current financial year
  // If the month is before July, it's the previous financial year
  return month >= 7 ? year + 1 : year;
};

export default function ReportingPage() {
  const [activeTab, setActiveTab] = useState<'cog' | 'cogs' | 'sales' | 'inventory'>('cog');
  const [cogData, setCogData] = useState<COGData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<COGRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // COGS-specific state
  const [cogsSummary, setCogsSummary] = useState<COGSSummary | null>(null);
  const [cogsMonthlyData, setCogsMonthlyData] = useState<COGSMonthlyData | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentFinancialYear());

  // Sales-specific state
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [salesMonthlyData, setSalesMonthlyData] = useState<SalesMonthlyData | null>(null);
  const [recentSalesData, setRecentSalesData] = useState<RecentSalesData | null>(null);
  const [selectedSalesYear, setSelectedSalesYear] = useState<number>(getCurrentFinancialYear());
  const [recentSalesDays, setRecentSalesDays] = useState<number>(30);

  // Inventory reports state
  const [locationData, setLocationData] = useState<{ location: string; count: number }[] | null>(null);
  const [locationTotal, setLocationTotal] = useState<number>(0);

  // Fetch COG records
  const fetchCOGRecords = async (page = 1) => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await apiCall(`http://localhost:3001/api/cog/records?page=${page}&limit=20`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch COG records');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setCogData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch COG records');
      }
      
    } catch (err) {
      console.error('COG records fetch error:', err);
      setError('Failed to load COG records. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch COGS summary data
  const fetchCOGSSummary = async () => {
    try {
      const response = await apiCall('http://localhost:3001/api/cogs/summary');
      if (!response.ok) throw new Error('Failed to fetch COGS summary');
      
      const result = await response.json();
      if (result.success) {
        setCogsSummary(result.data);
      }
    } catch (err) {
      console.error('COGS summary fetch error:', err);
      setError('Failed to load COGS summary. Please try again.');
    }
  };

  // Fetch COGS monthly data
  const fetchCOGSMonthlyData = async (year: number) => {
    try {
      const response = await apiCall(`http://localhost:3001/api/cogs/monthly?year=${year}`);
      if (!response.ok) throw new Error('Failed to fetch COGS monthly data');
      
      const result = await response.json();
      if (result.success) {
        setCogsMonthlyData(result.data);
      }
    } catch (err) {
      console.error('COGS monthly data fetch error:', err);
      setError('Failed to load COGS monthly data. Please try again.');
    }
  };

  // Fetch Sales summary data
  const fetchSalesSummary = async () => {
    try {
      const response = await apiCall('http://localhost:3001/api/sales/summary');
      if (!response.ok) throw new Error('Failed to fetch sales summary');
      
      const result = await response.json();
      if (result.success) {
        setSalesSummary(result.data);
      }
    } catch (err) {
      console.error('Sales summary fetch error:', err);
      setError('Failed to load sales summary. Please try again.');
    }
  };

  // Fetch Sales monthly data
  const fetchSalesMonthlyData = async (year: number) => {
    try {
      const response = await apiCall(`http://localhost:3001/api/sales/monthly?year=${year}`);
      if (!response.ok) throw new Error('Failed to fetch sales monthly data');
      
      const result = await response.json();
      if (result.success) {
        setSalesMonthlyData(result.data);
      }
    } catch (err) {
      console.error('Sales monthly data fetch error:', err);
      setError('Failed to load sales monthly data. Please try again.');
    }
  };

  // Fetch Recent sales data
  const fetchRecentSalesData = async (days: number) => {
    try {
      const response = await apiCall(`http://localhost:3001/api/sales/recent?days=${days}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch recent sales');
      
      const result = await response.json();
      if (result.success) {
        setRecentSalesData(result.data);
      }
    } catch (err) {
      console.error('Recent sales fetch error:', err);
      setError('Failed to load recent sales. Please try again.');
    }
  };

  // Load data when tab is active
  useEffect(() => {
    if (activeTab === 'cog') {
      fetchCOGRecords(currentPage);
    } else if (activeTab === 'cogs') {
      setIsLoading(true);
      Promise.all([
        fetchCOGSSummary(),
        fetchCOGSMonthlyData(selectedYear)
      ]).finally(() => setIsLoading(false));
    } else if (activeTab === 'sales') {
      setIsLoading(true);
      Promise.all([
        fetchSalesSummary(),
        fetchSalesMonthlyData(selectedSalesYear),
        fetchRecentSalesData(recentSalesDays)
      ]).finally(() => setIsLoading(false));
    }
    else if (activeTab === 'inventory') {
      setIsLoading(true);
      apiCall('http://localhost:3001/api/reports/inventory-by-location')
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            setLocationData(res.data.locations);
            setLocationTotal(res.data.totalItems);
          }
        })
        .catch(() => setError('Failed to load inventory by location'))
        .finally(() => setIsLoading(false));
    }
  }, [activeTab, currentPage, selectedYear, selectedSalesYear, recentSalesDays]);

  // Handle COG record deletion
  const handleDeleteCOGRecord = async (record: COGRecord) => {
    setIsDeleting(true);
    setError('');

    try {
      const response = await apiCall(`http://localhost:3001/api/cog/records/${record.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete COG record');
      }

      const result = await response.json();

      if (result.success) {
        // Remove record from current data
        setCogData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            records: prev.records.filter(r => r.id !== record.id),
            pagination: {
              ...prev.pagination,
              total: prev.pagination.total - 1
            }
          };
        });
        
        setShowDeleteConfirm(null);
        
        // Show success message (you might want to add a success state)
        console.log(`COG record deleted: ${result.data.itemsReset} items reset to $0.00`);
      } else {
        throw new Error(result.error || 'Failed to delete COG record');
      }
    } catch (err) {
      console.error('Delete COG record error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete COG record');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Format date and time
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
                <BarChart3 className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Reporting</h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (activeTab === 'cog') {
                    fetchCOGRecords(currentPage);
                  }
                }}
                className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium transition-colors flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="py-6 px-6 sm:px-8 lg:px-10">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('cog')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'cog'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Cost of Goods (COG)
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('cogs')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'cogs'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Cost of Goods Sold (COGS)
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('sales')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sales'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Sales Reports
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('inventory')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'inventory'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  Inventory Reports
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* COG Tab Content */}
        {activeTab === 'cog' && (
          <div className="space-y-6">
            {/* COG Summary Stats */}
            {cogData && cogData.records.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">COG Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-indigo-600">Total Records</div>
                    <div className="text-2xl font-bold text-indigo-900">{cogData.pagination.total}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-green-600">Total Spent</div>
                    <div className="text-2xl font-bold text-green-900">
                      {formatCurrency(cogData.records.reduce((sum, record) => sum + record.totalAmount, 0))}
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-blue-600">Items Updated</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {cogData.records.reduce((sum, record) => sum + record.itemsUpdated, 0)}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-purple-600">Avg Per Item</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {cogData.records.length > 0 ? formatCurrency(
                        cogData.records.reduce((sum, record) => sum + record.averagePerItem, 0) / cogData.records.length
                      ) : '$0.00'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* COG Records Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">COG Records</h3>
                <p className="text-sm text-gray-600">Line-by-line adjustments made to cost of goods</p>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="p-8 text-center">
                  <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading COG records...</p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="p-8">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && cogData && cogData.records.length === 0 && (
                <div className="p-12 text-center">
                  <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No COG Records Found</h3>
                  <p className="text-gray-600 mb-6">
                    You haven't created any cost of goods calculations yet.
                  </p>
                  <Link
                    href="/inventory"
                    className="inline-flex items-center bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    <Settings className="h-5 w-5 mr-2" />
                    Go to Inventory
                  </Link>
                </div>
              )}

              {/* COG Records Table */}
              {!isLoading && !error && cogData && cogData.records.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date of Record
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Intake Start Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Intake Stop Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Items Updated
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Average per Item
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {cogData.records.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDateTime(record.recordDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(record.startDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(record.endDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatCurrency(record.totalAmount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.itemsUpdated} items
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                              {formatCurrency(record.averagePerItem)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => setShowDeleteConfirm(record)}
                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                title="Delete COG record and reset item costs"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {cogData.pagination.pages > 1 && (
                    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                      <div className="flex-1 flex justify-between sm:hidden">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(Math.min(cogData.pagination.pages, currentPage + 1))}
                          disabled={currentPage === cogData.pagination.pages}
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
                              {((currentPage - 1) * cogData.pagination.limit) + 1}
                            </span>{' '}
                            to{' '}
                            <span className="font-medium">
                              {Math.min(currentPage * cogData.pagination.limit, cogData.pagination.total)}
                            </span>{' '}
                            of{' '}
                            <span className="font-medium">{cogData.pagination.total}</span>{' '}
                            records
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
                              Page {currentPage} of {cogData.pagination.pages}
                            </span>
                            <button
                              onClick={() => setCurrentPage(Math.min(cogData.pagination.pages, currentPage + 1))}
                              disabled={currentPage === cogData.pagination.pages}
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
            </div>
          </div>
        )}

        {/* COGS Tab Content */}
        {activeTab === 'cogs' && (
          <div className="space-y-6">
            {/* COGS Summary Cards */}
            {cogsSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* All Time COGS */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">All Time COGS</h3>
                  <div className="text-2xl font-bold text-gray-900">
                    ${(cogsSummary.allTime.totalCostCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {cogsSummary.allTime.totalItems.toLocaleString()} items sold
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Avg: ${(cogsSummary.allTime.averageCostCents / 100).toFixed(2)} per item
                  </p>
                </div>

                {/* Current Financial Year COGS */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">FY {cogsSummary.currentFinancialYear.year} COGS</h3>
                  <div className="text-2xl font-bold text-gray-900">
                    ${(cogsSummary.currentFinancialYear.totalCostCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {cogsSummary.currentFinancialYear.totalItems.toLocaleString()} items sold
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Avg: ${(cogsSummary.currentFinancialYear.averageCostCents / 100).toFixed(2)} per item
                  </p>
                </div>

                {/* YoY Growth */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">YoY Growth</h3>
                  <div className={`text-2xl font-bold ${
                    cogsSummary.currentFinancialYear.yoyGrowthPercent >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {cogsSummary.currentFinancialYear.yoyGrowthPercent >= 0 ? '+' : ''}
                    {cogsSummary.currentFinancialYear.yoyGrowthPercent.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    vs Previous FY
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Financial year ends June 30
                  </p>
                </div>

                {/* Period Information */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Current Period</h3>
                  <div className="text-lg font-semibold text-gray-900">
                    Jul {cogsSummary.currentFinancialYear.year - 1} -
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    Jun {cogsSummary.currentFinancialYear.year}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Financial Year {cogsSummary.currentFinancialYear.year}
                  </p>
                </div>
              </div>
            )}

            {/* Monthly COGS Chart */}
            {cogsMonthlyData && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Monthly Cost of Goods Sold - FY {cogsMonthlyData.financialYear}
                  </h3>
                  <div className="flex items-center space-x-4">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value={getCurrentFinancialYear()}>FY {getCurrentFinancialYear()}</option>
                      <option value={getCurrentFinancialYear() - 1}>FY {getCurrentFinancialYear() - 1}</option>
                      <option value={getCurrentFinancialYear() - 2}>FY {getCurrentFinancialYear() - 2}</option>
                    </select>
                  </div>
                </div>

                {/* Simple Bar Chart */}
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 mb-2">
                    {cogsMonthlyData.months.map((month) => (
                      <div key={month.month} className="text-center truncate">
                        {month.monthName.slice(0, 3)}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-12 gap-2 h-64 items-end">
                    {cogsMonthlyData.months.map((month) => {
                      const maxValue = Math.max(...cogsMonthlyData.months.map(m => m.totalCostCents));
                      const heightPercent = maxValue > 0 ? (month.totalCostCents / maxValue) * 100 : 0;
                      
                      return (
                        <div key={month.month} className="flex flex-col items-center h-full justify-end">
                          <div
                            className="w-full bg-green-500 rounded-t transition-all duration-300 hover:bg-green-600 group relative"
                            style={{ height: `${heightPercent}%`, minHeight: month.totalCostCents > 0 ? '4px' : '0px' }}
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                              <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap">
                                <div className="font-semibold">{month.monthName}</div>
                                <div>${(month.totalCostCents / 100).toFixed(2)}</div>
                                <div>{month.itemCount} items</div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs mt-1 text-center text-gray-700">
                            ${month.totalCostCents > 0 ? (month.totalCostCents / 100).toFixed(0) : '0'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="text-center text-sm text-gray-600 mt-4">
                    <strong>Total FY {cogsMonthlyData.financialYear}:</strong> ${(cogsMonthlyData.yearTotal.totalCostCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} 
                    ({cogsMonthlyData.yearTotal.totalItems.toLocaleString()} items)
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
                <p className="text-gray-600">Loading COGS data...</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && (!cogsSummary || cogsSummary.allTime.totalItems === 0) && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Sales Data</h3>
                <p className="text-gray-600">No items have been marked as sold yet. COGS tracking will begin when items are sold.</p>
              </div>
            )}
          </div>
        )}

        {/* Sales Tab Content */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            {/* Sales Summary Cards */}
            {salesSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* All Time Items Moved */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">All Time Items Moved</h3>
                  <div className="text-2xl font-bold text-green-600">
                    {salesSummary.allTime.totalItemsSold}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Total items sold from inventory
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Items successfully moved out
                  </p>
                </div>

                {/* Current Financial Year Items Moved */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">FY {salesSummary.currentFinancialYear.financialYear} Items Moved</h3>
                  <div className="text-2xl font-bold text-green-600">
                    {salesSummary.currentFinancialYear.totalItemsSold}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Items moved this financial year
                  </p>
                  <div className={`text-xs mt-1 ${
                    salesSummary.currentFinancialYear.yoyGrowthPercent >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {salesSummary.currentFinancialYear.yoyGrowthPercent >= 0 ? '+' : ''}
                    {salesSummary.currentFinancialYear.yoyGrowthPercent.toFixed(1)}% vs last year
                  </div>
                </div>

                {/* Current Month */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">This Month</h3>
                  <div className="text-2xl font-bold text-green-600">
                    {salesSummary.currentMonth.totalItemsSold}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Items moved in {salesSummary.currentMonth.month}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {salesSummary.currentMonth.month} {salesSummary.currentMonth.year}
                  </p>
                </div>
              </div>
            )}

            {/* Monthly Sales Chart */}
            {salesMonthlyData && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Monthly Items Moved - FY {salesMonthlyData.financialYear}
                  </h3>
                  <div className="flex items-center space-x-4">
                    <select
                      value={selectedSalesYear}
                      onChange={(e) => setSelectedSalesYear(parseInt(e.target.value))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value={getCurrentFinancialYear()}>FY {getCurrentFinancialYear()}</option>
                      <option value={getCurrentFinancialYear() - 1}>FY {getCurrentFinancialYear() - 1}</option>
                      <option value={getCurrentFinancialYear() - 2}>FY {getCurrentFinancialYear() - 2}</option>
                    </select>
                  </div>
                </div>

                {/* Sales Bar Chart */}
                <div className="space-y-6">
                  <div className="h-80 bg-gray-50 rounded-lg p-6">
                    <div className="flex items-end justify-between h-full space-x-1">
                      {salesMonthlyData.months.map((month) => {
                        const maxItems = Math.max(...salesMonthlyData.months.map(m => m.totalItemsSold));
                        const heightPercent = maxItems > 0 ? (month.totalItemsSold / maxItems) * 85 : 0; // Cap at 85% for better visuals
                        
                        return (
                          <div key={month.month} className="flex flex-col items-center h-full justify-end min-w-0 flex-1">
                            {/* Bar */}
                            <div
                              className="w-full bg-green-500 rounded-t-md transition-all duration-300 hover:bg-green-600 group relative mx-1"
                              style={{ 
                                height: `${heightPercent}%`, 
                                minHeight: month.totalItemsSold > 0 ? '8px' : '0px',
                                maxWidth: '40px'
                              }}
                            >
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10 shadow-lg">
                                <div className="font-semibold">{month.monthName} {salesMonthlyData.financialYear}</div>
                                <div>Items Moved: {month.totalItemsSold}</div>
                                {/* Arrow */}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                              </div>
                            </div>
                            
                            {/* Month Label */}
                            <div className="text-xs text-gray-600 mt-3 text-center font-medium">
                              {month.monthName.substring(0, 3)}
                            </div>
                            
                            {/* Value Label */}
                            {month.totalItemsSold > 0 && (
                              <div className="text-xs text-green-600 font-semibold mt-1">
                                {month.totalItemsSold}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Summary Footer */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-700">
                        Total FY {salesMonthlyData.financialYear}: {salesMonthlyData.totalItemsSold} Items Moved
                      </div>
                      <div className="text-sm text-green-600 mt-1">
                        Items successfully sold and removed from inventory
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Sales Timeline */}
            {recentSalesData && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Item Movement</h3>
                  <div className="flex items-center space-x-4">
                    <select
                      value={recentSalesDays}
                      onChange={(e) => setRecentSalesDays(parseInt(e.target.value))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value={7}>Last 7 days</option>
                      <option value={14}>Last 14 days</option>
                      <option value={30}>Last 30 days</option>
                      <option value={60}>Last 60 days</option>
                    </select>
                  </div>
                </div>

                {recentSalesData.timeline.length > 0 ? (
                  <div className="space-y-4">
                    {/* Timeline Bar Chart */}
                    <div className="h-40 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-end justify-between h-full space-x-1">
                        {recentSalesData.timeline.slice(-14).map((day) => { // Show last 14 days max
                          const maxCount = Math.max(...recentSalesData.timeline.map(d => d.count));
                          const heightPercent = maxCount > 0 ? (day.count / maxCount) * 85 : 0;
                          
                          return (
                            <div key={day.date} className="flex flex-col items-center h-full justify-end min-w-0 flex-1">
                              <div
                                className="w-full bg-green-400 rounded-t-md transition-all duration-300 hover:bg-green-500 group relative mx-0.5"
                                style={{ 
                                  height: `${heightPercent}%`, 
                                  minHeight: day.count > 0 ? '6px' : '0px',
                                  maxWidth: '30px'
                                }}
                              >
                                                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10 shadow-lg">
                                <div className="font-semibold">{new Date(day.date).toLocaleDateString()}</div>
                                <div>{day.count} items moved</div>
                                {/* Arrow */}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                              </div>
                              </div>
                              <div className="text-xs text-gray-600 mt-2 text-center">
                                {new Date(day.date).getDate()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {recentSalesData.totalRecentCount}
                        </div>
                        <div className="text-sm text-gray-600">Items Moved in Selected Period</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Items successfully sold and removed from inventory
                        </div>
                      </div>
                    </div>

                    {/* Recent Sales List */}
                    {recentSalesData.recentSales.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-md font-semibold text-gray-900 mb-4">Recently Moved Items</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Sold</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {recentSalesData.recentSales.slice(0, 10).map((sale) => (
                                <tr key={sale.id}>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{sale.title}</div>
                                      <div className="text-sm text-gray-500">{sale.author}</div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(sale.soldDate).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No sales in the selected period.</p>
                  </div>
                )}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading sales data...</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !salesSummary && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Sales Data</h3>
                <p className="text-gray-600">No items have been marked as sold yet. Sales tracking will begin when items are sold.</p>
          </div>
        )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error Loading Sales Data</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventory Tab Content */}
        {activeTab === 'inventory' && (
          <div className="space-y-8">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Inventory Location Analytics</h2>
                  <p className="text-purple-100">Real-time view of your stored inventory distribution</p>
                </div>
                <div className="hidden md:block">
                  <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                    <div className="text-sm text-purple-100">Status Filter</div>
                    <div className="text-lg font-semibold">STORED + LISTED</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Chart Section */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Inventory Distribution by Location</h3>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Alphabetical Order</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Live Data
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <InventoryByLocationChart />
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
                  <h3 className="text-lg font-medium text-gray-900">Delete COG Record</h3>
                </div>
                
                <p className="text-gray-600 mb-4">
                  Are you sure you want to delete this COG record? This will:
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>• Remove the COG record from reports</li>
                    <li>• Reset affected items' costs to $0.00</li>
                    <li>• This action cannot be undone</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Date Range:</span>
                      <span className="text-gray-900">
                        {formatDate(showDeleteConfirm.startDate)} - {formatDate(showDeleteConfirm.endDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Total Amount:</span>
                      <span className="text-gray-900">{formatCurrency(showDeleteConfirm.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Items Affected:</span>
                      <span className="text-gray-900">{showDeleteConfirm.itemsUpdated} items</span>
                    </div>
                  </div>
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
                    onClick={() => handleDeleteCOGRecord(showDeleteConfirm)}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Record
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Inline component: Inventory by Location Chart
function InventoryByLocationChart() {
  const [data, setData] = useState<{ location: string; count: number }[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    setError('');
    apiCall('http://localhost:3001/api/reports/inventory-by-location')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setData(res.data.locations);
          setTotal(res.data.totalItems);
        } else {
          setError('Failed to load inventory data');
        }
      })
      .catch(() => setError('Network error - please try again'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <div className="animate-pulse">
            <div className="h-2 bg-gray-200 rounded w-32 mx-auto mb-2"></div>
            <div className="h-2 bg-gray-200 rounded w-24 mx-auto"></div>
          </div>
        </div>
        <p className="text-gray-600 mt-4 font-medium">Loading inventory distribution...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <div className="text-red-400 mb-3">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-800 font-medium mb-1">Unable to Load Data</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 max-w-md mx-auto">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 9h.01M15 9h.01" />
            </svg>
          </div>
          <h3 className="text-gray-900 font-medium mb-2">No Stored Inventory</h3>
          <p className="text-gray-600 text-sm">No items with STORED status found in any locations.</p>
        </div>
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.count));

  return (
    <div className="space-y-6">
      {/* Chart Area */}
      <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-200 p-8 overflow-x-auto shadow-inner">
        <div className="flex items-end h-80 space-x-4 min-w-max">
          {data.map((row, index) => {
            const heightPct = max > 0 ? (row.count / max) * 85 : 0;
            const delay = index * 100; // Staggered animation
            
            return (
              <div key={row.location} className="flex flex-col items-center h-full justify-end group">
                {/* Bar */}
                <div
                  className="relative w-16 bg-gradient-to-t from-purple-600 to-purple-500 rounded-t-lg shadow-lg transition-all duration-500 hover:from-purple-700 hover:to-purple-600 hover:shadow-xl transform hover:scale-105"
                  style={{ 
                    height: `${heightPct}%`,
                    minHeight: row.count > 0 ? '12px' : '0px',
                    animationDelay: `${delay}ms`
                  }}
                >
                  {/* Subtle hover glow (keeps animation without popover/bubble) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-400 to-purple-300 rounded-t-lg opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                </div>
                
                {/* Location label */}
                <div className="mt-4 text-center">
                  <div className="text-sm font-semibold text-gray-800 mb-1">{row.location}</div>
                  <div className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-1">
                    {row.count} item{row.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Summary Footer */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-900">Total Inventory (Stored + Listed)</div>
              <div className="text-sm text-purple-600">Items with STORED or LISTED status across all locations</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-purple-700">{total}</div>
            <div className="text-sm text-purple-600">item{total !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
