FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV TIMESHEET_PORT=5180
COPY --from=build /app/dist ./dist
COPY index.html app.js hours.js reminders.js styles.css manifest.webmanifest sw.js config.js ./
COPY sdk ./sdk
COPY infra/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 5180
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/server.js"]
