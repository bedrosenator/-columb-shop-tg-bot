# Base image for NodeJS with Corepack enabled for pnpm
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src/app

# Stage 1: Install dependencies (including toolchain for compiling native better-sqlite3 C++ addon)
FROM base AS dependencies
RUN apk add --no-cache make gcc g++ python3
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Stage 2: Build the NestJS application
FROM base AS build
RUN apk add --no-cache make gcc g++ python3
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN pnpm build
# Re-install only production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Stage 3: Production runtime environment
FROM base AS production
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/generated ./generated
COPY --from=build /usr/src/app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000
ENV NODE_ENV=production

# Run migrations, seed the database, and start the application
CMD [ "sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/main" ]
