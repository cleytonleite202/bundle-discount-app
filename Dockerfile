FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps && npm cache clean --force

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 8080

CMD ["npm", "run", "docker-start"]