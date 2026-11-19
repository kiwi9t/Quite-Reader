FROM node:22.12.0-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate the Prisma client at build time so cold starts stay fast.
RUN npx prisma generate

# Pre-compile TypeScript once at build time. Starting with plain `node`
# instead of compiling through tsx on every boot makes Render's cold start
# (waking from sleep) a few seconds faster.
RUN npm run build

ENV NODE_ENV=production

CMD ["npm", "run", "start:prod"]
