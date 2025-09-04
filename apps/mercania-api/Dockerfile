# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install system dependencies for canvas and native modules
RUN apk add --no-cache \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/mercania-api/package*.json ./apps/mercania-api/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY apps/mercania-api/ ./apps/mercania-api/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN cd apps/mercania-api && npx prisma generate

# Build the application
RUN cd apps/mercania-api && npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mercania -u 1001

# Change ownership of the app directory
RUN chown -R mercania:nodejs /app
USER mercania

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "apps/mercania-api/dist/index.js"]
