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
# SQLite lives here; mount a volume at /app/apps/server/data to persist it.
EXPOSE 3001
CMD ["npm", "start"]
