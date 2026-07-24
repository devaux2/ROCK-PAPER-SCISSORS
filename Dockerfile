# Full game in one container: builds the web client, then the Node server
# serves client + API + realtime on $PORT (default 3001).
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci

COPY . .
ENV EXPO_OFFLINE=1
RUN npm run build:web

ENV NODE_ENV=production
ENV PORT=3001
# Some hosts (e.g. Hugging Face Spaces) run containers as a non-root user:
# make the SQLite dir writable and keep HOME somewhere writable too.
RUN mkdir -p apps/server/data && chmod -R 777 apps/server/data
ENV HOME=/tmp
# SQLite lives in apps/server/data; mount a volume there to persist it.
EXPOSE 3001
CMD ["node", "node_modules/tsx/dist/cli.mjs", "apps/server/src/index.ts"]
