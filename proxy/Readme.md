# How to run proxy

```bash
sudo apt install certbot
```

```bash
certbot certonly --standalone -d <domain>
```

## Docker

```bash
docker run -d \
    -p 443:443 \
    --name speccytools_proxy \
    -e "PROXY_CERTFILE=/fullchain.pem" \
    -e "PROXY_PRIVFILE=/privkey.pem" \
    -v /etc/letsencrypt/live/<domain>/fullchain.pem:/fullchain.pem \
    -v /etc/letsencrypt/live/<domain>/privkey.pem:/privkey.pem \
    <this docker image> \
    --origin="<allowed origin to connect to ws proxy from>
```

Make sure certbot restarts the container every few months, because let's encrypt certs are shortlived.

```bash
nano /etc/letsencrypt/renewal/<domain>.conf

[renewalparams]
...
renew_hook = docker restart speccytools_proxy
```

## Systemctl

```bash
cd /opt
git clone https://github.com/speccytools/jsspeccy3.git

sudo apt install python3 python3-pip
pip3 install -r /opt/jsspeccy3/proxy/requirements.txt
```

```bash
nano /etc/systemd/system/proxy.service

[Unit]
Description=Proxy service
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
Environment="PROXY_CERTFILE=/etc/letsencrypt/live/<domain>/fullchain.pem"
Environment="PROXY_PRIVFILE=/etc/letsencrypt/live/<domain>/privkey.pem"
ExecStart=/usr/bin/python3 /opt/jsspeccy3/proxy/proxy.py --logging=info --origin=https://<your origin that connects to proxy>

[Install]
WantedBy=multi-user.target
```

Make sure certbot restarts the container every few months, because let's encrypt certs are shortlived.

```bash
nano /etc/letsencrypt/renewal/<domain>.conf

[renewalparams]
...
renew_hook = systemctl restart proxy.service
```

```bash
systemctl start proxy.service
systemctl status proxy.service
```
