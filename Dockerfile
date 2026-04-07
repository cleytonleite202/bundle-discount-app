FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# ✅ Install all deps with legacy peer deps flag
RUN npm ci --legacy-peer-deps && npm cache clean --force

COPY . .

RUN npx prisma generate
RUN npm run build

RUN npm prune --production --legacy-peer-deps

EXPOSE ${PORT:-3000}

CMD ["npm", "run", "docker-start"]