# Supabase Auth — Email Templates UNIVERSALES (Hub + Regalos)

## ACTUALIZACIÓN 20/06/2026 — Rediseño sofisticado, sin emojis

Los 3 templates se rediseñaron con estética premium: wordmark "ANMA" en vez de
emoji-en-cuadrito, jerarquía tipográfica, espaciado generoso y paleta navy→violeta
fiel a la marca. **Sin un solo emoji** (ni en subject ni en cuerpo).

La lógica anti-prefetch (link directo con `token_hash`, ver sección abajo) se mantiene
intacta. Los links usan `{{ .RedirectTo }}` — que desde el cambio de routing del
20/06 ya apunta a `/app/bienvenida` automáticamente, sin tocar el template.

**Acción requerida: re-pegar los 3 templates en el dashboard** (paso a paso abajo).

---

## ACTUALIZACIÓN 11/06/2026 — Links a prueba de prefetch

**Problema confirmado en producción** (reset password): los links con
`{{ .ConfirmationURL }}` pasan por el endpoint `/auth/v1/verify` de Supabase y son
de **un solo uso**. Gmail, los antivirus y el propio Chrome de Android **pre-cargan**
el link antes del click real → el token se consume → el usuario ve "Enlace no válido /
expirado" aunque haga click 1 minuto después de recibir el email.

**Solución (la oficial de Supabase para este caso):** el link del email va **directo
a la app** con `token_hash`, y la verificación la hace el JavaScript de la app
(`verifyOtp`). Los scanners/prefetchers no ejecutan JS → el token no se gasta.

```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery   ← reset
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup     ← confirmación
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite     ← invitación
```
La app maneja `?token_hash=&type=` en `/app/bienvenida` (ambas apps, deployed).

---

## Importante: por qué un solo template para las 2 apps

ANMA Hub (`hub`) y ANMA Regalos (`host`) comparten el **mismo proyecto Supabase**
(`paxsvjdimqlfxnlipplx`). Los email templates son **globales al proyecto** — no se
pueden tener distintos por sitio.

**Solución:** templates con detección automática vía `{{ .Data.allowed_sites }}`
(`['hub']` o `['host']`, según desde qué app se registró el user). Un solo HTML por
template, ambas apps cubiertas con su branding.

---

## Variables disponibles (Go templates)

- `{{ .RedirectTo }}` — URL de retorno (ya incluye `/app/...`)
- `{{ .TokenHash }}` — hash del token (link anti-prefetch)
- `{{ .Email }}` — email del destinatario
- `{{ .Data.business_name }}` — nombre del negocio
- `{{ index .Data.allowed_sites 0 }}` — `"hub"` o `"host"`

---

## Template 1 — Confirm Signup (BIENVENIDA)

**Subject:** `Activá tu cuenta de ANMA`

