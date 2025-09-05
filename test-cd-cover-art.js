const fetch = require('node-fetch');

async function testCDCoverArt() {
  try {
    // Test with a known CD barcode
    const barcode = '081227583422'; // The Dokken CD from the image
    
    console.log(`Testing CD cover art for barcode: ${barcode}`);
    
    // Test MusicBrainz API
    const musicbrainzUrl = `https://musicbrainz.org/ws/2/release?query=barcode:${barcode}&fmt=json&inc=artist-credits+recordings+release-groups+media+labels`;
    
    console.log('MusicBrainz URL:', musicbrainzUrl);
    
    const response = await fetch(musicbrainzUrl, {
      headers: {
        'User-Agent': 'Mercania-WMS/1.0 (https://mercania-wms.com)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('MusicBrainz API Error:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('MusicBrainz response:', JSON.stringify(data, null, 2));

    if (data.releases && data.releases.length > 0) {
      const release = data.releases[0];
      console.log('Release ID:', release.id);
      
      // Test cover art URL
      const coverArtUrl = `https://coverartarchive.org/release/${release.id}/front-250`;
      console.log('Cover art URL:', coverArtUrl);
      
      // Test if cover art URL is accessible
      const coverResponse = await fetch(coverArtUrl, { method: 'HEAD' });
      console.log('Cover art response status:', coverResponse.status);
      
      if (coverResponse.ok) {
        console.log('✅ Cover art URL is accessible');
      } else {
        console.log('❌ Cover art URL is not accessible');
      }
    } else {
      console.log('No releases found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCDCoverArt();
