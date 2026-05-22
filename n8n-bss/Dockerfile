FROM node:22-alpine AS n8n-base

# Install n8n on regular Alpine (has apk)
RUN npm install -g n8n@2.17.7 --fetch-retry-mintimeout 20000 --fetch-retry-maxtimeout 120000 --fetch-retries 5

# Install Chromium and all dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup -S node 2>/dev/null || true
WORKDIR /home/node
USER node

CMD ["n8n", "start"]