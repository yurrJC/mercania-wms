'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { apiCall } from '../../utils/api';
import { 
  BookOpen, 
  Camera,
  Scan,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Plus,
  DollarSign,
  Package,
  Printer,
  Edit3,
  Disc,
  Music
} from 'lucide-react';

interface BookData {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pubYear: number;
  binding: string;
  imageUrl?: string;
}

interface DVDData {
  upc: string;
  title: string;
  director: string;
  studio: string;
  releaseYear: number;
  format: string;
  genre: string;
  rating: string;
  runtime: number;
}

interface CDData {
  barcode: string;
  title: string;
  artist: string;
  label: string;
  catalogNumber: string;
  releaseDate: string | null;
  country: string;
  format: string;
  genre: string;
  trackCount: number;
  duration: number;
  coverArtUrl?: string;
  musicbrainzId: string;
}

interface IntakeFormData {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pubYear: number | null;
  binding: string;
  conditionGrade: string;
  conditionNotes: string;
  costCents: number;
}

interface DVDFormData {
  upc: string;
  title: string;
  director: string;
  studio: string;
  releaseYear: number | null;
  format: string;
  genre: string;
  rating: string;
  runtime: number | null;
  conditionGrade: string;
  conditionNotes: string;
  costCents: number;
}

interface CDFormData {
  barcode: string;
  title: string;
  artist: string;
  label: string;
  releaseYear: number | null;
  format: string;
  genre: string;
  runtime: number | null;
  conditionGrade: string;
  conditionNotes: string;
  costCents: number;
}

