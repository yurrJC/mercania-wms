import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = Router();

// GET /lots - Get lots summary with pagination (optimized for scale)
router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100); // Max 100 lots per page
    const skip = (pageNum - 1) * limitNum;

    // Add caching headers since lot data changes less frequently
    res.set('Cache-Control', 'public, max-age=60'); // 1 minute cache
    
    // Use a single optimized query to get both count and data
    const [totalCountResult, lotAggregates] = await Promise.all([
      // Get total count efficiently
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT "lotNumber") as total_count
        FROM items 
        WHERE "lotNumber" IS NOT NULL
      `,
      // Get paginated lot data
      prisma.item.groupBy({
        by: ['lotNumber'],
        where: {
          lotNumber: { not: null }
        },
        _count: { id: true },
        _min: { createdAt: true },
        orderBy: { lotNumber: 'desc' },
        skip,
        take: limitNum
      })
    ]);

    const totalCount = Number((totalCountResult as any)[0].total_count);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get sample titles for each lot (limit to first 3 unique titles)
    const lotSummaries = await Promise.all(
      lotAggregates.map(async (aggregate) => {
        const sampleItems = await prisma.item.findMany({
          where: { lotNumber: aggregate.lotNumber },
          include: { isbnMaster: { select: { title: true } } },
          take: 10, // Get more items to ensure we get 3 unique titles
          orderBy: { id: 'asc' }
        });

        // Extract unique titles (up to 3)
        const uniqueTitles = new Set<string>();
        for (const item of sampleItems) {
          const title = item.isbnMaster?.title || 'Unknown Title';
          uniqueTitles.add(title);
          if (uniqueTitles.size >= 3) break;
        }

        return {
          lotNumber: aggregate.lotNumber!,
          itemCount: aggregate._count.id,
          createdAt: aggregate._min.createdAt!,
          sampleTitles: Array.from(uniqueTitles)
        };
      })
    );

    res.json({
      success: true,
      data: lotSummaries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Get lots summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Validation schema for lot creation
const CreateLotSchema = z.object({
  lotNumber: z.number().int().min(1),
  itemIds: z.array(z.number().int().min(1)).min(1)
});

// POST /lots - Create a new lot
router.post('/', async (req, res) => {
  try {
    const validatedData = CreateLotSchema.parse(req.body);

    // Check if all items exist and are not already in a lot
    const items = await prisma.item.findMany({
      where: {
        id: { in: validatedData.itemIds }
      },
      include: { isbnMaster: true }
    });

    if (items.length !== validatedData.itemIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more items not found'
      });
    }

    // Check if any items are already in a lot
    const itemsInLot = items.filter(item => item.lotNumber !== null);
    if (itemsInLot.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Items already in lot: ${itemsInLot.map(item => `#${item.id}`).join(', ')}`
      });
    }

    // Update all items with the lot number
    await prisma.item.updateMany({
      where: {
        id: { in: validatedData.itemIds }
      },
      data: {
        lotNumber: validatedData.lotNumber
      }
    });

    // Log status changes for all items
    const statusHistoryPromises = validatedData.itemIds.map(itemId => 
      prisma.itemStatusHistory.create({
        data: {
          itemId: itemId,
          fromStatus: null,
          toStatus: 'INTAKE', // Keep current status but log the lot creation
          channel: 'LOT_CREATION',
          note: `Added to lot #${validatedData.lotNumber}`
        }
      })
    );

    await Promise.all(statusHistoryPromises);

    // Fetch updated items
    const updatedItems = await prisma.item.findMany({
      where: {
        id: { in: validatedData.itemIds }
      },
      include: { isbnMaster: true }
    });

    res.status(201).json({
      success: true,
      message: `Lot #${validatedData.lotNumber} created with ${validatedData.itemIds.length} items`,
      data: {
        lotNumber: validatedData.lotNumber,
        items: updatedItems
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

    console.error('Create lot error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /lots/:lotNumber - Get all items in a lot
router.get('/:lotNumber', async (req, res) => {
  try {
    const { lotNumber } = req.params;
    const lotNum = parseInt(lotNumber);

    if (isNaN(lotNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lot number'
      });
    }

    const items = await prisma.item.findMany({
      where: { lotNumber: lotNum },
      include: { isbnMaster: true },
      orderBy: { id: 'asc' }
    });

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lot not found'
      });
    }

    res.json({
      success: true,
      data: {
        lotNumber: lotNum,
        items
      }
    });

  } catch (error) {
    console.error('Get lot error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// DELETE /lots/:lotNumber - Remove lot (ungroup items)
router.delete('/:lotNumber', async (req, res) => {
  try {
    const { lotNumber } = req.params;
    const lotNum = parseInt(lotNumber);

    if (isNaN(lotNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lot number'
      });
    }

    // Check if lot exists
    const items = await prisma.item.findMany({
      where: { lotNumber: lotNum }
    });

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Lot not found'
      });
    }

    // Remove lot number from all items
    await prisma.item.updateMany({
      where: { lotNumber: lotNum },
      data: { lotNumber: null }
    });

    // Log the ungrouping
    const statusHistoryPromises = items.map(item => 
      prisma.itemStatusHistory.create({
        data: {
          itemId: item.id,
          fromStatus: null,
          toStatus: item.currentStatus,
          channel: 'LOT_DELETION',
          note: `Removed from lot #${lotNum}`
        }
      })
    );

    await Promise.all(statusHistoryPromises);

    // Add cache invalidation headers to force refresh
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('X-Lot-Invalidated', lotNum.toString());

    res.json({
      success: true,
      message: `Lot #${lotNum} ungrouped (${items.length} items)`,
      invalidatedLot: lotNum
    });

  } catch (error) {
    console.error('Delete lot error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /lots/:lotNumber/remove - Remove a single item from a lot
router.post('/:lotNumber/remove', async (req, res) => {
  try {
    const { lotNumber } = req.params;
    const lotNum = parseInt(lotNumber);
    const { itemId } = req.body;

    if (isNaN(lotNum) || !itemId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lot number or item ID'
      });
    }

    // Check if the item exists and is in this lot
    const item = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    if (item.lotNumber !== lotNum) {
      return res.status(400).json({
        success: false,
        error: 'Item is not in this lot'
      });
    }

    // Remove the item from the lot
    await prisma.item.update({
      where: { id: itemId },
      data: { lotNumber: null }
    });

    // Log the change
    await prisma.itemStatusHistory.create({
      data: {
        itemId: itemId,
        fromStatus: null,
        toStatus: item.currentStatus,
        channel: 'LOT_REMOVAL',
        note: `Removed from lot #${lotNum}`
      }
    });

    // Check if this was the last item in the lot
    const remainingItems = await prisma.item.count({
      where: { lotNumber: lotNum }
    });

    res.json({
      success: true,
      message: `Item removed from lot #${lotNum}`,
      lotEmpty: remainingItems === 0
    });

  } catch (error) {
    console.error('Remove item from lot error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
