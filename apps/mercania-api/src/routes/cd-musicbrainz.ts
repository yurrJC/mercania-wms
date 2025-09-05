import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Rate limiting for MusicBrainz API (max 1 call per second)
let lastApiCall = 0;
const API_CALL_INTERVAL = 1000; // 1 second in milliseconds

const rateLimitMusicBrainz = async () => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (timeSinceLastCall < API_CALL_INTERVAL) {
    const waitTime = API_CALL_INTERVAL - timeSinceLastCall;
    console.log(`Rate limiting: waiting ${waitTime}ms before next MusicBrainz API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastApiCall = Date.now();
};

// MusicBrainz API lookup for CDs
const lookupCDByBarcode = async (barcode: string) => {
  try {
    console.log(`Looking up CD barcode ${barcode} with MusicBrainz...`);

    // Apply rate limiting
    await rateLimitMusicBrainz();

    // MusicBrainz API endpoint for barcode search
    // Using search instead of direct barcode lookup for better results
    const musicbrainzUrl = `https://musicbrainz.org/ws/2/release?query=barcode:${barcode}&fmt=json&inc=artist-credits+recordings+release-groups+media+labels`;
    
    const response = await fetch(musicbrainzUrl, {
      headers: {
        'User-Agent': 'Mercania-WMS/1.0 (https://mercania-wms.com)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('MusicBrainz API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('MusicBrainz API error response:', errorText);
      throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;

    if (!data.releases || data.releases.length === 0) {
      throw new Error('CD not found in MusicBrainz database');
    }

    // Get the first release (most relevant match)
    const release = data.releases[0];
    
    // Extract basic information
    const title = release.title || 'Unknown Title';
    const artist = release['artist-credit']?.[0]?.name || 'Unknown Artist';
    const releaseDate = release.date || null;
    const country = release.country || 'Unknown';
    
    // Extract additional metadata
    let label = 'Unknown Label';
    let catalogNumber = 'Unknown';
    let format = 'CD';
    let genre = 'Unknown Genre';
    let trackCount = 0;
    let duration = 0;

    // Get label information from label-info array
    if (release['label-info'] && release['label-info'].length > 0) {
      const labelInfo = release['label-info'][0];
      label = labelInfo.label?.name || 'Unknown Label';
      catalogNumber = labelInfo['catalog-number'] || 'Unknown';
    }

    // Get format and track information from media
    if (release.media && release.media.length > 0) {
      const media = release.media[0];
      format = media.format || 'CD';
      trackCount = media['track-count'] || 0;
      
      // Calculate total duration from tracks
      if (media.tracks && Array.isArray(media.tracks)) {
        duration = media.tracks.reduce((total: number, track: any) => {
          return total + (track.length || 0);
        }, 0);
      }
    }

    // Get genre from release group primary type
    if (release['release-group'] && release['release-group']['primary-type']) {
      genre = release['release-group']['primary-type'];
    }

    // Try to get secondary type as well
    if (release['release-group'] && release['release-group']['secondary-types'] && 
        release['release-group']['secondary-types'].length > 0) {
      const secondaryType = release['release-group']['secondary-types'][0];
      if (secondaryType) {
        genre = `${genre} (${secondaryType})`;
      }
    }

    // Get cover art URL (from Cover Art Archive)
    let coverArtUrl = null;
    if (release.id) {
      coverArtUrl = `https://coverartarchive.org/release/${release.id}/front-250`;
    }

    console.log(`Successfully retrieved CD data: ${artist} - ${title}`);

    return {
      barcode: barcode,
      title: title,
      artist: artist,
      label: label,
      catalogNumber: catalogNumber,
      releaseDate: releaseDate,
      country: country,
      format: format,
      genre: genre,
      trackCount: trackCount,
      duration: duration, // in milliseconds
      coverArtUrl: coverArtUrl,
      musicbrainzId: release.id
    };

  } catch (error) {
    console.error('MusicBrainz API Error:', error);
    throw error;
  }
};

// Check for existing CDs by barcode
const checkDuplicateCD = async (barcode: string) => {
  const existingCD = await prisma.isbnMaster.findFirst({
    where: { isbn: barcode }
  });
  return existingCD;
};

// POST /api/cd/lookup - Lookup CD by barcode using MusicBrainz
router.post('/lookup', async (req, res) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // Check for duplicates first
    const existingCD = await checkDuplicateCD(barcode);
    if (existingCD) {
      return res.status(409).json({ 
        error: 'CD already exists', 
        cd: existingCD 
      });
    }

    // Lookup CD data from MusicBrainz
    const cdData = await lookupCDByBarcode(barcode);

    res.json({
      success: true,
      data: cdData
    });

  } catch (error) {
    console.error('CD lookup error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to lookup CD' 
    });
  }
});

// GET /api/cd/search - Search CDs by artist and title
router.get('/search', async (req, res) => {
  try {
    const { artist, title } = req.query;

    if (!artist && !title) {
      return res.status(400).json({ error: 'Artist or title is required' });
    }

    // Build search query
    let query = '';
    if (artist && title) {
      query = `artist:"${artist}" AND release:"${title}"`;
    } else if (artist) {
      query = `artist:"${artist}"`;
    } else if (title) {
      query = `release:"${title}"`;
    }

    // Apply rate limiting
    await rateLimitMusicBrainz();

    const musicbrainzUrl = `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(query)}&fmt=json&inc=artist-credits+recordings+release-groups+media&limit=10`;
    
    const response = await fetch(musicbrainzUrl, {
      headers: {
        'User-Agent': 'Mercania-WMS/1.0 (https://mercania-wms.com)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to search MusicBrainz');
    }

    const data = await response.json() as any;

    if (!data.releases || data.releases.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No CDs found'
      });
    }

    // Format search results
    const searchResults = data.releases.map((release: any) => ({
      id: release.id,
      title: release.title,
      artist: release['artist-credit']?.[0]?.name || 'Unknown Artist',
      releaseDate: release.date,
      country: release.country,
      format: release.media?.[0]?.format || 'CD',
      trackCount: release.media?.[0]?.['track-count'] || 0
    }));

    res.json({
      success: true,
      data: searchResults
    });

  } catch (error) {
    console.error('CD search error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to search CDs' 
    });
  }
});

// GET /api/cd/info - Get information about MusicBrainz integration
router.get('/info', async (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'MusicBrainz',
      description: 'Free music database with comprehensive metadata',
      features: [
        'Barcode lookup',
        'Artist and title search',
        'Release information',
        'Cover art integration',
        'No API key required',
        'No rate limits'
      ],
      endpoints: {
        lookup: 'POST /api/cd/lookup - Lookup CD by barcode',
        search: 'GET /api/cd/search?artist=NAME&title=TITLE - Search CDs',
        info: 'GET /api/cd/info - Get service information'
      }
    }
  });
});

export default router;
