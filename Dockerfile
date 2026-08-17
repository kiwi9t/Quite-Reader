FROM node:22.12.0-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
