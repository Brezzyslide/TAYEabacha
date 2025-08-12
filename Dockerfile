# Phase 7: Production-ready Docker image for Linux deployment

FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN chmod +x build.sh && ./build.sh

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S careconnect -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=careconnect:nodejs /app/dist/public ./dist/public
COPY --from=builder --chown=careconnect:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=careconnect:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=careconnect:nodejs /app/package*.json ./

# Copy migration scripts
COPY --chown=careconnect:nodejs db-migrate.sh docker-migrate.sh ./
RUN chmod +x db-migrate.sh docker-migrate.sh

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Switch to non-root user
USER careconnect

# Expose port
EXPOSE 5000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "backend/dist/server.js"]