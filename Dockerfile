FROM caddy:2 AS base
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

FROM node:19 AS npmbuild
WORKDIR /project
COPY . .
RUN npm install
RUN npm run build

FROM base AS final
COPY --from=npmbuild /project/apps/web/public /srv
RUN sed -i "s|ver=0|"ver=`date +"%s"`"|g" /srv/index.html
