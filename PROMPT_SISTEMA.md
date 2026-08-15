# 🤖 GEMINI — MEMO_RU System Context Prompt

**Versión del Sistema:** v23.0.1-Titanium-Nova-Hotfix  
**Fecha:** 18 Abril 2026  
**URL de Producción:** <https://app.ruenisco.com>  
**Firebase Project:** boda-chingona  
**Dominio Hosting:** boda-chingona.web.app  

---

## 🏗️ Arquitectura del Sistema

```text
MEMO_RU (Ruenisco Engine v6.9.6)
├── Frontend: React + Vite + TailwindCSS
│   └── /bodachingona/frontend/src/
├── Backend: Firebase Cloud Functions (Node.js 22)
│   └── /bodachingona/functions/index.js
│   └── Express app exportado como "renderFarm"
├── DB: Firestore (colecciones: weddings, photos, clients, system_settings, system_logs)
├── Realtime: Firebase RTDB (/live_state/{slug}/...)
├── Auth: Firebase Anonymous + Email/Password (Admin sólo)
├── Storage: Firebase Storage (boda-chingona.appspot.com)
└── Hosting: Firebase Hosting → app.ruenisco.com
```

---

## 📱 Paneles del Sistema (Lista Completa)

### Panel de Invitados (Guest View)

- **Ruta:** `/s/{weddingId}` o `/s/{slug}`
- **Archivo:** `src/components/guest/GuestView.jsx`
- **Funciones:** Registro de nombre, subir fotos, cámara, chat/mensajes, galería, quests, trivia, PIN de acceso

### Panel de Admin del Evento

- **Ruta:** `/admin/{weddingId}`
- **Archivo:** `src/components/admin/AdminDashboard.jsx`
- **Tabs:** Fotos, Moderación, Analytics, Blackout, Audio, Export, Compartir, Imprimir, HighlightReel, Stats

### Super Admin Dashboard

- **Ruta:** `/super`
- **Archivo:** `src/components/admin/super/EventsDashboard.jsx`
- **Tabs:** Eventos, Clientes, Configuración Global, Monitor del Sistema, Herramientas

### Proyector (Live HUD)

- **Ruta:** `/projector/{weddingId}`
- **Archivo:** `src/components/Projector.jsx` o similar
- **Funciones:** Display en pantalla grande, QR toggle, blackout, fotos en vivo

### Panel de Cliente / Agencia

- **Ruta:** `/client`
- **Archivo:** `src/components/client/ClientPortal.jsx`

### Admin Login

- **Ruta:** `/admin-login`
- **Archivo:** `src/components/admin/AdminLogin.jsx`

### Landing Page

- **Ruta:** `/`
- **Archivo:** `src/components/Landing.jsx` o `src/pages/Landing.jsx`

---

## 🗂️ Colecciones de Firestore

| Colección | Descripción |
| :--- | :--- |
| `weddings/{id}` | Eventos (bodas, XV, corporativos, etc.) |
| `photos/{id}` | Fotos/videos/audio/mensajes de invitados |
| `weddings/{id}/guests/{guestId}` | Registro de invitados |
| `clients/{id}` | Organizaciones/clientes del SaaS |
| `system_settings/global` | Configuración de plataforma |
| `system_logs/{id}` | Logs del sistema |
| `error_logs/{id}` | Logs de errores del frontend |

---

## 🔑 Reglas de Seguridad

### Firestore Rules (clave)

- `isAdmin()`: `request.auth != null && (token.admin || email matches ruenisco.com/pacoismael@gmail.com/paco@cobertores.com/admin@.*)`
- `photos`: allow create sin auth si `isValidPhotoData()` (weddingId, timestamp, status)
- `system_settings/global`: allow read si true (sin auth)
- `weddings`: allow read si true

### Storage Rules

- `photos/**`: allow create si size < 25MB y contentType image/*o video/*
- `videos/**`: allow create si size < 100MB
- `audio/**`: allow create si size < 10MB y contentType audio/*

---

## ⚙️ Cloud Functions (renderFarm)

```text
POST /render         → Video 16:9 (ffmpeg + zoompan)
POST /render-story   → Video 9:16 Story (ffmpeg)
POST /transcribe     → Transcripción audio (Google Speech-to-Text)
GET  /seo/:id        → SSR para Open Graph
```

**CRÍTICO** — Las fotos se descargan con Admin SDK (bypasa Storage rules), NO con axios:

```js
const file = bucket.file(objectPath);
await file.download({ destination: destPath });
```

---

## 🐛 Bugs Resueltos (Histórico v6.9.x)

| Bug | Causa | Fix |
| :--- | :--- | :--- |
| `permission-denied` en startup | `LanguageContext` leía `settings/global` sin regla | → `system_settings/global` |
| `globalSettings is not defined` en EventsDashboard | Destructuring eliminado, var no declarada | → `useSystemSettings()` hook |
| `GuestRegistration` no aparecía | Faltaba import en `GuestView.jsx` | → Import añadido |
| CF 500 en video | `axios` descargando URLs Firebase Storage → 404 | → Admin SDK `bucket.file().download()` |
| CSP bloqueaba workers | `worker-src blob: 'self'` muy restrictivo | → `worker-src * blob: 'self'` |

---

## 📌 Instrucciones para el Agente

1. **Versión actual:** v6.9.6-Enterprise. Siempre bumpar al corregir bugs críticos.
2. **No cambiar las Storage rules** sin revisar que guest uploads sigan funcionando.
3. **No cambiar worker-src CSP** a menos que sea para ampliar, nunca restringir.
4. **Firestore path:** Siempre usar `system_settings/global`, NUNCA `settings/global`.
5. **Cloud Functions:** Al generar video, siempre usar Admin SDK para descargar fotos de Storage.
6. **GuestRegistration:** DEBE estar importado y activo en GuestView.jsx.
7. **i18n:** Todos los strings visibles al usuario deben pasar por `t()` del LanguageContext.
8. **Build antes de deploy:** Siempre `npm run build` y revisar errores antes de `firebase deploy`.
