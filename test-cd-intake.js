#!/usr/bin/env node

/**
 * Test script for CD intake endpoint with MusicBrainz
 * Tests the exact endpoint that was failing: /api/intake/cd/:barcode
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE = process.env.API_URL || 'http://localhost:3001';
const JWT_TOKEN = process.env.JWT_TOKEN || 'your-jwt-token-here';

// Test barcodes (real examples from MusicBrainz)
const TEST_BARCODES = [
  '5099750442229', // The Beatles - Abbey Road (real barcode)
  '0747313001576', // The barcode that was failing
  '886972123456',  // Another example
  '602498612345'   // Example CD barcode
];

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testCDIntake(barcode) {
  console.log(`🔍 Testing CD intake for barcode: ${barcode}...`);
  
  try {
    const response = await makeRequest(`${API_BASE}/api/intake/cd/${barcode}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ CD intake successful');
      const cd = response.data.data;
      console.log('Title:', cd?.title || 'Unknown');
      console.log('Artist:', cd?.artist || 'Unknown');
      console.log('Label:', cd?.label || 'Unknown');
      console.log('Release Date:', cd?.releaseDate || 'Unknown');
      console.log('Format:', cd?.format || 'Unknown');
      console.log('Track Count:', cd?.trackCount || 0);
      console.log('Cover Art:', cd?.coverArtUrl ? 'Available' : 'Not available');
      console.log('MusicBrainz ID:', cd?.musicbrainzId || 'Unknown');
      
      // Check for duplicate warning
      if (response.data.duplicate?.isDuplicate) {
        console.log('⚠️ DUPLICATE WARNING:');
        console.log('Message:', response.data.duplicate.message);
        if (response.data.duplicate.existingItems) {
          console.log('Existing items:');
          response.data.duplicate.existingItems.forEach((item, index) => {
            console.log(`  ${index + 1}. ID #${item.id} - ${item.status} - ${item.intakeDate} - ${item.location || 'No location'}`);
          });
        }
      }
    } else if (response.status === 404) {
      console.log('❌ CD not found in MusicBrainz database');
      console.log('Error:', response.data.error || 'Unknown error');
    } else {
      console.log('❌ CD intake failed');
      console.log('Error:', response.data.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ CD intake error:', error.message);
  }
  
  console.log('');
}

async function testHealthCheck() {
  console.log('🔍 Testing health check...');
  
  try {
    const response = await makeRequest(`${API_BASE}/health`);
    console.log(`Status: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ API server is running');
    } else {
      console.log('❌ API server health check failed');
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    console.log('Make sure your API server is running on', API_BASE);
  }
  
  console.log('');
}

async function runTests() {
  console.log('🚀 Starting CD intake tests with MusicBrainz...\n');
  
  // Test 1: Health check
  await testHealthCheck();
  
  // Test 2: CD intake tests
  for (const barcode of TEST_BARCODES) {
    await testCDIntake(barcode);
  }
  
  console.log('🏁 Tests completed!');
  console.log('\nExpected results:');
  console.log('✅ Health check: Status 200');
  console.log('✅ CD intake: Status 200 with CD metadata');
  console.log('⚠️ Duplicate CDs: Status 409 (if already exists)');
  console.log('❌ Not found: Status 404 (if not in MusicBrainz)');
  console.log('');
  console.log('MusicBrainz benefits:');
  console.log('• Free and open source');
  console.log('• No API key required');
  console.log('• Rate limited to 1 call per second');
  console.log('• Comprehensive music metadata');
  console.log('• Cover art integration');
  console.log('');
  console.log('If you see errors:');
  console.log('1. Make sure your API server is running: cd apps/mercania-api && npm run dev');
  console.log('2. Check your JWT token is valid');
  console.log('3. MusicBrainz is very reliable - if it fails, check your internet connection');
}

// Run tests
runTests().catch(console.error);
