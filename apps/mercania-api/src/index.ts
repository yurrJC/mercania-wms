import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import PDFDocument from 'pdfkit';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';
import bwipjs from 'bwip-js';

// Load environment variables
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

// Initialize Prisma client
export const prisma = new PrismaClient();

// Promisify exec for async operations
const execAsync = promisify(exec);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Mercania WMS API', 
    status: 'OK', 
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      items: '/api/items',
      intake: '/api/intake',
      sales: '/api/sales',
      reports: '/api/reports'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ZPL Label endpoint
app.get('/zpl/mercania_item_label.zpl', (req, res): void => {
  try {
    const { internalId, itemTitle, intakeDate } = req.query;
    
    if (!internalId) {
      res.status(400).json({ error: 'Internal ID is required' });
      return;
    }

    // Read the ZPL template (go up two levels from apps/mercania-api to project root)
    const templatePath = path.join(process.cwd(), '..', '..', 'zpl', 'mercania_item_label.zpl');
    let zplTemplate = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders with actual values
    zplTemplate = zplTemplate.replace(/{INTERNAL_ID}/g, String(internalId));
    zplTemplate = zplTemplate.replace(/{ITEM_TITLE}/g, String(itemTitle || 'Unknown Item'));
    zplTemplate = zplTemplate.replace(/{INTAKE_DATE}/g, String(intakeDate || new Date().toISOString().split('T')[0]));
    
    // Set appropriate headers for ZPL
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `inline; filename="label_${internalId}.zpl"`);
    res.send(zplTemplate);
  } catch (error) {
    console.error('Error generating ZPL label:', error);
    res.status(500).json({ error: 'Failed to generate label', details: error instanceof Error ? error.message : String(error) });
  }
});

