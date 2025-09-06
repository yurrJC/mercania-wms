import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { createCOGSRecord } from './cogs.js';
import PDFDocument from 'pdfkit';
import { invalidateDashboardCache, getCachedDashboardStats, setCachedDashboardStats, isDashboardCacheValid } from '../utils/cache';

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

    return res.json({
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
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /items/export - Export full inventory as CSV (Excel-compatible)
router.get('/export', async (req, res) => {
  try {
    // Accept same filters as list endpoint, but no pagination
    const { status, location, lotNumber, sort, search, isbn, barcode, title } = req.query as Record<string, string>;

    const where: any = {};
    if (status) where.currentStatus = status;
    if (location) where.currentLocation = location;
    if (lotNumber) {
      const lotNum = parseInt(lotNumber);
      if (!isNaN(lotNum)) where.lotNumber = lotNum;
    }
    const barcodeValue = barcode || isbn;
    if (barcodeValue) {
      const barcodeStr = String(barcodeValue).trim();
      if (barcodeStr.length > 0) {
        where.isbn = {
          contains: barcodeStr,
          mode: 'insensitive'
        };
      }
    }
    if (search) {
      const id = parseInt(search);
      if (!isNaN(id)) where.id = id;
    }
    if (title) {
      const titleStr = String(title).trim();
      if (titleStr.length > 0) {
        where.isbnMaster = {
          title: {
            contains: titleStr,
            mode: 'insensitive'
          }
        };
      }
    }

    const orderBy: any[] = [];
    if (sort === 'id_desc') orderBy.push({ id: 'desc' });
    else if (sort === 'id_asc') orderBy.push({ id: 'asc' });
    else orderBy.push({ lotNumber: 'asc' }, { id: 'desc' });

    const items = await prisma.item.findMany({
      where,
      orderBy,
      select: {
        id: true,
        isbn: true,
        conditionGrade: true,
        conditionNotes: true,
        costCents: true,
        intakeDate: true,
        listedDate: true,
        soldDate: true,
        currentStatus: true,
        currentLocation: true,
        lotNumber: true,
        dvdMetadata: true,
        isbnMaster: {
          select: { title: true, author: true, publisher: true, binding: true, imageUrl: true, pubYear: true }
        }
      } as any
    });

    const header = ['ID','SKU','Status','Location','Lot','Listed Date','Sold Date','ISBN','Title','Author','Publisher','Binding','Created'];
    const rows = items.map(it => [
      it.id,
      `${it.currentLocation || 'TBD'}-${it.id}`,
      it.currentStatus || '',
      it.currentLocation || '',
      it.lotNumber ?? '',
      it.listedDate ? new Date(it.listedDate).toISOString() : '',
      it.soldDate ? new Date(it.soldDate).toISOString() : '',
      it.isbn || '',
      it.isbnMaster?.title || '',
      it.isbnMaster?.author || '',
      it.isbnMaster?.publisher || '',
      it.isbnMaster?.binding || '',
      it.createdAt.toISOString()
    ]);

    const escapeCsv = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [header, ...rows].map(r => r.map(escapeCsv).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inventory_export_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ success: false, error: 'Failed to export inventory' });
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

    return res.status(201).json({
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
    return res.status(500).json({
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

    return res.json({
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
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /items/putaway-activity - Get recent putaway activity for PDF report
router.get('/putaway-activity', async (req, res) => {
  try {
    const { days = '7', limit = '50' } = req.query;
    const daysNum = Math.min(parseInt(days as string) || 7, 30); // Max 30 days
    const limitNum = Math.min(parseInt(limit as string) || 50, 100); // Max 100 records
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Get putaway activities from ItemStatusHistory
    const activities = await prisma.itemStatusHistory.findMany({
      where: {
        channel: 'PUTAWAY',
        changedAt: {
          gte: cutoffDate
        }
      },
      include: {
        item: {
          include: {
            isbnMaster: true
          }
        }
      },
      orderBy: {
        changedAt: 'desc'
      },
      take: limitNum
    });

    // Transform data to include old and new SKU information
    const transformedActivities = activities.map(activity => {
      const item = activity.item;
      const note = activity.note || '';
      
      // Extract old and new location from note
      // Notes like "Moved to location: B01" or "Location updated to C07"
      const locationMatch = note.match(/(?:to location|to):\s*([A-Z0-9]+)/i) || 
                           note.match(/(?:assigned|updated to)\s+([A-Z0-9]+)/i);
      const newLocation = locationMatch ? locationMatch[1] : item.currentLocation;
      
      // For old location, we need to infer it was likely null/TBD before putaway
      const oldLocation = activity.fromStatus === 'INTAKE' ? null : 'Unknown';
      
      return {
        id: activity.id,
        itemId: item.id,
        internalId: item.id,
        title: item.isbnMaster?.title || 'Unknown Title',
        author: item.isbnMaster?.author || 'Unknown Author',
        isbn: item.isbn,
        oldSKU: oldLocation ? `${oldLocation}-${item.id}` : `TBD-${item.id}`,
        newSKU: newLocation ? `${newLocation}-${item.id}` : `TBD-${item.id}`,
        oldLocation: oldLocation,
        newLocation: newLocation,
        timestamp: activity.changedAt,
        note: note,
        fromStatus: activity.fromStatus,
        toStatus: activity.toStatus
      };
    });

    res.set('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
    return res.json({
      success: true,
      data: transformedActivities,
      meta: {
        total: transformedActivities.length,
        days: daysNum,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Putaway activity fetch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /items/putaway-activity/pdf - Generate PDF report of recent putaway activity
router.get('/putaway-activity/pdf', async (req, res) => {
  try {
    const { days = '7', limit = '50' } = req.query;
    const daysNum = Math.min(parseInt(days as string) || 7, 30); // Max 30 days
    const limitNum = Math.min(parseInt(limit as string) || 50, 100); // Max 100 records
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Get putaway activities from ItemStatusHistory
    const activities = await prisma.itemStatusHistory.findMany({
      where: {
        channel: 'PUTAWAY',
        changedAt: {
          gte: cutoffDate
        }
      },
      include: {
        item: {
          include: {
            isbnMaster: true
          }
        }
      },
      orderBy: {
        changedAt: 'desc'
      },
      take: limitNum
    });

    // Transform data to include old and new SKU information
    const transformedActivities = activities.map(activity => {
      const item = activity.item;
      const note = activity.note || '';
      
      // Extract old and new location from note
      const locationMatch = note.match(/(?:to location|to):\s*([A-Z0-9]+)/i) || 
                           note.match(/(?:assigned|updated to)\s+([A-Z0-9]+)/i);
      const newLocation = locationMatch ? locationMatch[1] : item.currentLocation;
      
      // For old location, we need to infer it was likely null/TBD before putaway
      const oldLocation = activity.fromStatus === 'INTAKE' ? null : 'Unknown';
      
      return {
        internalId: item.id,
        title: item.isbnMaster?.title || 'Unknown Title',
        author: item.isbnMaster?.author || 'Unknown Author',
        isbn: item.isbn,
        oldSKU: oldLocation ? `${oldLocation}-${item.id}` : `TBD-${item.id}`,
        newSKU: newLocation ? `${newLocation}-${item.id}` : `TBD-${item.id}`,
        timestamp: activity.changedAt,
        note: note
      };
    });

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="putaway-activity-${new Date().toISOString().slice(0, 10)}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(18).font('Helvetica-Bold');
    doc.text('Mercania WMS - Recent Putaway Activity Report', 50, 50);
    
    doc.fontSize(12).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 75);
    doc.text(`Period: Last ${daysNum} days`, 50, 90);
    doc.text(`Total Records: ${transformedActivities.length}`, 50, 105);

    // Add table headers
    const startY = 140;
    const rowHeight = 20;
    let currentY = startY;

    // Table column positions
    const cols = {
      internalId: 50,
      oldSKU: 120,
      newSKU: 220,
      title: 320,
      timestamp: 480
    };

    // Header row
    doc.fontSize(10).font('Helvetica-Bold');
    doc.rect(40, currentY - 5, 520, rowHeight).stroke();
    
    doc.text('Internal ID', cols.internalId, currentY);
    doc.text('Old SKU', cols.oldSKU, currentY);
    doc.text('New SKU', cols.newSKU, currentY);
    doc.text('Title', cols.title, currentY);
    doc.text('Date/Time', cols.timestamp, currentY);

    currentY += rowHeight;

    // Data rows
    doc.font('Helvetica').fontSize(9);
    
    transformedActivities.forEach((activity, index) => {
      // Check if we need a new page
      if (currentY > 720) {
        doc.addPage();
        currentY = 50;
        
        // Repeat headers on new page
        doc.fontSize(10).font('Helvetica-Bold');
        doc.rect(40, currentY - 5, 520, rowHeight).stroke();
        
        doc.text('Internal ID', cols.internalId, currentY);
        doc.text('Old SKU', cols.oldSKU, currentY);
        doc.text('New SKU', cols.newSKU, currentY);
        doc.text('Title', cols.title, currentY);
        doc.text('Date/Time', cols.timestamp, currentY);
        
        currentY += rowHeight;
        doc.font('Helvetica').fontSize(9);
      }

      // Alternate row background
      if (index % 2 === 1) {
        doc.rect(40, currentY - 5, 520, rowHeight).fillAndStroke('#f8f9fa', '#e9ecef');
      } else {
        doc.rect(40, currentY - 5, 520, rowHeight).stroke();
      }

      // Row data
      doc.fillColor('black');
      doc.text(activity.internalId.toString(), cols.internalId, currentY);
      doc.text(activity.oldSKU, cols.oldSKU, currentY);
      doc.text(activity.newSKU, cols.newSKU, currentY);
      
      // Truncate title if too long
      const truncatedTitle = activity.title.length > 20 ? 
        activity.title.substring(0, 20) + '...' : activity.title;
      doc.text(truncatedTitle, cols.title, currentY);
      
      doc.text(activity.timestamp.toLocaleString(), cols.timestamp, currentY);

      currentY += rowHeight;
    });

    // Add footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('gray');
      doc.text(`Page ${i + 1} of ${pageCount}`, 50, 770);
      doc.text('Mercania WMS © 2025', 450, 770);
    }

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate PDF report'
    });
  }
});

// POST /items/putaway-activity/pdf - Generate PDF for current session rows sent by client
router.post('/putaway-activity/pdf', async (req, res) => {
  try {
    const RowsSchema = z.object({
      rows: z.array(z.object({
        internalId: z.number(),
        oldSKU: z.string(),
        newSKU: z.string(),
        timestamp: z.union([z.string(), z.date()])
      })).min(1)
    });

    const parsed = RowsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const rows = parsed.data.rows.map(r => ({
      internalId: r.internalId,
      oldSKU: r.oldSKU,
      newSKU: r.newSKU,
      timestamp: new Date(r.timestamp)
    }));

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="putaway-session-${new Date().toISOString().slice(0, 10)}.pdf"`);

    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold');
    doc.text('Mercania WMS - Putaway Session Report', 50, 50);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 75);
    doc.text(`Records: ${rows.length}`, 50, 90);

    // Table
    const startY = 120;
    const rowHeight = 20;
    let currentY = startY;

    const cols = {
      internalId: 50,
      oldSKU: 150,
      newSKU: 300,
      timestamp: 450
    };

    doc.fontSize(10).font('Helvetica-Bold');
    doc.rect(40, currentY - 5, 520, rowHeight).stroke();
    doc.text('Internal ID', cols.internalId, currentY);
    doc.text('Old SKU', cols.oldSKU, currentY);
    doc.text('New SKU', cols.newSKU, currentY);
    doc.text('Date/Time', cols.timestamp, currentY);
    currentY += rowHeight;

    doc.font('Helvetica').fontSize(10);
    rows.forEach((r, index) => {
      if (currentY > 720) {
        doc.addPage();
        currentY = 50;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.rect(40, currentY - 5, 520, rowHeight).stroke();
        doc.text('Internal ID', cols.internalId, currentY);
        doc.text('Old SKU', cols.oldSKU, currentY);
        doc.text('New SKU', cols.newSKU, currentY);
        doc.text('Date/Time', cols.timestamp, currentY);
        currentY += rowHeight;
        doc.font('Helvetica').fontSize(10);
      }

      if (index % 2 === 1) {
        doc.rect(40, currentY - 5, 520, rowHeight).fillAndStroke('#f8f9fa', '#e9ecef');
      } else {
        doc.rect(40, currentY - 5, 520, rowHeight).stroke();
      }

      doc.fillColor('black');
      doc.text(String(r.internalId), cols.internalId, currentY);
      doc.text(r.oldSKU, cols.oldSKU, currentY);
      doc.text(r.newSKU, cols.newSKU, currentY);
      doc.text(r.timestamp.toLocaleString(), cols.timestamp, currentY);

      currentY += rowHeight;
    });

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('gray');
      doc.text(`Page ${i + 1} of ${totalPages}`, 50, 770);
      doc.text('Mercania WMS © 2025', 450, 770);
    }

    doc.end();
  } catch (error) {
    console.error('Session PDF generation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate session PDF' });
  }
});

// GET /items/dashboard-stats - Get dashboard statistics (optimized with caching)
router.get('/dashboard-stats', async (req, res) => {
  try {
    // Check cache first
    const cachedData = getCachedDashboardStats();
    if (cachedData) {
      res.set('Cache-Control', 'public, max-age=30');
      res.set('X-Cache-Status', 'HIT');
      return res.json(cachedData);
    }

    // Use a single optimized query instead of multiple queries
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN "currentStatus" = 'STORED' THEN 1 END) as stored_count,
        COUNT(CASE WHEN "currentStatus" = 'LISTED' THEN 1 END) as listed_count,
        COUNT(CASE WHEN "currentStatus" = 'INTAKE' THEN 1 END) as intake_count,
        COUNT(CASE WHEN "currentStatus" = 'SOLD' THEN 1 END) as sold_count,
        COALESCE(SUM(CASE WHEN "currentStatus" = 'SOLD' THEN "costCents" ELSE 0 END), 0) as total_cogs_cents
      FROM items
    `;

    const result = (stats as any[])[0];
    const totalCOGS = result.total_cogs_cents ? Number(result.total_cogs_cents) / 100 : 0;

    // Format status breakdown for frontend in workflow order
    const statusData = [
      { status: 'INTAKE', count: Number(result.intake_count) },
      { status: 'STORED', count: Number(result.stored_count) },
      { status: 'LISTED', count: Number(result.listed_count) },
      { status: 'SOLD', count: Number(result.sold_count) }
    ];

    const responseData = {
      success: true,
      data: {
        totalItems: Number(result.total_items),
        stored: Number(result.stored_count),
        listed: Number(result.listed_count),
        listedValue: totalCOGS, // This is actually COGS, not listed value
        statusBreakdown: statusData
      }
    };

    // Cache the result
    setCachedDashboardStats(responseData);

    res.set('Cache-Control', 'public, max-age=30');
    res.set('X-Cache-Status', 'MISS');
    return res.json(responseData);

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
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

    return res.json({
      success: true,
      data: item
    });

  } catch (error) {
    console.error('Get item error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /items - List items with filters
router.get('/', async (req, res) => {
  try {
    const { status, location, isbn, barcode, search, title, lotNumber, sort, page = '1', limit = '50' } = req.query;
    
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
      // Allow any non-empty barcode search - use contains for partial matches
      if (barcodeStr.length > 0) {
        where.isbn = {
          contains: barcodeStr,
          mode: 'insensitive'
        };
        cacheKey += `_barcode_${barcodeStr}`;
        cacheDuration = 1800; // 30 minutes - partial searches are less stable
      }
    }
    
    // Title search - search in isbnMaster.title
    if (title) {
      const titleStr = String(title).trim();
      if (titleStr.length > 0) {
        // If we already have isbnMaster conditions, we need to combine them
        if (where.isbnMaster) {
          where.isbnMaster = {
            ...where.isbnMaster,
            title: {
              contains: titleStr,
              mode: 'insensitive' // Case-insensitive search
            }
          };
        } else {
          where.isbnMaster = {
            title: {
              contains: titleStr,
              mode: 'insensitive' // Case-insensitive search
            }
          };
        }
        cacheKey += `_title_${titleStr.toLowerCase()}`;
        cacheDuration = 1800; // 30 minutes - title searches are relatively stable
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
          listedDate: true,
          soldDate: true,
          currentStatus: true,
          currentLocation: true,
          lotNumber: true,
          dvdMetadata: true,
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
        } as any,
        orderBy: (() => {
          // Dynamic sorting based on search type and sort parameter
          const sortParam = String(sort || '');
          
          // FIRST COPY PRIORITY: For barcode searches, always return oldest copy first
          const barcodeValue = barcode || isbn;
          if (barcodeValue) {
            const barcodeStr = String(barcodeValue).trim();
            if (barcodeStr.length > 0) {
              console.log(`Barcode search for ${barcodeStr}: Using first-copy priority (ORDER BY id ASC)`);
              return [{ id: 'asc' }]; // Oldest copy first for barcode searches
            }
          }
          
          // For specific ID searches, standard sorting applies
          if (search) {
            const searchId = parseInt(String(search));
            if (!isNaN(searchId) && searchId > 0 && searchId < 2147483647) {
              return [{ id: 'asc' }]; // Simple ID sort for specific item lookup
            }
          }
          
          // Standard sorting for general queries
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
      // Use optimized count query
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

    return res.json({
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
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /items/export - Export full inventory as CSV (streaming for large datasets)
router.get('/export', async (req, res) => {
  try {
    // Reuse existing filters from the list endpoint, but ignore pagination
    const { status, location, lotNumber, sort, search, isbn, barcode } = req.query as Record<string, string>;

    const where: any = {};
    if (status) where.currentStatus = status;
    if (location) where.currentLocation = location;
    if (lotNumber) {
      const lotNum = parseInt(lotNumber);
      if (!isNaN(lotNum)) where.lotNumber = lotNum;
    }
    const barcodeValue = barcode || isbn;
    if (barcodeValue) {
      const barcodeStr = String(barcodeValue).trim();
      if (barcodeStr.length > 0) {
        where.isbn = {
          contains: barcodeStr,
          mode: 'insensitive'
        };
      }
    }
    if (search) {
      const id = parseInt(search);
      if (!isNaN(id)) where.id = id;
    }

    // Sorting
    const orderBy: any[] = [];
    if (sort === 'id_desc') orderBy.push({ id: 'desc' });
    else if (sort === 'id_asc') orderBy.push({ id: 'asc' });
    else orderBy.push({ lotNumber: 'asc' }, { id: 'desc' });

    // Helper function to escape CSV values
    const escapeCsv = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    // Set up streaming response
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inventory_export_${Date.now()}.csv"`);
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Start streaming with UTF-8 BOM for Excel compatibility
    res.write('\uFEFF');
    
    // Write CSV header
    const header = [
      'ID','Status','Location','Lot','Listed Date','Sold Date','ISBN','Title','Author','Publisher','Binding','Created'
    ];
    res.write(header.map(escapeCsv).join(',') + '\n');

    // Stream items in batches to prevent memory issues
    const batchSize = 1000; // Process 1000 items at a time
    let skip = 0;
    let hasMore = true;
    let totalProcessed = 0;

    console.log('Starting streaming export...');

    while (hasMore) {
      // Fetch batch of items
    const items = await prisma.item.findMany({
      where,
      orderBy,
      include: {
        isbnMaster: {
          select: { title: true, author: true, publisher: true, binding: true }
        }
        },
        skip,
        take: batchSize
      });

      // If no more items, we're done
      if (items.length === 0) {
        hasMore = false;
        break;
      }

      // Process and stream this batch
      for (const item of items) {
        const row = [
          item.id,
          item.currentStatus || '',
          item.currentLocation || '',
          item.lotNumber ?? '',
          item.listedDate ? new Date(item.listedDate).toISOString() : '',
          item.soldDate ? new Date(item.soldDate).toISOString() : '',
          item.isbn || '',
          item.isbnMaster?.title || '',
          item.isbnMaster?.author || '',
          item.isbnMaster?.publisher || '',
          item.isbnMaster?.binding || '',
          item.createdAt.toISOString()
        ];
        
        res.write(row.map(escapeCsv).join(',') + '\n');
        totalProcessed++;
      }

      // Update skip for next batch
      skip += batchSize;
      
      // Log progress every 5000 items
      if (totalProcessed % 5000 === 0) {
        console.log(`Exported ${totalProcessed} items so far...`);
      }

      // If we got fewer items than batch size, we're done
      if (items.length < batchSize) {
        hasMore = false;
      }
    }

    console.log(`Streaming export completed. Total items exported: ${totalProcessed}`);
    res.end();

  } catch (error) {
    console.error('Export error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: 'Failed to export inventory' });
    } else {
      // If we already started streaming, just end the response
      res.end();
    }
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

    // Invalidate dashboard cache since stats may have changed
    invalidateDashboardCache();

    return res.json({
      success: true,
      message: 'Item deleted successfully'
    });

  } catch (error) {
    console.error('Delete item error:', error);
    return res.status(500).json({
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

    // Check if item exists and get lot information
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        currentLocation: true,
        currentStatus: true,
        conditionGrade: true,
        conditionNotes: true,
        lotNumber: true
      }
    });

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    // Determine which items to update based on lot membership
    let itemsToUpdate: number[] = [itemId];
    let lotWideUpdate = false;
    
    if (existingItem.lotNumber && currentLocation !== undefined) {
      // If this item is in a lot and we're updating location, update entire lot
      const lotItems = await prisma.item.findMany({
        where: { lotNumber: existingItem.lotNumber },
        select: { id: true }
      });
      itemsToUpdate = lotItems.map(item => item.id);
      lotWideUpdate = true;
    }

    // Update the item(s)
    const updateResult = await prisma.item.updateMany({
      where: { 
        id: { in: itemsToUpdate }
      },
      data: updateData
    });

    // Get the primary updated item with full details for response
    const updatedItem = await prisma.item.findUnique({
      where: { id: itemId },
      include: { isbnMaster: true }
    });

    // Auto-update status to STORED when location is assigned
    if (currentLocation && currentLocation !== existingItem.currentLocation) {
      // If no status was explicitly provided and item is being located, set to STORED
      if (!currentStatus && existingItem.currentStatus === 'INTAKE') {
        await prisma.item.updateMany({
          where: { id: { in: itemsToUpdate } },
          data: { currentStatus: 'STORED' }
        });
        
        // Log the automatic status change for all affected items
        const statusHistoryData = itemsToUpdate.map(id => ({
          itemId: id,
          fromStatus: existingItem.currentStatus,
          toStatus: 'STORED' as any,
          channel: 'PUTAWAY',
          note: lotWideUpdate 
            ? `Lot-wide location assigned: ${currentLocation} - Status auto-updated to STORED (Lot #${existingItem.lotNumber})`
            : `Location assigned: ${currentLocation} - Status auto-updated to STORED`
        }));
        
        await prisma.itemStatusHistory.createMany({
          data: statusHistoryData
        });
      } else {
        // Log just the location change for all affected items
        const statusHistoryData = itemsToUpdate.map(id => ({
          itemId: id,
          fromStatus: existingItem.currentStatus,
          toStatus: (currentStatus || existingItem.currentStatus) as any,
          channel: 'PUTAWAY',
          note: lotWideUpdate
            ? `Lot-wide location update to ${currentLocation} (Lot #${existingItem.lotNumber})`
            : `Location updated to ${currentLocation}`
        }));
        
        await prisma.itemStatusHistory.createMany({
          data: statusHistoryData
        });
      }
    }

    // Invalidate dashboard cache since stats may have changed
    invalidateDashboardCache();

    return res.json({
      success: true,
      data: updatedItem,
      itemsUpdated: updateResult.count,
      lotWideUpdate: lotWideUpdate,
      lotNumber: existingItem.lotNumber,
      message: lotWideUpdate 
        ? `Lot-wide update applied to ${updateResult.count} items in Lot #${existingItem.lotNumber}`
        : 'Item updated successfully'
    });

  } catch (error) {
    console.error('Update item error:', error);
    return res.status(500).json({
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

    // Invalidate dashboard cache since stats may have changed
    invalidateDashboardCache();

    return res.json({
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
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /items/update-dates - Update listed/sold dates for multiple items
router.post('/update-dates', async (req, res): Promise<any> => {
  try {
    const { itemIds, dateType, date } = req.body;

    // Validate input
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Item IDs array is required'
      });
    }

    if (!['listed', 'sold'].includes(dateType)) {
      return res.status(400).json({
        success: false,
        error: 'Date type must be "listed" or "sold"'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required'
      });
    }

    // Validate that all itemIds are positive integers
    const validItemIds = itemIds.filter(id => Number.isInteger(id) && id > 0);
    if (validItemIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid item IDs provided'
      });
    }

    // Check which items exist and get their lot information
    const existingItems = await prisma.item.findMany({
      where: {
        id: {
          in: validItemIds
        }
      },
      select: {
        id: true,
        currentStatus: true,
        lotNumber: true
      }
    });

    if (existingItems.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No items found with the provided IDs'
      });
    }

    const foundItemIds = existingItems.map(item => item.id);
    const notFoundIds = validItemIds.filter(id => !foundItemIds.includes(id));

    // Check if any items are in lots - if so, we need to update entire lots
    const lotsToUpdate = new Set<number>();
    const individualItemIds = new Set<number>();

    for (const item of existingItems) {
      if (item.lotNumber) {
        lotsToUpdate.add(item.lotNumber);
      } else {
        individualItemIds.add(item.id);
      }
    }

    // Get all items in the affected lots
    let allAffectedItems = [...existingItems];
    if (lotsToUpdate.size > 0) {
      const lotItems = await prisma.item.findMany({
        where: {
          lotNumber: {
            in: Array.from(lotsToUpdate)
          }
        },
        select: {
          id: true,
          currentStatus: true,
          lotNumber: true
        }
      });
      
      // Merge with individual items, avoiding duplicates
      const existingItemIds = new Set(existingItems.map(item => item.id));
      const additionalLotItems = lotItems.filter(item => !existingItemIds.has(item.id));
      allAffectedItems = [...existingItems, ...additionalLotItems];
    }

    const allAffectedItemIds = allAffectedItems.map(item => item.id);

    // Determine new status based on date type
    let newStatus: string;
    let dateField: string;
    
    if (dateType === 'listed') {
      newStatus = 'LISTED';
      dateField = 'listedDate';
    } else {
      newStatus = 'SOLD';
      dateField = 'soldDate';
    }

    // Update items with the date and status
    const updateData: any = {
      currentStatus: newStatus
    };
    updateData[dateField] = new Date(date).toISOString();

    // For sold items, also set soldYear and soldMonth for reporting
    if (dateType === 'sold') {
      const soldDate = new Date(date);
      updateData.soldYear = soldDate.getFullYear();
      updateData.soldMonth = soldDate.getMonth() + 1; // getMonth() returns 0-11
    }

    const updateResult = await prisma.item.updateMany({
      where: {
        id: {
          in: allAffectedItemIds
        }
      },
      data: updateData
    });

    // Count status changes (items that had a different status)
    const statusChanges = allAffectedItems.filter(item => item.currentStatus !== newStatus).length;

    // Create status history entries for items with status changes
    if (statusChanges > 0) {
      const statusHistoryData = allAffectedItems
        .filter(item => item.currentStatus !== newStatus)
        .map(item => ({
          itemId: item.id,
          fromStatus: item.currentStatus,
          toStatus: newStatus as any,
          changedAt: new Date(),
          note: item.lotNumber 
            ? `${dateType} date updated via lot-wide update (Lot #${item.lotNumber})`
            : `${dateType} date updated via bulk update`,
          channel: 'ADMIN'
        }));

      await prisma.itemStatusHistory.createMany({
        data: statusHistoryData
      });
    }

    // Enhanced logging with lot information
    const lotInfo = lotsToUpdate.size > 0 
      ? ` (including ${lotsToUpdate.size} lot(s): ${Array.from(lotsToUpdate).join(', ')})`
      : '';
    
    console.log(`Update dates: ${updateResult.count} items updated to ${newStatus} status with ${dateType} date ${date}${lotInfo}`);

    // Create COGS records for items marked as sold
    if (dateType === 'sold') {
      const soldDate = new Date(date);
      const cogsPromises = allAffectedItemIds.map(async (itemId) => {
        try {
          await createCOGSRecord(itemId, soldDate);
        } catch (error) {
          console.error(`Failed to create COGS record for item ${itemId}:`, error);
          // Don't fail the entire operation if COGS tracking fails
        }
      });
      
      // Wait for all COGS records to be created
      await Promise.allSettled(cogsPromises);
      console.log(`COGS tracking: Processed ${allAffectedItemIds.length} sold items for COGS recording`);
    }

    // Invalidate dashboard cache since stats may have changed
    invalidateDashboardCache();

    return res.json({
      success: true,
      data: {
        itemsUpdated: updateResult.count,
        statusChanges,
        notFoundIds: notFoundIds.length > 0 ? notFoundIds : undefined,
        dateType,
        date,
        newStatus,
        lotsAffected: lotsToUpdate.size > 0 ? Array.from(lotsToUpdate) : undefined,
        lotWideUpdate: lotsToUpdate.size > 0,
        message: lotsToUpdate.size > 0 
          ? `Updated ${updateResult.count} items including entire lot(s): ${Array.from(lotsToUpdate).join(', ')}`
          : `Updated ${updateResult.count} individual items`
      }
    });

  } catch (error) {
    console.error('Update dates error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during date update',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});


export default router;