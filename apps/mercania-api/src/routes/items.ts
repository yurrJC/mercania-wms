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
    const { status, location, isbn, barcode, search, lotNumber, sort, page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100); // Max 100 items per page
    const skip = (pageNum - 1) * limitNum;

    // Build optimized where clause
    const where: any = {};
    let cacheKey = 'items';
    let cacheDuration = 60; // Default 1 minute
    
    // Basic filters with optimized indexing
    if (status) {
      where.currentStatus = status;
      cacheKey += `_status_${status}`;
    }
    
    if (location) {
      where.currentLocation = location;
      cacheKey += `_loc_${location}`;
      cacheDuration = 30; // Location data changes more frequently
    }
    
    // Lot number filtering (highly cacheable)
    if (lotNumber) {
      const lotNum = parseInt(String(lotNumber));
      if (!isNaN(lotNum) && lotNum > 0) { // Validate positive integers only
        where.lotNumber = lotNum;
        cacheKey += `_lot_${lotNum}`;
        cacheDuration = 300; // 5 minutes - lot composition rarely changes
        
        // Additional validation: check if lot actually exists
        const lotExists = await prisma.item.findFirst({
          where: { lotNumber: lotNum },
          select: { id: true }
        });
        
        if (!lotExists) {
          // Lot doesn't exist - return empty result immediately with short cache
          res.set('Cache-Control', 'public, max-age=10'); // 10 seconds for non-existent lots
          res.set('X-Cache-Key', `${cacheKey}_empty`);
          res.set('X-Query-Time', '0ms');
          res.set('X-Result-Count', '0');
          
          return res.json({
            success: true,
            data: {
              items: [],
              pagination: {
                page: pageNum,
                limit: limitNum,
                total: 0,
                pages: 0
              },
              meta: {
                queryTime: '0ms',
                cacheKey: `${cacheKey}_empty`,
                cacheDuration: 10,
                appliedFilters: 1,
                hasLotFilter: true,
                lotExists: false
              }
            }
          });
        }
      }
    }
    
    // Barcode search (ISBN, UPC, or any product barcode) - highly specific, good for caching
    const barcodeValue = barcode || isbn; // Support both 'barcode' and 'isbn' parameters
    if (barcodeValue) {
      const barcodeStr = String(barcodeValue).trim();
      // Allow real barcodes (10+ digits) or internal identifiers (MC/MD/MB prefix)
      if (barcodeStr.length >= 10 || /^M[BCD]\d+$/.test(barcodeStr)) {
        where.isbn = barcodeStr; // Note: Still using 'isbn' field in database for now
        cacheKey += `_barcode_${barcodeStr}`;
        cacheDuration = 3600; // 1 hour - barcode data is very stable
      }
    }
    
    // ID search (specific item lookup) - only for reasonable integer values
    if (search) {
      const searchId = parseInt(String(search));
      // Only treat as ID if it's a reasonable integer (not a large ISBN)
      if (!isNaN(searchId) && searchId > 0 && searchId < 2147483647) { // INT4 max value
        where.id = searchId;
        cacheKey += `_id_${searchId}`;
        cacheDuration = 1800; // 30 minutes - specific item data is stable
      }
    }

    // Add sort parameter to cache key
    if (sort) {
      cacheKey += `_sort_${String(sort)}`;
    }
    
    // Set intelligent caching based on query type
    const hasSpecificFilters = lotNumber || isbn || search;
    const finalCacheDuration = hasSpecificFilters ? cacheDuration : 30;
    
    res.set('Cache-Control', `public, max-age=${finalCacheDuration}`);
    res.set('X-Cache-Key', cacheKey); // Debug header for cache monitoring
    
    console.log('Items API - Where clause:', JSON.stringify(where));
    console.log('Items API - Cache duration:', finalCacheDuration, 'seconds');

    // Performance monitoring
    const queryStart = Date.now();
    
    // Optimized queries with selective loading
    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        select: {
          // Only select needed fields for better performance
          id: true,
          isbn: true,
          conditionGrade: true,
          conditionNotes: true,
          costCents: true,
          intakeDate: true,
          currentStatus: true,
          currentLocation: true,
          lotNumber: true,
          isbnMaster: {
            select: {
              title: true,
              author: true,
              publisher: true,
              pubYear: true,
              binding: true,
              imageUrl: true
            }
          }
        },
        orderBy: (() => {
          // Dynamic sorting based on sort parameter
          const sortParam = String(sort || '');
          
          switch (sortParam) {
            case 'id_asc':
              return [{ id: 'asc' }]; // ID low to high
            case 'id_desc':
              return [{ id: 'desc' }]; // ID high to low
            default:
              // Default: optimized for lot-based operations
              return [
                { lotNumber: 'asc' }, // Group by lot first
                { id: 'desc' }        // Then by newest ID
              ];
          }
        })(),
        skip,
        take: limitNum
      }),
      // Use a more efficient count query for large datasets
      lotNumber ? 
        prisma.item.count({ where: { lotNumber: parseInt(String(lotNumber)) } }) :
      prisma.item.count({ where })
    ]);
    
    const queryTime = Date.now() - queryStart;
    
    // Add performance headers for monitoring
    res.set('X-Query-Time', `${queryTime}ms`);
    res.set('X-Result-Count', total.toString());
    
    // Log slow queries for optimization
    if (queryTime > 1000) { // Log queries taking more than 1 second
      console.warn(`Slow query detected: ${queryTime}ms for filter:`, JSON.stringify(where));
    }
    
    console.log(`Items API - Query completed in ${queryTime}ms, returned ${items.length}/${total} items`);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        // Add metadata for debugging and monitoring
        meta: {
          queryTime: `${queryTime}ms`,
          cacheKey,
          cacheDuration: finalCacheDuration,
          appliedFilters: Object.keys(where).length,
          hasLotFilter: !!lotNumber
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

// PATCH /items/:id - Update individual item
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const itemId = parseInt(id);

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    const { currentLocation, currentStatus, conditionGrade, conditionNotes } = req.body;

    // Build update object
    const updateData: any = {};
    if (currentLocation !== undefined) updateData.currentLocation = currentLocation;
    if (currentStatus !== undefined) updateData.currentStatus = currentStatus;
    if (conditionGrade !== undefined) updateData.conditionGrade = conditionGrade;
    if (conditionNotes !== undefined) updateData.conditionNotes = conditionNotes;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // Check if item exists
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    // Update the item
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: updateData,
      include: { isbnMaster: true }
    });

    // Auto-update status to STORED when location is assigned
    if (currentLocation && currentLocation !== existingItem.currentLocation) {
      // If no status was explicitly provided and item is being located, set to STORED
      if (!currentStatus && existingItem.currentStatus === 'INTAKE') {
        await prisma.item.update({
          where: { id: itemId },
          data: { currentStatus: 'STORED' }
        });
        
        // Log the automatic status change
        await prisma.itemStatusHistory.create({
          data: {
            itemId: itemId,
            fromStatus: existingItem.currentStatus,
            toStatus: 'STORED',
            channel: 'PUTAWAY',
            note: `Location assigned: ${currentLocation} - Status auto-updated to STORED`
          }
        });
      } else {
        // Log just the location change
        await prisma.itemStatusHistory.create({
          data: {
            itemId: itemId,
            fromStatus: existingItem.currentStatus,
            toStatus: currentStatus || existingItem.currentStatus,
            channel: 'PUTAWAY',
            note: `Location updated to ${currentLocation}`
          }
        });
      }
    }

    res.json({
      success: true,
      data: updatedItem,
      message: 'Item updated successfully'
    });

  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PATCH /items/bulk-location - Update location for multiple items
