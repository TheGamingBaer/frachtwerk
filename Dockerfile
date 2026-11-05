# --- Web-App bauen ---
FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Server ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/frachtwerk.db
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY client/ ./client/
COPY --from=web /app/web/dist ./web/dist
VOLUME /data
EXPOSE 8080
CMD ["node", "server/src/index.js"]
