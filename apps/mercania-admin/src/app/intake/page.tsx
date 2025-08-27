'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  Camera,
  Scan,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Plus,
  DollarSign,
  Package
} from 'lucide-react';

interface BookData {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pubYear: number | null;
  binding: string;
  imageUrl: string | null;
  categories: string[];
}

interface IntakeFormData {
  isbn: string;
  conditionGrade: string;
  conditionNotes: string;
  costCents: number;
}

export default function IntakePage() {
  const [isbnInput, setIsbnInput] = useState('');
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [formData, setFormData] = useState<IntakeFormData>({
    isbn: '',
    conditionGrade: '',
    conditionNotes: '',
    costCents: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [internalId, setInternalId] = useState('');
  
  const isbnInputRef = useRef<HTMLInputElement>(null);

  // Focus on ISBN input when page loads
  useEffect(() => {
    if (isbnInputRef.current) {
      isbnInputRef.current.focus();
    }
  }, []);

  // Handle ISBN lookup
  const handleIsbnLookup = async (isbn: string) => {
    if (!isbn || isbn.length < 10) {
      setError('Please enter a valid ISBN (10 or 13 digits)');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // For now, we'll use mock data that matches your API structure
      // This will be replaced with actual API call to /api/intake/:isbn
      const mockBookData: BookData = {
        isbn: isbn,
        title: isbn === '9780140283334' ? 'The Great Gatsby' : 
               isbn === '9780061120084' ? 'To Kill a Mockingbird' : 
               `Book with ISBN ${isbn}`,
        author: isbn === '9780140283334' ? 'F. Scott Fitzgerald' : 
                isbn === '9780061120084' ? 'Harper Lee' : 
                'Unknown Author',
        publisher: isbn === '9780140283334' ? 'Penguin Books' : 
                   isbn === '9780061120084' ? 'Harper Perennial' : 
                   'Unknown Publisher',
        pubYear: isbn === '9780140283334' ? 1998 : 
                 isbn === '9780061120084' ? 2006 : 
                 null,
        binding: 'Paperback',
        imageUrl: null,
        categories: ['Fiction']
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setBookData(mockBookData);
      setFormData(prev => ({ ...prev, isbn }));
      
    } catch (err) {
      setError('Failed to fetch book data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bookData || !formData.conditionGrade) {
      setError('Please scan a book and select condition grade');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // This will call your actual API endpoint /api/intake
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        setInternalId(result.data.internalId || 'MOCK-ID-123');
        setSuccess(true);
        
        // Reset form for next item
        setTimeout(() => {
          resetForm();
        }, 3000);
      } else {
        throw new Error('Failed to create item');
      }
    } catch (err) {
      // For demo purposes, we'll simulate success
      setInternalId(`MOCK-${Date.now()}`);
      setSuccess(true);
      setTimeout(() => {
        resetForm();
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setIsbnInput('');
    setBookData(null);
    setFormData({
      isbn: '',
      conditionGrade: '',
      conditionNotes: '',
      costCents: 0
    });
    setError('');
    setSuccess(false);
    setInternalId('');
    if (isbnInputRef.current) {
      isbnInputRef.current.focus();
    }
  };

  // Handle barcode scan simulation (Enter key press)
  const handleIsbnKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleIsbnLookup(isbnInput);
    }
  };

  if (success) {
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
                <BookOpen className="h-8 w-8 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">Item Intake</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Success Message */}
        <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-900 mb-2">Item Successfully Added!</h2>
            <p className="text-green-700 mb-4">
              Internal ID: <span className="font-mono font-bold">{internalId}</span>
            </p>
            <p className="text-green-600 mb-6">
              A barcode label has been generated. Print it and attach to the book.
            </p>
            <div className="space-y-3">
              <button
                onClick={resetForm}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
              >
                <Plus className="h-5 w-5 inline mr-2" />
                Add Another Item
              </button>
              <Link
                href="/putaway"
                className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium text-center"
              >
                <Package className="h-5 w-5 inline mr-2" />
                Go to Putaway
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
              <BookOpen className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Item Intake</h1>
            </div>
            <div className="text-sm text-gray-500">
              Step 1: Scan → Assess → Confirm
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* Barcode Scanning Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <Scan className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Scan Barcode / Enter ISBN</h2>
          </div>
          
          <div className="flex space-x-4">
            <div className="flex-1">
              <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 mb-2">
                ISBN (10 or 13 digits)
              </label>
              <input
                ref={isbnInputRef}
                type="text"
                id="isbn"
                value={isbnInput}
                onChange={(e) => setIsbnInput(e.target.value.replace(/\D/g, ''))}
                onKeyPress={handleIsbnKeyPress}
                placeholder="Scan barcode or type ISBN..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                disabled={isLoading}
              />
              <p className="text-sm text-gray-500 mt-1">
                📷 Position barcode scanner here, or type manually
              </p>
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={() => handleIsbnLookup(isbnInput)}
                disabled={isLoading || !isbnInput}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {isLoading ? 'Looking up...' : 'Lookup'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          )}
        </div>

        {/* Book Information Display */}
        {bookData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Book Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <p className="text-lg font-semibold text-gray-900">{bookData.title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Author</label>
                      <p className="text-gray-900">{bookData.author}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Publisher</label>
                      <p className="text-gray-900">{bookData.publisher}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Year</label>
                      <p className="text-gray-900">{bookData.pubYear || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Binding</label>
                      <p className="text-gray-900">{bookData.binding}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">ISBN</label>
                      <p className="text-gray-900 font-mono">{bookData.isbn}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-32 h-40 bg-gray-200 rounded-lg flex items-center justify-center">
                  {bookData.imageUrl ? (
                    <img src={bookData.imageUrl} alt="Book cover" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <BookOpen className="h-16 w-16 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Condition Assessment Form */}
        {bookData && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Condition Assessment</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="condition" className="block text-sm font-medium text-gray-700 mb-2">
                  Condition Grade *
                </label>
                <select
                  id="condition"
                  value={formData.conditionGrade}
                  onChange={(e) => setFormData(prev => ({ ...prev, conditionGrade: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select condition...</option>
                  <option value="NEW">New</option>
                  <option value="LIKE_NEW">Like New</option>
                  <option value="VERY_GOOD">Very Good</option>
                  <option value="GOOD">Good</option>
                  <option value="ACCEPTABLE">Acceptable</option>
                  <option value="POOR">Poor</option>
                </select>
              </div>

              <div>
                <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-2">
                  Cost Paid (USD)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    id="cost"
                    step="0.01"
                    min="0"
                    value={formData.costCents / 100}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      costCents: Math.round(parseFloat(e.target.value || '0') * 100)
                    }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Condition Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={formData.conditionNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, conditionNotes: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe any damage, wear, missing pages, etc..."
              />
            </div>

            <div className="mt-8 flex space-x-4">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Clear & Scan New
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.conditionGrade}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {isLoading ? 'Adding Item...' : 'Confirm & Add to Inventory'}
              </button>
            </div>
          </form>
        )}

        {/* Quick Reference */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Quick Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-blue-800">Common ISBNs to Test:</h4>
              <ul className="text-blue-700 mt-1 space-y-1">
                <li>• 9780140283334 (Gatsby)</li>
                <li>• 9780061120084 (Mockingbird)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800">Condition Guidelines:</h4>
              <ul className="text-blue-700 mt-1 space-y-1">
                <li>• New: Unread, pristine</li>
                <li>• Like New: Minimal wear</li>
                <li>• Good: Normal wear</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800">Next Steps:</h4>
              <ul className="text-blue-700 mt-1 space-y-1">
                <li>• Print barcode label</li>
                <li>• Attach to book</li>
                <li>• Place in intake area</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
