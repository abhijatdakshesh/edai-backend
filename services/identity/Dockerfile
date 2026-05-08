FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
# Copy non-TS assets that tsc doesn't emit
RUN find src -name "*.json" | while read f; do \
      dest="dist/${f#src/}"; mkdir -p "$(dirname $dest)"; cp "$f" "$dest"; \
    done

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
