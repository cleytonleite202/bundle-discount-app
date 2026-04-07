FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json* ./

# ✅ Install ALL deps including devDeps for build
RUN npm ci && npm cache clean --force

# Copy source
COPY . .

# ✅ Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# ✅ Remove devDeps after build to keep image small
RUN npm prune --production

# ✅ Expose Railway's dynamic port
EXPOSE ${PORT:-3000}

CMD ["npm", "run", "docker-start"]