FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json .
RUN npm install

COPY . .
RUN npm run build

# Production: serve via nginx (docker-compose / VPS)
FROM nginx:alpine AS nginx
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# Railway target: zero-dependency Node.js static server
FROM node:20-alpine AS railway
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY server.js .
EXPOSE 3000
CMD ["node", "server.js"]
