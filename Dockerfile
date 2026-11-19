FROM node:22.12.0-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate the Prisma client at build time so cold starts stay fast.
RUN npx prisma generate

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
