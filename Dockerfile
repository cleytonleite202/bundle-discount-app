FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY package.json package-lock.json* ./

# ✅ Install ALL deps — don't prune, Shopify packages need their peer deps
RUN npm ci --legacy-peer-deps && npm cache clean --force

COPY . .

RUN npx prisma generate
RUN npm run build

# ✅ Removed npm prune — it was deleting required Shopify peer deps

EXPOSE ${PORT:-3000}

CMD ["npm", "run", "docker-start"]