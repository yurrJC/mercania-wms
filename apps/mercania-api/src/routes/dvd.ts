import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// eBay Product Catalog API lookup
const lookupDVDByUPC = async (upc: string) => {
  try {
    // Use user OAuth token directly (no need for app credentials)
    const EBAY_USER_TOKEN = process.env.EBAY_USER_TOKEN;

    console.log('eBay User Token check:', {
      EBAY_USER_TOKEN: EBAY_USER_TOKEN ? 'SET' : 'NOT SET'
    });

    if (!EBAY_USER_TOKEN) {
      console.log('eBay User Token not configured, falling back to manual entry');
      throw new Error('eBay User Token not configured. Please use manual entry.');
    }

    const accessToken = EBAY_USER_TOKEN;
    console.log('Using eBay user token for API calls');

    // Search for product by UPC using eBay Product Catalog API
    const searchUrl = `https://api.ebay.com/commerce/catalog/v1_beta/product_summary/search?upc=${upc}&category_ids=11232,617,1249,11233,63861`;
    
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
    
    // For Browse API, we get the data directly from the search results
    // No need for additional detail API call

    // Extract and format the data from Browse API response
    const title = product.title || 'Unknown Title';
    const brand = product.brand || '';
    
    // Extract additional details from product aspects
    let director = '';
    let studio = brand;
    let releaseYear = null;
    let format = 'DVD';
    let genre = '';
    let rating = '';
    let runtime = null;

    if (product?.aspects) {
      const aspects = product.aspects;
      
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
