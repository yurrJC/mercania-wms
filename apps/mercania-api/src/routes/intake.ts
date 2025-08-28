import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import dvdRoutes from './dvd';

const router = Router();

// Mount DVD routes
router.use('/dvd', dvdRoutes);

// Validation schemas
const IntakeSchema = z.object({
  isbn: z.string().min(8).max(14).regex(/^\d+$/), // Support both ISBN and UPC
  title: z.string().optional(),
  author: z.string().optional(), // For DVDs, this will be the director
  publisher: z.string().optional(), // For DVDs, this will be the studio
  pubYear: z.number().optional(), // Release year
  binding: z.string().optional(), // For DVDs, this will be the format
  conditionGrade: z.string().optional(),
  conditionNotes: z.string().optional(),
  costCents: z.number().int().min(0).default(0),
  productType: z.string().optional(), // 'BOOK' or 'DVD'
  dvdMetadata: z.object({
    genre: z.string().optional(),
    rating: z.string().optional(),
    runtime: z.number().optional()
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
    isbn?: string;
    isbn13?: string;
    image?: string;
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

    const data: ISBNdbResponse = await response.json();
    
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
router.post('/', async (req, res) => {
  try {
    // Validate input
    const validatedData = IntakeSchema.parse(req.body);
    
    const productType = validatedData.productType || 'BOOK';
    const identifier = validatedData.isbn; // This could be ISBN or UPC
    
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
    } else {
      // For books, lookup ISBN metadata as before
      itemData = await lookupIsbn(identifier);
      
      // Override with any provided data (for manual entries)
      if (validatedData.title) itemData.title = validatedData.title;
      if (validatedData.author) itemData.author = validatedData.author;
      if (validatedData.publisher) itemData.publisher = validatedData.publisher;
      if (validatedData.pubYear) itemData.pubYear = validatedData.pubYear;
      if (validatedData.binding) itemData.binding = validatedData.binding;
    }
    
    // Check for existing items with this identifier (regardless of status)
    const existingItems = await prisma.item.findMany({
      where: { isbn: identifier },
      include: { isbnMaster: true },
      orderBy: { createdAt: 'desc' }
    });

    // Create or update ISBN/UPC master record
    const isbnMaster = await prisma.isbnMaster.upsert({
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

    // Create new item (PostgreSQL auto-generates sequential ID)
    const item = await prisma.item.create({
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

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      duplicate: duplicateWarning,
      data: {
        item,
        internalId: item.id, // Return the simple integer ID
        zplTemplate: `/zpl/mercania_item_label.zpl?internalId=${item.id}&intakeDate=${new Date().toISOString().split('T')[0]}`
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
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /intake/:isbn - Get ISBN metadata (for frontend preview)
router.get('/:isbn', async (req, res) => {
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
      data: bookData,
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