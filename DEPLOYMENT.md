# 🚀 Mercania WMS Production Deployment Guide

## Pre-Deployment Checklist

### ✅ Code Preparation
- [x] Dockerfiles created for both services
- [x] Next.js configured for production
- [x] Environment variables documented
- [x] Database setup script created
- [x] Render blueprint configuration ready

### ✅ Security Considerations
- [ ] Generate strong JWT secret
- [ ] Set up CORS properly
- [ ] Review environment variables
- [ ] Enable HTTPS (automatic on Render)

## Deployment Steps

### 1. Database Setup
1. Create PostgreSQL database on Render
2. Note the connection string
3. Update environment variables

### 2. API Deployment
1. Deploy API service with Docker
2. Set environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `CORS_ORIGIN`

### 3. Frontend Deployment
1. Deploy frontend service with Docker
2. Set environment variables:
   - `NEXT_PUBLIC_API_URL`
   - `API_URL`

### 4. Post-Deployment
1. Verify database connection
2. Run database migrations
3. Test all endpoints
4. Configure custom domain (optional)

## Environment Variables

### API Service
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/db
ADMIN_PASSWORD=your-admin-password
JWT_SECRET=your-super-secret-key
CORS_ORIGIN=https://your-frontend-url.onrender.com
```

### Frontend Service
```bash
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://your-api-url.onrender.com
API_URL=https://your-api-url.onrender.com
```

## Monitoring & Maintenance

### Health Checks
- API: `https://your-api.onrender.com/health`
- Frontend: `https://your-frontend.onrender.com/`

### Logs
- Monitor logs in Render dashboard
- Set up alerts for errors

### Database
- Regular backups (Render handles this)
- Monitor connection limits

## Troubleshooting

### Common Issues
1. **Database Connection**: Check DATABASE_URL format
2. **CORS Errors**: Verify CORS_ORIGIN matches frontend URL
3. **Build Failures**: Check Docker logs for missing dependencies
4. **Environment Variables**: Ensure all required vars are set

### Useful Commands
```bash
# Check API health
curl https://your-api.onrender.com/health

# Test database connection
curl https://your-api.onrender.com/api/items

# View logs
# Use Render dashboard logs section
```

## Cost Optimization

### Free Tier Limits
- 750 hours/month per service
- Services sleep after 15 minutes of inactivity
- Cold start takes ~30 seconds

### Upgrade Considerations
- Upgrade to paid plan for always-on services
- Consider database backup options
- Monitor usage and performance

## Security Best Practices

1. **Environment Variables**: Never commit secrets to git
2. **HTTPS**: Always use HTTPS in production
3. **CORS**: Restrict to known origins
4. **Database**: Use connection pooling
5. **Monitoring**: Set up error tracking

## Support

- Render Documentation: https://render.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Prisma Deployment: https://www.prisma.io/docs/guides/deployment
