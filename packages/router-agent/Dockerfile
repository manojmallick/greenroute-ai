FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/router-agent/package.json ./packages/router-agent/

RUN npm install --omit=dev --workspace=packages/router-agent

COPY packages/router-agent/src ./packages/router-agent/src
COPY data/ ./data/

ENV NODE_ENV=production

CMD ["node", "packages/router-agent/src/agent.js"]
