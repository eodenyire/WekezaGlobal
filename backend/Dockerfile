FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Copy pre-installed node_modules so the image builds without registry access.
# When node_modules is absent from the build context, add a `RUN npm ci` here.
COPY node_modules ./node_modules
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# Create non-root user for security
RUN addgroup -S wgi && adduser -S wgi -G wgi
COPY package*.json ./
# Reuse builder node_modules and strip devDependencies
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Ensure the non-root user owns the app files
RUN chown -R wgi:wgi /app
USER wgi
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "dist/server.js"]
