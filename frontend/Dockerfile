# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage — static files served by Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback handled by the root nginx.conf, not here
EXPOSE 80
