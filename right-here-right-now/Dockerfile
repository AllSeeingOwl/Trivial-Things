FROM node:26-alpine AS base

FROM base AS builder
WORKDIR /app

# Pinned so a new pnpm release can't change install behaviour under us.
# pnpm 12 refuses packages published less than 24h ago (minimumReleaseAge),
# a supply-chain safeguard: a just-released dependency fails the build until
# it is a day old.
RUN npm install -g pnpm@12.21.0

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* ./
RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
