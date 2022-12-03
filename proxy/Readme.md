## How to run proxy

```bash
sudo apt install certbot
```

```bash
certbot certonly --standalone -d <domain>
```

```bash
docker run -d \
    --net=host \
    --name speccytools_proxy \
    -e "PROXY_CERTFILE=/fullchain.pem" \
    -e "PROXY_PRIVFILE=/privkey.pem" \
    -v /etc/letsencrypt/live/<domain>/fullchain.pem:/fullchain.pem \
    -v /etc/letsencrypt/live/<domain>/privkey.pem:/privkey.pem \
    <this docker image>
```