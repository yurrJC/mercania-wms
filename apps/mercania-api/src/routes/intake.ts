import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = Router();

// Validation schemas
const IntakeSchema = z.object({
  isbn: z.string().length(13).regex(/^\d+$/),
  conditionGrade: z.string().optional(),
  conditionNotes: z.string().optional(),
  costCents: z.number().int().min(0).default(0)
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

// POST /intake - Create new item from ISBN
router.post('/', async (req, res) => {
  try {
    // Validate input
    const validatedData = IntakeSchema.parse(req.body);
    
    // Lookup ISBN metadata
    const bookData = await lookupIsbn(validatedData.isbn);
    
    // Create or update ISBN master record
    const isbnMaster = await prisma.isbnMaster.upsert({
      where: { isbn: validatedData.isbn },
      update: {
        title: bookData.title,
        author: bookData.author,
        publisher: bookData.publisher,
        pubYear: bookData.pubYear,
        binding: bookData.binding,
        imageUrl: bookData.imageUrl,
        categories: bookData.categories
      },
      create: {
        isbn: validatedData.isbn,
        title: bookData.title,
        author: bookData.author,
        publisher: bookData.publisher,
        pubYear: bookData.pubYear,
        binding: bookData.binding,
        imageUrl: bookData.imageUrl,
        categories: bookData.categories
      }
    });

    // Create new item (PostgreSQL auto-generates sequential ID)
    const item = await prisma.item.create({
      data: {
        isbn: validatedData.isbn,
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

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
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