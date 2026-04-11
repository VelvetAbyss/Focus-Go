#!/bin/bash
# focusgo.db 每日备份脚本
# 备份到本地保留 7 天，同时上传至阿里云 OSS（通过 rclone）
#
# 依赖：sqlite3、gzip、rclone（已配置 aliyunoss remote）
# 使用：直接运行，或通过 crontab 定时执行
#       0 3 * * * /root/focus-go/apps/web/focus-go-api/scripts/backup.sh >> /var/log/focusgo-backup.log 2>&1

set -euo pipefail

# ── 配置 ────────────────────────────────────────────────────────────────────
DB_PATH="/root/focus-go/apps/web/focus-go-api/data/focusgo.db"
LOCAL_BACKUP_DIR="/root/focus-go/apps/web/focus-go-api/data/backups"
OSS_REMOTE="aliyunoss"                    # rclone remote 名称
OSS_BUCKET="focusgo-db-backup"            # ← 改成你的 bucket 名
OSS_PATH="${OSS_REMOTE}:${OSS_BUCKET}/daily"
KEEP_DAYS=7
# ─────────────────────────────────────────────────────────────────────────────

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="focusgo_${TIMESTAMP}.db"
BACKUP_GZ="${BACKUP_NAME}.gz"
TEMP_BACKUP="/tmp/${BACKUP_NAME}"
LOCAL_BACKUP_PATH="${LOCAL_BACKUP_DIR}/${BACKUP_GZ}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "========== 开始备份 =========="
log "数据库路径: ${DB_PATH}"

if [ ! -f "${DB_PATH}" ]; then
  log "ERROR: 数据库文件不存在: ${DB_PATH}"
  exit 1
fi

mkdir -p "${LOCAL_BACKUP_DIR}"

# ── 第一步：SQLite 热备份（WAL 安全，不锁库）───────────────────────────────
log "正在创建数据库快照..."
sqlite3 "${DB_PATH}" "VACUUM INTO '${TEMP_BACKUP}'"
log "快照完成，大小: $(du -sh "${TEMP_BACKUP}" | cut -f1)"

# ── 第二步：压缩 ─────────────────────────────────────────────────────────────
log "正在压缩..."
gzip -c "${TEMP_BACKUP}" > "${LOCAL_BACKUP_PATH}"
rm -f "${TEMP_BACKUP}"
log "压缩完成: ${LOCAL_BACKUP_PATH} ($(du -sh "${LOCAL_BACKUP_PATH}" | cut -f1))"

# ── 第三步：上传到 OSS ────────────────────────────────────────────────────────
log "正在上传到 OSS: ${OSS_PATH}/${BACKUP_GZ}"
if rclone copy "${LOCAL_BACKUP_PATH}" "${OSS_PATH}/" --stats-one-line 2>&1; then
  log "OSS 上传成功"
else
  log "ERROR: OSS 上传失败，本地备份已保留"
  exit 1
fi

# ── 第四步：清理本地过期备份 ─────────────────────────────────────────────────
log "清理超过 ${KEEP_DAYS} 天的本地备份..."
find "${LOCAL_BACKUP_DIR}" -name "focusgo_*.db.gz" -mtime "+${KEEP_DAYS}" -delete
REMAINING=$(find "${LOCAL_BACKUP_DIR}" -name "focusgo_*.db.gz" | wc -l | tr -d ' ')
log "本地保留 ${REMAINING} 个备份"

log "========== 备份完成 =========="
