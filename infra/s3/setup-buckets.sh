#!/usr/bin/env bash
# Настройка S3 buckets для GrainFlow: Object Lock WORM для подписанных документов
set -euo pipefail

AWS_REGION="${AWS_REGION:-ru-central1}"
ENDPOINT_URL="${AWS_ENDPOINT_URL:-https://storage.yandexcloud.net}"
DOCS_BUCKET="${S3_DOCUMENTS_BUCKET:-grainflow-documents}"
SIGNED_BUCKET="${S3_SIGNED_DOCS_BUCKET:-grainflow-signed-documents}"
UPLOADS_BUCKET="${S3_UPLOADS_BUCKET:-grainflow-uploads}"

aws_cmd() {
  aws --endpoint-url="$ENDPOINT_URL" --region="$AWS_REGION" "$@"
}

echo "=== GrainFlow S3 bucket setup ==="

# ──────────────────────────────────────────────────────────────────────────────
# 1. Bucket для загруженных документов (до подписания)
# ──────────────────────────────────────────────────────────────────────────────
if ! aws_cmd s3 ls "s3://$UPLOADS_BUCKET" &>/dev/null; then
  aws_cmd s3api create-bucket \
    --bucket "$UPLOADS_BUCKET" \
    --region "$AWS_REGION"
  echo "Created uploads bucket: $UPLOADS_BUCKET"
fi

aws_cmd s3api put-bucket-lifecycle-configuration \
  --bucket "$UPLOADS_BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "delete-unconfirmed-uploads",
      "Status": "Enabled",
      "Filter": {"Prefix": "pending/"},
      "Expiration": {"Days": 7}
    }]
  }'

aws_cmd s3api put-bucket-encryption \
  --bucket "$UPLOADS_BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# ──────────────────────────────────────────────────────────────────────────────
# 2. Основной bucket документов
# ──────────────────────────────────────────────────────────────────────────────
if ! aws_cmd s3 ls "s3://$DOCS_BUCKET" &>/dev/null; then
  aws_cmd s3api create-bucket \
    --bucket "$DOCS_BUCKET" \
    --region "$AWS_REGION"
  echo "Created documents bucket: $DOCS_BUCKET"
fi

aws_cmd s3api put-bucket-versioning \
  --bucket "$DOCS_BUCKET" \
  --versioning-configuration Status=Enabled

aws_cmd s3api put-bucket-encryption \
  --bucket "$DOCS_BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Блокировка публичного доступа
aws_cmd s3api put-public-access-block \
  --bucket "$DOCS_BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# ──────────────────────────────────────────────────────────────────────────────
# 3. WORM bucket для подписанных документов (Object Lock)
# ──────────────────────────────────────────────────────────────────────────────
if ! aws_cmd s3 ls "s3://$SIGNED_BUCKET" &>/dev/null; then
  aws_cmd s3api create-bucket \
    --bucket "$SIGNED_BUCKET" \
    --region "$AWS_REGION" \
    --object-lock-enabled-for-bucket
  echo "Created WORM signed documents bucket: $SIGNED_BUCKET"
fi

# Object Lock: COMPLIANCE mode, 7 лет (ФЗ-402 требует 5 лет, берём с запасом)
aws_cmd s3api put-object-lock-configuration \
  --bucket "$SIGNED_BUCKET" \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Years": 7
      }
    }
  }'

aws_cmd s3api put-bucket-versioning \
  --bucket "$SIGNED_BUCKET" \
  --versioning-configuration Status=Enabled

aws_cmd s3api put-bucket-encryption \
  --bucket "$SIGNED_BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

aws_cmd s3api put-public-access-block \
  --bucket "$SIGNED_BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Bucket policy — запрет удаления подписанных документов
aws_cmd s3api put-bucket-policy \
  --bucket "$SIGNED_BUCKET" \
  --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Sid\": \"DenyDeleteObject\",
        \"Effect\": \"Deny\",
        \"Principal\": \"*\",
        \"Action\": [\"s3:DeleteObject\", \"s3:DeleteObjectVersion\"],
        \"Resource\": \"arn:aws:s3:::$SIGNED_BUCKET/*\"
      },
      {
        \"Sid\": \"DenyRemoveObjectLock\",
        \"Effect\": \"Deny\",
        \"Principal\": \"*\",
        \"Action\": \"s3:PutObjectLegalHold\",
        \"Resource\": \"arn:aws:s3:::$SIGNED_BUCKET/*\",
        \"Condition\": {
          \"StringEquals\": {\"s3:object-lock-legal-hold-status\": \"OFF\"}
        }
      }
    ]
  }"

echo ""
echo "=== Bucket setup complete ==="
echo "  Uploads:        s3://$UPLOADS_BUCKET"
echo "  Documents:      s3://$DOCS_BUCKET"
echo "  Signed (WORM):  s3://$SIGNED_BUCKET (Object Lock COMPLIANCE 7y)"
