'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft,
  Scan,
  MapPin,
  Package2,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  BookOpen,
  Package
} from 'lucide-react';

interface Item {
  id: number;
  isbn: string;
  currentLocation: string | null;
  lotNumber: number | null;
  currentStatus: string;
  isbnMaster?: {
    title: string;
    author: string;
    imageUrl: string | null;
  };
}

interface PutawaySession {
  type: 'item' | 'lot';
  identifier: string;
  items: Item[];
  targetLocation: string;
  timestamp: Date;
}

export default function PutawayPage() {
  const [mode, setMode] = useState<'select' | 'item' | 'lot'>('select');
  const [itemInput, setItemInput] = useState('');
  const [lotInput, setLotInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const [currentLot, setCurrentLot] = useState<{ lotNumber: number; items: Item[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sessions, setSessions] = useState<PutawaySession[]>([]);
  const [awaitingLocation, setAwaitingLocation] = useState(false);

  const itemInputRef = useRef<HTMLInputElement>(null);
  const lotInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Focus management
  useEffect(() => {
    if (mode === 'item' && itemInputRef.current) {
      itemInputRef.current.focus();
    } else if (mode === 'lot' && lotInputRef.current) {
      lotInputRef.current.focus();
    } else if (awaitingLocation && locationInputRef.current) {
      locationInputRef.current.focus();
    }
  }, [mode, awaitingLocation]);

  // Handle item lookup (barcode or internal ID)
  const handleItemLookup = async (identifier: string) => {
    if (!identifier) {
      setError('Please scan or enter an item identifier');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // First try by ID, then by ISBN/barcode
      let response = await fetch(`/api/items?search=${identifier}`);
      
      if (!response.ok) {
        throw new Error('Failed to lookup item');
      }

      const result = await response.json();
      
      if (!result.success || !result.data.items || result.data.items.length === 0) {
        throw new Error('Item not found');
      }

      const item = result.data.items[0];
      setCurrentItem(item);
      setAwaitingLocation(true);
      setSuccess(`Item found: ${item.isbnMaster?.title || 'Unknown Title'}`);

    } catch (err) {
      console.error('Item lookup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to lookup item');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle lot lookup
  const handleLotLookup = async (lotNumber: string) => {
    if (!lotNumber) {
      setError('Please scan or enter a lot number');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/lots/${lotNumber}`);
      
      if (!response.ok) {
        throw new Error('Lot not found');
      }

      const result = await response.json();
      
      if (!result.success || !result.data.items || result.data.items.length === 0) {
        throw new Error('Lot is empty or not found');
      }

      setCurrentLot({
        lotNumber: parseInt(lotNumber),
        items: result.data.items
      });
      setAwaitingLocation(true);
      setSuccess(`Lot #${lotNumber} found: ${result.data.items.length} items`);

    } catch (err) {
      console.error('Lot lookup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to lookup lot');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle location assignment
  const handleLocationAssignment = async (location: string) => {
    if (!location) {
      setError('Please scan or enter a location');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (mode === 'item' && currentItem) {
        // Update single item location
        const response = await fetch(`/api/items/${currentItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentLocation: location.toUpperCase() })
        });

        if (!response.ok) {
          throw new Error('Failed to update item location');
        }

        // Add to session history
        setSessions(prev => [...prev, {
          type: 'item',
          identifier: currentItem.id.toString(),
          items: [currentItem],
          targetLocation: location.toUpperCase(),
          timestamp: new Date()
        }]);

        const statusMessage = currentItem.currentStatus === 'INTAKE' 
          ? ` (Status: INTAKE → STORED)`
          : '';
        setSuccess(`✅ Item #${currentItem.id} assigned to ${location.toUpperCase()}${statusMessage}`);

      } else if (mode === 'lot' && currentLot) {
        // Update all items in lot
        const itemIds = currentLot.items.map(item => item.id);
        
        const response = await fetch('/api/items/bulk-location', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            itemIds, 
            currentLocation: location.toUpperCase() 
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update lot location');
        }

        // Add to session history
        setSessions(prev => [...prev, {
          type: 'lot',
          identifier: currentLot.lotNumber.toString(),
          items: currentLot.items,
          targetLocation: location.toUpperCase(),
          timestamp: new Date()
        }]);

        const intakeItems = currentLot.items.filter(item => item.currentStatus === 'INTAKE');
        const statusMessage = intakeItems.length > 0 
          ? ` (${intakeItems.length} items: INTAKE → STORED)`
          : '';
        setSuccess(`✅ Lot #${currentLot.lotNumber} (${currentLot.items.length} items) assigned to ${location.toUpperCase()}${statusMessage}`);
      }

      // Reset for next scan
      resetCurrentScan();

    } catch (err) {
      console.error('Location assignment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign location');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset current scan
  const resetCurrentScan = () => {
    setCurrentItem(null);
    setCurrentLot(null);
    setItemInput('');
    setLotInput('');
    setLocationInput('');
    setAwaitingLocation(false);
    setError('');

    // Refocus on appropriate input
    setTimeout(() => {
      if (mode === 'item' && itemInputRef.current) {
        itemInputRef.current.focus();
      } else if (mode === 'lot' && lotInputRef.current) {
        lotInputRef.current.focus();
      }
    }, 100);
  };

  // Handle keyboard events
  const handleItemKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleItemLookup(itemInput);
    }
  };

  const handleLotKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLotLookup(lotInput);
    }
  };

  const handleLocationKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLocationAssignment(locationInput);
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
              <Package className="h-8 w-8 text-green-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Putaway</h1>
            </div>
            <div className="text-sm text-gray-500">
              Assign locations to inventory
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* Mode Selection */}
        {mode === 'select' && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Putaway Mode</h2>
              <p className="text-gray-600">Select how you want to assign locations to inventory</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Individual Items Mode */}
              <button
                onClick={() => setMode('item')}
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
              >
                <div className="text-center">
                  <Scan className="h-12 w-12 text-blue-600 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Individual Items</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Scan barcodes or enter internal IDs to assign locations one by one
                  </p>
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                    Item by Item
                  </div>
                </div>
              </button>

              {/* Lot Mode */}
              <button
                onClick={() => setMode('lot')}
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors group"
              >
                <div className="text-center">
                  <Package2 className="h-12 w-12 text-purple-600 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Lot Putaway</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Enter lot numbers to assign locations to entire lots at once
                  </p>
                  <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium">
                    Batch Processing
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Item Mode */}
        {mode === 'item' && (
          <div className="space-y-6">
            {/* Mode Header */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Scan className="h-6 w-6 text-blue-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">Individual Item Putaway</h2>
                </div>
                <button
                  onClick={() => setMode('select')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
              <p className="text-gray-600 mt-2">Scan barcode or enter internal ID to assign location</p>
            </div>

            {/* Item Input */}
            {!awaitingLocation && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center mb-4">
                  <Scan className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Scan Item</h3>
                </div>
                
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label htmlFor="itemInput" className="block text-sm font-medium text-gray-700 mb-2">
                      Barcode or Internal ID
                    </label>
                    <input
                      ref={itemInputRef}
                      type="text"
                      id="itemInput"
                      value={itemInput}
                      onChange={(e) => setItemInput(e.target.value)}
                      onKeyPress={handleItemKeyPress}
                      placeholder="Scan barcode or type ID..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-mono"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      onClick={() => handleItemLookup(itemInput)}
                      disabled={isLoading || !itemInput}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    >
                      {isLoading ? 'Looking up...' : 'Lookup'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Current Item & Location Input */}
            {awaitingLocation && currentItem && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Item Details */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Item</h3>
                    <div className="flex items-start space-x-4">
                      {currentItem.isbnMaster?.imageUrl ? (
                        <img 
                          src={currentItem.isbnMaster.imageUrl} 
                          alt="Book cover"
                          className="h-20 w-16 object-cover rounded"
                        />
                      ) : (
                        <div className="h-20 w-16 bg-gray-200 rounded flex items-center justify-center">
                          <BookOpen className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">#{currentItem.id}</p>
                        <p className="text-sm text-gray-600">{currentItem.isbnMaster?.title || 'Unknown Title'}</p>
                        <p className="text-xs text-gray-500">{currentItem.isbnMaster?.author || 'Unknown Author'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Current: {currentItem.currentLocation || 'No location'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Location Input */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Location</h3>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="locationInput" className="block text-sm font-medium text-gray-700 mb-2">
                          Location Code
                        </label>
                        <input
                          ref={locationInputRef}
                          type="text"
                          id="locationInput"
                          value={locationInput}
                          onChange={(e) => setLocationInput(e.target.value.toUpperCase())}
                          onKeyPress={handleLocationKeyPress}
                          placeholder="e.g., A01, B05, C12..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg font-mono uppercase"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleLocationAssignment(locationInput)}
                          disabled={isLoading || !locationInput}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                        >
                          {isLoading ? 'Assigning...' : 'Assign Location'}
                        </button>
                        <button
                          onClick={resetCurrentScan}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lot Mode */}
        {mode === 'lot' && (
          <div className="space-y-6">
            {/* Mode Header */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Package2 className="h-6 w-6 text-purple-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">Lot Putaway</h2>
                </div>
                <button
                  onClick={() => setMode('select')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
              <p className="text-gray-600 mt-2">Enter lot number to assign location to entire lot</p>
            </div>

            {/* Lot Input */}
            {!awaitingLocation && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center mb-4">
                  <Package2 className="h-5 w-5 text-purple-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Scan Lot</h3>
                </div>
                
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label htmlFor="lotInput" className="block text-sm font-medium text-gray-700 mb-2">
                      Lot Number
                    </label>
                    <input
                      ref={lotInputRef}
                      type="text"
                      id="lotInput"
                      value={lotInput}
                      onChange={(e) => setLotInput(e.target.value.replace(/\D/g, ''))}
                      onKeyPress={handleLotKeyPress}
                      placeholder="Enter lot number..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg font-mono"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      onClick={() => handleLotLookup(lotInput)}
                      disabled={isLoading || !lotInput}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    >
                      {isLoading ? 'Looking up...' : 'Lookup'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Current Lot & Location Input */}
            {awaitingLocation && currentLot && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Lot Details */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Lot</h3>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <Package2 className="h-6 w-6 text-purple-600 mr-2" />
                        <span className="text-lg font-bold text-purple-900">Lot #{currentLot.lotNumber}</span>
                      </div>
                      <p className="text-purple-700 mb-3">{currentLot.items.length} items in this lot</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {currentLot.items.slice(0, 5).map((item) => (
                          <div key={item.id} className="text-xs text-purple-600">
                            #{item.id} - {item.isbnMaster?.title || 'Unknown Title'}
                          </div>
                        ))}
                        {currentLot.items.length > 5 && (
                          <div className="text-xs text-purple-500">
                            +{currentLot.items.length - 5} more items...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location Input */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Location</h3>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="locationInput" className="block text-sm font-medium text-gray-700 mb-2">
                          Location Code (for entire lot)
                        </label>
                        <input
                          ref={locationInputRef}
                          type="text"
                          id="locationInput"
                          value={locationInput}
                          onChange={(e) => setLocationInput(e.target.value.toUpperCase())}
                          onKeyPress={handleLocationKeyPress}
                          placeholder="e.g., A01, B05, C12..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg font-mono uppercase"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleLocationAssignment(locationInput)}
                          disabled={isLoading || !locationInput}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                        >
                          {isLoading ? 'Assigning...' : `Assign to ${currentLot.items.length} Items`}
                        </button>
                        <button
                          onClick={resetCurrentScan}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Session History */}
        {sessions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Putaway Activity</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {sessions.slice(-10).reverse().map((session, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    {session.type === 'item' ? (
                      <Scan className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Package2 className="h-4 w-4 text-purple-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {session.type === 'item' ? `Item #${session.identifier}` : `Lot #${session.identifier}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {session.items.length} item{session.items.length !== 1 ? 's' : ''} → {session.targetLocation}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {session.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Reference */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Putaway Quick Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-blue-800">Location Codes:</h4>
              <ul className="text-blue-700 mt-1 space-y-1">
                <li>• A01-A99: Aisle A</li>
                <li>• B01-B99: Aisle B</li>
                <li>• C01-C99: Aisle C</li>
                <li>• Use consistent format</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800">Workflow:</h4>
              <ul className="text-blue-700 mt-1 space-y-1">
                <li>• 1. Scan item or lot</li>
                <li>• 2. Verify details</li>
                <li>• 3. Scan/enter location</li>
                <li>• 4. Auto-update: INTAKE → STORED</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
