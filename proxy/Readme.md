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

Make sure certbot restarts the container every few months, because let's encrypt certs are shortlived.

```bash
nano /etc/letsencrypt/renewal/<domain>.conf

[renewalparams]
...
renew_hook = docker restart speccytools_proxy
```
