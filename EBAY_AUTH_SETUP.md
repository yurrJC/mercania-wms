# eBay Authentication Setup Guide

This guide covers both OAuth 2.0 and Auth'n'Auth (legacy) authentication methods for eBay's Product Catalog API.

## Overview

Your Mercania WMS system uses eBay's Product Catalog API to lookup DVD and CD metadata. You have two authentication options:

1. **OAuth 2.0** (Recommended) - Modern, secure, but requires user interaction
2. **Auth'n'Auth** (Legacy) - Simpler setup, but being phased out by eBay

## Option 1: OAuth 2.0 (Recommended)

### Step 1: Get eBay Developer Credentials

1. Go to [eBay Developer Console](https://developer.ebay.com/my/keys)
2. Sign in with your eBay account
3. Click "Create an Application Key"
4. Choose "Production" for live use
5. Fill in application details:
   - **Application Name**: "Mercania WMS DVD Lookup"
   - **Application Purpose**: "Inventory management system for retail/resale business"

### Step 2: Get Your Credentials

After creating the application, you'll receive:
- **App ID** (Client ID)
- **Client Secret** (OAuth Client Secret)

### Step 3: Generate User Token

Use the provided `get-ebay-token.html` file:

1. Open `get-ebay-token.html` in your browser
2. Enter your App ID and Client Secret
3. Click "Generate Authorization URL"
4. Click the generated URL and sign in to eBay
5. Copy the authorization code from the redirect URL
6. Paste the code and click "Get Access Token"
7. Copy the generated access token

### Step 4: Configure Environment Variables

Add to your `.env` file in `apps/mercania-api/`:

```bash
# eBay OAuth Configuration
EBAY_CLIENT_ID="your-ebay-client-id-here"
EBAY_CLIENT_SECRET="your-ebay-client-secret-here"
EBAY_USER_TOKEN="your-generated-user-token-here"
```

### Step 5: Test the Setup

```bash
# Test DVD lookup
curl -X POST "http://localhost:3001/api/dvd/lookup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"upc": "883929247318"}'
```

## Option 2: Auth'n'Auth (Legacy)

### Step 1: Get eBay Developer Credentials

1. Go to [eBay Developer Console](https://developer.ebay.com/my/keys)
2. Create an application (same as OAuth)
3. You'll need:
   - **App ID** (Application ID)
   - **Dev ID** (Developer ID)
   - **Cert ID** (Certificate ID)

### Step 2: Configure Environment Variables

Add to your `.env` file in `apps/mercania-api/`:

```bash
# eBay Auth'n'Auth Configuration
EBAY_APP_ID="your-ebay-app-id-here"
EBAY_DEV_ID="your-ebay-dev-id-here"
EBAY_CERT_ID="your-ebay-cert-id-here"
EBAY_RU_NAME="Mercania-WMS-1"
EBAY_USER_TOKEN="your-user-token-here"
```

### Step 3: Get Authorization URL

```bash
curl "http://localhost:3001/api/dvd/auth-url" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 4: Complete Authorization

1. Open the returned URL in your browser
2. Sign in to eBay and authorize the application
3. Copy the session ID from the redirect URL
4. Use the session ID to get a user token (requires additional implementation)

## Troubleshooting

### Common OAuth Issues

1. **"Invalid scope" error**
   - Ensure you're using the correct scopes: `https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly https://api.ebay.com/oauth/api_scope/commerce.catalog.read`

2. **"Token expired" error**
   - OAuth tokens expire. You'll need to regenerate them periodically
   - Consider implementing token refresh logic

3. **"Insufficient permissions" error**
   - Check that your eBay account has the necessary permissions
   - Ensure you're using production credentials for live environment

### Common Auth'n'Auth Issues

1. **"Missing credentials" error**
   - Verify all three IDs (App ID, Dev ID, Cert ID) are set correctly
   - Check that RU_NAME is configured

2. **"Invalid session" error**
   - The Auth'n'Auth flow requires user interaction
   - Ensure you've completed the authorization process

### API Version Issues

- The system now uses `v1` instead of `v1_beta` for better stability
- If you encounter API errors, check the eBay API documentation for the latest version

## Testing Your Setup

### Test with Sample UPCs

```bash
# The Matrix (1999)
curl -X POST "http://localhost:3001/api/dvd/lookup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"upc": "883929247318"}'

# Toy Story (1995)
curl -X POST "http://localhost:3001/api/dvd/lookup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"upc": "786936224436"}'
```

### Expected Response

```json
{
  "success": true,
  "data": {
    "upc": "883929247318",
    "title": "The Matrix",
    "director": "Lana Wachowski, Lilly Wachowski",
    "studio": "Warner Bros.",
    "releaseYear": 1999,
    "format": "DVD",
    "genre": "Action",
    "rating": "M",
    "runtime": 136,
    "epid": "123456789",
    "imageUrl": "https://..."
  }
}
```

## Security Best Practices

1. **Never commit** `.env` files to version control
2. **Rotate credentials** periodically
3. **Use environment-specific** credentials (sandbox vs production)
4. **Monitor API usage** through eBay Developer Console
5. **Implement rate limiting** to avoid hitting API limits

## Migration from OAuth to Auth'n'Auth

If you want to switch from OAuth to Auth'n'Auth:

1. Update your environment variables
2. Use the new `/api/dvd/` endpoints instead of `/api/intake/dvd/`
3. Follow the Auth'n'Auth authorization flow

## Support

- **eBay Developer Documentation**: https://developer.ebay.com/api-docs/
- **eBay Developer Community**: https://community.ebay.com/t5/Developer-Program/ct-p/developer-program
- **API Status**: https://developer.ebay.com/support/api-status

## Rate Limits

- **100,000 requests per day** (OAuth)
- **5,000 requests per day** (Auth'n'Auth)
- **Burst limit**: ~10 requests per second
- **Enterprise support**: Available for high-volume users
