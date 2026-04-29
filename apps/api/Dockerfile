FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile=false --filter @datos/api...

FROM base AS build
COPY --from=deps /app /app
COPY apps/api apps/api
COPY tsconfig.base.json .
WORKDIR /app/apps/api
RUN pnpm prisma generate && pnpm build

FROM node:22-alpine AS runtime
RUN apk add --no-cache dumb-init openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
USER node
EXPOSE 4000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
