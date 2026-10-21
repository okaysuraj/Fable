#!/bin/bash
# Run only on the operator-owned Linux host after preparing a bundle with real hostnames.
set -euo pipefail
umask 077
[[ "$EUID" -eq 0 ]] || { echo 'Run this installer with sudo.'; exit 1; }
[[ "$(pwd -P)" == /opt/fable/backend ]] || { echo 'Install the backend at /opt/fable/backend and run this command there.'; exit 1; }
bundle=/opt/fable/backend/ops/generated/server
for program in node caddy turnserver certbot systemctl install runuser flock tar openssl setfacl; do
  command -v "$program" >/dev/null || { echo "Install prerequisite: $program"; exit 1; }
done
[[ -x /usr/bin/node && -x /usr/bin/turnserver ]] || { echo 'The service units require /usr/bin/node and /usr/bin/turnserver.'; exit 1; }
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'
node -e 'if (require("./package.json").name !== "fable-backend") process.exit(1)'
node -e 'const {execFileSync}=require("node:child_process"); const match=execFileSync("/usr/bin/turnserver",["--version"],{encoding:"utf8"}).match(/(\d+)\.(\d+)\.(\d+)/); if(!match || Number(match[1]) < 4 || (Number(match[1])===4 && Number(match[2])<9)) {console.error("Install patched coturn 4.9 or later.");process.exit(1);}'
if systemctl is-active --quiet coturn.service; then
  echo 'The existing coturn.service owns relay ports. Review and stop it before installing the separate Fable relay.'
  exit 1
fi
[[ -f dist/index.js && -f dist/worker.js && -x node_modules/mediasoup/worker/out/Release/mediasoup-worker ]] || { echo 'As your deployment user, run npm ci, npm run prisma:generate and npm run build on this Linux host first.'; exit 1; }
getent passwd fable >/dev/null || useradd --system --home-dir /var/lib/fable --shell /usr/sbin/nologin fable
getent passwd turnserver >/dev/null || useradd --system --home-dir /var/lib/fable-turn --shell /usr/sbin/nologin turnserver
runuser -u fable -- test -r dist/index.js
runuser -u fable -- test -r config/database.mjs
runuser -u fable -- test -x node_modules/mediasoup/worker/out/Release/mediasoup-worker
install -d -o root -g fable -m 0750 /etc/fable
install -d -o root -g turnserver -m 0750 /etc/fable/turn
# Allow only the relay group to traverse the configuration parent.
setfacl -m g:turnserver:x /etc/fable
install -d -o fable -g fable -m 0700 /var/lib/fable /var/lib/fable/media
install -d -o root -g root -m 0700 /var/backups/fable /usr/local/lib/fable
install -d -o root -g root -m 0755 /var/lib/fable-acme /etc/caddy/conf.d
install -o root -g fable -m 0640 "$bundle/api.env" /etc/fable/api.env
install -o root -g root -m 0600 "$bundle/migration.env" /etc/fable/migration.env
install -o root -g fable -m 0640 "$bundle/firebase-admin.json" /etc/fable/firebase-admin.json
install -o root -g turnserver -m 0640 "$bundle/turnserver.conf" /etc/fable/turnserver.conf
install -o root -g root -m 0644 "$bundle/Caddyfile" /etc/caddy/conf.d/fable.caddy
if ! grep -qFx 'import /etc/caddy/conf.d/*.caddy' /etc/caddy/Caddyfile; then
  cp -p /etc/caddy/Caddyfile "/var/backups/fable/Caddyfile-$(date -u +%Y%m%dT%H%M%SZ)"
  printf '\nimport /etc/caddy/conf.d/*.caddy\n' >> /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload-or-restart caddy
for unit in fable-api.service fable-worker.service fable-turn.service fable-media-backup.service fable-media-backup.timer; do
  install -o root -g root -m 0644 "$bundle/$unit" "/etc/systemd/system/$unit"
done
install -o root -g root -m 0700 "$bundle/backup-media.sh" /usr/local/lib/fable/backup-media.sh
cat > /usr/local/lib/fable/renew-turn-cert.sh <<'HOOK'
#!/bin/sh
set -eu
lineage=/etc/letsencrypt/live/@TURN_DOMAIN@
install -o root -g turnserver -m 0640 "$lineage/fullchain.pem" /etc/fable/turn/fullchain.pem
install -o root -g turnserver -m 0640 "$lineage/privkey.pem" /etc/fable/turn/privkey.pem
if systemctl is-active --quiet fable-turn.service; then systemctl restart fable-turn.service; fi
HOOK
chmod 0700 /usr/local/lib/fable/renew-turn-cert.sh
certbot certonly --webroot --webroot-path /var/lib/fable-acme --domain @TURN_DOMAIN@ --deploy-hook /usr/local/lib/fable/renew-turn-cert.sh
/usr/local/lib/fable/renew-turn-cert.sh
# Runtime services receive no migration-owner credentials.
chown -R root:root "$bundle"
chmod 0700 "$bundle"
if runuser -u fable -- test -w dist/index.js; then
  echo 'Installed application code must be owned by root or your deployment user, not fable.'
  exit 1
fi
DOTENV_CONFIG_PATH=/etc/fable/migration.env node scripts/deploy-database.mjs
systemctl daemon-reload
systemctl enable --now fable-api.service fable-worker.service fable-turn.service fable-media-backup.timer
systemctl enable --now certbot.timer
printf '%s\n' 'Fable services installed. Run sudo journalctl -u fable-api -u fable-worker -u fable-turn for service status.'
printf '%s\n' 'Keep private media backups off-host. For existing media, copy the original objects before switching the mobile API URL.'
