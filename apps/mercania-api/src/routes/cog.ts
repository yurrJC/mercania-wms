import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const COGCalculationSchema = z.object({
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid start date format"
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid end date format"
  }),
  totalSpent: z.number().positive("Total spent must be positive")
});

// POST /api/cog/calculate - Calculate and apply COG to items
router.post('/calculate', async (req, res): Promise<any> => {
  try {
    const validation = COGCalculationSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: validation.error.errors
      });
    }

    const { startDate, endDate, totalSpent } = validation.data;

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return res.status(400).json({
        success: false,
        error: 'Start date cannot be after end date'
      });
    }

    // Find items within the date range (inclusive of end date)
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999); // Include the entire end date
    
    const items = await prisma.item.findMany({
      where: {
        intakeDate: {
          gte: start.toISOString(),
          lte: endOfDay.toISOString()
        }
      },
      select: {
        id: true,
        intakeDate: true
      }
    });

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No items found in the specified date range'
      });
    }

    // Calculate average cost per item
    const averagePerItem = totalSpent / items.length;
    const averageCents = Math.round(averagePerItem * 100);

    // Update all items with the new cost
    const itemIds = items.map(item => item.id);
    
    await prisma.item.updateMany({
      where: {
        id: {
          in: itemIds
        }
      },
      data: {
        costCents: averageCents
      }
    });

    // Create COG record
    const cogRecord = await prisma.cOGRecord.create({
      data: {
        recordDate: new Date(),
        startDate: start,
        endDate: end,
        totalAmount: totalSpent,
        itemsUpdated: items.length,
        averagePerItem: averagePerItem
      }
    });

    console.log(`COG calculation completed: ${items.length} items updated with average cost $${averagePerItem.toFixed(2)}`);

    res.json({
      success: true,
      data: {
        recordId: cogRecord.id,
        itemsUpdated: items.length,
        averagePerItem: averagePerItem,
        totalSpent: totalSpent,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });

  } catch (error) {
    console.error('COG calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during COG calculation',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// GET /api/cog/records - Get all COG records for reporting
router.get('/records', async (req, res): Promise<any> => {
  try {
    const { page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      prisma.cOGRecord.findMany({
        orderBy: {
          recordDate: 'desc'
        },
        skip,
        take: limitNum
      }),
      prisma.cOGRecord.count()
    ]);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('COG records fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch COG records',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// DELETE /api/cog/records/:id - Delete a COG record and revert item costs
router.delete('/records/:id', async (req, res): Promise<any> => {
  try {
    const recordId = parseInt(req.params.id);
    
    if (isNaN(recordId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid record ID'
      });
    }

    // Find the COG record to get the date range
    const cogRecord = await prisma.cOGRecord.findUnique({
      where: { id: recordId }
    });

    if (!cogRecord) {
      return res.status(404).json({
        success: false,
        error: 'COG record not found'
      });
    }

    // Find items that were affected by this COG calculation
    const endOfDay = new Date(cogRecord.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const affectedItems = await prisma.item.findMany({
      where: {
        intakeDate: {
          gte: cogRecord.startDate.toISOString(),
          lte: endOfDay.toISOString()
        }
      },
      select: {
        id: true
      }
    });

    // Reset the cost of affected items to 0
    const itemIds = affectedItems.map(item => item.id);
    
    if (itemIds.length > 0) {
      await prisma.item.updateMany({
        where: {
          id: {
            in: itemIds
          }
        },
        data: {
          costCents: 0
        }
      });
    }

    // Delete the COG record
    await prisma.cOGRecord.delete({
      where: { id: recordId }
    });

    console.log(`COG record ${recordId} deleted: ${itemIds.length} items reset to $0.00 cost`);

    res.json({
      success: true,
      data: {
        deletedRecordId: recordId,
        itemsReset: itemIds.length,
        dateRange: {
          start: cogRecord.startDate,
          end: cogRecord.endDate
        }
      }
    });

  } catch (error) {
    console.error('COG record deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during COG record deletion',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router;
