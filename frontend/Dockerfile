FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_SERVER_URL=http://localhost:10000
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
