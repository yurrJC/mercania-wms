# eBay API Setup for DVD Intake

## Overview
The DVD intake system uses eBay's Product Catalog API to lookup movie metadata from UPC/EAN barcodes. This provides rich product information for professional inventory management.

## eBay Developer Account Setup

### 1. Create eBay Developer Account
1. Go to https://developer.ebay.com/
2. Sign in with your existing eBay account or create new one
3. Accept the developer agreement

### 2. Create an Application
1. Navigate to "My Account" → "Keys"
2. Click "Create an Application Key"
3. Choose "Production" for live use or "Sandbox" for testing
4. Fill in application details:
   - **Application Name**: "Mercania WMS DVD Lookup"
   - **Application Purpose**: "Inventory management system for retail/resale business"

### 3. Get Your Credentials
After creating the application, you'll receive:
- **App ID** (Application ID)
- **Client ID** (OAuth Client ID)  
- **Client Secret** (OAuth Client Secret)

## Environment Configuration

Add these variables to your `.env` file in `apps/mercania-api/`:

```bash
# eBay API Configuration
EBAY_APP_ID="your_ebay_app_id_here"
EBAY_CLIENT_ID="your_ebay_client_id_here"
EBAY_CLIENT_SECRET="your_ebay_client_secret_here"
```

### Example Credentials Format:
```bash
# Sandbox (Testing)
EBAY_CLIENT_ID="YourApp-YourApp-SBX-abc123def4-56789abc"
EBAY_CLIENT_SECRET="SBX-abc123def456789-abc123-456789-abc123-def456"
EBAY_APP_ID="YourAppI-d123-4567-8901-234567890123"

# Production (Live)
EBAY_CLIENT_ID="YourApp-YourApp-PRD-abc123def4-56789abc"
EBAY_CLIENT_SECRET="PRD-abc123def456789-abc123-456789-abc123-def456"
EBAY_APP_ID="YourAppI-d123-4567-8901-234567890123"
```

## API Endpoints Used

### Product Catalog API
- **Base URL**: `https://api.ebay.com/commerce/catalog/v1/`
- **Search**: `product_summary/search?upc={upc}&category_ids=11232,617,1249,11233,63861`
- **Details**: `product/{epid}`
- **Marketplace**: `EBAY_AU` (Australia)

### Categories Used:
- **11232**: DVDs & Movies
- **617**: DVDs & Blu-ray Discs  
- **1249**: DVDs
- **11233**: Blu-ray Discs
- **63861**: 4K UHD Movies

## Rate Limits
- **100,000 requests per day** (more than sufficient for most operations)
- **Burst limit**: ~10 requests per second
- **Enterprise support**: Available for high-volume users

## Testing

### Test UPC Codes (for verification):
- **The Matrix (1999)**: `883929247318`
- **Toy Story (1995)**: `786936224436`
- **Finding Nemo (2003)**: `786936279528`

### API Test:
```bash
# Test the DVD lookup endpoint
curl "http://localhost:3001/api/intake/dvd/883929247318"
```

## Troubleshooting

### Common Issues:

1. **"eBay API credentials not configured"**
   - Verify environment variables are set correctly
   - Restart the API server after adding credentials

2. **"Failed to get eBay access token"**
   - Check Client ID and Client Secret are correct
   - Ensure using production credentials for live environment

3. **"DVD not found in eBay catalog"**
   - Try a different UPC/EAN code
   - Use manual entry for rare/independent releases
   - Some items may not be in eBay's product catalog

4. **Rate limit exceeded**
   - Implement caching for repeated lookups
   - Contact eBay for enterprise limits if needed

## Data Quality

### What You Get:
- ✅ **Title**: Movie/TV show name
- ✅ **Director**: From product aspects  
- ✅ **Studio/Distributor**: Brand information
- ✅ **Release Year**: Publication date
- ✅ **Format**: DVD, Blu-ray, 4K UHD
- ✅ **Genre**: Category classification
- ✅ **Rating**: Age classification (when available)
- ✅ **Runtime**: Duration in minutes (when available)

### Australian Specific:
- **Region 4 DVDs**: Well covered
- **PAL format**: Properly identified
- **Local distributors**: Good coverage
- **Classification**: Australian ratings when available

## Security Notes

- **Never commit** `.env` files to version control
- **Rotate credentials** periodically
- **Use Sandbox** for development/testing
- **Monitor usage** through eBay Developer Console

## Production Deployment

For production deployment:
1. Use **production** eBay credentials
2. Set up **monitoring** for API usage
3. Implement **error handling** for rate limits
4. Consider **caching** frequently accessed products
5. Set up **alerts** for credential expiration

---

**Need Help?**
- eBay Developer Documentation: https://developer.ebay.com/api-docs/
- eBay Developer Community: https://community.ebay.com/t5/Developer-Program/ct-p/developer-program
- Contact eBay Developer Support through the developer portal
