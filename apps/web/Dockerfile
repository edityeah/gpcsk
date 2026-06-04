# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gpcsk/web build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3001
