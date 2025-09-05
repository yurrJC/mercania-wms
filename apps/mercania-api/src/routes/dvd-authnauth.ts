import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthnAuthFromEnv } from '../utils/ebayAuthnAuth';

const router = express.Router();
const prisma = new PrismaClient();

// eBay Product Catalog API lookup using Auth'n'Auth
const lookupDVDByUPCWithAuthnAuth = async (upc: string) => {
  try {
    // Try to get user token from environment first
    let userToken = process.env.EBAY_USER_TOKEN;
    
    if (!userToken) {
      console.log('No user token found, attempting to get one via Auth\'n\'Auth...');
      
      try {
        const authnAuth = createAuthnAuthFromEnv();
        // Note: In a real implementation, you'd need to handle the full Auth'n'Auth flow
        // which requires user interaction. For now, we'll assume you have a user token.
        throw new Error('Auth\'n\'Auth user token not available. Please set EBAY_USER_TOKEN or complete the Auth\'n\'Auth flow.');
      } catch (error) {
        console.error('Auth\'n\'Auth setup error:', error);
        throw new Error('eBay authentication not configured. Please set EBAY_USER_TOKEN or configure Auth\'n\'Auth credentials.');
      }
    }

    console.log('Using eBay user token for API calls');
    console.log('Token format:', userToken.substring(0, 20) + '...');

    // Search for product by UPC using eBay Product Catalog API
    const searchUrl = `https://api.ebay.com/commerce/catalog/v1/product_summary/search?upc=${upc}&category_ids=11232,617,1249,11233,63861`;
    
    console.log(`Looking up UPC ${upc} with eBay...`);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
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
    
    // Extract and format the data from Browse API response
    const title = product.title || 'Unknown Title';
    const brand = product.brand || '';
    
    // Extract additional details from product aspects
    let director = 'Unknown Director';
    let studio = 'Unknown Studio';
    let releaseYear = null;
    let format = 'Unknown Format';
    let genre = 'Unknown Genre';
    let rating = 'Unknown Rating';
    let runtime = null;

    if (product.aspects && Array.isArray(product.aspects)) {
      const aspects = product.aspects;

      // Extract director
      const directorAspect = aspects.find((a: any) => 
        a.name?.toLowerCase().includes('director') || 
        a.name?.toLowerCase().includes('directed by')
      );
      if (directorAspect && directorAspect.values) {
        director = directorAspect.values[0];
      }

      // Extract studio
      const studioAspect = aspects.find((a: any) => 
        a.name?.toLowerCase().includes('studio') || 
        a.name?.toLowerCase().includes('distributor') ||
        a.name?.toLowerCase().includes('publisher')
      );
      if (studioAspect && studioAspect.values) {
        studio = studioAspect.values[0];
      }

      // Extract release year
      const yearAspect = aspects.find((a: any) => 
        a.name?.toLowerCase().includes('year') || 
        a.name?.toLowerCase().includes('release') ||
        a.name?.toLowerCase().includes('publication')
      );
      if (yearAspect && yearAspect.values) {
        const yearValue = parseInt(yearAspect.values[0]);
        if (!isNaN(yearValue)) {
          releaseYear = yearValue;
        }
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
  const existingDVD = await prisma.dVD.findFirst({
    where: { upc: upc }
  });
  return existingDVD;
};

// POST /api/dvd/lookup - Lookup DVD by UPC using Auth'n'Auth
router.post('/lookup', async (req, res) => {
  try {
    const { upc } = req.body;

    if (!upc) {
      return res.status(400).json({ error: 'UPC is required' });
    }

    // Check for duplicates first
    const existingDVD = await checkDuplicateDVD(upc);
    if (existingDVD) {
      return res.status(409).json({ 
        error: 'DVD already exists', 
        dvd: existingDVD 
      });
    }

    // Lookup DVD data from eBay
    const dvdData = await lookupDVDByUPCWithAuthnAuth(upc);

    res.json({
      success: true,
      data: dvdData
    });

  } catch (error) {
    console.error('DVD lookup error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to lookup DVD' 
    });
  }
});

// GET /api/dvd/auth-url - Get Auth'n'Auth authorization URL
router.get('/auth-url', async (req, res) => {
  try {
    const authnAuth = createAuthnAuthFromEnv();
    const authUrl = authnAuth.generateAuthUrl();
    
    res.json({
      success: true,
      authUrl: authUrl,
      instructions: [
        '1. Open the URL above in your browser',
        '2. Sign in to your eBay account',
        '3. Authorize the application',
        '4. Copy the session ID from the redirect URL',
        '5. Use the session ID to get a user token'
      ]
    });
  } catch (error) {
    console.error('Auth URL generation error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate auth URL' 
    });
  }
});

export default router;
