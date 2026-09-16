FROM node:18-bookworm-slim

# Install Chromium and FFmpeg for Remotion rendering
# ponytail: deb.debian.org drops the connection mid-batch on this VM; retry
# once with --fix-missing (cached debs from the first pass complete the rest)
RUN apt-get update && \
    (apt-get install -y --no-install-recommends chromium ffmpeg || \
     apt-get install -y --no-install-recommends --fix-missing chromium ffmpeg) && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV REMOTION_BUNDLE_PATH=/app/remotion
ENV OUTPUT_DIR=/output

WORKDIR /app

# Copy render service source. The lockfile has to come along: without it npm
# resolves the ^4.x ranges fresh, and because this layer and the remotion one
# below are cached independently, the two trees drift onto different Remotion
# versions — a mismatched bundler and runtime fail the bundle at startup.
COPY render-service/package.json render-service/package-lock.json ./
RUN npm ci

COPY render-service/tsconfig.json ./
COPY render-service/src/ ./src/

# Copy remotion source for bundling
COPY remotion/package.json remotion/package-lock.json /app/remotion/
COPY remotion/tsconfig.json /app/remotion/tsconfig.json
COPY remotion/src/ /app/remotion/src/
COPY remotion/public/ /app/remotion/public/

# Install remotion deps — must stay in lockstep with the render-service tree
# above, since the bundler and the bundled code resolve Remotion separately.
RUN cd /app/remotion && npm ci

# Build TypeScript
RUN npm run build

# Drop privileges, as the main API image already does. This container runs a
# headless Chromium over user-supplied video, which is the least trustworthy
# code in the stack to be running as root. node:*-slim ships an unused `node`
# user; /output is a mounted volume, so its ownership is set by the host.
RUN chown -R node:node /app
USER node

EXPOSE 3100
CMD ["node", "dist/server.js"]
