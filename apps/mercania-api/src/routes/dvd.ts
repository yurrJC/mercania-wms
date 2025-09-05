import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// eBay Product Catalog API lookup
const lookupDVDByUPC = async (upc: string) => {
  try {
    // Note: You'll need to add your eBay API credentials to environment variables
    const EBAY_APP_ID = process.env.EBAY_APP_ID;
    const EBAY_DEV_ID = process.env.EBAY_DEV_ID;
    const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

    console.log('eBay API credentials check:', {
      EBAY_APP_ID: EBAY_APP_ID ? 'SET' : 'NOT SET',
      EBAY_DEV_ID: EBAY_DEV_ID ? 'SET' : 'NOT SET', 
      EBAY_CLIENT_SECRET: EBAY_CLIENT_SECRET ? 'SET' : 'NOT SET'
    });

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
      console.error('eBay token request failed:', tokenResponse.status, tokenResponse.statusText);
      const errorText = await tokenResponse.text();
      console.error('eBay token error response:', errorText);
      throw new Error('Failed to get eBay access token');
    }

    const tokenData = await tokenResponse.json() as any;
    const accessToken = tokenData.access_token;
    console.log('eBay access token obtained successfully');

    // Search for product by UPC using eBay Product Catalog API
    const searchUrl = `https://api.ebay.com/commerce/catalog/v1/product_summary/search?upc=${upc}&category_ids=11232,617,1249,11233,63861`;
    
    console.log(`Looking up UPC ${upc} with eBay...`);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU' // Australia marketplace
      }
    });

    if (!response.ok) {
      console.error('eBay API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('eBay API error response:', errorText);
      throw new Error('DVD not found in eBay catalog');
    }

    const data = await response.json() as any;
    
    if (!data.productSummaries || data.productSummaries.length === 0) {
      throw new Error('No DVD found for this UPC');
    }

    // Get the first product summary
    const product = data.productSummaries[0];
    
    // Get detailed product information
    const detailUrl = `https://api.ebay.com/commerce/catalog/v1/product/${product.epid}`;
    const detailResponse = await fetch(detailUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU'
      }
    });

    let productDetails = null;
    if (detailResponse.ok) {
      productDetails = await detailResponse.json();
    }

    // Extract and format the data
    const title = product.title || productDetails?.product?.title || 'Unknown Title';
    const brand = product.brand || productDetails?.product?.brand || '';
    
    // Extract additional details from product aspects
    let director = '';
    let studio = brand;
    let releaseYear = null;
    let format = 'DVD';
    let genre = '';
    let rating = '';
    let runtime = null;

    if (productDetails?.product?.aspects) {
      const aspects = productDetails.product.aspects;
      
      // Extract director
      const directorAspect = aspects.find((a: any) => 
        a.name?.toLowerCase().includes('director') || 
        a.name?.toLowerCase().includes('creator')
      );
      if (directorAspect && directorAspect.values) {
        director = directorAspect.values[0];
      }

      // Extract format
      const formatAspect = aspects.find((a: any) => 
        a.name?.toLowerCase().includes('format') || 
        a.name?.toLowerCase().includes('type')
      );
      if (formatAspect && formatAspect.values) {
        format = formatAspect.values[0];
      }

      // Extract genre
      const genreAspect = aspects.find((a: any) => 
        a.name?.toLowerCase().includes('genre') || 
        a.name?.toLowerCase().includes('category')
      );
      if (genreAspect && genreAspect.values) {
        genre = genreAspect.values[0];
      }

      // Extract rating
      const ratingAspect = aspects.find((a: any) => 
        a.name?.toLowerCase().includes('rating') || 
        a.name?.toLowerCase().includes('classification')
      );
      if (ratingAspect && ratingAspect.values) {
        rating = ratingAspect.values[0];
      }

      // Extract release year
      const yearAspect = aspects.find((a: any) => 
        a.name?.toLowerCase().includes('year') || 
        a.name?.toLowerCase().includes('release')
      );
      if (yearAspect && yearAspect.values) {
        const yearValue = parseInt(yearAspect.values[0]);
        if (!isNaN(yearValue)) {
          releaseYear = yearValue;
        }
      }

      // Extract runtime
      const runtimeAspect = aspects.find((a: any) => 
        a.name?.toLowerCase().includes('runtime') || 
        a.name?.toLowerCase().includes('duration')
      );
      if (runtimeAspect && runtimeAspect.values) {
        const runtimeValue = parseInt(runtimeAspect.values[0]);
        if (!isNaN(runtimeValue)) {
          runtime = runtimeValue;
        }
      }
    }

    console.log(`Successfully retrieved data for: ${title}`);

    return {
      upc: upc,
      title: title,
      director: director,
      studio: studio,
      releaseYear: releaseYear,
      format: format,
      genre: genre,
      rating: rating,
      runtime: runtime,
      epid: product.epid, // Store eBay product ID for reference
      imageUrl: product.image?.imageUrl || null
    };

  } catch (error) {
    console.error('eBay API Error:', error);
    throw error;
  }
};

// Check for existing DVDs by UPC
const checkDuplicateDVD = async (upc: string) => {
  const existingItems = await prisma.item.findMany({
    where: {
      isbnMaster: {
        isbn: upc
      }
    },
    select: {
      id: true,
      currentStatus: true,
      intakeDate: true,
      currentLocation: true
    },
    orderBy: {
      intakeDate: 'desc'
    }
  });

  if (existingItems.length > 0) {
    return {
      isDuplicate: true,
      message: `Warning: ${existingItems.length} DVD(s) with this UPC already exist in inventory.`,
      existingItems: existingItems.map(item => ({
        id: item.id,
        status: item.currentStatus,
        intakeDate: item.intakeDate.toLocaleDateString(),
        location: item.currentLocation
      }))
    };
  }

  return { isDuplicate: false };
};

// GET /api/dvd/:upc - Lookup DVD by UPC
router.get('/:upc', async (req, res) => {
  console.log('DVD route hit with UPC:', req.params.upc);
  try {
    const { upc } = req.params;
    
    if (!upc || upc.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Valid UPC required (minimum 8 digits)'
      });
    }

    console.log(`DVD lookup request for UPC: ${upc}`);

    // Look up DVD data from eBay
    const dvdData = await lookupDVDByUPC(upc);

    // Check for duplicates
    const duplicateCheck = await checkDuplicateDVD(upc);

    res.json({
      success: true,
      data: dvdData,
      duplicate: duplicateCheck.isDuplicate ? duplicateCheck : null
    });

  } catch (error) {
    console.error('DVD lookup error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'DVD not found. Please verify the UPC or use manual entry.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to look up DVD. Please try again or use manual entry.'
    });
  }
});

export default router;
