'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft,
  Scan,
  Hash,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Package,
  BarChart3
} from 'lucide-react';
import { useItemSearch } from '../../hooks/useItemSearch';
import { useClipboard } from '../../hooks/useClipboard';

export default function ListingHelperPage() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [internalIdInput, setInternalIdInput] = useState('');
  
  const {
    barcodeSearch,
    idSearch,
    searchByBarcode,
    searchById,
    resetBarcodeSearch,
    resetIdSearch
  } = useItemSearch();
  
  const { copySuccess, copyToClipboard } = useClipboard();

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on barcode input when component mounts
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  const handleBarcodeSearch = async (barcode: string) => {
    try {
      const itemData = await searchByBarcode(barcode);
      if (itemData) {
        // Auto-copy SKU to clipboard
        await copyToClipboard(itemData.sku, 'barcode');
      }
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleIdSearch = async (id: string) => {
    try {
      const itemData = await searchById(id);
      if (itemData) {
        // Auto-copy SKU to clipboard
        await copyToClipboard(itemData.sku, 'id');
      }
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleBarcodeKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSearch(barcodeInput);
    }
  };

  const handleIdKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleIdSearch(internalIdInput);
    }
  };

  const handleResetBarcodeSearch = () => {
    setBarcodeInput('');
    resetBarcodeSearch();
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const handleResetIdSearch = () => {
    setInternalIdInput('');
    resetIdSearch();
    if (idInputRef.current) {
      idInputRef.current.focus();
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'INTAKE': 'bg-blue-100 text-blue-800',
      'STORED': 'bg-green-100 text-green-800',
      'LISTED': 'bg-yellow-100 text-yellow-800',
      'SOLD': 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
              <BarChart3 className="h-8 w-8 text-green-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Listing Helper</h1>
            </div>
            <div className="text-sm text-gray-500">
              Find items quickly for listing
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <Package className="h-6 w-6 text-blue-600 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-blue-900 mb-2">How to Use Listing Helper</h2>
              <div className="text-blue-800 space-y-1">
                <p>1. Scan or enter a barcode/ISBN in the first field</p>
                <p>2. Or enter an internal ID (like #1, #2, etc.) in the second field</p>
                <p>3. The item SKU will be automatically copied to your clipboard when found</p>
                <p>4. Use the copied SKU in your listing platform</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Barcode Search */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-6">
              <Scan className="h-6 w-6 text-blue-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Search by Barcode</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-2">
                  Barcode / ISBN
                </label>
                <div className="flex space-x-3">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    id="barcode"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyPress={handleBarcodeKeyPress}
                    placeholder="Scan barcode or type ISBN..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                    disabled={barcodeSearch.loading}
                  />
                  <button
                    onClick={() => handleBarcodeSearch(barcodeInput)}
                    disabled={barcodeSearch.loading || !barcodeInput.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                  >
                    {barcodeSearch.loading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      'Search'
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  📷 Position barcode scanner here, or type manually
                </p>
              </div>

              {/* Barcode Search Results */}
              {barcodeSearch.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" />
                  <span className="text-red-700">{barcodeSearch.error}</span>
                </div>
              )}

              {barcodeSearch.data && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-green-900">Item Found!</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(barcodeSearch.data.currentStatus)}`}>
                      {barcodeSearch.data.currentStatus}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">ID:</span> #{barcodeSearch.data.id}</p>
                    <p><span className="font-medium">Title:</span> {barcodeSearch.data.title}</p>
                    <p><span className="font-medium">Author:</span> {barcodeSearch.data.author}</p>
                    {barcodeSearch.data.isbn && (
                      <p><span className="font-medium">ISBN:</span> {barcodeSearch.data.isbn}</p>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-white border border-green-300 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Generated SKU:</label>
                        <p className="text-lg font-mono font-bold text-green-700">{barcodeSearch.data.sku}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {copySuccess === 'barcode' ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-5 w-5 mr-1" />
                            <span className="text-sm">Copied!</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => copyToClipboard(barcodeSearch.data!.sku, 'barcode')}
                            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleResetBarcodeSearch}
                    className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Search Another Item
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Internal ID Search */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-6">
              <Hash className="h-6 w-6 text-purple-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Search by Internal ID</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="internalId" className="block text-sm font-medium text-gray-700 mb-2">
                  Internal ID
                </label>
                <div className="flex space-x-3">
                  <input
                    ref={idInputRef}
                    type="text"
                    id="internalId"
                    value={internalIdInput}
                    onChange={(e) => setInternalIdInput(e.target.value.replace(/\D/g, ''))}
                    onKeyPress={handleIdKeyPress}
                    placeholder="Enter internal ID number..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg font-mono"
                    disabled={idSearch.loading}
                  />
                  <button
                    onClick={() => handleIdSearch(internalIdInput)}
                    disabled={idSearch.loading || !internalIdInput.trim()}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                  >
                    {idSearch.loading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      'Search'
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  🔍 Enter just the number (e.g., 1, 2, 15, 123)
                </p>
              </div>

              {/* ID Search Results */}
              {idSearch.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" />
                  <span className="text-red-700">{idSearch.error}</span>
                </div>
              )}

              {idSearch.data && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-purple-900">Item Found!</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(idSearch.data.currentStatus)}`}>
                      {idSearch.data.currentStatus}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">ID:</span> #{idSearch.data.id}</p>
                    <p><span className="font-medium">Title:</span> {idSearch.data.title}</p>
                    <p><span className="font-medium">Author:</span> {idSearch.data.author}</p>
                    {idSearch.data.isbn && (
                      <p><span className="font-medium">ISBN:</span> {idSearch.data.isbn}</p>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-white border border-purple-300 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Generated SKU:</label>
                        <p className="text-lg font-mono font-bold text-purple-700">{idSearch.data.sku}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {copySuccess === 'id' ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-5 w-5 mr-1" />
                            <span className="text-sm">Copied!</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => copyToClipboard(idSearch.data!.sku, 'id')}
                            className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleResetIdSearch}
                    className="mt-3 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    Search Another Item
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Reference */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Quick Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">SKU Format:</h4>
              <ul className="text-gray-700 space-y-1">
                <li>• LOCATION-ID format</li>
                <li>• Example: B07-3</li>
                <li>• Example: TBD-123 (no location)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Search Tips:</h4>
              <ul className="text-gray-700 space-y-1">
                <li>• Press Enter to search</li>
                <li>• SKU auto-copies on success</li>
                <li>• Use barcode scanner for speed</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Status Meanings:</h4>
              <ul className="text-gray-700 space-y-1">
                <li>• INTAKE: Recently added</li>
                <li>• STORED: Ready to list</li>
                <li>• LISTED: Currently for sale</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
