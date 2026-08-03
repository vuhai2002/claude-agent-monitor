#!/bin/bash
# Double-clickable launcher for macOS. Finder runs a .command from the user's
# home directory, so move to the folder holding this file before anything else.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  [X] Không tìm thấy Node.js trên máy này."
  echo ""
  echo "  Cài đặt tại https://nodejs.org rồi mở lại file này."
  echo ""
  read -r -p "  Nhấn Enter để đóng..." _
  exit 1
fi

export AGENT_MONITOR_OPEN=1
node server.js
