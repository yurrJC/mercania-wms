'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { apiCall } from '../../utils/api';

export default function DebugPage() {
  const [apiTest, setApiTest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const testAPI = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Testing API connection...');
      
      // Test direct API
      const response = await apiCall('http://localhost:3001/api/items');
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      setApiTest(data);
    } catch (err: any) {
      console.error('API Test Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    testAPI();
  }, []);

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
              <h1 className="text-2xl font-bold text-gray-900">API Debug</h1>
            </div>
            <button
              onClick={testAPI}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              <RefreshCw className="h-4 w-4 inline mr-2" />
              Test Again
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* API Test Results */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">API Connection Test</h2>
          
          {isLoading && (
            <div className="flex items-center text-blue-600">
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Testing API connection...
            </div>
          )}

          {error && (
            <div className="flex items-start text-red-600">
              <XCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">API Error:</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && apiTest && (
            <div className="space-y-4">
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                API Connection Successful!
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Response Summary:</h3>
                <ul className="space-y-1 text-sm">
                  <li><strong>Success:</strong> {apiTest.success ? 'Yes' : 'No'}</li>
                  <li><strong>Total Items:</strong> {apiTest.data?.pagination?.total || 0}</li>
                  <li><strong>Items Retrieved:</strong> {apiTest.data?.items?.length || 0}</li>
                  <li><strong>Current Page:</strong> {apiTest.data?.pagination?.page || 1}</li>
                </ul>
              </div>

              {apiTest.data?.items?.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Sample Items:</h3>
                  <div className="space-y-2">
                    {apiTest.data.items.slice(0, 3).map((item: any) => (
                      <div key={item.id} className="text-sm bg-white p-2 rounded border">
                        <div><strong>ID:</strong> #{item.id}</div>
                        <div><strong>Title:</strong> {item.isbnMaster?.title || 'Unknown'}</div>
                        <div><strong>Status:</strong> {item.currentStatus}</div>
                        <div><strong>Date:</strong> {new Date(item.intakeDate).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {apiTest.data?.items?.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">
                    <strong>No items found.</strong> Try adding some items through the 
                    <Link href="/intake" className="text-yellow-900 underline ml-1">intake page</Link>.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Raw Response */}
        {!isLoading && apiTest && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Raw API Response</h2>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(apiTest, null, 2)}
            </pre>
          </div>
        )}

        {/* Navigation Links */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Quick Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/intake"
              className="block p-3 bg-white rounded-lg hover:bg-gray-50 text-center border"
            >
              <div className="font-medium text-gray-900">Add Items</div>
              <div className="text-sm text-gray-600">Go to Intake</div>
            </Link>
            <Link
              href="/inventory"
              className="block p-3 bg-white rounded-lg hover:bg-gray-50 text-center border"
            >
              <div className="font-medium text-gray-900">View Inventory</div>
              <div className="text-sm text-gray-600">See All Items</div>
            </Link>
            <Link
              href="/"
              className="block p-3 bg-white rounded-lg hover:bg-gray-50 text-center border"
            >
              <div className="font-medium text-gray-900">Dashboard</div>
              <div className="text-sm text-gray-600">Back to Home</div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
