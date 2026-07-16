FAILURE_REASON="production-like object storage TLS failed"

minio_tls_dir="$(mktemp -d)"
cleanup_minio_tls_material() {
  rm -rf "$minio_tls_dir"
}
trap cleanup_minio_tls_material ERR

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1 \
  -subj "/CN=grainflow-acceptance-minio-ca" \
  -keyout "$minio_tls_dir/ca.key" \
  -out "$minio_tls_dir/ca.crt" \
  > "$K8S_DIR/minio-ca-generate.log" 2>&1

openssl req -newkey rsa:2048 -nodes -sha256 \
  -subj "/CN=minio" \
  -addext "subjectAltName=DNS:minio,DNS:minio.grainflow-acceptance.svc,DNS:minio.grainflow-acceptance.svc.cluster.local" \
  -keyout "$minio_tls_dir/private.key" \
  -out "$minio_tls_dir/server.csr" \
  > "$K8S_DIR/minio-server-csr.log" 2>&1

cat > "$minio_tls_dir/server.ext" <<'EOF'
subjectAltName=DNS:minio,DNS:minio.grainflow-acceptance.svc,DNS:minio.grainflow-acceptance.svc.cluster.local
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
EOF

openssl x509 -req -sha256 -days 1 \
  -in "$minio_tls_dir/server.csr" \
  -CA "$minio_tls_dir/ca.crt" \
  -CAkey "$minio_tls_dir/ca.key" \
  -CAcreateserial \
  -extfile "$minio_tls_dir/server.ext" \
  -out "$minio_tls_dir/public.crt" \
  > "$K8S_DIR/minio-server-cert-sign.log" 2>&1

chmod 0600 "$minio_tls_dir/ca.key" "$minio_tls_dir/private.key"
openssl verify -CAfile "$minio_tls_dir/ca.crt" "$minio_tls_dir/public.crt" \
  > "$K8S_DIR/minio-server-cert-verify.log" 2>&1

kubectl create secret generic grainflow-minio-tls -n "$NAMESPACE" \
  --from-file=public.crt="$minio_tls_dir/public.crt" \
  --from-file=private.key="$minio_tls_dir/private.key" \
  --from-file=ca.crt="$minio_tls_dir/ca.crt" \
  --dry-run=client -o yaml | kubectl apply -f - \
  > "$K8S_DIR/minio-tls-secret-apply.log"

kubectl get secret grainflow-minio-secrets -n "$NAMESPACE" -o json | \
  jq '{apiVersion:"v1",kind:"Secret",metadata:{name:"grainflow-object-storage-secrets",namespace:.metadata.namespace},type:"Opaque",data:{OBJECT_STORAGE_ACCESS_KEY_ID:.data.MINIO_ROOT_USER,OBJECT_STORAGE_SECRET_ACCESS_KEY:.data.MINIO_ROOT_PASSWORD}}' | \
  kubectl apply -f - > "$K8S_DIR/minio-runtime-secret-apply.log"

kubectl patch deployment minio -n "$NAMESPACE" --type=strategic \
  --patch-file infra/kind/production-like/minio-tls-patch.yaml \
  > "$K8S_DIR/minio-tls-patch.log"
kubectl rollout status -n "$NAMESPACE" deployment/minio --timeout=360s

kubectl delete pod minio-tls-check -n "$NAMESPACE" --ignore-not-found=true --wait=true
kubectl apply -f infra/kind/production-like/minio-tls-check.yaml \
  > "$K8S_DIR/minio-tls-check-apply.log"
for _ in $(seq 1 90); do
  phase="$(kubectl get pod minio-tls-check -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  [[ "$phase" = Succeeded ]] && break
  [[ "$phase" = Failed ]] && break
  sleep 2
done
kubectl logs -n "$NAMESPACE" minio-tls-check > "$K8S_DIR/minio-tls-check.log" 2>&1 || true
test "$(kubectl get pod minio-tls-check -n "$NAMESPACE" -o jsonpath='{.status.phase}')" = Succeeded
kubectl delete pod minio-tls-check -n "$NAMESPACE" --wait=true

cleanup_minio_tls_material
trap - ERR

patch_api_object_storage() {
  local state
  state="$(kubectl get deployment grainflow-api -n "$NAMESPACE" -o json | jq -r '[
    ([.spec.template.spec.containers[] | select(.name == "api") | .envFrom[]? | select(.secretRef.name == "grainflow-object-storage-secrets")] | length),
    ([.spec.template.spec.containers[] | select(.name == "api") | .volumeMounts[]? | select(.name == "minio-ca")] | length),
    ([.spec.template.spec.volumes[]? | select(.name == "minio-ca")] | length)
  ] | @tsv')"

  if [[ "$state" == $'1\t1\t1' ]]; then
    printf 'already-applied\n' >> "$K8S_DIR/api-object-storage-ca-patch.log"
    return 0
  fi
  if [[ "$state" != $'0\t0\t0' ]]; then
    printf 'partial-storage-patch-state:%s\n' "$state" > "$K8S_DIR/api-object-storage-ca-patch.log"
    return 1
  fi

  kubectl patch deployment grainflow-api -n "$NAMESPACE" --type=json \
    --patch-file infra/kind/production-like/api-object-storage-ca-patch.json \
    > "$K8S_DIR/api-object-storage-ca-patch.log" 2>&1
}
