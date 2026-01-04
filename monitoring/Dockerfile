FROM node:18-alpine

# Set timezone
ENV TZ=Asia/Jakarta
RUN apk add --no-cache tzdata && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

# Install wget and curl for healthcheck
RUN apk add --no-cache wget curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# ✅ FIX: Install ALL dependencies (not just production)
# npm ci is more reliable than npm install for Docker
RUN npm ci && \
    npm cache clean --force

# Copy application files
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 5000

# Health check - use curl instead of wget (more reliable)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["node", "monitoring-server.js"]