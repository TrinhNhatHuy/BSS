# Stage 1 - Build React app
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files first - caches node_modules
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# n8n "AI Controller" webhook URL — Vite inlines env vars at build time, so this
# must be present when `npm run build` runs. Override per-deploy via the
# docker-compose build arg of the same name. If unset, the app falls back to the
# default baked into src/api/aiApi.js.
ARG VITE_AI_CONTROLLER_URL
ENV VITE_AI_CONTROLLER_URL=$VITE_AI_CONTROLLER_URL

RUN npm run build

# Stage 2 - Serve with Nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
