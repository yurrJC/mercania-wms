import { Router } from 'express';
import { z } from 'zod';
import { ulid } from 'ulid';
import { prisma } from '../index';

const router = Router();

// Validation schemas
const IntakeSchema = z.object({
  isbn: z.string().length(13).regex(/^\d+$/),
  conditionGrade: z.string().optional(),
  conditionNotes: z.string().optional(),
  costCents: z.number().int().min(0).default(0)
});

// Mock ISBN lookup function (replace with real API)
async function lookupIsbn(isbn: string) {
  // This would typically call Google Books API, OpenLibrary, etc.
  // For now, return mock data
  const mockBooks: Record<string, any> = {
    '9780140283334': {
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      publisher: 'Penguin Books',
      pubYear: 1998,
      binding: 'Paperback',
      imageUrl: 'https://example.com/gatsby.jpg',
      categories: ['Fiction', 'Classic']
    },
    '9780061120084': {
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      publisher: 'Harper Perennial',
      pubYear: 2006,
      binding: 'Paperback',
      imageUrl: 'https://example.com/mockingbird.jpg',
      categories: ['Fiction', 'Classic']
    }
  };

  return mockBooks[isbn] || {
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

    // Generate unique Internal ID (ULID)
    const internalId = ulid();
    
    // Create new item
    const item = await prisma.item.create({
      data: {
        id: internalId,
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
        itemId: internalId,
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
        internalId,
        zplTemplate: `/zpl/mercania_item_label.zpl?internalId=${internalId}&intakeDate=${new Date().toISOString().split('T')[0]}`
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

// GET /intake/:isbn - Get ISBN metadata
router.get('/:isbn', async (req, res) => {
  try {
    const { isbn } = req.params;
    
    if (!/^\d{13}$/.test(isbn)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ISBN format'
      });
    }

    // Lookup ISBN metadata
    const bookData = await lookupIsbn(isbn);
    
    res.json({
      success: true,
      data: bookData
    });

  } catch (error) {
    console.error('ISBN lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
