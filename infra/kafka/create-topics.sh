#!/usr/bin/env bash
# GrainFlow — Kafka Topics Creation Script (ТЗ 4.2)
# Usage: ./create-topics.sh [bootstrap-server]
# Default bootstrap server: kafka:9092

set -euo pipefail

BOOTSTRAP="${1:-kafka:9092}"
KAFKA_CMD="${KAFKA_HOME:-/opt/kafka}/bin/kafka-topics.sh"

echo "=== GrainFlow Kafka Topics Setup ==="
echo "Bootstrap: ${BOOTSTRAP}"

create_topic() {
  local name="$1"
  local partitions="$2"
  local replication="$3"
  shift 3
  local configs=("$@")

  if ${KAFKA_CMD} --bootstrap-server "${BOOTSTRAP}" --describe --topic "${name}" 2>/dev/null; then
    echo "Topic '${name}' already exists — skipping"
    return
  fi

  local config_args=""
  for cfg in "${configs[@]}"; do
    config_args="${config_args} --config ${cfg}"
  done

  # shellcheck disable=SC2086
  ${KAFKA_CMD} --bootstrap-server "${BOOTSTRAP}" \
    --create \
    --topic "${name}" \
    --partitions "${partitions}" \
    --replication-factor "${replication}" \
    ${config_args}

  echo "Created topic: ${name} (partitions=${partitions}, RF=${replication})"
}

# ── Сделки ────────────────────────────────────────────────────────────────────
create_topic "grainflow.deals.events" 12 3 \
  "retention.ms=2592000000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete" \
  "message.max.bytes=1048576"

create_topic "grainflow.deals.commands" 6 3 \
  "retention.ms=86400000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete"

# ── Платежи ───────────────────────────────────────────────────────────────────
create_topic "grainflow.payments.events" 6 3 \
  "retention.ms=31536000000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete"

# ── Логистика / GPS ───────────────────────────────────────────────────────────
create_topic "grainflow.logistics.events" 24 3 \
  "retention.ms=2592000000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete"

# ── Документы / ЭДО ──────────────────────────────────────────────────────────
create_topic "grainflow.documents.events" 6 3 \
  "retention.ms=31536000000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete"

# ── Интеграции ────────────────────────────────────────────────────────────────
create_topic "grainflow.integrations.inbound" 12 3 \
  "retention.ms=604800000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete"

create_topic "grainflow.integrations.outbound" 12 3 \
  "retention.ms=604800000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete"

# ── Аудит (5 лет, append-only) ───────────────────────────────────────────────
create_topic "grainflow.audit.events" 6 3 \
  "retention.ms=157680000000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete"

# ── Уведомления ──────────────────────────────────────────────────────────────
create_topic "grainflow.notifications" 6 3 \
  "retention.ms=86400000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete"

# ── Dead Letter Queue ─────────────────────────────────────────────────────────
create_topic "grainflow.outbox.dead-letter" 3 3 \
  "retention.ms=604800000" \
  "min.insync.replicas=2" \
  "compression.type=lz4" \
  "cleanup.policy=delete"

echo "=== All Kafka topics created successfully ==="
${KAFKA_CMD} --bootstrap-server "${BOOTSTRAP}" --list | grep "^grainflow\."