```html
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0f0a1e;padding:48px 16px">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(76,29,149,.35)">

        {{ if eq (index .Data.allowed_sites 0) "host" }}
        <!-- HEADER — ANMA Regalos -->
        <tr><td style="background:linear-gradient(135deg,#2E1065 0%,#7C3AED 55%,#D946EF 100%);padding:48px 40px 40px;text-align:center">
          <div style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:8px;text-transform:uppercase">ANMA</div>
          <div style="color:rgba(255,255,255,.65);font-size:10.5px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-top:4px">Regalos</div>
          <div style="width:40px;height:2px;background:rgba(255,255,255,.35);margin:22px auto 0"></div>
        </td></tr>
        {{ else }}
        <!-- HEADER — ANMA Hub -->
        <tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#4C1D95 50%,#7C3AED 100%);padding:48px 40px 40px;text-align:center">
          <div style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:8px;text-transform:uppercase">ANMA</div>
          <div style="color:rgba(255,255,255,.65);font-size:10.5px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-top:4px">Hub</div>
          <div style="width:40px;height:2px;background:rgba(255,255,255,.35);margin:22px auto 0"></div>
        </td></tr>
        {{ end }}

        <!-- BODY -->
        <tr><td style="padding:44px 44px 40px">
          <h1 style="color:#0f0a1e;margin:0 0 6px;font-size:25px;font-weight:700;letter-spacing:-.4px">Qué bueno tenerte</h1>
          <p style="color:#6b7280;margin:0 0 28px;font-size:14px;line-height:1.6">
            Hola {{ .Data.business_name }}, estás a un paso de empezar.
          </p>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 32px">
            Tu espacio de trabajo en ANMA ya casi está listo. Confirmá tu email para
            activar la cuenta y arrancar con tu prueba de 7 días.
          </p>

          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto">
            <tr><td style="border-radius:12px;background:linear-gradient(135deg,{{ if eq (index .Data.allowed_sites 0) "host" }}#7C3AED,#D946EF{{ else }}#5B21B6,#7C3AED{{ end }})">
              <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup" style="display:inline-block;padding:15px 40px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:.2px">
                Confirmar mi email
              </a>
            </td></tr>
          </table>

          <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:28px 0 0;text-align:center">
            ¿El botón no funciona? Copiá este enlace en tu navegador:<br>
            <span style="color:#7C3AED;word-break:break-all">{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup</span>
          </p>

          <div style="margin-top:36px;padding:24px;background:#faf8ff;border-radius:14px;border:1px solid #ede9fe">
            <p style="color:#4C1D95;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 14px">Para empezar</p>
            <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
              {{ if eq (index .Data.allowed_sites 0) "host" }}
              <tr><td style="color:#374151;font-size:13.5px;line-height:1.6;padding:5px 0">Armá tu primer kit en <strong>Catálogo</strong></td></tr>
              <tr><td style="color:#374151;font-size:13.5px;line-height:1.6;padding:5px 0">Sumá tu primer cliente desde <strong>Clientes</strong></td></tr>
              <tr><td style="color:#374151;font-size:13.5px;line-height:1.6;padding:5px 0">Cargá packaging desde <strong>Insumos</strong></td></tr>
              {{ else }}
              <tr><td style="color:#374151;font-size:13.5px;line-height:1.6;padding:5px 0">Sumá tu primer cliente desde <strong>Clientes</strong></td></tr>
              <tr><td style="color:#374151;font-size:13.5px;line-height:1.6;padding:5px 0">Armá tu primer presupuesto en <strong>Nuevo pedido</strong></td></tr>
              <tr><td style="color:#374151;font-size:13.5px;line-height:1.6;padding:5px 0">Importá tu catálogo desde <strong>Productos</strong></td></tr>
              {{ end }}
            </table>
          </div>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#faf8ff;padding:24px 44px;border-top:1px solid #f0ecfb;text-align:center">
          <p style="color:#9ca3af;font-size:11.5px;margin:0;line-height:1.6">
            Si no creaste esta cuenta, podés ignorar este mensaje.<br>
            {{ if eq (index .Data.allowed_sites 0) "host" }}ANMA Regalos{{ else }}ANMA Hub{{ end }} · Tu negocio en un solo lugar
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

## Template 2 — Reset Password

**Subject:** `Recuperá el acceso a tu cuenta`

```html
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0f0a1e;padding:48px 16px">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(76,29,149,.35)">

        <tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#4C1D95 50%,#7C3AED 100%);padding:48px 40px 40px;text-align:center">
          <div style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:8px;text-transform:uppercase">ANMA</div>
          <div style="width:40px;height:2px;background:rgba(255,255,255,.35);margin:22px auto 0"></div>
        </td></tr>

        <tr><td style="padding:44px 44px 40px">
          <h1 style="color:#0f0a1e;margin:0 0 8px;font-size:25px;font-weight:700;letter-spacing:-.4px">Recuperá tu acceso</h1>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 32px">
            Recibimos un pedido para restablecer tu contraseña. Elegí una nueva desde
            el botón de abajo.
          </p>

          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto">
            <tr><td style="border-radius:12px;background:linear-gradient(135deg,#5B21B6,#7C3AED)">
              <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery" style="display:inline-block;padding:15px 40px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:.2px">
                Elegir nueva contraseña
              </a>
            </td></tr>
          </table>

          <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:28px 0 0;text-align:center">
            ¿El botón no funciona? Copiá este enlace en tu navegador:<br>
            <span style="color:#7C3AED;word-break:break-all">{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery</span>
          </p>

          <div style="margin-top:32px;padding:18px 22px;background:#faf8ff;border-radius:12px;border:1px solid #ede9fe">
            <p style="color:#6b7280;font-size:12.5px;line-height:1.7;margin:0">
              Si no pediste este cambio, ignorá este mensaje: tu contraseña actual sigue
              funcionando. Por seguridad, el enlace vence en 1 hora.
            </p>
          </div>
        </td></tr>

        <tr><td style="background:#faf8ff;padding:24px 44px;border-top:1px solid #f0ecfb;text-align:center">
          <p style="color:#9ca3af;font-size:11.5px;margin:0">ANMA · Tu negocio en un solo lugar</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

> **Nota:** este template no necesita branching Hub/Regalos — el reset es neutro y la
> URL ya lleva al user al dominio correcto donde hizo el pedido.

---

## Template 3 — Invite User (admin invita a operador)

**Subject:** `Te invitaron a colaborar en ANMA`

```html
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0a1e;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0f0a1e;padding:48px 16px">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(76,29,149,.35)">

        {{ if eq (index .Data.allowed_sites 0) "host" }}
        <tr><td style="background:linear-gradient(135deg,#2E1065 0%,#7C3AED 55%,#D946EF 100%);padding:48px 40px 40px;text-align:center">
          <div style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:8px;text-transform:uppercase">ANMA</div>
          <div style="color:rgba(255,255,255,.65);font-size:10.5px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-top:4px">Regalos</div>
          <div style="width:40px;height:2px;background:rgba(255,255,255,.35);margin:22px auto 0"></div>
        </td></tr>
        {{ else }}
        <tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#4C1D95 50%,#7C3AED 100%);padding:48px 40px 40px;text-align:center">
          <div style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:8px;text-transform:uppercase">ANMA</div>
          <div style="color:rgba(255,255,255,.65);font-size:10.5px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-top:4px">Hub</div>
          <div style="width:40px;height:2px;background:rgba(255,255,255,.35);margin:22px auto 0"></div>
        </td></tr>
        {{ end }}

        <tr><td style="padding:44px 44px 40px">
          <h1 style="color:#0f0a1e;margin:0 0 8px;font-size:25px;font-weight:700;letter-spacing:-.4px">Te sumaron al equipo</h1>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 14px">
            Te invitaron a colaborar en el espacio de trabajo de
            <strong>{{ .Data.business_name }}</strong>.
          </p>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 32px">
            Aceptá la invitación y creá tu contraseña para entrar.
          </p>

          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto">
            <tr><td style="border-radius:12px;background:linear-gradient(135deg,{{ if eq (index .Data.allowed_sites 0) "host" }}#7C3AED,#D946EF{{ else }}#5B21B6,#7C3AED{{ end }})">
              <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite" style="display:inline-block;padding:15px 40px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:.2px">
                Aceptar invitación
              </a>
            </td></tr>
          </table>

          <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:28px 0 0;text-align:center">
            ¿El botón no funciona? Copiá este enlace en tu navegador:<br>
            <span style="color:#7C3AED;word-break:break-all">{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite</span>
          </p>
        </td></tr>

        <tr><td style="background:#faf8ff;padding:24px 44px;border-top:1px solid #f0ecfb;text-align:center">
          <p style="color:#9ca3af;font-size:11.5px;margin:0">
            {{ if eq (index .Data.allowed_sites 0) "host" }}ANMA Regalos{{ else }}ANMA Hub{{ end }} · Acceso colaborativo
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

## Cómo configurarlo paso a paso

### 1. Entrá al panel de templates
`https://supabase.com/dashboard/project/paxsvjdimqlfxnlipplx/auth/templates`

(Si estás en el panel general: Authentication → Emails → Templates)

### 2. Para cada uno de los 3 templates (Confirm signup, Reset Password, Invite user):
- **Subject**: pegá el subject que dice arriba (sin emoji)
- **Message body**: cliqueá **"Source"** / **"HTML"** (NO el modo visual), borrá todo
  el contenido por defecto y pegá el bloque HTML completo
- Botón **Save changes**

### 3. URL Configuration (CRÍTICO para que los links funcionen)
Authentication → **URL Configuration**:

- **Site URL**: `https://anmahub.com`
- **Redirect URLs**:
  - `https://anmahub.com/**`
  - `https://www.anmahub.com/**`
  - `https://anma-hub.vercel.app/**` (alias legacy)
  - `https://anma-host.vercel.app/**`
  - `http://localhost:5173/**`
  - `http://localhost:5174/**`

> El `**` cubre `/app/bienvenida` y cualquier subruta — no hace falta listarlas una por una.

### 4. Probá enviando un signup desde cada app
- Desde `https://anmahub.com/app/registro` → email **navy-violeta "ANMA Hub"**
- Desde `https://anma-host.vercel.app/registro` (con otro email) → email **violeta-fucsia "ANMA Regalos"**

Si recibís el branding equivocado, revisá que Registro.jsx pase `allowed_sites: ['hub']`
o `['host']` en `signUp.options.data`.

---

## SMTP propio (recomendado al crecer)

Por default Supabase usa su SMTP con límite de ~3-4 emails/hora. Si crecés:
- **Authentication → Emails → SMTP Settings**
- Opciones: Gmail SMTP (100/día con [App Password](https://myaccount.google.com/apppasswords)),
  Brevo (300/día gratis), MailerSend (3.000/mes gratis)

No es urgente — el SMTP default alcanza para los primeros ~50 signups/mes.

---

## Preguntas frecuentes

**¿El TrialReminderModal del día 5/7 se configura acá?**
No. Esos son modales **dentro de la app**, ya están en el código. No tocan Supabase.

**¿Cuando el user paga $120k le llega un email?**
Hoy no automático. Mercado Pago manda el comprobante. Vos te enterás vía el Admin
(Realtime + browser notification). Un email custom de "Pago confirmado" requeriría una
Edge Function.

**¿Las invitaciones a operadores andan?**
Sí, Supabase Auth las maneja. El template 3 (Invite user) es el que reciben.
