import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = Router();

// Validation schemas
const PutawaySchema = z.object({
  location: z.string().min(1).max(20)
});

const ListingSchema = z.object({
  channel: z.string().min(1).max(50),
  externalId: z.string().optional(),
  priceCents: z.number().int().min(1)
});

const StatusChangeSchema = z.object({
  toStatus: z.enum(['INTAKE', 'STORED', 'LISTED', 'RESERVED', 'SOLD', 'RETURNED', 'DISCARDED']),
  channel: z.string().optional(),
  note: z.string().optional()
});

// PUT /items/:id/putaway - Assign shelf location
router.put('/:id/putaway', async (req, res) => {
  try {
    const { id } = req.params;
    const itemId = parseInt(id); // Convert string to integer
    const validatedData = PutawaySchema.parse(req.body);

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    // Get current item
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { isbnMaster: true }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    if (item.currentStatus !== 'INTAKE') {
      return res.status(400).json({
        success: false,
        error: 'Item must be in INTAKE status for putaway'
      });
    }

    // Update item location and status
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: {
        currentLocation: validatedData.location,
        currentStatus: 'STORED'
      },
      include: { isbnMaster: true }
    });

    // Log status change
    await prisma.itemStatusHistory.create({
      data: {
        itemId: itemId,
        fromStatus: 'INTAKE',
        toStatus: 'STORED',
        channel: 'PUTAWAY',
        note: `Moved to location: ${validatedData.location}`
      }
    });

    res.json({
      success: true,
      message: 'Item putaway successful',
      data: updatedItem
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Putaway error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /items/:id/list - Create sales listing
router.post('/:id/list', async (req, res) => {
  try {
    const { id } = req.params;
    const itemId = parseInt(id); // Convert string to integer
    const validatedData = ListingSchema.parse(req.body);

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    // Get current item
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { isbnMaster: true }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    if (item.currentStatus !== 'STORED') {
      return res.status(400).json({
        success: false,
        error: 'Item must be in STORED status for listing'
      });
    }

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        itemId: itemId,
        channel: validatedData.channel,
        externalId: validatedData.externalId,
        priceCents: validatedData.priceCents
      }
    });

    // Update item status
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: { currentStatus: 'LISTED' },
      include: { isbnMaster: true }
    });

    // Log status change
    await prisma.itemStatusHistory.create({
      data: {
        itemId: itemId,
        fromStatus: 'STORED',
        toStatus: 'LISTED',
        channel: validatedData.channel,
        note: `Listed for ${validatedData.priceCents / 100}`
      }
    });

    res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      data: {
        listing,
        item: updatedItem,
        sku: `${item.currentLocation}-${itemId}`
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

    console.error('Listing error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PUT /items/:id/status - Generic status transition
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const itemId = parseInt(id); // Convert string to integer
    const validatedData = StatusChangeSchema.parse(req.body);

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    // Get current item
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { isbnMaster: true }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    // Update item status
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: { currentStatus: validatedData.toStatus },
      include: { isbnMaster: true }
    });

    // Log status change
    await prisma.itemStatusHistory.create({
      data: {
        itemId: itemId,
        fromStatus: item.currentStatus,
        toStatus: validatedData.toStatus,
        channel: validatedData.channel || 'MANUAL',
        note: validatedData.note
      }
    });

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: updatedItem
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Status change error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /items/:id - Get item details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const itemId = parseInt(id); // Convert string to integer

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        isbnMaster: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 10
        },
        listings: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });

  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /items - List items with filters
router.get('/', async (req, res) => {
  try {
    const { status, location, isbn, search, page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    
    // Basic filters
    if (status) where.currentStatus = status;
    if (location) where.currentLocation = location;
    
    // Handle legacy isbn parameter
    if (isbn) {
      where.isbn = isbn;
    }
    
    // Handle search parameter for ID search
    if (search) {
      const searchId = parseInt(String(search));
      if (!isNaN(searchId)) {
        where.id = searchId;
      }
    }

    // console.log('Search where clause:', JSON.stringify(where));

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: { isbnMaster: true },
        orderBy: { id: 'desc' }, // Order by ID descending (newest first)
        skip,
        take: limitNum
      }),
      prisma.item.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('List items error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// DELETE /items/:id - Delete an item
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const itemId = parseInt(id);

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    // Check if item exists
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { 
        listings: true,
        orderLines: true,
        statusHistory: true
      }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    // Check if item can be deleted (no active listings or sales)
    const activeListings = item.listings.filter(listing => listing.status === 'ACTIVE');
    if (activeListings.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete item with active listings'
      });
    }

    if (item.orderLines.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete item that has been sold'
      });
    }

    // Delete related records first (cascade delete)
    await prisma.itemStatusHistory.deleteMany({
      where: { itemId: itemId }
    });

    await prisma.listing.deleteMany({
      where: { itemId: itemId }
    });

    // Delete the item
    await prisma.item.delete({
      where: { id: itemId }
    });

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });

  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;