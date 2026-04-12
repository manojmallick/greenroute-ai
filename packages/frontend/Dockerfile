FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root + package files
COPY package.json ./
COPY packages/frontend/package.json ./packages/frontend/

# Install (legacy-peer-deps for react-leaflet + React 19)
RUN npm install --legacy-peer-deps --workspace=packages/frontend

# Copy source
COPY packages/frontend/ ./packages/frontend/

# Build with API URL pointing to the Cloud Run API gateway
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build --workspace=packages/frontend

# ── nginx stage ───────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
