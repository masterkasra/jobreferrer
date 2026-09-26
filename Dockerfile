# Runs the Telegram bot. Build: docker build -t jobreferrer .
# Run:  docker run -d --env-file .env -v jr-data:/app/.cache jobreferrer
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY bin ./bin
COPY src ./src
COPY examples ./examples
ENV NODE_ENV=production
VOLUME ["/app/.cache"]
CMD ["node", "src/bot/telegram.js"]
