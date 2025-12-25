# KPI ETL Pipeline Dockerfile
# Multi-stage build for production-ready container
# Optimized for security, size, and performance

ARG NODE_VERSION=20

# ============================================================================
# Stage 0: Frontend (Dashboard) build
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS dashboard-deps

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; else npm install; fi

FROM node:${NODE_VERSION}-alpine AS dashboard-build

# Accept build arg for Clerk publishable key (public, safe to embed in frontend)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

WORKDIR /app/dashboard
COPY --from=dashboard-deps /app/dashboard/node_modules ./node_modules
COPY dashboard .
RUN npm run build

# ============================================================================
# Stage 1: Dependencies (Server)
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --prefer-offline 2>/dev/null || npm install

# ============================================================================
# Stage 2: Build
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Replace legacy public assets with the built dashboard
RUN rm -rf public && mkdir -p public
COPY --from=dashboard-build /app/dashboard/dist/ ./public/

# Build TypeScript (TSOA will generate routes and OpenAPI spec)
RUN npm run build

# ============================================================================
# Stage 3: Production
# ============================================================================
FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

# Install security updates and required tools
RUN apk upgrade --no-cache && \
    apk add --no-cache wget tini dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 kpi

# Set production environment
ENV NODE_ENV=production \
    TZ=Asia/Kolkata \
    PORT=3001

# Install production dependencies only
COPY package*.json ./
RUN npm ci --production --prefer-offline 2>/dev/null || npm install --production && \
    npm cache clean --force && \
    rm -rf /root/.npm /tmp/*

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create logs directory
RUN mkdir -p /app/logs && chown -R kpi:nodejs /app

# Switch to non-root user
USER kpi

# Expose port
EXPOSE 3001

# Health check with proper intervals for production
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application with memory limits
CMD ["node", "--max-old-space-size=512", "dist/server/app.js"]
