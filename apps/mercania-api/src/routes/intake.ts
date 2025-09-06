import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import dvdRoutes from './dvd';
import cdRoutes from './cd';
import { invalidateDashboardCache } from '../utils/cache';

const router = Router();

// Mount DVD and CD routes
console.log('Mounting DVD routes at /dvd');
router.use('/dvd', dvdRoutes);
console.log('Mounting CD routes at /cd');
router.use('/cd', cdRoutes);

// Validation schemas
const IntakeSchema = z.object({
  isbn: z.string().optional().nullable(), // ISBN, UPC, or any product barcode - allow null for manual entries
  barcode: z.string().optional().nullable(), // Alias for isbn field for better API clarity
  title: z.string().optional(),
  author: z.string().optional(), // For DVDs, this will be the director
  publisher: z.string().optional(), // For DVDs, this will be the studio
  pubYear: z.number().nullable().optional(), // Release year
  binding: z.string().optional(), // For DVDs, this will be the format
  imageUrl: z.string().nullable().optional(), // Cover art URL for books, DVDs, and CDs
  conditionGrade: z.string().optional(),
  conditionNotes: z.string().optional(),
  costCents: z.number().int().min(0).default(0),
  productType: z.string().optional(), // 'BOOK', 'DVD', or 'CD'
  dvdMetadata: z.object({
    genre: z.string().nullable().optional(), // Allow null genre
    rating: z.string().nullable().optional(), // Allow null rating
    runtime: z.number().nullable().optional() // Allow null runtime
  }).optional(),
  cdMetadata: z.object({
    genre: z.string().nullable().optional(), // Allow null genre
    runtime: z.number().nullable().optional() // Allow null runtime
  }).optional()
});

// Interface for ISBNdb API response
interface ISBNdbResponse {
  book?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    date_published?: string;
    binding?: string;
    pages?: number;
    language?: string;
    synopsis?: string;
    subjects?: string[];
    image?: string;
    isbn?: string;
    isbn13?: string;
  };
}