router.patch('/bulk-location', async (req, res) => {
  try {
    const { itemIds, currentLocation } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'itemIds must be a non-empty array'
      });
    }

    if (!currentLocation || typeof currentLocation !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'currentLocation is required and must be a string'
      });
    }

    // Validate all item IDs are numbers
    const validItemIds = itemIds.filter(id => typeof id === 'number' && id > 0);
    if (validItemIds.length !== itemIds.length) {
      return res.status(400).json({
        success: false,
        error: 'All itemIds must be positive numbers'
      });
    }

    // Check which items exist
    const existingItems = await prisma.item.findMany({
      where: { id: { in: validItemIds } },
      select: { id: true, currentStatus: true, currentLocation: true }
    });

    if (existingItems.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No items found with provided IDs'
      });
    }

    // Update all items with location
    await prisma.item.updateMany({
      where: { id: { in: validItemIds } },
      data: { currentLocation }
    });

    // Auto-update status to STORED for items currently in INTAKE
    const intakeItems = existingItems.filter(item => item.currentStatus === 'INTAKE');
    if (intakeItems.length > 0) {
      await prisma.item.updateMany({
        where: { 
          id: { in: intakeItems.map(item => item.id) },
          currentStatus: 'INTAKE'
        },
        data: { currentStatus: 'STORED' }
      });
    }

    // Log status changes for all items
    const statusHistoryPromises = existingItems.map(item => {
      const wasIntake = item.currentStatus === 'INTAKE';
      return prisma.itemStatusHistory.create({
        data: {
          itemId: item.id,
          fromStatus: item.currentStatus,
          toStatus: wasIntake ? 'STORED' : item.currentStatus,
          channel: 'BULK_PUTAWAY',
          note: wasIntake 
            ? `Bulk location assigned: ${currentLocation} - Status auto-updated to STORED`
            : `Bulk location update to ${currentLocation}`
        }
      });
    });

    await Promise.all(statusHistoryPromises);

    res.json({
      success: true,
      data: {
        updatedCount: existingItems.length,
        location: currentLocation,
        itemIds: existingItems.map(item => item.id)
      },
      message: `${existingItems.length} items updated with location ${currentLocation}`
    });

  } catch (error) {
    console.error('Bulk update location error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;