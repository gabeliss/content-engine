FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV REMOTION_DISABLE_UPDATE_CHECK=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci
RUN node -e "import('@remotion/renderer').then(({ ensureBrowser }) => ensureBrowser({ chromeMode: 'headless-shell', logLevel: 'info' }))"

COPY src ./src
COPY services/studio-render-worker ./services/studio-render-worker

CMD ["node", "services/studio-render-worker/server.mjs"]
