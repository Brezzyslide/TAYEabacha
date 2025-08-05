# Production Dockerfile for NeedsCareAI+ Healthcare Platform
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY production-start.js ./

# Set default environment variables (can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S needscareai -u 1001

# Set ownership
RUN chown -R needscareai:nodejs /app
USER needscareai

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the application using the production startup script
CMD ["node", "production-start.js"]