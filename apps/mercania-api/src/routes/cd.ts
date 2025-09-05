import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const prisma = new PrismaClient();

// eBay Product Catalog API lookup for CDs
const lookupCDByBarcode = async (barcode: string) => {
  try {
    const EBAY_APP_ID = process.env.EBAY_CLIENT_ID;
    const EBAY_DEV_ID = process.env.EBAY_DEV_ID;
    const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

    if (!EBAY_APP_ID || !EBAY_DEV_ID || !EBAY_CLIENT_SECRET) {
      console.log('eBay API credentials not configured, falling back to manual entry');
      throw new Error('eBay API not configured. Please use manual entry.');
    }

    // First, get an access token using App ID and Client Secret
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${EBAY_APP_ID}:${EBAY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });

    if (!tokenResponse.ok) {
      console.error('eBay API Error:', tokenResponse.status, tokenResponse.statusText);
      throw new Error('Failed to get eBay access token');
    }
    const tokenData = await tokenResponse.json() as any;
    const accessToken = tokenData.access_token;

    // Use the access token to search the Catalog API by UPC
    // Category IDs for Music & CDs (example, can be refined)
    const categoryIds = '11233,176985,3270,306'; // Common eBay categories for music/CDs
    const searchUrl = `https://api.ebay.com/commerce/catalog/v1/product_summary/search?upc=${barcode}&category_ids=${categoryIds}`;

    console.log(`Looking up barcode ${barcode} with eBay...`);
    const productResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU', // Target Australian marketplace
        'Content-Type': 'application/json'
      }
    });

    if (!productResponse.ok) {
      console.error('eBay API Error:', productResponse.status, productResponse.statusText);
      throw new Error('Failed to fetch CD data from eBay');
    }

    const productData = await productResponse.json() as any;

    if (!productData.productSummaries || productData.productSummaries.length === 0) {
      throw new Error('CD not found in eBay catalog');
    }

    const product = productData.productSummaries[0]; // Take the first result

    // Extract relevant metadata
    const title = product.title;
    const imageUrl = product.image?.imageUrl || null;

    // Extract aspects for artist, label, year, genre, format
    let artist = 'Unknown Artist';
    let label = 'Unknown Label';
    let releaseYear = null;
    let genre = 'Unknown Genre';
    let format = 'CD'; // Default format
    let runtime = null;

    if (product.aspects) {
      product.aspects.forEach((aspect: any) => {
        switch (aspect.localizedName) {
          case 'Artist':
          case 'Performer':
            artist = aspect.localizedValues[0];
            break;
          case 'Record Label':
          case 'Label':
            label = aspect.localizedValues[0];
            break;
          case 'Release Year':
          case 'Year':
            releaseYear = parseInt(aspect.localizedValues[0]);
            break;
          case 'Genre':
            genre = aspect.localizedValues[0];
            break;
          case 'Format':
            format = aspect.localizedValues[0];
            break;
          case 'Duration':
          case 'Runtime':
            // Runtime might be in "60 min" format, extract number
            const runtimeMatch = aspect.localizedValues[0].match(/(\d+)\s*min/);
            if (runtimeMatch) {
              runtime = parseInt(runtimeMatch[1]);
            }
            break;
        }
      });
    }

    return {
      barcode,
      title,
      artist,
      label,
      releaseYear,
      format,
      genre,
      runtime,
      imageUrl
    };

  } catch (error: any) {
    console.error('eBay API Error:', error.message);
    throw error;
  }
};

// GET /api/intake/cd/:barcode - Lookup CD metadata by barcode
router.get('/:barcode', async (req, res) => {
  const { barcode } = req.params;

  if (!barcode || !/^\d+$/.test(barcode)) {
    return res.status(400).json({ success: false, error: 'Invalid barcode format' });
  }

  try {
    const cdData = await lookupCDByBarcode(barcode);
    res.json({ success: true, data: cdData });
  } catch (error: any) {
    console.error('CD lookup error:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

export default router;