// Get available printers
app.get('/api/printers', async (req, res) => {
  try {
    // Get list of available printers using system commands
    const { stdout } = await execAsync('lpstat -p 2>/dev/null || echo "No printers found"');
    const printers = stdout
      .split('\n')
      .filter(line => line.includes('printer') && !line.includes('No printers'))
      .map(line => {
        const match = line.match(/printer (\S+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    
    res.json({ printers });
  } catch (error) {
    console.error('Error getting printers:', error);
    res.status(500).json({ error: 'Failed to get printers', details: error instanceof Error ? error.message : String(error) });
  }
});

// Generate ZPL label for direct thermal printer printing
app.get('/api/label-zpl', (req, res) => {
  try {
    const { internalId, itemTitle } = req.query;
    
    if (!internalId) {
      res.status(400).json({ error: 'Internal ID is required' });
      return;
    }

    // Title (truncated for 80mm width)
    const title = String(itemTitle || 'Unknown Item');
    const maxTitleLength = 35; // Good for 80mm width
    const displayTitle = title.length > maxTitleLength 
      ? title.substring(0, maxTitleLength) + '...' 
      : title;

    // Generate ZPL code for 80mm x 40mm label
    const zpl = `^XA
^CF0,20
^FO10,10^FD${displayTitle}^FS
^CF0,15
^FO10,35^FDID: ${internalId}^FS
^BY2,3,50
^FO10,55^BCN,50,Y,N,N^FD${internalId}^FS
^CF0,12
^FO10,110^FDMERCANIA^FS
^XZ`;

    // Set response headers for ZPL
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `inline; filename="label_${internalId}.zpl"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send ZPL directly to response
    res.send(zpl);
  } catch (error) {
    console.error('Error generating ZPL label:', error);
    res.status(500).json({ 
      error: 'Failed to generate ZPL label', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Generate ZPL label for lot printing
app.get('/api/lot-label-zpl', (req, res) => {
  try {
    const { lotNumber, itemCount } = req.query;
    
    if (!lotNumber) {
      res.status(400).json({ error: 'Lot number is required' });
      return;
    }

    // Generate ZPL code for 80mm x 40mm lot label
    const zpl = `^XA
^CF0,20
^FO10,10^FDLOT #${lotNumber}^FS
^CF0,15
^FO10,35^FDItems: ${itemCount || '0'}^FS
^BY2,3,50
^FO10,55^BCN,50,Y,N,N^FDLOT${lotNumber}^FS
^CF0,12
^FO10,110^FDMERCANIA^FS
^XZ`;

    // Set response headers for ZPL
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `inline; filename="lot_label_${lotNumber}.zpl"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send ZPL directly to response
    res.send(zpl);
  } catch (error) {
    console.error('Error generating lot ZPL label:', error);
    res.status(500).json({ 
      error: 'Failed to generate lot ZPL label', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Keep PDF endpoint for fallback
app.get('/api/label-pdf', (req, res) => {
  try {
    const { internalId, itemTitle } = req.query;
    
    if (!internalId) {
      res.status(400).json({ error: 'Internal ID is required' });
      return;
    }

    // Create PDF document with exact 80mm x 40mm dimensions
    const doc = new PDFDocument({ 
      size: [226.77, 113.39], // 80mm x 40mm in points
      margin: 0,
      layout: 'landscape' // Force landscape orientation for proper printing
    });
    
    // Set response headers for PDF with browser printing compatibility
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label_${internalId}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Generate Code 128 barcode - original working size
    const canvas = createCanvas(200, 30);
    JsBarcode(canvas, String(internalId), {
      format: "CODE128",
      width: 2,
      height: 25,
      displayValue: false,
      margin: 0
    });
    
    // Convert canvas to buffer
    const barcodeBuffer = canvas.toBuffer('image/png');
    
    // Title (original working truncation)
    const title = String(itemTitle || 'Unknown Item');
    const maxTitleLength = 30; // Original working length
    const displayTitle = title.length > maxTitleLength 
      ? title.substring(0, maxTitleLength) + '...' 
      : title;
    
    // Background - exact 80mm x 40mm dimensions
    doc.rect(0, 0, 226.77, 113.39)
       .fill('#ffffff');
    
    // Title with original working font size
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text(displayTitle, 8, 8, { 
         width: 210, 
         align: 'left',
         lineGap: 1
       });
    
    // Internal ID with original working styling
    doc.fontSize(7)
       .font('Helvetica')
       .fillColor('#333333')
       .text(`ID: ${internalId}`, 8, 25, { width: 210, align: 'left' });
    
    // Add the barcode image - original working size
    doc.image(barcodeBuffer, 13, 35, { width: 200, height: 25 });
    
    // Barcode number below - original working font
    doc.fontSize(6)
       .font('Courier')
       .fillColor('#000000')
       .text(String(internalId), 8, 65, { width: 210, align: 'center' });
    
    // Mercania branding with original working styling
    doc.fontSize(7)
       .font('Helvetica-Bold')
       .fillColor('#1f2937')
       .text('MERCANIA', 8, 80, { width: 210, align: 'center' });
    
    // Add professional border - original working design
    doc.rect(2, 2, 222.77, 109.39)
       .lineWidth(1)
       .stroke('#e5e7eb');
    
    // Add inner border for premium look
    doc.rect(4, 4, 218.77, 105.39)
       .lineWidth(0.5)
       .stroke('#d1d5db');
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating PDF label:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF label', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// New multi-page PDF label endpoint with bwip-js - optimized for 40x20mm
app.post('/labels', async (req, res) => {
  try {
    const { internalID, title, author, copyIndex, labelSize, qty } = req.body;
    
    // Validate required fields
    if (!internalID) {
      res.status(400).json({ error: 'internalID is required' });
      return;
    }

    // Set defaults - force 40x20mm for inventory management
    const quantity = qty || 1;
    const labelSizeValue = '40x20mm'; // Fixed size for inventory labels
    const displayTitle = title || 'Unknown Item';
    const displayAuthor = author || 'Unknown Author';
    const copyIndexValue = copyIndex || 0;

    // Parse label size (40x20mm)
    const widthMm = 40;
    const heightMm = 20;
    
    // Convert mm to points (1mm = 2.834645669 points)
    const widthPoints = widthMm * 2.834645669;  // 113.39 points
    const heightPoints = heightMm * 2.834645669; // 56.69 points
    
    // Exact dimensions: 40mm × 20mm = 113.39 × 56.69 points

    // Create PDF document with proper MediaBox and CropBox for 40x20mm
    const doc = new PDFDocument({ 
      size: [widthPoints, heightPoints],
      margin: 0,
      layout: 'portrait'
    });
    
    // Set MediaBox and CropBox to exact 40x20mm dimensions
    // This ensures accurate printing dimensions for thermal label printers
    if (doc.page) {
      (doc.page as any).mediaBox = [0, 0, widthPoints, heightPoints];
      (doc.page as any).cropBox = [0, 0, widthPoints, heightPoints];
      (doc.page as any).bleedBox = [0, 0, widthPoints, heightPoints];
      (doc.page as any).trimBox = [0, 0, widthPoints, heightPoints];
    }
    
    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="labels_${internalID}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Pipe PDF to response
    doc.pipe(res);

    // Generate labels for each copy
    for (let i = 0; i < quantity; i++) {
      if (i > 0) {
        doc.addPage({ size: [widthPoints, heightPoints], margin: 0, layout: 'portrait' });
        // Set MediaBox and CropBox for additional pages
        if (doc.page) {
          (doc.page as any).mediaBox = [0, 0, widthPoints, heightPoints];
          (doc.page as any).cropBox = [0, 0, widthPoints, heightPoints];
          (doc.page as any).bleedBox = [0, 0, widthPoints, heightPoints];
          (doc.page as any).trimBox = [0, 0, widthPoints, heightPoints];
        }
      }

      // Generate Code 128 barcode using bwip-js - optimized for 40x20mm
      const barcodeOptions = {
        bcid: 'code128',        // Barcode type
        text: String(internalID), // Text to encode
        scale: 1.2,             // Increased scale for better readability
        height: 8,              // Increased height for better scanning
        includetext: false,     // Don't include text below barcode
        textxalign: 'center' as const,   // Center text if included
        quietzones: true,       // Include quiet zones
        quietzone: 2,           // Adequate quiet zone
        width: 1                // Appropriate bar width
      };

      const barcodeBuffer = await bwipjs.toBuffer(barcodeOptions);

      // Truncate title and author for 40mm width (strict limits)
      const maxTitleLength = 30; // Exactly 30 characters for title
      const maxAuthorLength = 40; // Increased to show more of the author
      const truncatedTitle = displayTitle.length > maxTitleLength 
        ? displayTitle.substring(0, maxTitleLength) + '...' 
        : displayTitle;
      const truncatedAuthor = displayAuthor.length > maxAuthorLength 
        ? displayAuthor.substring(0, maxAuthorLength) + '...' 
        : displayAuthor;

      // Clean white background
      doc.rect(0, 0, widthPoints, heightPoints)
         .fill('#ffffff');

      // 1. TITLE at the top (moved right and down for printing) - exactly 30 chars
      doc.fontSize(5)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text(truncatedTitle, 4, 7, { 
           width: widthPoints - 8, 
           align: 'left',
           lineGap: 0.5
         });

      // 2. AUTHOR just under title (moved right and down for printing)
      doc.fontSize(5)
         .font('Helvetica')
         .fillColor('#333333')
         .text(truncatedAuthor, 4, 14, { 
           width: widthPoints - 8, 
           align: 'left' 
         });

      // 3. INTERNAL ID (moved right and down for printing)
      doc.fontSize(4)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text(`ID: ${internalID}`, 4, 20, { width: widthPoints - 8, align: 'left' });

      // 4. BARCODE (Code 128 of internal ID) - perfectly centered, moved down another 4 points
      const barcodeWidth = Math.min(widthPoints - 4, 70); // Good width for 40mm
      const barcodeHeight = 8; // Slightly smaller to fit better
      const barcodeX = (widthPoints - barcodeWidth) / 2;
      const barcodeY = 30; // Moved down another 4 points from 26 to 30

      doc.image(barcodeBuffer, barcodeX, barcodeY, { 
        width: barcodeWidth, 
        height: barcodeHeight 
      });

      // 5. INTAKE DATE at the bottom-left (moved right for printing)
      const now = new Date();
      const intakeDate = now.toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: '2-digit' 
      });
      
      doc.fontSize(4)
         .font('Helvetica')
         .fillColor('#666666')
         .text(`Intake: ${intakeDate}`, 4, heightPoints - 12, { 
           width: widthPoints - 8, 
           align: 'left' 
         });

      // MERCANIA branding at the bottom-center (centered, bold) - within label bounds
      doc.fontSize(4)
         .font('Helvetica-Bold')
         .fillColor('#1f2937')
         .text('MERCANIA', 1, heightPoints - 6, { 
           width: widthPoints - 2, 
           align: 'center' 
         });

      // Copy index if multiple copies
      if (quantity > 1) {
        doc.fontSize(3)
           .font('Helvetica-Bold')
           .fillColor('#dc2626')
           .text(`COPY ${copyIndexValue + i + 1}`, 4, heightPoints - 3, { 
             width: widthPoints - 8, 
             align: 'right' 
           });
      }

      // Clean border
      doc.rect(1, 1, widthPoints - 2, heightPoints - 2)
         .lineWidth(0.5)
         .stroke('#cccccc');
    }

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating multi-page PDF labels:', error);
    res.status(500).json({ 
      error: 'Failed to generate labels', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Lot labels PDF endpoint - optimized for 80x40mm
app.post('/lot-labels', async (req, res) => {
  try {
    const { lotNumber, itemCount, qty } = req.body;
    
    // Validate required fields
    if (!lotNumber) {
      res.status(400).json({ error: 'lotNumber is required' });
      return;
    }

    // Set defaults - force 40x20mm for lot labels (matching item labels)
    const quantity = qty || 1;
    const displayLotNumber = lotNumber.toString();
    const displayItemCount = itemCount || 0;

    // Parse label size (40x20mm)
    const widthMm = 40;
    const heightMm = 20;
    
    // Convert mm to points (1mm = 2.834645669 points)
    const widthPoints = widthMm * 2.834645669;  // 113.39 points
    const heightPoints = heightMm * 2.834645669; // 56.69 points
    
    // Create PDF document with proper MediaBox and CropBox for 40x20mm
    const doc = new PDFDocument({ 
      size: [widthPoints, heightPoints],
      margin: 0,
      layout: 'portrait'
    });
    
    // Set MediaBox and CropBox to exact 40x20mm dimensions
    if (doc.page) {
      (doc.page as any).mediaBox = [0, 0, widthPoints, heightPoints];
      (doc.page as any).cropBox = [0, 0, widthPoints, heightPoints];
      (doc.page as any).bleedBox = [0, 0, widthPoints, heightPoints];
      (doc.page as any).trimBox = [0, 0, widthPoints, heightPoints];
    }
    
    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="lot_labels_${lotNumber}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Pipe PDF to response
    doc.pipe(res);

    // Generate multiple copies if quantity > 1
    for (let i = 0; i < quantity; i++) {
      if (i > 0) {
        doc.addPage();
      }

      // Background - exact 40mm x 20mm dimensions
      doc.rect(0, 0, widthPoints, heightPoints)
         .fill('#ffffff');

      // Generate Code 128 barcode for lot number - matching item label structure
      const canvas = createCanvas(200, 30);
      JsBarcode(canvas, displayLotNumber, { // Removed LOT prefix
        format: "CODE128",
        width: 1.5, // Reduced from 2 to match item labels
        height: 8,  // Reduced from 25 to match item labels
        displayValue: false,
        margin: 0
      });
      
      // Convert canvas to buffer
      const barcodeBuffer = canvas.toBuffer('image/png');

      // 1. LOT NUMBER at the top (left-aligned, scaled down for 40x20mm)
      doc.fontSize(5) // Scaled down from 10pt to 5pt
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text(`LOT #${displayLotNumber}`, 4, 3, { // Moved right to X=4, moved up to Y=3
           width: widthPoints - 8, // Adjusted width
           align: 'left' 
         });

      // 2. ITEM COUNT below lot number (left-aligned, scaled down)
      doc.fontSize(4) // Scaled down from 8pt to 4pt
         .font('Helvetica')
         .fillColor('#333333')
         .text(`Items: ${displayItemCount}`, 4, 10, { // Moved right to X=4, moved up to Y=10
           width: widthPoints - 8, // Adjusted width
           align: 'left' 
         });

      // 3. BARCODE (Code 128 of lot number) - centered, moved down 10px
      const barcodeWidth = Math.min(widthPoints - 4, 70); // Matching item label width
      const barcodeHeight = 8; // Matching item label height
      const barcodeX = (widthPoints - barcodeWidth) / 2;
      const barcodeY = 28; // Moved down 10px from Y=18 to Y=28

      doc.image(barcodeBuffer, barcodeX, barcodeY, { 
        width: barcodeWidth, 
        height: barcodeHeight 
      });

      // 4. DATE on first page (left-aligned, scaled down) - moved up from bottom
      const now = new Date();
      const lotDate = now.toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: '2-digit' 
      });
      
      doc.fontSize(3) // Scaled down from 5pt to 3pt
         .font('Helvetica')
         .fillColor('#666666')
         .text(lotDate, 4, 38, { // Moved up to Y=38 to fit on first page
           width: widthPoints - 8, // Adjusted width
           align: 'left' 
         });

      // 5. MERCANIA branding at the bottom (centered, scaled down)
      doc.fontSize(3) // Scaled down from 6pt to 3pt
         .font('Helvetica-Bold')
         .fillColor('#1f2937')
         .text('MERCANIA', 1, heightPoints - 6, { // Moved to X=1, adjusted Y position
           width: widthPoints - 2, // Adjusted width
           align: 'center' 
         });

      // Copy index if multiple copies
      if (quantity > 1) {
        doc.fontSize(2) // Scaled down from 5pt to 2pt
           .font('Helvetica-Bold')
           .fillColor('#dc2626')
           .text(`COPY ${i + 1}`, 4, heightPoints - 1, { // Moved right to X=4, adjusted Y position
             width: widthPoints - 8, // Adjusted width
             align: 'right' 
           });
      }

      // Clean border
      doc.rect(1, 1, widthPoints - 2, heightPoints - 2)
         .lineWidth(0.5)
         .stroke('#e5e7eb');
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating lot labels PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate lot labels PDF', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// GET endpoint for easier testing - redirects to POST with sample data
app.get('/labels', (req, res) => {
  const { internalID, title, qty } = req.query;
  
  if (!internalID) {
    res.status(400).json({ 
      error: 'internalID is required',
      usage: 'Use POST /labels with JSON body or GET /labels?internalID=YOUR_ID&title=YOUR_TITLE&qty=1'
    });
    return;
  }

  // Redirect to POST with query parameters
  const postData = {
    internalID: String(internalID),
    title: title ? String(title) : 'Test Item',
    qty: qty ? parseInt(String(qty)) : 1
  };

  // Create a simple HTML form for testing
  res.send(`
    <html>
      <head><title>Label Generator Test</title></head>
      <body>
        <h2>Label Generator</h2>
        <p>Use POST /labels with JSON body:</p>
        <pre>${JSON.stringify(postData, null, 2)}</pre>
        <p>Or test with curl:</p>
        <pre>curl -X POST http://localhost:3001/labels -H "Content-Type: application/json" -d '${JSON.stringify(postData)}' --output test.pdf</pre>

      </body>
    </html>
  `);
});

// Print label directly to USB printer (keeping for compatibility)
app.post('/api/print-label', async (req, res) => {
  try {
    const { internalId, itemTitle, printerName } = req.body;
    
    if (!internalId) {
      res.status(400).json({ error: 'Internal ID is required' });
      return;
    }

    // Read the ZPL template
    const templatePath = path.join(process.cwd(), '..', '..', 'zpl', 'mercania_item_label.zpl');
    let zplTemplate = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders with actual values
    zplTemplate = zplTemplate.replace(/{INTERNAL_ID}/g, String(internalId));
    zplTemplate = zplTemplate.replace(/{ITEM_TITLE}/g, String(itemTitle || 'Unknown Item'));
    zplTemplate = zplTemplate.replace(/{INTAKE_DATE}/g, String(new Date().toISOString().split('T')[0]));
    
    // Create temporary file for ZPL
    const tempFile = path.join(process.cwd(), '..', '..', 'temp_label.zpl');
    fs.writeFileSync(tempFile, zplTemplate);
    
    try {
      // Print using system command
      const printCommand = printerName 
        ? `lp -d "${printerName}" "${tempFile}"`
        : `lp "${tempFile}"`;
      
      const { stdout, stderr } = await execAsync(printCommand);
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      res.json({ 
        success: true, 
        message: 'Label sent to printer successfully',
        printer: printerName || 'default',
        output: stdout 
      });
    } catch (printError) {
      // Clean up temp file even if printing fails
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw printError;
    }
  } catch (error) {
    console.error('Error printing label:', error);
    res.status(500).json({ 
      error: 'Failed to print label', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Print lot label directly to USB printer
app.post('/api/print-lot-label', async (req, res) => {
  try {
    const { lotNumber, itemCount, printerName } = req.body;
    
    if (!lotNumber) {
      res.status(400).json({ error: 'Lot number is required' });
      return;
    }

    // Read the ZPL template
    const templatePath = path.join(process.cwd(), '..', '..', 'zpl', 'mercania_lot_label.zpl');
    let zplTemplate = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders with actual values
    zplTemplate = zplTemplate.replace(/{LOT_NUMBER}/g, String(lotNumber));
    zplTemplate = zplTemplate.replace(/{ITEM_COUNT}/g, String(itemCount || '0'));
    
    // Create temporary file for ZPL
    const tempFile = path.join(process.cwd(), '..', '..', 'temp_lot_label.zpl');
    fs.writeFileSync(tempFile, zplTemplate);
    
    try {
      // Print using system command
      const printCommand = printerName 
        ? `lp -d "${printerName}" "${tempFile}"`
        : `lp "${tempFile}"`;
      
      const { stdout, stderr } = await execAsync(printCommand);
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      res.json({ 
        success: true, 
        message: 'Lot label sent to printer successfully',
        printer: printerName || 'default',
        output: stdout 
      });
    } catch (printError) {
      // Clean up temp file even if printing fails
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw printError;
    }
  } catch (error) {
    console.error('Error printing lot label:', error);
    res.status(500).json({ 
      error: 'Failed to print lot label', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// API Routes
import authRoutes from './routes/auth.js';
import intakeRoutes from './routes/intake.js';
import itemsRoutes from './routes/items.js';
import reportsRoutes from './routes/reports.js';
import lotsRoutes from './routes/lots.js';
import cogRoutes from './routes/cog.js';
import cogsRoutes from './routes/cogs.js';
import salesRoutes from './routes/sales.js';
import dvdAuthnAuthRoutes from './routes/dvd-authnauth.js';
import cdMusicbrainzRoutes from './routes/cd-musicbrainz.js';
import { authenticateToken } from './middleware/auth.js';

// Public auth routes (no authentication required)
app.use('/api/auth', authRoutes);

// All other API routes require authentication
app.use('/api/intake', authenticateToken, intakeRoutes);
app.use('/api/items', authenticateToken, itemsRoutes);
app.use('/api/reports', authenticateToken, reportsRoutes);
app.use('/api/lots', authenticateToken, lotsRoutes);
app.use('/api/cog', authenticateToken, cogRoutes);
app.use('/api/cogs', authenticateToken, cogsRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
app.use('/api/dvd', authenticateToken, dvdAuthnAuthRoutes);
app.use('/api/cd', authenticateToken, cdMusicbrainzRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Mercania API server running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
