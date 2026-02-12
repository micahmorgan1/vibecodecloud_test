# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build frontend and backend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev
RUN npx prisma generate

# Copy built files
COPY --from=builder /app/dist ./dist

# Create uploads directories
RUN mkdir -p uploads/resumes uploads/portfolios uploads/offers

# Set environment variables
ENV NODE_ENV=production

# Expose port (Railway injects PORT at runtime)
EXPOSE ${PORT:-3005}

# Start the server (run db:push to ensure schema is applied, then start)
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server/index.js"]