export default function IntakePage() {
  const [productType, setProductType] = useState<'books' | 'dvds' | 'cds' | null>(null);
  
  // Book-specific states
  const [isbnInput, setIsbnInput] = useState('');
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [formData, setFormData] = useState<IntakeFormData>({
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    pubYear: null,
    binding: '',
    conditionGrade: 'GOOD',
    conditionNotes: '',
    costCents: 0
  });

  // DVD-specific states
  const [upcInput, setUpcInput] = useState('');
  const [dvdData, setDvdData] = useState<DVDData | null>(null);
  const [dvdManualEntry, setDvdManualEntry] = useState(false);
  const [dvdFormData, setDvdFormData] = useState<DVDFormData>({
    upc: '',
    title: '',
    director: '',
    studio: '',
    releaseYear: null,
    format: 'DVD',
    genre: '',
    rating: '',
    runtime: null,
    conditionGrade: 'GOOD',
    conditionNotes: '',
    costCents: 0
  });

  // CD-specific states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cdData, setCdData] = useState<CDData | null>(null);
  const [cdManualEntry, setCdManualEntry] = useState(false);
  const [cdFormData, setCdFormData] = useState<CDFormData>({
    barcode: '',
    title: '',
    artist: '',
    label: '',
    releaseYear: null,
    format: 'CD',
    genre: '',
    runtime: null,
    conditionGrade: 'GOOD',
    conditionNotes: '',
    costCents: 0
  });

  // Common states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [internalId, setInternalId] = useState<number | null>(null);
  const [showLabelPreview, setShowLabelPreview] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isDuplicate: boolean;
    message?: string;
    existingItems?: Array<{
      id: number;
      status: string;
      intakeDate: string;
      location: string | null;
    }>;
  } | null>(null);
  
  const isbnInputRef = useRef<HTMLInputElement>(null);
  const upcInputRef = useRef<HTMLInputElement>(null);

  // Load printers on component mount
  useEffect(() => {
    loadPrinters();
  }, []);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (productType === 'books' && isbnInputRef.current) {
      isbnInputRef.current.focus();
    } else if (productType === 'dvds' && upcInputRef.current) {
      upcInputRef.current.focus();
    } else if (productType === 'cds' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [productType]);

  // Book functions
  const fetchBookData = async (isbn: string): Promise<void> => {
    setIsLoading(true);
    setError('');
    setBookData(null);
    setDuplicateWarning(null);
    
    try {
      const response = await apiCall(`/api/intake/${isbn}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Book not found. Please verify the ISBN or use manual entry.');
        }
        throw new Error('Failed to fetch book data');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch book data');
      }
      
      const data = result.data;
      setBookData(data);
      setFormData({
        isbn: data.isbn,
        title: data.title,
        author: data.author,
        publisher: data.publisher,
        pubYear: data.pubYear,
        binding: data.binding,
        conditionGrade: 'GOOD',
        conditionNotes: '',
        costCents: 0
      });
      
      if (result.duplicate) {
        setDuplicateWarning(result.duplicate);
      }
      
    } catch (err) {
      console.error('Error fetching book data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch book data');
    } finally {
      setIsLoading(false);
    }
  };

  // DVD functions
  const fetchDVDData = async (upc: string): Promise<void> => {
    setIsLoading(true);
    setError('');
    setDvdData(null);
    setDuplicateWarning(null);
    
    try {
      const response = await apiCall(`/api/intake/dvd/${upc}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('DVD not found. Please verify the UPC or use manual entry.');
        }
        throw new Error('Failed to fetch DVD data');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch DVD data');
      }
      
      const data = result.data;
      setDvdData(data);
      setDvdFormData({
        upc: data.upc,
        title: data.title,
        director: data.director,
        studio: data.studio,
        releaseYear: data.releaseYear,
        format: data.format,
        genre: data.genre,
        rating: data.rating,
        runtime: data.runtime,
        conditionGrade: 'GOOD',
        conditionNotes: '',
        costCents: 0
      });
      
      if (result.duplicate) {
        setDuplicateWarning(result.duplicate);
      }
      
    } catch (err) {
      console.error('Error fetching DVD data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch DVD data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await apiCall('/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          costCents: Math.round(formData.costCents * 100),
          productType: 'BOOK'
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add item to inventory');
      }
      
        const result = await response.json();
        console.log('Intake API Response:', result);
        
        if (result.success) {
          setInternalId(result.data.internalId);
          setDuplicateWarning(result.duplicate || null);
          setSuccess(true);
        } else {
        throw new Error(result.error || 'Failed to add item');
      }
    } catch (err) {
      console.error('Error submitting book:', err);
      setError(err instanceof Error ? err.message : 'Failed to add item to inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDVDSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!dvdFormData.title.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await apiCall('/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isbn: dvdFormData.upc || '', // Use UPC as identifier, empty string if none
          title: dvdFormData.title,
          author: dvdFormData.director, // Director maps to author field
          publisher: dvdFormData.studio, // Studio maps to publisher field
          pubYear: dvdFormData.releaseYear,
          binding: dvdFormData.format, // Format maps to binding field
          conditionGrade: dvdFormData.conditionGrade,
          conditionNotes: dvdFormData.conditionNotes,
          costCents: Math.round((dvdFormData.costCents || 0) * 100),
          productType: 'DVD',
          // Store DVD-specific data in additional fields
          dvdMetadata: {
            genre: dvdFormData.genre || null,
            rating: dvdFormData.rating || null,
            runtime: dvdFormData.runtime || null
          }
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('DVD submission failed:', response.status, errorText);
        throw new Error(`Failed to add DVD to inventory: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('DVD Intake API Response:', result);
      
      if (result.success) {
        setInternalId(result.data.internalId);
        setDuplicateWarning(result.duplicate || null);
        setSuccess(true);
      } else {
        throw new Error(result.error || 'Failed to add DVD');
      }
    } catch (err) {
      console.error('Error submitting DVD:', err);
      setError(err instanceof Error ? err.message : 'Failed to add DVD to inventory');
    } finally {
      setIsLoading(false);
    }
  };

  // Load available printers
  const loadPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      const response = await apiCall('/api/printers');
      const data = await response.json();
      setAvailablePrinters(data.printers || []);
      if (data.printers && data.printers.length > 0) {
        setSelectedPrinter(data.printers[0]); // Select first printer by default
      }
    } catch (error) {
      console.error('Error loading printers:', error);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  // Print label using original PDF method
  const handlePrintLabel = async () => {
    if (!internalId) {
      alert('No item to print label for');
      return;
    }

    try {
      const itemTitle = bookData?.title || dvdData?.title || cdData?.title || 'Unknown Item';
      
      // Use new 80x40mm label endpoint with POST method
      const response = await apiCall('/labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          internalID: internalId.toString(),
          title: itemTitle,
          author: bookData?.author || dvdData?.director || cdData?.artist || 'Unknown',
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
        a.download = `label_${internalId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        alert('PDF label downloaded. Open in Preview and print for best results.');
      }
      
      window.URL.revokeObjectURL(url);
      setShowLabelPreview(true);
    } catch (error) {
      console.error('Error generating label:', error);
      alert('Error generating label. Please try again.');
    }
  };

  const resetForm = () => {
    // Keep the current product type - don't reset to null
    setIsbnInput('');
    setUpcInput('');
    setBarcodeInput('');
    setBookData(null);
    setDvdData(null);
    setCdData(null);
    setManualEntry(false);
    setDvdManualEntry(false);
    setCdManualEntry(false);
    setFormData({
      isbn: '',
      title: '',
      author: '',
      publisher: '',
      pubYear: null,
      binding: '',
      conditionGrade: 'GOOD',
      conditionNotes: '',
      costCents: 0
    });
    setDvdFormData({
      upc: '',
      title: '',
      director: '',
      studio: '',
      releaseYear: null,
      format: 'DVD',
      genre: '',
      rating: '',
      runtime: null,
      conditionGrade: 'GOOD',
      conditionNotes: '',
      costCents: 0
    });
    setCdFormData({
      barcode: '',
      title: '',
      artist: '',
      label: '',
      releaseYear: null,
      format: 'CD',
      genre: '',
      runtime: null,
      conditionGrade: 'GOOD',
      conditionNotes: '',
      costCents: 0
    });
    setError('');
    setSuccess(false);
    setInternalId(null);
    setShowLabelPreview(false);
    setDuplicateWarning(null);
    
    // Auto-focus the appropriate input field based on product type
    setTimeout(() => {
      if (productType === 'books') {
        document.getElementById('isbn')?.focus();
      } else if (productType === 'dvds') {
        document.getElementById('upc')?.focus();
      } else if (productType === 'cds') {
        document.getElementById('barcode')?.focus();
      }
    }, 100);
  };

  const handleIsbnKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isbnInput.length >= 10) {
        fetchBookData(isbnInput);
      }
    }
  };

  const handleUpcKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (upcInput.length >= 8) {
        fetchDVDData(upcInput);
      }
    }
  };

  const handleBookManualEntry = () => {
    setManualEntry(true);
    setIsbnInput('');
    setBookData({
      isbn: '',
      title: '',
      author: '',
      publisher: '',
      pubYear: new Date().getFullYear(),
      binding: 'Paperback'
    });
    setFormData(prev => ({
      ...prev,
      isbn: '',
      title: '',
      author: '',
      publisher: '',
      pubYear: new Date().getFullYear(),
      binding: 'Paperback'
    }));
    setError('');
  };

  const handleDVDManualEntry = () => {
    setDvdManualEntry(true);
    setUpcInput('');
    setDvdData({
      upc: '',
      title: '',
      director: '',
      studio: '',
      releaseYear: new Date().getFullYear(),
      format: 'DVD',
      genre: '',
      rating: '',
      runtime: 0
    });
    setDvdFormData(prev => ({
      ...prev,
      upc: '',
      title: '',
      director: '',
      studio: '',
      releaseYear: new Date().getFullYear(),
      format: 'DVD'
    }));
    setError('');
  };

  // CD functions
  const fetchCDData = async (barcode: string): Promise<void> => {
    setIsLoading(true);
    setError('');
    setCdData(null);
    setDuplicateWarning(null);
    
    // Clean the barcode - remove leading/trailing spaces
    const cleanBarcode = barcode.trim();
    
    if (!cleanBarcode) {
      setError('Please enter a barcode');
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await apiCall(`/api/intake/cd/${cleanBarcode}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('CD not found. Please verify the barcode or use manual entry.');
        }
        throw new Error('Failed to fetch CD data');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch CD data');
      }
      
      const data = result.data;
      setCdData(data);
      setCdFormData({
        barcode: data.barcode,
        title: data.title,
        artist: data.artist,
        label: data.label,
        releaseYear: data.releaseDate ? new Date(data.releaseDate).getFullYear() : null,
        format: data.format,
        genre: data.genre,
        runtime: data.duration ? Math.round(data.duration / 60000) : null, // Convert milliseconds to minutes
        conditionGrade: 'GOOD',
        conditionNotes: '',
        costCents: 0
      });
      
      if (result.duplicate) {
        setDuplicateWarning(result.duplicate);
      }
      
    } catch (err) {
      console.error('Error fetching CD data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch CD data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCDBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const trimmedBarcode = barcodeInput.trim();
    if (e.key === 'Enter' && trimmedBarcode && !isLoading && !cdManualEntry) {
      e.preventDefault();
      if (trimmedBarcode.length >= 8) {
        fetchCDData(trimmedBarcode);
      }
    }
  };

  const handleCDManualEntry = () => {
    setCdManualEntry(true);
    setBarcodeInput('');
    setCdData({
      barcode: '',
      title: '',
      artist: '',
      label: '',
      catalogNumber: '',
      releaseDate: new Date().toISOString(),
      country: '',
      format: 'CD',
      genre: '',
      trackCount: 0,
      duration: 0,
      musicbrainzId: ''
    });
    setCdFormData(prev => ({
      ...prev,
      barcode: '',
      title: '',
      artist: '',
      label: '',
      releaseYear: new Date().getFullYear(),
      format: 'CD'
    }));
    setError('');
  };

  const handleCDSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!cdFormData.title.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await apiCall('/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isbn: cdFormData.barcode || '', // Use barcode as identifier, empty string if none
          title: cdFormData.title,
          author: cdFormData.artist, // Artist maps to author field
          publisher: cdFormData.label, // Label maps to publisher field
          pubYear: cdFormData.releaseYear,
          binding: cdFormData.format, // Format maps to binding field
          imageUrl: cdData?.coverArtUrl || null, // Include cover art URL
          conditionGrade: cdFormData.conditionGrade,
          conditionNotes: cdFormData.conditionNotes,
          costCents: Math.round((cdFormData.costCents || 0) * 100),
          productType: 'CD',
          // Store CD-specific data in additional fields
          cdMetadata: {
            genre: cdFormData.genre || null,
            runtime: cdFormData.runtime || null
          }
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('CD submission failed:', response.status, errorText);
        throw new Error(`Failed to add CD to inventory: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('CD Intake API Response:', result);
      
      if (result.success) {
        setInternalId(result.data.internalId);
        setDuplicateWarning(result.duplicate || null);
        setSuccess(true);
      } else {
        throw new Error(result.error || 'Failed to add CD');
      }
    } catch (err) {
      console.error('Error submitting CD:', err);
      setError(err instanceof Error ? err.message : 'Failed to add CD to inventory');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/" className="mr-4">
                  <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
                </Link>
                {productType === 'books' && <BookOpen className="h-8 w-8 text-blue-600 mr-3" />}
                {productType === 'dvds' && <Disc className="h-8 w-8 text-purple-600 mr-3" />}
                <h1 className="text-2xl font-bold text-gray-900">
                  {productType === 'books' && 'Book Intake'}
                  {productType === 'dvds' && 'DVD Intake'}
                  {productType === 'cds' && 'CD Intake'}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {productType === 'books' && 'Book Added Successfully!'}
              {productType === 'dvds' && 'DVD Added Successfully!'}
            </h2>
            <p className="text-gray-600 mb-6">
              Internal ID: <span className="font-bold text-2xl text-blue-600">#{internalId}</span>
            </p>
            
            {duplicateWarning?.isDuplicate && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ Duplicate Warning</h4>
                <p className="text-yellow-700 text-sm">{duplicateWarning.message}</p>
              </div>
            )}

            <div className="space-y-3">
              {!showLabelPreview && (
                <button
                  onClick={handlePrintLabel}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Printer className="h-5 w-5 inline mr-2" />
                  Print Label
                </button>
              )}
              
              <button
                onClick={resetForm}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
              >
                <Plus className="h-5 w-5 inline mr-2" />
                Add Another Item
              </button>
              
              <Link
                href="/putaway"
                className="block w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium text-center"
              >
                <Package className="h-5 w-5 inline mr-2" />
                Go to Putaway
              </Link>
            </div>
          </div>

          {showLabelPreview && (
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 max-w-md mx-auto">
              <h3 className="font-bold text-gray-900 mb-4">Label Preview (80mm x 40mm)</h3>
              <div className="bg-white border border-gray-400 p-3 text-left" style={{ width: '320px', height: '160px' }}>
                <div className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                  {bookData?.title || dvdData?.title || cdData?.title || 'Unknown Item'}
                </div>
                <div className="text-sm text-gray-700 mb-2">ID: {internalId}</div>
                <div className="border border-gray-400 h-8 bg-black bg-opacity-10 flex items-center justify-center mb-2">
                  <span className="text-xs text-gray-600 font-mono">||||| |||| ||||| ||||</span>
                </div>
                <div className="text-xs text-gray-600 font-bold">MERCANIA</div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              {!productType && <Package className="h-8 w-8 text-gray-600 mr-3" />}
              {productType === 'books' && <BookOpen className="h-8 w-8 text-blue-600 mr-3" />}
              {productType === 'dvds' && <Disc className="h-8 w-8 text-purple-600 mr-3" />}
              {productType === 'cds' && <Music className="h-8 w-8 text-green-600 mr-3" />}
              <h1 className="text-2xl font-bold text-gray-900">
                {!productType && 'Item Intake'}
                {productType === 'books' && 'Book Intake'}
                {productType === 'dvds' && 'DVD Intake'}
                {productType === 'cds' && 'CD Intake'}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* Product Type Selection */}
        {!productType && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">What are you listing today?</h2>
              <p className="text-gray-600">Select the type of product you want to intake</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() => setProductType('books')}
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
              >
                <div className="text-center">
                  <BookOpen className="h-16 w-16 text-blue-600 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Books</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Novels, textbooks, manuals, and all printed literature
                  </p>
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                    ISBN Lookup Available
                  </div>
                </div>
              </button>

              <button
                onClick={() => setProductType('dvds')}
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors group"
              >
                <div className="text-center">
                  <Disc className="h-16 w-16 text-purple-600 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">DVDs</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Movies, TV shows, documentaries, and video content
                  </p>
                  <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium">
                    eBay UPC Lookup
                  </div>
                </div>
              </button>

              <button
                onClick={() => setProductType('cds')}
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors group"
              >
                <div className="text-center">
                  <Music className="h-16 w-16 text-green-600 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">CDs</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Music albums, audiobooks, and audio content
                  </p>
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                    eBay Catalog API
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Product Type Header */}
        {productType && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {productType === 'books' && <BookOpen className="h-6 w-6 text-blue-600 mr-3" />}
                {productType === 'dvds' && <Disc className="h-6 w-6 text-purple-600 mr-3" />}
                {productType === 'cds' && <Music className="h-6 w-6 text-green-600 mr-3" />}
                <h2 className="text-xl font-semibold text-gray-900">
                  {productType === 'books' && 'Book Intake'}
                  {productType === 'dvds' && 'DVD Intake'}
                  {productType === 'cds' && 'CD Intake'}
                </h2>
              </div>
              <button
                onClick={() => setProductType(null)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Change Type
              </button>
            </div>
          </div>
        )}

        {/* Books Intake */}
        {productType === 'books' && (
          <>
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
                onChange={(e) => setIsbnInput(e.target.value.replace(/\D/g, '').trim())}
                onKeyPress={handleIsbnKeyPress}
                placeholder="Scan barcode or type ISBN..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                    disabled={isLoading || manualEntry}
              />
              <p className="text-sm text-gray-500 mt-1">
                📷 Position barcode scanner here, or type manually
              </p>
                  {manualEntry && (
                    <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                      <strong>Manual Entry Mode:</strong> Enter book details manually below
            </div>
                  )}
                </div>
                
                <div className="flex flex-col space-y-2">
              <button
                    onClick={() => fetchBookData(isbnInput)}
                    disabled={isLoading || isbnInput.length < 10 || manualEntry}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {isLoading ? 'Looking up...' : 'Lookup'}
              </button>
                  
                  <button
                    onClick={handleBookManualEntry}
                    className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm"
                  >
                    No Barcode?
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

        {bookData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center mb-4">
              <Edit3 className="h-6 w-6 text-blue-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    {manualEntry ? 'Book Information (Manual Entry)' : 'Book Information (Editable)'}
                  </h2>
                  {manualEntry && (
                    <div className="ml-3 bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                      Manual Entry
            </div>
                  )}
                </div>
                {/* Cover Art Display */}
                {bookData?.imageUrl && (
                  <div className="mb-6 flex justify-center">
                    <div className="relative">
                      <img 
                        src={bookData.imageUrl} 
                        alt={`Cover of ${bookData.title}`}
                        className="w-32 h-48 object-cover rounded-lg shadow-md border border-gray-200"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-1 rounded-full">
                        <BookOpen className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sticky Submit Button - Always Visible */}
                <div className="sticky top-4 z-10 mb-4">
                  <button
                    onClick={handleBookSubmit}
                    disabled={isLoading || !formData.title.trim()}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium shadow-lg"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Confirm & Add to Inventory
                      </span>
                    )}
                  </button>
                </div>

                <form onSubmit={handleBookSubmit} className="space-y-3">
                  {/* Essential Fields - Most Important */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                      <input
                        type="text"
                        value={formData.author}
                        onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                      <select
                        value={formData.conditionGrade}
                        onChange={(e) => setFormData(prev => ({ ...prev, conditionGrade: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="LIKE_NEW">Like New</option>
                        <option value="GOOD">Good</option>
                        <option value="ACCEPTABLE">Acceptable</option>
                      </select>
                    </div>
                  </div>

                  {/* Secondary Fields - Less Critical */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                      <input
                        type="text"
                        value={formData.isbn}
                        onChange={(e) => setFormData(prev => ({ ...prev, isbn: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        readOnly={!manualEntry}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                      <input
                        type="text"
                        value={formData.publisher}
                        onChange={(e) => setFormData(prev => ({ ...prev, publisher: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                      <input
                        type="number"
                        value={formData.pubYear || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, pubYear: e.target.value ? parseInt(e.target.value) : null }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Binding</label>
                      <select
                        value={formData.binding}
                        onChange={(e) => setFormData(prev => ({ ...prev, binding: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select binding</option>
                        <option value="Hardcover">Hardcover</option>
                        <option value="Paperback">Paperback</option>
                        <option value="Mass Market">Mass Market</option>
                        <option value="Board Book">Board Book</option>
                      </select>
                    </div>
                  </div>

                  {/* Cost Field */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost (AUD)</label>
                      <div className="relative">
                        <DollarSign className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.costCents}
                          onChange={(e) => setFormData(prev => ({ ...prev, costCents: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Condition Notes</label>
                      <input
                        type="text"
                        value={formData.conditionNotes}
                        onChange={(e) => setFormData(prev => ({ ...prev, conditionNotes: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Optional notes..."
                      />
                    </div>
                  </div>

                  {duplicateWarning?.isDuplicate && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-2">⚠️ Duplicate Warning</h4>
                      <p className="text-yellow-700 text-sm mb-3">{duplicateWarning.message}</p>
                      {duplicateWarning.existingItems && duplicateWarning.existingItems.length > 0 && (
                        <div className="space-y-2">
                          {duplicateWarning.existingItems.map((item, index) => (
                            <div key={index} className="text-xs text-yellow-600 bg-yellow-100 p-2 rounded">
                              ID #{item.id} • {item.status} • {item.intakeDate} • {item.location || 'No location'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </form>
              </div>
            )}
          </>
        )}

        {/* DVD Intake */}
        {productType === 'dvds' && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center mb-4">
                <Scan className="h-6 w-6 text-purple-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Scan Barcode / Enter UPC</h2>
              </div>
              
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label htmlFor="upc" className="block text-sm font-medium text-gray-700 mb-2">
                    UPC/EAN (8-14 digits)
                      </label>
                      <input
                    ref={upcInputRef}
                        type="text"
                    id="upc"
                    value={upcInput}
                    onChange={(e) => setUpcInput(e.target.value.replace(/\D/g, '').trim())}
                    onKeyPress={handleUpcKeyPress}
                    placeholder="Scan barcode or type UPC..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg font-mono"
                    disabled={isLoading || dvdManualEntry}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    📷 Position barcode scanner here, or type manually
                  </p>
                  {dvdManualEntry && (
                    <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                      <strong>Manual Entry Mode:</strong> Enter DVD details manually below
                    </div>
                  )}
                  </div>
                
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => fetchDVDData(upcInput)}
                    disabled={isLoading || upcInput.length < 8 || dvdManualEntry}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                  >
                    {isLoading ? 'Looking up...' : 'Lookup'}
                  </button>
                  
                  {/* DVDs require UPC - no manual entry option */}
                </div>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
                  )}
                </div>

            {dvdData && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex items-center mb-4">
                  <Edit3 className="h-6 w-6 text-purple-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    {dvdManualEntry ? 'DVD Information (Manual Entry)' : 'DVD Information (Editable)'}
                  </h2>
                  {dvdManualEntry && (
                    <div className="ml-3 bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                      Manual Entry
              </div>
                  )}
            </div>

                <form onSubmit={handleDVDSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">UPC/EAN</label>
                      <input
                        type="text"
                        value={dvdFormData.upc}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, upc: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        readOnly={!dvdManualEntry}
                      />
          </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                      <input
                        type="text"
                        value={dvdFormData.title}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                    
              <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Director</label>
                      <input
                        type="text"
                        value={dvdFormData.director}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, director: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Studio</label>
                      <input
                        type="text"
                        value={dvdFormData.studio}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, studio: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Release Year</label>
                      <input
                        type="number"
                        value={dvdFormData.releaseYear || ''}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, releaseYear: e.target.value ? parseInt(e.target.value) : null }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                <select
                        value={dvdFormData.format}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, format: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="DVD">DVD</option>
                        <option value="Blu-ray">Blu-ray</option>
                        <option value="4K UHD">4K UHD</option>
                        <option value="DVD Box Set">DVD Box Set</option>
                        <option value="Blu-ray Box Set">Blu-ray Box Set</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                      <select
                        value={dvdFormData.genre}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, genre: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Select genre</option>
                        <option value="Action">Action</option>
                        <option value="Comedy">Comedy</option>
                        <option value="Drama">Drama</option>
                        <option value="Horror">Horror</option>
                        <option value="Sci-Fi">Sci-Fi</option>
                        <option value="Romance">Romance</option>
                        <option value="Thriller">Thriller</option>
                        <option value="Documentary">Documentary</option>
                        <option value="Animation">Animation</option>
                        <option value="TV Series">TV Series</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                      <select
                        value={dvdFormData.rating}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, rating: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Select rating</option>
                        <option value="G">G - General</option>
                        <option value="PG">PG - Parental Guidance</option>
                        <option value="M">M - Mature</option>
                        <option value="MA15+">MA15+ - Mature Accompanied</option>
                        <option value="R18+">R18+ - Restricted</option>
                        <option value="TBC">TBC - To Be Classified</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Runtime (minutes)</label>
                      <input
                        type="number"
                        value={dvdFormData.runtime || ''}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, runtime: e.target.value ? parseInt(e.target.value) : null }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="120"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Condition Grade *</label>
                      <select
                        value={dvdFormData.conditionGrade}
                        onChange={(e) => setDvdFormData(prev => ({ ...prev, conditionGrade: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="LIKE_NEW">Like New</option>
                  <option value="GOOD">Good</option>
                  <option value="ACCEPTABLE">Acceptable</option>
                </select>
              </div>

              <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost (AUD)</label>
                <div className="relative">
                        <DollarSign className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                          value={dvdFormData.costCents}
                          onChange={(e) => setDvdFormData(prev => ({ ...prev, costCents: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condition Notes</label>
              <textarea
                      value={dvdFormData.conditionNotes}
                      onChange={(e) => setDvdFormData(prev => ({ ...prev, conditionNotes: e.target.value }))}
                rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Optional notes about the DVD's condition..."
              />
            </div>

                  {duplicateWarning?.isDuplicate && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-2">⚠️ Duplicate Warning</h4>
                      <p className="text-yellow-700 text-sm mb-3">{duplicateWarning.message}</p>
                      {duplicateWarning.existingItems && duplicateWarning.existingItems.length > 0 && (
                        <div className="space-y-2">
                          {duplicateWarning.existingItems.map((item, index) => (
                            <div key={index} className="text-xs text-yellow-600 bg-yellow-100 p-2 rounded">
                              ID #{item.id} • {item.status} • {item.intakeDate} • {item.location || 'No location'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex space-x-4">
              <button
                type="submit"
                      disabled={isLoading || !dvdFormData.title.trim()}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                      {isLoading ? 'Adding DVD...' : 'Confirm & Add to Inventory'}
              </button>
            </div>
          </form>
              </div>
            )}
          </>
        )}

        {/* CD Intake Section */}
        {productType === 'cds' && (
          <>
            {/* Barcode Scanner */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center mb-4">
                <Scan className="h-6 w-6 text-green-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {cdManualEntry ? 'Manual CD Entry' : 'Scan CD Barcode'}
                </h2>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    id="barcode"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value.trim())}
                    onKeyPress={handleCDBarcodeScan}
                    placeholder="Scan or enter CD barcode (EAN/UPC)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
                    disabled={isLoading || cdManualEntry}
                  />
                </div>
                
                <div className="flex gap-2">
              <button
                    onClick={() => fetchCDData(barcodeInput.trim())}
                    disabled={isLoading || barcodeInput.trim().length < 8 || cdManualEntry}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                  >
                    {isLoading ? 'Looking up...' : 'Lookup'}
                  </button>
                  
                  {/* CDs require barcode - no manual entry option */}
            </div>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
              )}
            </div>

            {cdData && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex items-center mb-4">
                  <Edit3 className="h-6 w-6 text-green-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    {cdManualEntry ? 'CD Information (Manual Entry)' : 'CD Information (Editable)'}
                  </h2>
                </div>

                <form onSubmit={handleCDSubmit} className="space-y-3">
                  {/* Cover Art and Form Header */}
                  <div className="flex items-start space-x-4 mb-4">
                    {/* Cover Art */}
                    {cdData?.coverArtUrl && (
                      <div className="flex-shrink-0">
                        <img 
                          src={cdData.coverArtUrl} 
                          alt={`Cover of ${cdData.title}`}
                          className="w-20 h-20 object-cover rounded-lg shadow-md border border-gray-200"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Essential Fields - First Row */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                        <input
                          type="text"
                          value={cdFormData.barcode}
                          onChange={(e) => setCdFormData(prev => ({ ...prev, barcode: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                          readOnly={!cdManualEntry}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                        <input
                          type="text"
                          value={cdFormData.title}
                          onChange={(e) => setCdFormData(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Artist</label>
                        <input
                          type="text"
                          value={cdFormData.artist}
                          onChange={(e) => setCdFormData(prev => ({ ...prev, artist: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Main Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                      <input
                        type="text"
                        value={cdFormData.label}
                        onChange={(e) => setCdFormData(prev => ({ ...prev, label: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Release Year</label>
                      <input
                        type="number"
                        value={cdFormData.releaseYear || ''}
                        onChange={(e) => setCdFormData(prev => ({ ...prev, releaseYear: e.target.value ? parseInt(e.target.value) : null }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        min="1900"
                        max={new Date().getFullYear()}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                      <select
                        value={cdFormData.format}
                        onChange={(e) => setCdFormData(prev => ({ ...prev, format: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      >
                        <option value="CD">CD</option>
                        <option value="CD Single">CD Single</option>
                        <option value="CD EP">CD EP</option>
                        <option value="CD Box Set">CD Box Set</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                      <input
                        type="text"
                        value={cdFormData.genre}
                        onChange={(e) => setCdFormData(prev => ({ ...prev, genre: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="e.g., Rock, Pop, Classical"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Runtime (min)</label>
                      <input
                        type="number"
                        value={cdFormData.runtime || ''}
                        onChange={(e) => setCdFormData(prev => ({ ...prev, runtime: e.target.value ? parseInt(e.target.value) : null }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        min="1"
                        max="999"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Condition Grade *</label>
                      <select
                        value={cdFormData.conditionGrade}
                        onChange={(e) => setCdFormData(prev => ({ ...prev, conditionGrade: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        required
                      >
                        <option value="MINT">Mint</option>
                        <option value="EXCELLENT">Excellent</option>
                        <option value="VERY_GOOD">Very Good</option>
                        <option value="GOOD">Good</option>
                        <option value="FAIR">Fair</option>
                        <option value="POOR">Poor</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost (AUD)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="number"
                          value={cdFormData.costCents}
                          onChange={(e) => setCdFormData(prev => ({ ...prev, costCents: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Condition Notes and Duplicate Warning */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Condition Notes</label>
                      <textarea
                        value={cdFormData.conditionNotes}
                        onChange={(e) => setCdFormData(prev => ({ ...prev, conditionNotes: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        rows={2}
                        placeholder="Any scratches, missing booklet, etc."
                      />
                    </div>
                    
                    {/* Duplicate Warning */}
                    {duplicateWarning && duplicateWarning.isDuplicate && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center mb-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                          <span className="font-medium text-yellow-800 text-sm">Duplicate Found</span>
                        </div>
                        <p className="text-yellow-700 text-xs mb-2">{duplicateWarning.message}</p>
                        {duplicateWarning.existingItems && (
                          <div className="text-xs text-yellow-700">
                            <p className="font-medium mb-1">Existing items:</p>
                            <ul className="space-y-1">
                              {duplicateWarning.existingItems.map((item) => (
                                <li key={item.id}>
                                  ID {item.id} - {item.status} - {item.intakeDate} - {item.location || 'No location'}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isLoading || !cdFormData.title.trim()}
                    className="w-full bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm"
                  >
                    {isLoading ? 'Adding CD...' : 'Add CD to Inventory'}
                  </button>
          </form>
              </div>
            )}
          </>
        )}

        {/* Quick Reference for Books */}
        {productType === 'books' && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Quick Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-blue-800">Sequential IDs:</h4>
              <ul className="text-blue-700 mt-1 space-y-1">
                <li>• 1, 2, 3, 4, 5...</li>
                  <li>• Unique per item</li>
                  <li>• Used for tracking</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800">Condition Guidelines:</h4>
              <ul className="text-blue-700 mt-1 space-y-1">
                <li>• Good: Default condition</li>
                <li>• Like New: Minimal wear</li>
                <li>• Acceptable: Heavy wear</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800">Process:</h4>
              <ul className="text-blue-700 mt-1 space-y-1">
                  <li>• 1. Scan ISBN or click "No Barcode?"</li>
                  <li>• 2. Edit/enter book details</li>
                <li>• 3. Confirm & get ID</li>
              </ul>
            </div>
          </div>
        </div>
        )}

        {/* Quick Reference for DVDs */}
        {productType === 'dvds' && (
          <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">Quick Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-purple-800">UPC/EAN Formats:</h4>
                <ul className="text-purple-700 mt-1 space-y-1">
                  <li>• UPC-A: 12 digits</li>
                  <li>• EAN-13: 13 digits</li>
                  <li>• UPC-E: 8 digits</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-purple-800">Australian Ratings:</h4>
                <ul className="text-purple-700 mt-1 space-y-1">
                  <li>• G, PG, M, MA15+, R18+</li>
                  <li>• Region 4 for Australia</li>
                  <li>• PAL video format</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-purple-800">Process:</h4>
                <ul className="text-purple-700 mt-1 space-y-1">
                  <li>• 1. Scan UPC or click "No Barcode?"</li>
                  <li>• 2. eBay API lookup</li>
                  <li>• 3. Edit details & confirm</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}