#!/bin/bash
set -e
if [ -x "./litestream" ]; then
  echo "[build] litestream already present"
  exit 0
fi
echo "[build] Downloading litestream (optional backup tool)..."
wget -q "https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz" -O litestream.tgz
tar -xzf litestream.tgz
chmod +x litestream
rm -f litestream.tgz
echo "[build] litestream ready"
