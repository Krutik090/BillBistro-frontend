FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/pos/package.json apps/pos/
COPY apps/kds/package.json apps/kds/
COPY apps/qr/package.json apps/qr/
COPY packages/ui/package.json packages/ui/
COPY packages/sdk/package.json packages/sdk/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_API_MODE=real
ARG NEXT_PUBLIC_TENANT_SLUG=demo
ARG NEXT_PUBLIC_OUTLET_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_MODE=$NEXT_PUBLIC_API_MODE \
    NEXT_PUBLIC_TENANT_SLUG=$NEXT_PUBLIC_TENANT_SLUG \
    NEXT_PUBLIC_OUTLET_ID=$NEXT_PUBLIC_OUTLET_ID
RUN npx turbo run build --filter=@billbistro/pos...

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/pos
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
