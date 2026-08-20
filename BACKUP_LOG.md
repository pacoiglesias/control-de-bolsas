> **Nota (20 Agosto 2026):** este archivo dejó de actualizarse manualmente el 2026-08-02. Desde entonces el respaldo real corre de dos formas automáticas: (1) `scheduledMidnightBackup`, una Cloud Function programada que genera un snapshot completo en Firestore (`snapshots/{id}`) todas las noches a medianoche, y (2) `backup.ps1`, que rota y conserva los últimos 5 respaldos locales cada vez que se corre `SUBIR_CAMBIOS.bat`. Ninguno de los dos escribe en esta tabla — el historial de qué cambió en cada versión vive en `CHANGELOG.md`, no aquí.

| Fecha | Rama | Archivo ZIP | Hash del commit | Estado |
|---|---|---|---|---|
| 2026-08-02 | audit/workspace-2026-08-01 | backup-control-bolsas-2026-08-02.zip | bce4c86b9019334938eca2f748cb711d465b0abe | Éxito |

### Historial de Respaldo:
- **[2026-08-02T16:59:00]**: `backup-control-bolsas-2026-08-02-16-59.zip` (Caja Chica proactiva, Lazy Loading xlsx, Memoization en Cobranza, Optimización Cloud Functions index.ts. v6.34.0/v6.33.0). Commit: `14dc1d9`.
- **[2026-08-02T16:03:00]**: `backup-control-bolsas-2026-08-02-16-03.zip` (Fix completo de AuditSync sin falsos negativos y array-contains con set).
- **[2026-08-02T15:20:00]**: `backup-control-bolsas-2026-08-02-15-20.zip` (Corrección de sync masiva, batch writes y timestamps centralizados).
