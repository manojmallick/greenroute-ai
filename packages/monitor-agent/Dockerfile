FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/monitor-agent/package.json ./packages/monitor-agent/
COPY packages/router-agent/package.json ./packages/router-agent/

RUN npm install --omit=dev \
    --workspace=packages/monitor-agent \
    --workspace=packages/router-agent

COPY packages/monitor-agent/src ./packages/monitor-agent/src
COPY packages/router-agent/src ./packages/router-agent/src
COPY data/ ./data/

ENV NODE_ENV=production

CMD ["node", "packages/monitor-agent/src/agent.js"]
