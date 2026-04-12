FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/replanner-agent/package.json ./packages/replanner-agent/
COPY packages/router-agent/package.json ./packages/router-agent/

RUN npm install --omit=dev \
    --workspace=packages/replanner-agent \
    --workspace=packages/router-agent

COPY packages/replanner-agent/src ./packages/replanner-agent/src
COPY packages/router-agent/src ./packages/router-agent/src
COPY data/ ./data/

ENV NODE_ENV=production

CMD ["node", "packages/replanner-agent/src/agent.js"]
