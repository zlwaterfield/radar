# Multi-stage build for NestJS application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper process handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Copy for trigger.dev
COPY --from=builder --chown=nestjs:nodejs /app/src ./src
COPY --from=builder --chown=nestjs:nodejs /app/trigger.config.ts ./trigger.config.ts
COPY --from=builder --chown=nestjs:nodejs /app/trigger ./trigger

# Install production dependencies and keep Prisma for migrations
RUN npm ci --only=production && npm install prisma --save-dev && npm cache clean --force

# Create startup script for migrations
RUN printf '#!/bin/sh\necho "Running Prisma migrations..."\nnpx prisma migrate deploy\necho "Starting application..."\nexec "$@"' > /app/start.sh && \
    chmod +x /app/start.sh && \
    chown nestjs:nodejs /app/start.sh

# Create .trigger directory with proper permissions
RUN mkdir -p /app/.trigger/tmp && \
    chown -R nestjs:nodejs /app/.trigger

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/src/main.js --health-check || exit 1

# Start the application with migrations
CMD ["/app/start.sh", "dumb-init", "node", "dist/src/main.js"]