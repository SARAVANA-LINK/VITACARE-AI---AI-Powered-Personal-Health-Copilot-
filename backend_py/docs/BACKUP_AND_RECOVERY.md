# VitaCare AI — Database Backup, Recovery & Disaster Restoration Guide

This document defines the production backup architecture, Point-in-Time Recovery (PITR), object storage synchronization, and disaster recovery procedures for the VitaCare AI healthcare platform.

---

## 1. Compliance Objectives (RPO & RTO)

Healthcare applications handling Protected Health Information (PHI) require rigorous recovery guarantees to maintain clinical continuity:

| Parameter | Target Objective | Strategy |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **<= 5 Minutes** | Continuous Write-Ahead Log (WAL) archiving to immutable S3 storage. |
| **Recovery Time Objective (RTO)** | **<= 30 Minutes** | Pre-provisioned standby replica and automated warm-standby failover. |
| **Backup Retention** | **7 Years** | Daily snapshots kept 30 days; weekly snapshots kept 1 year; yearly snapshots archived to Glacier for 7 years. |
| **Encryption Standard** | **AES-256 (FIPS 140-3)** | KMS envelope encryption for all snapshots, WAL archives, and object storage files. |

---

## 2. Backup Architecture & Automation

```
+-------------------------------------------------------------------------------+
|                             Primary PostgreSQL 16                             |
|                                                                               |
|  +--------------------+        +---------------------+                        |
|  | Base Daily Backup  |        | Continuous WAL Logs |                        |
|  |   (pg_basebackup)  |        |  (archive_command)  |                        |
|  +---------+----------+        +----------+----------+                        |
+------------|------------------------------|-----------------------------------+
             |                              |
             v                              v
+-------------------------------------------------------------------------------+
|                       AWS S3 / GCS Protected Bucket Vault                     |
|                                                                               |
|   s3://vitacare-backups-vault/base_backups/base_20261024_020000.tar.gz       |
|   s3://vitacare-backups-vault/wal_archives/00000001000000020000003A           |
|                                                                               |
|   [Policy: S3 Object Lock (WORM - Write Once, Read Many) Enabled]             |
+-------------------------------------------------------------------------------+
```

### PostgreSQL WAL Archiving Configuration (`postgresql.conf`)

```ini
# Continuous Archiving Configuration
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /mnt/wal_archive/%f && cp %p /mnt/wal_archive/%f && aws s3 cp /mnt/wal_archive/%f s3://vitacare-backups-vault/wal_archives/%f --sse aws:kms'
archive_timeout = 300 # Forces a WAL segment flush every 5 minutes to guarantee <= 5 min RPO
```

---

## 3. Daily Logical and Physical Backups

### A. Full Daily Snapshot via `pg_basebackup` (Executed at 02:00 UTC)
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DATE=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_DIR="/var/backups/postgres/base_${BACKUP_DATE}"
S3_DEST="s3://vitacare-backups-vault/base_backups/base_${BACKUP_DATE}.tar.gz"

echo "[$(date)] Starting base backup..."
mkdir -p "${BACKUP_DIR}"

# Execute streaming physical backup with checkpoint
pg_basebackup -h localhost -U vitacare_backup -D "${BACKUP_DIR}" -Ft -z -Xs -P

# Ship to immutable cloud vault with KMS encryption
aws s3 cp "${BACKUP_DIR}/base.tar.gz" "${S3_DEST}" --sse aws:kms

echo "[$(date)] Base backup uploaded successfully to ${S3_DEST}"
rm -rf "${BACKUP_DIR}"
```

### B. Logical Schema & Data Export via `pg_dump`
Used for development seeding, testing, and table-level granular recovery:
```bash
pg_dump \
  -h localhost \
  -U vitacare_backup \
  -d vitacare_prod \
  --format=custom \
  --compress=9 \
  --file="/var/backups/postgres/logical_vitacare_$(date +%Y%m%d).dump"
```

---

## 4. Point-In-Time Recovery (PITR) Playbook

If a catastrophic data incident occurs (e.g. accidental drop or ransomware), execute Point-In-Time Recovery to restore the exact state before the incident:

### Step 1: Stop PostgreSQL Service
```bash
sudo systemctl stop postgresql
```

### Step 2: Clear Corrupted Data Directory
```bash
mv /var/lib/postgresql/16/main /var/lib/postgresql/16/main_corrupted_$(date +%s)
mkdir -p /var/lib/postgresql/16/main
chown -R postgres:postgres /var/lib/postgresql/16/main
chmod 700 /var/lib/postgresql/16/main
```

### Step 3: Extract Base Backup
```bash
tar -xzf /mnt/backups/base_backup_latest.tar.gz -C /var/lib/postgresql/16/main
```

### Step 4: Configure Recovery Target (`postgresql.auto.conf`)
Specify the target point in time (1 minute before the corruption):
```ini
restore_command = 'aws s3 cp s3://vitacare-backups-vault/wal_archives/%f %p'
recovery_target_time = '2026-10-24 14:45:00 UTC'
recovery_target_action = 'promote'
```

### Step 5: Create Recovery Signal and Start Server
```bash
touch /var/lib/postgresql/16/main/recovery.signal
sudo systemctl start postgresql
```

### Step 6: Verify Recovery Completion in Logs
```bash
sudo journalctl -u postgresql -n 50 --no-pager
# Look for: "recovery stopping at restore point ... archive recovery complete ... database system is ready to accept connections"
```

---

## 5. Object Storage & Database Synchronization

Medical files (PDF prescriptions, lab reports, imaging DICOMs) reside in private object storage, while their cryptographic hashes and metadata reside in PostgreSQL:

1. **Transaction Sequence**:
   - Step 1: Stream upload to private object storage key `vault/patients/{user_id}/{doc_id}.pdf`.
   - Step 2: Compute SHA-256 checksum during upload stream.
   - Step 3: Insert metadata record into `medical_documents` with matching `checksum` and `private_storage_key`.
   - Step 4: Commit PostgreSQL transaction.
2. **Orphan Cleanup Cron**:
   - A weekly reconciliation script compares S3 object keys with `SELECT private_storage_key FROM medical_documents WHERE deleted_at IS NULL`.
   - Keys in storage without database references are quarantined.
3. **Backup Co-Recovery**:
   - S3 Versioning is enabled on the storage bucket.
   - Restoring PostgreSQL to a point in time (e.g. `2026-10-24 14:45:00 UTC`) pairs with S3 version lifecycle state at that same timestamp.

---

## 6. Disaster Recovery Drills & Integrity Testing

Disaster recovery readiness is tested quarterly via automated staging drills:
1. Automated CI/CD spins up an isolated sandbox PostgreSQL container.
2. Downloads the previous night's `base_backup` and applies all WALs up to 10 minutes prior.
3. Runs integrity queries (`SELECT COUNT(*) FROM users;`, `SELECT COUNT(*) FROM health_records;`).
4. Runs automated test suite (`pytest tests/test_database_schema.py`).
5. Alerts on-call engineering team via PagerDuty if restoration time exceeds 25 minutes or checksum mismatches occur.
