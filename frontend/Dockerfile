FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY public/ ./public/
COPY src/ ./src/
COPY tsconfig.json ./
ARG REACT_APP_API_URL=http://localhost:3001
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

FROM nginx:alpine AS production
# Create non-root user for security
RUN addgroup -S wgi && adduser -S wgi -G wgi
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Allow nginx to write temporary files as non-root
RUN chown -R wgi:wgi /usr/share/nginx/html \
    && chown -R wgi:wgi /var/cache/nginx \
    && touch /var/run/nginx.pid \
    && chown wgi:wgi /var/run/nginx.pid
USER wgi
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
