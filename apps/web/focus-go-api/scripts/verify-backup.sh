#!/bin/bash
# 验证最新备份文件是否可以正常解压和读取
# 用法：./verify-backup.sh
# 建议在首次配置完成后执行一次，确认备份可用

set -euo pipefail

LOCAL_BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/data/backups"
VERIFY_DIR="/tmp/focusgo-verify-$$"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

cleanup() {
  rm -rf "${VERIFY_DIR}"
}
trap cleanup EXIT

log "========== 验证最新备份 =========="

# 找到最新的备份文件
LATEST=$(find "${LOCAL_BACKUP_DIR}" -name "focusgo_*.db.gz" | sort | tail -1)
if [ -z "${LATEST}" ]; then
  log "ERROR: 未找到任何备份文件，请先运行 backup.sh"
  exit 1
fi

log "最新备份: ${LATEST} ($(du -sh "${LATEST}" | cut -f1))"

# 解压
mkdir -p "${VERIFY_DIR}"
log "正在解压..."
gunzip -c "${LATEST}" > "${VERIFY_DIR}/focusgo-verify.db"

# 用 sqlite3 检查数据库完整性
log "检查数据库完整性..."
INTEGRITY=$(sqlite3 "${VERIFY_DIR}/focusgo-verify.db" "PRAGMA integrity_check;")
if [ "${INTEGRITY}" = "ok" ]; then
  log "✓ 完整性检查通过"
else
  log "ERROR: 完整性检查失败: ${INTEGRITY}"
  exit 1
fi

# 读取基本统计
USER_COUNT=$(sqlite3 "${VERIFY_DIR}/focusgo-verify.db" "SELECT COUNT(*) FROM users;")
TASK_COUNT=$(sqlite3 "${VERIFY_DIR}/focusgo-verify.db" "SELECT COUNT(*) FROM sync_tasks;")
NOTE_COUNT=$(sqlite3 "${VERIFY_DIR}/focusgo-verify.db" "SELECT COUNT(*) FROM sync_notes;")

log "备份数据统计:"
log "  用户数:    ${USER_COUNT}"
log "  任务总数:  ${TASK_COUNT}"
log "  笔记总数:  ${NOTE_COUNT}"
log "========== 验证通过，备份可正常恢复 =========="
