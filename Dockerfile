FROM caddy:2 AS base
COPY Caddyfile /etc/caddy/Caddyfile

FROM node:16 AS npmbuild
WORKDIR /project
COPY . .
RUN npm install
RUN npm run build:all:release

FROM base AS final
COPY --from=npmbuild /project/public /srv