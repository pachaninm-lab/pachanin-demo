{{/* Immutable release authority helpers. */}}

{{- define "grainflow.release.sourceCommit" -}}
{{- $commit := required "release.sourceCommit is required when a runtime workload is enabled" .Values.release.sourceCommit -}}
{{- if not (regexMatch "^[0-9a-f]{40}$" $commit) -}}
{{- fail "release.sourceCommit must be a lowercase 40-character Git commit SHA" -}}
{{- end -}}
{{- $commit -}}
{{- end -}}

{{- define "grainflow.release.manifestId" -}}
{{- $manifestId := required "release.manifestId is required when a runtime workload is enabled" .Values.release.manifestId -}}
{{- if not (regexMatch "^sha256:[0-9a-f]{64}$" $manifestId) -}}
{{- fail "release.manifestId must be a sha256 digest of the canonical release manifest" -}}
{{- end -}}
{{- $manifestId -}}
{{- end -}}

{{- define "grainflow.image.digest" -}}
{{- $component := required "component is required for immutable image validation" .component -}}
{{- $digest := required (printf "%s.image.digest is required when %s.enabled=true; mutable tags are forbidden" $component $component) .digest -}}
{{- if not (regexMatch "^sha256:[0-9a-f]{64}$" $digest) -}}
{{- fail (printf "%s.image.digest must be a lowercase sha256 OCI digest" $component) -}}
{{- end -}}
{{- $digest -}}
{{- end -}}
