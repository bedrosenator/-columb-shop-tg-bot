# Base image for NodeJS with Corepack enabled for pnpm
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src/app

# Stage 1: Install dependencies
FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Build the NestJS application
FROM base AS build
COPY package.json pnpm-lock.yaml ./
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY . .
RUN pnpm build
# Re-install only production dependencies to keep the image slim
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --ignore-scripts

# Stage 3: Production runtime environment
FROM base AS production
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

# Expose default application port
EXPOSE 3000

# Set environment variable for execution mode
ENV NODE_ENV=production

# Run the app
CMD [ "node", "dist/main" ]
