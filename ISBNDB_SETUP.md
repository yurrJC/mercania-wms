# ISBNdb Integration Setup

## 🔑 Getting Your ISBNdb API Key

1. **Sign up at ISBNdb**
   - Go to [https://isbndb.com/](https://isbndb.com/)
   - Create a free account
   - Navigate to your account dashboard
   - Find your API key (REST API Key)

2. **Pricing Info (as of 2024)**
   - **Free tier**: 1,000 requests/month
   - **Premium**: $50/month for 100,000 requests
   - **Enterprise**: Custom pricing for higher volumes

## ⚙️ Configuration

1. **Create Environment File**
   ```bash
   cd apps/mercania-api
   cp .env.example .env  # If .env.example exists
   # OR create .env manually
   ```

2. **Add Your API Key**
   ```env
   # Database
   DATABASE_URL="postgresql://postgres:password@localhost:5432/mercania_wms"
   
   # ISBNdb API
   ISBNDB_API_KEY="your_actual_api_key_here"
   
   # API Configuration
   PORT=3001
   NODE_ENV=development
   ```

3. **Replace the placeholder**
   - Replace `your_actual_api_key_here` with your real ISBNdb API key

## 🧪 Testing

### Test ISBNs (these work with both mock and real API):
- `9780140283334` - The Great Gatsby
- `9780061120084` - To Kill a Mockingbird  
- `9780451524935` - 1984

### Test without API key:
- System will automatically fall back to mock data
- Console will show: "ISBNdb API key not configured, using mock data"

### Test with API key:
- System will call real ISBNdb API
- Console will show: "Looking up ISBN X with ISBNdb..."
- Much richer data (real publishers, publication dates, etc.)

## 🔄 How It Works

1. **User scans/enters ISBN** → Frontend calls `/api/intake/:isbn`
2. **Backend checks** for `ISBNDB_API_KEY` environment variable
3. **If API key exists**:
   - Calls ISBNdb API: `GET https://api2.isbndb.com/book/{isbn}`
   - Parses response and returns formatted data
4. **If no API key**:
   - Falls back to mock data for development
5. **If API fails**:
   - Gracefully falls back to mock data
   - Logs error for debugging

## 📊 What Data You Get

### From ISBNdb API:
- **Title**: Complete book title
- **Authors**: All authors (combined into single string)
- **Publisher**: Official publisher name
- **Publication Year**: Parsed from date_published
- **Binding**: Paperback, Hardcover, etc.
- **Cover Image**: Direct URL to book cover
- **Categories**: Subject classifications
- **Additional**: Pages, language, synopsis (stored in database)

### From Mock Data (fallback):
- Basic title, author, publisher
- Limited but functional for development

## 🚨 Error Handling

The system gracefully handles:
- **Invalid ISBNs**: Returns "Unknown Book" entry
- **Book not found**: Returns appropriate placeholder
- **API rate limits**: Falls back to mock data
- **Network errors**: Falls back to mock data
- **Malformed responses**: Returns safe defaults

## 🎯 Production Recommendations

1. **Monitor API usage** through ISBNdb dashboard
2. **Set up alerts** for approaching rate limits
3. **Consider caching** frequent ISBN lookups
4. **Have mock fallback** always enabled for reliability

## ✅ Current Features

- ✅ Real-time ISBN lookup via ISBNdb API
- ✅ Automatic fallback to mock data
- ✅ Graceful error handling
- ✅ Rich metadata parsing
- ✅ Database integration
- ✅ Frontend integration

## 🚀 Next Steps

Your system is now ready to use real book data! Just add your API key and start scanning ISBNs.
