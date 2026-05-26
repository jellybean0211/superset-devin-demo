FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --omit=dev

COPY src ./src

# Default ENTRYPOINT runs the spawn script. Override with `--entrypoint`
# (e.g. for upload-knowledge): docker run --entrypoint npx ... tsx src/upload-knowledge.ts
ENTRYPOINT ["npx", "tsx", "src/index.ts"]
