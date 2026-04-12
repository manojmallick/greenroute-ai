FROM node:20-alpine

WORKDIR /app

# Copy workspace root and package manifests first (layer cache optimization)
COPY package.json ./
COPY packages/api-gateway/package.json ./packages/api-gateway/
COPY packages/router-agent/package.json ./packages/router-agent/

# Install only production deps
RUN npm install --omit=dev --workspace=packages/api-gateway --workspace=packages/router-agent

# Copy source
COPY packages/api-gateway/src ./packages/api-gateway/src
COPY packages/router-agent/src ./packages/router-agent/src
COPY data/ ./data/

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "packages/api-gateway/src/index.js"]
