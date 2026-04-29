#!/usr/bin/env bash
# Bootstrap VPS Fedora/Ubuntu — ejecutar como root la primera vez.
set -euo pipefail

DEPLOY_USER="deploy"
SSH_PORT="${SSH_PORT:-2222}"

echo "[1/7] Creating user $DEPLOY_USER"
id -u "$DEPLOY_USER" &>/dev/null || useradd -m -s /bin/bash "$DEPLOY_USER"
usermod -aG sudo "$DEPLOY_USER" 2>/dev/null || usermod -aG wheel "$DEPLOY_USER"
mkdir -p "/home/$DEPLOY_USER/.ssh" && chmod 700 "/home/$DEPLOY_USER/.ssh"
if [ -n "${DEPLOY_AUTHORIZED_KEYS:-}" ]; then
  echo "$DEPLOY_AUTHORIZED_KEYS" > "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
fi

echo "[2/7] Hardening SSH"
sed -i "s/^#\?Port .*/Port $SSH_PORT/" /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd || systemctl reload ssh

echo "[3/7] Firewall"
if command -v ufw &>/dev/null; then
  ufw default deny incoming && ufw default allow outgoing
  ufw allow "$SSH_PORT"/tcp
  ufw allow 80/tcp && ufw allow 443/tcp
  ufw --force enable
elif command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-port="$SSH_PORT"/tcp
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --reload
fi

echo "[4/7] fail2ban"
if command -v apt-get &>/dev/null; then apt-get update -y && apt-get install -y fail2ban unattended-upgrades
elif command -v dnf &>/dev/null; then dnf install -y fail2ban dnf-automatic && systemctl enable --now dnf-automatic.timer; fi
systemctl enable --now fail2ban || true

echo "[5/7] Docker"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$DEPLOY_USER"
systemctl enable --now docker

echo "[6/7] App directory"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/datos

echo "[7/7] Done. Next:"
echo "  - su - $DEPLOY_USER"
echo "  - cd /opt/datos && git clone <repo> . && cp infra/.env.example .env && edit .env"
echo "  - ./infra/deploy-first.sh .env datos.nicoholas.dev"
