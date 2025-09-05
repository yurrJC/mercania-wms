#!/usr/bin/env node

/**
 * Test script for MusicBrainz CD integration
 * Run this to verify your CD lookup is working
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE = process.env.API_URL || 'http://localhost:3001';
const JWT_TOKEN = process.env.JWT_TOKEN || 'your-jwt-token-here';

// Test CD barcodes (real examples from MusicBrainz)
const TEST_BARCODES = [
  '5099750442229', // The Beatles - Abbey Road (real barcode)
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

async function testCDInfo() {
  console.log('🔍 Testing CD service info...');
  
  try {
    const response = await makeRequest(`${API_BASE}/api/cd/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ CD service info working');
      console.log('Service:', response.data.data?.service);
      console.log('Features:', response.data.data?.features?.join(', '));
    } else {
      console.log('❌ CD service info failed');
      console.log('Response:', response.data);
    }
  } catch (error) {
    console.log('❌ CD service info error:', error.message);
  }
  
  console.log('');
}

async function testCDLookup(barcode) {
  console.log(`🔍 Testing CD lookup for barcode: ${barcode}...`);
  
  try {
    const response = await makeRequest(`${API_BASE}/api/cd/lookup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ barcode })
    });
    
    console.log(`Status: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ CD lookup successful');
      const cd = response.data.data;
      console.log('Title:', cd?.title || 'Unknown');
      console.log('Artist:', cd?.artist || 'Unknown');
      console.log('Label:', cd?.label || 'Unknown');
      console.log('Release Date:', cd?.releaseDate || 'Unknown');
      console.log('Format:', cd?.format || 'Unknown');
      console.log('Track Count:', cd?.trackCount || 0);
      console.log('Cover Art:', cd?.coverArtUrl ? 'Available' : 'Not available');
    } else {
      console.log('❌ CD lookup failed');
      console.log('Error:', response.data.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ CD lookup error:', error.message);
  }
  
  console.log('');
}

async function testCDSearch(artist, title) {
  console.log(`🔍 Testing CD search for: ${artist} - ${title}...`);
  
  try {
    const searchUrl = `${API_BASE}/api/cd/search?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
    const response = await makeRequest(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ CD search successful');
      const results = response.data.data;
      console.log(`Found ${results.length} results:`);
      results.forEach((cd, index) => {
        console.log(`  ${index + 1}. ${cd.artist} - ${cd.title} (${cd.releaseDate})`);
      });
    } else {
      console.log('❌ CD search failed');
      console.log('Error:', response.data.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ CD search error:', error.message);
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
  console.log('🚀 Starting MusicBrainz CD integration tests...\n');
  
  // Test 1: Health check
  await testHealthCheck();
  
  // Test 2: CD service info
  await testCDInfo();
  
  // Test 3: CD lookups
  for (const barcode of TEST_BARCODES) {
    await testCDLookup(barcode);
  }
  
  // Test 4: CD search
  await testCDSearch('The Beatles', 'Abbey Road');
  await testCDSearch('Pink Floyd', 'Dark Side of the Moon');
  
  console.log('🏁 Tests completed!');
  console.log('\nNext steps:');
  console.log('1. If health check fails, start your API server: cd apps/mercania-api && npm run dev');
  console.log('2. If CD lookups fail, check your JWT token');
  console.log('3. MusicBrainz is free and has no rate limits!');
}

// Run tests
runTests().catch(console.error);
