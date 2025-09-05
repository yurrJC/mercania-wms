import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
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
  const existingItems = await prisma.item.findMany({
    where: {
      isbnMaster: {
        isbn: barcode
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
      message: `Warning: ${existingItems.length} CD(s) with this barcode already exist in inventory.`,
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

// GET /api/intake/cd/:barcode - Lookup CD metadata by barcode using MusicBrainz
router.get('/:barcode', async (req, res) => {
  const { barcode } = req.params;

  if (!barcode || !/^\d+$/.test(barcode)) {
    return res.status(400).json({ success: false, error: 'Invalid barcode format' });
  }

  try {
    // Check for duplicates first
    const duplicateCheck = await checkDuplicateCD(barcode);
    
    // Lookup CD data from MusicBrainz
    const cdData = await lookupCDByBarcode(barcode);
    
    // Include duplicate information in the response
    res.json({ 
      success: true, 
      data: cdData,
      duplicate: duplicateCheck.isDuplicate ? duplicateCheck : null
    });
  } catch (error: any) {
    console.error('CD lookup error:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message });
  }
});

export default router;
