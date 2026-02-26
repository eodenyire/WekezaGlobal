{{- define "wgi.name" -}}wgi{{- end }}
{{- define "wgi.backendImage" -}}
{{ .Values.global.imageRegistry }}/{{ .Values.global.imageRepository }}/backend:{{ .Values.backend.image.tag }}
{{- end }}
{{- define "wgi.frontendImage" -}}
{{ .Values.global.imageRegistry }}/{{ .Values.global.imageRepository }}/frontend:{{ .Values.frontend.image.tag }}
{{- end }}
{{- define "wgi.labels" -}}
app.kubernetes.io/managed-by: Helm
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end }}
