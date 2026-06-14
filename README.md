# Alcanzando las Estrellas — Sistema de Pagos

App de gestión de mensualidades para academia de pole dance.
Stack: Cloudflare Pages + Workers + D1 + Twilio WhatsApp.

---

## Estructura del proyecto

```
public/             → Páginas HTML (servidas por Cloudflare Pages)
functions/api/      → API backend (Cloudflare Pages Functions)
cron-worker/        → Worker con cron diario para WhatsApp automático
schema.sql          → Esquema de base de datos D1
wrangler.toml       → Configuración Pages
```

---

## Setup paso a paso

### 1. Instalar Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Crear la base de datos D1

```bash
wrangler d1 create academia-db
```

Copiá el `database_id` que aparece y reemplazalo en:
- `wrangler.toml` → `database_id = "REEMPLAZAR_CON_ID_REAL"`
- `cron-worker/wrangler.toml` → `database_id = "REEMPLAZAR_CON_ID_REAL"`

### 3. Crear las tablas

```bash
wrangler d1 execute academia-db --file=schema.sql
```

### 4. Conectar GitHub a Cloudflare Pages

1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages**
2. Conectar tu repositorio GitHub
3. Configuración de build:
   - **Framework preset**: None
   - **Build command**: (vacío)
   - **Build output directory**: `public`
4. En **Settings → Functions → D1 database bindings**:
   - Variable name: `DB`
   - D1 database: `academia-db`

### 5. Variables de entorno en Cloudflare Pages

En **Settings → Environment variables** agregar:

| Variable | Valor |
|----------|-------|
| `ADMIN_USER` | tu usuario (ej: `admin`) |
| `ADMIN_PASS` | tu contraseña segura |
| `JWT_SECRET` | cadena aleatoria larga (ej: 32+ caracteres) |
| `TWILIO_ACCOUNT_SID` | tu Account SID de Twilio |
| `TWILIO_AUTH_TOKEN` | tu Auth Token de Twilio |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (sandbox) o tu número aprobado |

### 6. Deploy del cron worker

```bash
cd cron-worker
wrangler deploy
```

Agregar las mismas variables de entorno al cron worker:
```bash
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_WHATSAPP_FROM
wrangler secret put CRON_SECRET   # cualquier cadena para proteger el endpoint /trigger
```

### 7. Dominio personalizado

En Cloudflare Pages → **Custom domains** → agregar `alcanzandolasestrellas.com`
(Como ya tenés el dominio en Cloudflare, se configura automáticamente.)

---

## Uso

### Acceso
- URL: `https://alcanzandolasestrellas.com`
- Login con las credenciales configuradas en las variables de entorno

### Módulos
- **Dashboard**: resumen mensual + botón envío manual WhatsApp
- **Alumnas**: agregar/editar/desactivar alumnas
- **Pagos**: marcar mensualidades por mes, ver historial

### Notificaciones WhatsApp automáticas
El cron se ejecuta cada día a las 09:00 Chile y envía automáticamente:
- **Día (vencimiento - 3)**: recordatorio preventivo
- **Día vencimiento**: aviso de vencimiento
- **Día (vencimiento + 3)**: aviso de deuda

El día de vencimiento se configura en **Dashboard → Configuración**.

### Envío manual WhatsApp
Dashboard → botón **Enviar WhatsApp** → elegir tipo de mensaje.

---

## Planes

| Plan | Clases/semana | Mensualidad |
|------|--------------|-------------|
| 1    | 1 clase      | $45.000 CLP |
| 2    | 2 clases     | $55.000 CLP |
| 3    | 3 clases     | $65.000 CLP |

---

## Twilio WhatsApp

Si usás el sandbox de Twilio:
1. Cada alumna debe enviar el código de activación al número sandbox una sola vez
2. Para producción, solicitar un número WhatsApp Business en Twilio

Los números de teléfono se guardan con prefijo `+56` (Chile). Formato al ingresar: `912345678` (sin el 56).