// ISBNdb API lookup function
async function lookupIsbn(isbn: string) {
  const API_KEY = process.env.ISBNDB_API_KEY;
  
  if (!API_KEY) {
    console.warn('ISBNdb API key not configured, using mock data');
    return getMockBookData(isbn);
  }

  try {
    console.log(`Looking up ISBN ${isbn} with ISBNdb...`);
    
    const response = await fetch(`https://api2.isbndb.com/book/${isbn}`, {
      headers: {
        'Authorization': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`ISBN ${isbn} not found in ISBNdb`);
        return getUnknownBookData(isbn);
      }
      throw new Error(`ISBNdb API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as ISBNdbResponse;
    
    if (!data.book) {
      console.log(`No book data returned for ISBN ${isbn}`);
      return getUnknownBookData(isbn);
    }

    const book = data.book;
    
    // Parse publication year from date
    let pubYear = null;
    if (book.date_published) {
      const yearMatch = book.date_published.match(/\d{4}/);
      if (yearMatch) {
        pubYear = parseInt(yearMatch[0]);
      }
    }

    // Parse binding
    const binding = book.binding || 'Unknown';

    // Format authors
    const author = book.authors && book.authors.length > 0 
      ? book.authors.join(', ') 
      : 'Unknown Author';

    // Format categories from subjects
    const categories = book.subjects || [];

    const result = {
      title: book.title || `Unknown Book (ISBN: ${isbn})`,
      author,
      publisher: book.publisher || 'Unknown Publisher',
      pubYear,
      binding,
      imageUrl: book.image || null,
      categories
    };

    console.log(`Successfully retrieved data for: ${result.title}`);
    return result;

  } catch (error) {
    console.error('ISBNdb lookup error:', error);
    console.log('Falling back to mock data...');
    return getMockBookData(isbn);
  }
}

// Mock data fallback for development/testing
function getMockBookData(isbn: string) {
  const mockBooks: Record<string, any> = {
    '9780140283334': {
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      publisher: 'Penguin Books',
      pubYear: 1998,
      binding: 'Paperback',
      imageUrl: null,
      categories: ['Fiction', 'Classic Literature']
    },
    '9780061120084': {
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      publisher: 'Harper Perennial',
      pubYear: 2006,
      binding: 'Paperback',
      imageUrl: null,
      categories: ['Fiction', 'Classic Literature']
    },
    '9780451524935': {
      title: '1984',
      author: 'George Orwell',
      publisher: 'Signet Classic',
      pubYear: 1977,
      binding: 'Paperback',
      imageUrl: null,
      categories: ['Fiction', 'Dystopian', 'Classic Literature']
    }
  };

  return mockBooks[isbn] || getUnknownBookData(isbn);
}

// Fallback for unknown books
function getUnknownBookData(isbn: string) {
  return {
    title: `Unknown Book (ISBN: ${isbn})`,
    author: 'Unknown Author',
    publisher: 'Unknown Publisher',
    pubYear: null,
    binding: 'Unknown',
    imageUrl: null,
    categories: []
  };
}

// POST /intake - Create new item from ISBN or UPC
router.post('/', async (req, res): Promise<any> => {
  try {
    console.log('=== INTAKE REQUEST START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    // Validate input
    try {
      const validatedData = IntakeSchema.parse(req.body);
      console.log('Validated data:', JSON.stringify(validatedData, null, 2));
    } catch (validationError) {
      console.error('Validation error:', validationError);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: validationError
      });
    }
    
    const validatedData = IntakeSchema.parse(req.body);
    
    const productType = validatedData.productType || 'BOOK';
    // Support both 'isbn' and 'barcode' fields for flexibility
    let identifier = validatedData.barcode || validatedData.isbn; // This could be ISBN, UPC, or any product barcode
    
    // Handle different scenarios based on product type and identifier
    if (!identifier || identifier.trim() === '') {
      // Allow manual entries for books and CDs, require barcode for DVDs
      if (productType === 'BOOK') {
        // For manual books, require at least a title
        if (!validatedData.title || !validatedData.title.trim()) {
          return res.status(400).json({
            success: false,
            error: 'For manual book entries, title is required'
          });
        }
        
        identifier = null; // No ISBN for manual books - will be tracked by internal ID only
        console.log('Creating manual book entry (no ISBN)');
      } else if (productType === 'CD') {
        // For manual CDs, require at least a title
        if (!validatedData.title || !validatedData.title.trim()) {
          return res.status(400).json({
            success: false,
            error: 'For manual CD entries, title is required'
          });
        }
        
        identifier = null; // No barcode for manual CDs - will be tracked by internal ID only
        console.log('Creating manual CD entry (no barcode)');
      } else {
        return res.status(400).json({
          success: false,
          error: `UPC is required for ${productType.toLowerCase()} entries`
        });
      }
    } else {
      identifier = identifier.trim();
      console.log(`Using provided identifier: ${identifier}`);
    }
    
    let itemData;
    
    if (productType === 'DVD') {
      // For DVDs, use the provided form data instead of API lookup
      // since the lookup already happened on the frontend
      itemData = {
        title: validatedData.title || 'Unknown DVD',
        author: validatedData.author || 'Unknown Director',
        publisher: validatedData.publisher || 'Unknown Studio',
        pubYear: validatedData.pubYear || null,
        binding: validatedData.binding || 'DVD',
        imageUrl: null,
        categories: validatedData.dvdMetadata?.genre ? [validatedData.dvdMetadata.genre] : []
      };
    } else if (productType === 'CD') {
      // For CDs, use the provided form data instead of API lookup
      // since the lookup already happened on the frontend (or manual entry)
      itemData = {
        title: validatedData.title || 'Unknown CD',
        author: validatedData.author || 'Unknown Artist',
        publisher: validatedData.publisher || 'Unknown Label',
        pubYear: validatedData.pubYear || null,
        binding: validatedData.binding || 'CD',
        imageUrl: validatedData.imageUrl || null, // Use the cover art URL from frontend
        categories: validatedData.cdMetadata?.genre ? [validatedData.cdMetadata.genre] : []
      };
    } else {
      // For books
      if (identifier && identifier.startsWith('MB')) {
        // Manual book entry - use provided form data instead of API lookup
        itemData = {
          title: validatedData.title || 'Unknown Book',
          author: validatedData.author || 'Unknown Author',
          publisher: validatedData.publisher || 'Unknown Publisher',
          pubYear: validatedData.pubYear || null,
          binding: validatedData.binding || 'Unknown',
          imageUrl: null,
          categories: []
        };
      } else if (identifier && identifier.startsWith('MC')) {
        // Manual CD entry - use provided form data instead of API lookup
        itemData = {
          title: validatedData.title || 'Unknown CD',
          author: validatedData.author || 'Unknown Artist',
          publisher: validatedData.publisher || 'Unknown Label',
          pubYear: validatedData.pubYear || null,
          binding: validatedData.binding || 'CD',
          imageUrl: validatedData.imageUrl || null, // Use the cover art URL from frontend
          categories: validatedData.cdMetadata?.genre ? [validatedData.cdMetadata.genre] : []
        };
      } else if (identifier) {
        // Regular ISBN lookup for books with barcodes
        itemData = await lookupIsbn(identifier);
        
        // Override with any provided data (for manual entries)
        if (validatedData.title) itemData.title = validatedData.title;
        if (validatedData.author) itemData.author = validatedData.author;
        if (validatedData.publisher) itemData.publisher = validatedData.publisher;
        if (validatedData.pubYear) itemData.pubYear = validatedData.pubYear;
        if (validatedData.binding) itemData.binding = validatedData.binding;
        if (validatedData.imageUrl) itemData.imageUrl = validatedData.imageUrl;
      } else {
        // Manual book without barcode - use provided data only
        itemData = {
          title: validatedData.title || 'Untitled Book',
          author: validatedData.author || 'Unknown Author',
          publisher: validatedData.publisher || 'Unknown Publisher',
          pubYear: validatedData.pubYear || null,
          binding: validatedData.binding || 'Unknown',
          imageUrl: validatedData.imageUrl || null,
          categories: []
        };
      }
    }
    
    // Check for existing items with this identifier (only if identifier exists)
    const existingItems = identifier ? await prisma.item.findMany({
      where: { isbn: identifier },
      include: { isbnMaster: true },
      orderBy: { createdAt: 'desc' }
    }) : [];

    // Create or update ISBN/UPC master record
    // For manual entries, create a master record with a generated identifier so inventory display works
    let isbnMaster = null;
    if (identifier) {
      try {
        console.log('Creating/updating ISBN master with data:', JSON.stringify({
          isbn: identifier,
          title: itemData.title,
          author: itemData.author,
          publisher: itemData.publisher,
          pubYear: itemData.pubYear,
          binding: itemData.binding,
          imageUrl: itemData.imageUrl,
          categories: itemData.categories
        }, null, 2));
        console.log('Cover art URL being saved:', itemData.imageUrl);
        
        isbnMaster = await prisma.isbnMaster.upsert({
          where: { isbn: identifier },
          update: {
            title: itemData.title,
            author: itemData.author,
            publisher: itemData.publisher,
            pubYear: itemData.pubYear,
            binding: itemData.binding,
            imageUrl: itemData.imageUrl,
            categories: itemData.categories
          },
          create: {
            isbn: identifier,
            title: itemData.title,
            author: itemData.author,
            publisher: itemData.publisher,
            pubYear: itemData.pubYear,
            binding: itemData.binding,
            imageUrl: itemData.imageUrl,
            categories: itemData.categories
          }
        });
        console.log('ISBN master created/updated successfully');
      } catch (isbnError) {
        console.error('Error creating ISBN master:', isbnError);
        return res.status(400).json({
          success: false,
          error: 'Failed to create ISBN master record',
          details: isbnError
        });
      }
    } else {
      // For manual entries without barcode, create a master record with a generated identifier
      // This ensures the inventory screen can display the title and author properly
      try {
        const manualIdentifier = `M${productType.charAt(0)}${Date.now()}`; // e.g., "MC1703123456789"
        console.log('Creating manual master record with identifier:', manualIdentifier);
        
        isbnMaster = await prisma.isbnMaster.create({
          data: {
            isbn: manualIdentifier,
            title: itemData.title,
            author: itemData.author,
            publisher: itemData.publisher,
            pubYear: itemData.pubYear,
            binding: itemData.binding,
            imageUrl: itemData.imageUrl,
            categories: itemData.categories
          }
        });
        console.log('Manual master record created successfully');
        
        // Update identifier to use the generated one
        identifier = manualIdentifier;
      } catch (manualError) {
        console.error('Error creating manual master record:', manualError);
        return res.status(400).json({
          success: false,
          error: 'Failed to create manual master record',
          details: manualError
        });
      }
    }

    // Create new item (PostgreSQL auto-generates sequential ID)
    // All items now have an identifier (either barcode or generated for manual entries)
    console.log('=== CREATING ITEM ===');
    console.log('Item data to create:', JSON.stringify(itemData, null, 2));
    console.log('Creating item with identifier:', identifier);
    
    let item;
    try {
      // All items now have an identifier and master relation
      console.log('Creating item with identifier:', identifier);
      item = await prisma.item.create({
        data: {
          isbn: identifier,
          conditionGrade: validatedData.conditionGrade,
          conditionNotes: validatedData.conditionNotes,
          costCents: validatedData.costCents,
          currentStatus: 'INTAKE'
        },
        include: {
          isbnMaster: true
        }
      });
      console.log('Item created successfully with ID:', item.id);
    } catch (itemError) {
      console.error('Error creating item:', itemError);
      return res.status(400).json({
        success: false,
        error: 'Failed to create item',
        details: itemError
      });
    }

    // Log status change
    await prisma.itemStatusHistory.create({
      data: {
        itemId: item.id, // Now using the auto-generated integer ID
        fromStatus: null,
        toStatus: 'INTAKE',
        channel: 'INTAKE',
        note: 'Item created during intake process'
      }
    });

    // Check if this is a duplicate intake
    const isDuplicate = existingItems.length > 0;
    const duplicateWarning = isDuplicate ? {
      isDuplicate: true,
      message: `⚠️ This book has been previously intaken! Found ${existingItems.length} existing item(s).`,
      existingItems: existingItems.map(item => ({
        id: item.id,
        status: item.currentStatus,
        intakeDate: item.intakeDate,
        location: item.currentLocation
      })),
      recommendation: 'A new label is needed for this additional copy.'
    } : { isDuplicate: false };

    // Invalidate dashboard cache since stats may have changed
    invalidateDashboardCache();

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      duplicate: duplicateWarning,
      data: {
        item,
        internalId: item.id, // Return the simple integer ID
        // All items now have isbnMaster data, so no need for separate metadata
        zplTemplate: `/zpl/mercania_item_label.zpl?internalId=${item.id}&itemTitle=${encodeURIComponent(itemData.title)}&intakeDate=${new Date().toISOString().split('T')[0]}`
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Intake error:', error);
    console.error('Error stack:', (error as Error).stack);
    console.error('Request body:', req.body);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /intake/:isbn - Get ISBN metadata (for frontend preview)
router.get('/:isbn', async (req, res): Promise<any> => {
  try {
    const { isbn } = req.params;
    
    if (!/^\d{10,13}$/.test(isbn)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ISBN format (must be 10 or 13 digits)'
      });
    }

    // Pad to 13 digits if needed
    const isbn13 = isbn.length === 10 ? `978${isbn}` : isbn;

    // Lookup ISBN metadata
    const bookData = await lookupIsbn(isbn13);
    
    res.json({
      success: true,
      data: {
        ...bookData,
        isbn: isbn // Include the original ISBN in the response
      },
      source: process.env.ISBNDB_API_KEY ? 'isbndb' : 'mock'
    });

  } catch (error) {
    console.error('ISBN lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;