#!/usr/bin/env node

/**
 * Test script for eBay Auth'n'Auth endpoints
 * Run this to verify your setup is working
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE = process.env.API_URL || 'http://localhost:3001';
const JWT_TOKEN = process.env.JWT_TOKEN || 'your-jwt-token-here';

// Test UPCs
const TEST_UPCS = [
  '883929247318', // The Matrix (1999)
  '786936224436', // Toy Story (1995)
  '786936279528'  // Finding Nemo (2003)
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

async function testAuthUrl() {
  console.log('🔍 Testing Auth URL endpoint...');
  
  try {
    const response = await makeRequest(`${API_BASE}/api/dvd/auth-url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ Auth URL endpoint working');
      console.log('Auth URL:', response.data.authUrl);
    } else {
      console.log('❌ Auth URL endpoint failed');
      console.log('Response:', response.data);
    }
  } catch (error) {
    console.log('❌ Auth URL endpoint error:', error.message);
  }
  
  console.log('');
}

async function testDVDLookup(upc) {
  console.log(`🔍 Testing DVD lookup for UPC: ${upc}...`);
  
  try {
    const response = await makeRequest(`${API_BASE}/api/dvd/lookup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ upc })
    });
    
    console.log(`Status: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ DVD lookup successful');
      console.log('Title:', response.data.data?.title || 'Unknown');
      console.log('Director:', response.data.data?.director || 'Unknown');
      console.log('Studio:', response.data.data?.studio || 'Unknown');
    } else {
      console.log('❌ DVD lookup failed');
      console.log('Error:', response.data.error || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ DVD lookup error:', error.message);
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
  console.log('🚀 Starting eBay Auth\'n\'Auth endpoint tests...\n');
  
  // Test 1: Health check
  await testHealthCheck();
  
  // Test 2: Auth URL endpoint
  await testAuthUrl();
  
  // Test 3: DVD lookups
  for (const upc of TEST_UPCS) {
    await testDVDLookup(upc);
  }
  
  console.log('🏁 Tests completed!');
  console.log('\nNext steps:');
  console.log('1. If health check fails, start your API server: cd apps/mercania-api && npm run dev');
  console.log('2. If auth URL fails, check your environment variables');
  console.log('3. If DVD lookups fail, verify your EBAY_USER_TOKEN is valid');
}

// Run tests
runTests().catch(console.error);
