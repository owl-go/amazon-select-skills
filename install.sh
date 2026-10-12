#!/bin/sh
set -eu
installer_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v python3 >/dev/null 2>&1; then
  exec python3 "$installer_dir/scripts/install_skills.py" "$@"
fi
printf '%s\n' '需要Python 3.8或以上。安装Python后重试，或运行 python scripts/install_skills.py。' >&2
exit 1
