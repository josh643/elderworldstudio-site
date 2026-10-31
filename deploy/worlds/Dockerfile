FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY incoming/world-server/ews-world-src ./incoming/world-server/ews-world-src
COPY tools/worlds-lod-build.mjs tools/worlds-build.mjs ./tools/
COPY packages/ews-render ./packages/ews-render
COPY site ./site
COPY incoming/elderverse-baked ./incoming/elderverse-baked
RUN node tools/worlds-build.mjs --assets
ENV PUBLIC_BIND=0.0.0.0 PUBLIC_PORT=8080 EWS_WORLD_DATA=/var/lib/ews-worlds
EXPOSE 8080
VOLUME ["/var/lib/ews-worlds"]
CMD ["node", "incoming/world-server/ews-world-src/worlds-host.mjs"]
