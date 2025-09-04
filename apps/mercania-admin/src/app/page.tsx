'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  BookOpen, 
  Package, 
  Tag, 
  BarChart3, 
  Plus,
  TrendingUp,
  DollarSign,
  MapPin,
  FileText,
  Loader2,
  LogOut
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/api';

interface DashboardStats {
  totalItems: number;
  stored: number;
  listed: number;
  listedValue: number;
  statusBreakdown: Array<{
    status: string;
    count: number;
  }>;
}

export default function Dashboard() {
  const { logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    stored: 0,
    listed: 0,
    listedValue: 0,
    statusBreakdown: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await apiCall('http://localhost:3001/api/items/dashboard-stats');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard statistics');
        }
        
        const result = await response.json();
        if (result.success) {
          setStats(result.data);
          setLastUpdated(new Date().toISOString());
        } else {
          throw new Error(result.error || 'Failed to fetch dashboard statistics');
        }
      } catch (err) {
        console.error('Dashboard stats error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboard statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'INTAKE': 'bg-blue-100 text-blue-800',
      'STORED': 'bg-green-100 text-green-800',
      'LISTED': 'bg-yellow-100 text-yellow-800',
      'SOLD': 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Image
                src="/mercania2048x2048bluetext copy.png"
                alt="Mercania Logo"
                width={40}
                height={40}
                className="mr-3"
                style={{ background: 'transparent' }}
              />
              <h1 className="text-2xl font-bold text-gray-900">Mercania WMS</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </span>
              <button
                onClick={logout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <Link href="/" className="flex items-center px-3 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
            <Link href="/intake" className="flex items-center px-3 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent">
              <Plus className="h-4 w-4 mr-2" />
              Intake
            </Link>
            <Link href="/inventory" className="flex items-center px-3 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent">
              <Package className="h-4 w-4 mr-2" />
              Inventory
            </Link>
            <Link href="/putaway" className="flex items-center px-3 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent">
              <Tag className="h-4 w-4 mr-2" />
              Putaway
            </Link>
            <Link href="/listing-helper" className="flex items-center px-3 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent">
              <BarChart3 className="h-4 w-4 mr-2" />
              Listing Helper
            </Link>
            <Link href="/reporting" className="flex items-center px-3 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent">
              <FileText className="h-4 w-4 mr-2" />
              Reporting
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        
        {/* Welcome Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            <Image
              src="/mercania2048x2048bluetext copy.png"
              alt="Mercania Logo"
              width={60}
              height={60}
              className="rounded-lg mr-4 shadow-sm"
            />
            <div>
              <h2 className="text-xl font-semibold text-blue-900">Welcome to Mercania WMS! 🎉</h2>
              <p className="text-blue-700 mt-1">Your warehouse management system is now running successfully.</p>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-red-600 mr-3">⚠️</div>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error loading dashboard data</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalItems}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Stored</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.stored}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Tag className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Listed</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.listed}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cost of Goods Sold</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(stats.listedValue * 100)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Breakdown & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Status Breakdown</h3>
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : stats.statusBreakdown.length > 0 ? (
                stats.statusBreakdown.map(({ status, count }) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                      {status}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link href="/intake" className="flex items-center p-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <Plus className="h-4 w-4 mr-3 text-blue-600" />
                Start Item Intake
              </Link>
              <Link href="/inventory" className="flex items-center p-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <Package className="h-4 w-4 mr-3 text-blue-600" />
                View Inventory
              </Link>
              <Link href="/listing-helper" className="flex items-center p-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <BarChart3 className="h-4 w-4 mr-3 text-blue-600" />
                Listing Helper
              </Link>
              <Link href="/reporting" className="flex items-center p-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <TrendingUp className="h-4 w-4 mr-3 text-blue-600" />
                View Reports
              </Link>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">🚀 Next Steps</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">1. Try Item Intake</h4>
              <p className="text-sm text-gray-600">
                <Link href="/intake" className="text-blue-600 hover:text-blue-700">
                  Start the intake process →
                </Link>
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">2. Test Workflows</h4>
              <p className="text-sm text-gray-600">Try the Intake → Putaway → Listing process</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">3. Add Sample Data</h4>
              <p className="text-sm text-gray-600">Create test books to explore the system</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">4. View Reports</h4>
              <p className="text-sm text-gray-600">Explore inventory analytics and insights</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}