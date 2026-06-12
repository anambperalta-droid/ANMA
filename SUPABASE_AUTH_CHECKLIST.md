# 🔐 Checklist Supabase Auth — Para que Nicolas (y todos) puedan entrar

Esta guía soluciona el bug crítico: **"link inválido" al ingresar / registrarse con Google / recuperar contraseña.**

La causa raíz suele ser una de estas 3 — entrá al **Supabase Dashboard del proyecto** y verificá:

---

## 1️⃣ Redirect URLs — Authentication → URL Configuration

**Site URL** (canónica, una sola — dominio propio desde 12/06/2026):
```
https://anmahub.com
```

**Redirect URLs** (todos los dominios desde los que puede llegar un email/OAuth):
```
https://anmahub.com/**
https://www.anmahub.com/**
https://anma-hub.vercel.app/**
https://anma-host.vercel.app/**
http://localhost:5173/**
http://localhost:5174/**
```

> ⚠️ Sin el dominio en esta lista, Google OAuth y los emails fallan con "link inválido". El alias `anma-hub.vercel.app` se mantiene porque sigue sirviendo la app.

---

## 2️⃣ Google OAuth — Authentication → Providers → Google

Habilitado. Client ID + Client Secret pegados desde Google Cloud Console.

En **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client**:
- **Authorized JavaScript origins**:
  ```
  https://anmahub.com
  https://www.anmahub.com
  https://anma-hub.vercel.app
  https://anma-host.vercel.app
  https://[tu-proyecto].supabase.co
  ```
- **Authorized redirect URIs**:
  ```
  https://[tu-proyecto].supabase.co/auth/v1/callback
  ```

---

## 3️⃣ Email Templates — Authentication → Email Templates

Asegurate que los links usen `{{ .ConfirmationURL }}` (Supabase reemplaza automático) y NO un hardcoded `https://anma-hub.vercel.app/...`.

Templates a revisar:
- **Confirm signup** → `{{ .ConfirmationURL }}`
- **Reset password** → `{{ .ConfirmationURL }}`
- **Invite user** → `{{ .ConfirmationURL }}`
- **Magic link** → `{{ .ConfirmationURL }}`

---

## 4️⃣ Si Nicolas sigue sin poder entrar — checklist runtime

Decile que abra la consola del browser (F12) y mire los logs `[anma-auth] ...`. Eso muestra exactamente en qué paso falla:

| Log que ve | Qué significa | Fix |
|---|---|---|
| `in-app-browser-detected` | Abrió el link desde Gmail/Instagram in-app | Abrir en Safari/Chrome (3 puntos → "Abrir en navegador") |
| `pkce-error` | El `?code=` ya fue usado o expiró | Pedir nuevo enlace (los links son one-time, expiran al hora) |
| `token-hash-error` | El token verifyOtp falla | Probablemente expirado, pedir nuevo |
| `supabase-error` con `expired` | El email es viejo | Pedir nuevo |
| `timeout` (6s) | No detectó nada — URL malformada o red lenta | Reintentar, validar URL completa |

---

## 5️⃣ Fixes que YA aplicamos en código (commits recientes)

- ✅ Soporte para `?token=` legacy (Supabase a veces emite ese formato)
- ✅ Detección de webview in-app (Gmail iOS) con mensaje claro
- ✅ Timeout subido de 3s → 6s (móviles lentos)
- ✅ Mensajes de error específicos: expirado / ya usado / inválido (en vez de genérico)
- ✅ CTAs en pantalla de error: "Volver a Ingresar" + ayuda WhatsApp
- ✅ Título dinámico según flow: `recovery` → "Elegí tu nueva contraseña"
- ✅ Logs `[anma-auth]` para diagnosticar producción

---

## 6️⃣ Cómo testear que el fix funciona

1. Pedí reset password con un email real
2. Abrí el email en **Gmail iOS** → debería mostrar mensaje "Abrí en Safari"
3. Abrí el email desde Gmail web → debería ir a `/bienvenida` y dejarte poner contraseña nueva
4. Probá Google OAuth desde `/registro` → debería redirigir a `/bienvenida` y luego a `/`
5. Si algo falla, abrir F12 y leer los `[anma-auth]` logs
