# NetControl Pro — Plan de Pruebas en Ambiente Real

**Autor:** Wilfredo Caban  
**Fecha de ejecución prevista:** Sabado  
**Ambiente:** Red doméstica real  
**Versión:** rama `claude/analyze-project-c1pZ4`

---

## Requisitos previos

### Software necesario
- Node.js 18+ y npm
- nmap instalado o accesible

### Credenciales necesarias
- `.env` creado a partir de `.env.example` con valores reales
- Acceso al dashboard de Supabase: https://supabase.com/dashboard/project/psjfmqxngodknlyctelx

### Variables de entorno a configurar en `.env`
```
VITE_SUPABASE_URL=https://psjfmqxngodknlyctelx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<tu clave real>
SCAN_SUBNET=<tu subred, ej: 192.168.1.0/24>
```

---

## Cómo descubrir tu subred

**Linux / macOS:**
```bash
ip a | grep "inet " | grep -v 127.0.0.1
# o
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```cmd
ipconfig | findstr "IPv4"
```

Ejemplo de resultado: `192.168.1.105/24` → tu subred es `192.168.1.0/24`

---

## Nota sobre nmap y sistema operativo

| SO | Acción necesaria |
|----|-----------------|
| Linux | Usar `./nmap` del repo (ya incluido). Para ver MACs: `sudo ./nmap` |
| macOS | Instalar: `brew install nmap`. Editar `vite.config.ts` línea 15: cambiar `./nmap` por `nmap` |
| Windows | Instalar desde https://nmap.org/download. Editar `vite.config.ts` línea 15: cambiar `./nmap` por `nmap` |

**Sin sudo/admin:** nmap detecta IPs pero NO muestra MAC addresses ni vendors de dispositivos.

---

## Migración pendiente en Supabase

Antes de probar la app, aplicar la migración de `firewall_rules` en Supabase:

1. Ir a: Dashboard Supabase → SQL Editor
2. Copiar y ejecutar el contenido de:  
   `supabase/migrations/20260428120000_a1b2c3d4-e5f6-7890-abcd-ef1234567890.sql`
3. Verificar en Table Editor que la tabla `firewall_rules` existe

---

## Bitácora de resultados

Anotar cada resultado con `[PASS]`, `[FAIL]` o `[SKIP]` y observaciones.

---

## FASE 0 — Setup local

**Duración estimada:** 15-20 min  
**Objetivo:** App corriendo en la máquina con ambiente configurado

| # | Tarea | Comando | Resultado esperado | Estado |
|---|-------|---------|-------------------|--------|
| 0.1 | Instalar dependencias | `npm install` | Sin errores | [ ] |
| 0.2 | Crear `.env` desde `.env.example` | Copiar y rellenar valores | Archivo `.env` creado | [ ] |
| 0.3 | Descubrir subred real | `ip a` o `ifconfig` | Ej: `192.168.1.0/24` | [ ] |
| 0.4 | Configurar `SCAN_SUBNET` en `.env` | Editar con subred real | Variable con valor correcto | [ ] |
| 0.5 | Verificar nmap funciona | `sudo ./nmap -sn 192.168.X.0/24` | Lista de hosts activos | [ ] |
| 0.6 | Levantar dev server | `npm run dev` | Abre en http://localhost:8080 | [ ] |
| 0.7 | Ejecutar tests unitarios | `npm run test:run` | 16/16 passing | [ ] |

**Subred detectada:** `______________________`  
**Cantidad de dispositivos detectados con nmap directo:** `______`  
**Tiempo que tardó el escaneo nmap:** `______ seg`

**Observaciones Fase 0:**
```
(anotar aquí)
```

---

## FASE 1 — Setup Supabase

**Duración estimada:** 10 min  
**Objetivo:** Backend listo con las tablas correctas y primer usuario admin

| # | Tarea | Cómo | Resultado esperado | Estado |
|---|-------|-----|-------------------|--------|
| 1.1 | Aplicar migración `firewall_rules` | Supabase → SQL Editor → ejecutar SQL | Tabla `firewall_rules` creada | [ ] |
| 1.2 | Verificar RLS en `firewall_rules` | Supabase → Auth → Policies | 2 políticas visibles | [ ] |
| 1.3 | Registrar primer usuario (admin) | App → `/auth` → Sign Up | Email de confirmación recibido | [ ] |
| 1.4 | Confirmar email y hacer login | Click en link del email | Redirige a `/` con dashboard | [ ] |
| 1.5 | Verificar badge Admin | Header de la app | Badge "Admin" + tab "Users" visible | [ ] |
| 1.6 | Verificar perfil en DB | Supabase → Table Editor → `profiles` | Fila con tu usuario | [ ] |
| 1.7 | Verificar rol en DB | Supabase → Table Editor → `user_roles` | Fila con `role = admin` | [ ] |

> **Importante:** El trigger `handle_new_user()` asigna `admin` solo al **primer** usuario registrado.  
> Si ya existen usuarios en la tabla `profiles`, el nuevo será `user` por defecto.

**Email usado para el primer usuario:** `______________________`  
**Rol asignado automáticamente:** `______________________`

**Observaciones Fase 1:**
```
(anotar aquí)
```

---

## FASE 2 — Pruebas Funcionales

**Duración estimada:** 30-45 min  
**Objetivo:** Validar cada funcionalidad con datos reales de la red doméstica

---

### 2.1 Auth Flow

| # | Prueba | Pasos | Resultado esperado | Estado |
|---|--------|-------|-------------------|--------|
| 2.1.1 | Signup funciona | `/auth` → Sign Up → llenar formulario | Email de confirmación llega | [ ] |
| 2.1.2 | Login funciona | `/auth` → Sign In con credenciales | Redirige a dashboard | [ ] |
| 2.1.3 | Sesión persiste | Login → cerrar y reabrir el navegador | Sigue logueado | [ ] |
| 2.1.4 | Forgot password | `/forgot-password` → ingresar email | Email con link llega | [ ] |
| 2.1.5 | Update password | Click en link del email | Formulario de nueva contraseña | [ ] |
| 2.1.6 | Login con nueva contraseña | Cerrar sesión → login con password nuevo | Acceso exitoso | [ ] |
| 2.1.7 | Logout funciona | Menú usuario → Logout | Redirige a `/auth` | [ ] |
| 2.1.8 | Ruta protegida | Sin login, ir a `http://localhost:8080/` | Redirige a `/auth` | [ ] |

**Observaciones 2.1:**
```
(anotar aquí)
```

---

### 2.2 Devices Page (tab "Devices")

| # | Prueba | Pasos | Resultado esperado | Estado |
|---|--------|-------|-------------------|--------|
| 2.2.1 | Escaneo inicial carga | Click en tab "Devices" | Spinner/skeleton ~5-20 seg, luego lista | [ ] |
| 2.2.2 | Dispositivos reales detectados | Ver lista tras el escaneo | Al menos router (192.168.X.1) visible | [ ] |
| 2.2.3 | Conteo correcto | Contar dispositivos en la UI | Coincide con los que tienes en la red | [ ] |
| 2.2.4 | IP visible | Ver detalles de cualquier dispositivo | IP en formato `192.168.X.X` | [ ] |
| 2.2.5 | MAC address visible | Con sudo: ver campo MAC | Formato `AA:BB:CC:DD:EE:FF` | [ ] |
| 2.2.6 | Vendor/nombre visible | Ver nombre en dispositivos conocidos | Apple, Samsung, etc. según el fabricante | [ ] |
| 2.2.7 | "Last seen" formateado | Ver timestamp | "less than a minute ago" o similar | [ ] |
| 2.2.8 | Botón Refresh funciona | Click en "Refresh" | Spinner + re-escaneo | [ ] |
| 2.2.9 | Dismiss de dispositivo | Click Trash → AlertDialog → "Remove" | Desaparece de la lista | [ ] |
| 2.2.10 | Dismiss es temporal | Después de 2.2.9, click "Refresh" | El dispositivo vuelve a aparecer | [ ] |
| 2.2.11 | Estado offline | Apagar un dispositivo → "Refresh" | Estado cambia a "offline" | [ ] |
| 2.2.12 | Cancel en AlertDialog | Click Trash → click "Cancel" | Dialog se cierra, dispositivo NO se elimina | [ ] |

**Cantidad de dispositivos detectados:** `______`  
**Dispositivos esperados no detectados:** `______________________`  
**Tiempo de escaneo real:** `______ seg`

**Observaciones 2.2:**
```
(anotar aquí)
```

---

### 2.3 Dashboard (tab "Dashboard")

| # | Prueba | Pasos | Resultado esperado | Estado |
|---|--------|-------|-------------------|--------|
| 2.3.1 | "Network Devices" dinámico | Ver card en dashboard | Número real (no `12` hardcodeado) | [ ] |
| 2.3.2 | "Online Devices" dinámico | Ver card en dashboard | Coincide con dispositivos online | [ ] |
| 2.3.3 | Cache compartido | Ir a tab Devices → volver a Dashboard | Conteos NO re-escanean (usan cache) | [ ] |
| 2.3.4 | "Recent Activity" real | Ver sección "Recent Network Activity" | 3 dispositivos reales con timestamps | [ ] |
| 2.3.5 | Skeleton mientras carga | Recargar página → ir a Dashboard rápido | Skeletons en los cards antes de datos | [ ] |

**Valor de "Network Devices" mostrado:** `______`  
**Valor de "Online Devices" mostrado:** `______`

**Observaciones 2.3:**
```
(anotar aquí)
```

---

### 2.4 Firewall Page (tab "Firewall")

| # | Prueba | Pasos | Resultado esperado | Estado |
|---|--------|-------|-------------------|--------|
| 2.4.1 | Estado inicial vacío | Primera vez en tab Firewall | "No firewall rules configured" | [ ] |
| 2.4.2 | Abrir dialog "Add Rule" | Click en "Add Rule" | Dialog con formulario | [ ] |
| 2.4.3 | Crear regla ALLOW | Completar form: source=any, dest=192.168.X.1, port=443, action=Allow | Toast "Rule saved", regla en tabla | [ ] |
| 2.4.4 | Crear regla DENY | source=any, dest=any, port=22, action=Deny | Segunda regla en tabla con badge rojo | [ ] |
| 2.4.5 | Persistencia tras recarga | Recargar la página | Las 2 reglas siguen ahí | [ ] |
| 2.4.6 | Toggle desactiva | Click switch de una regla | Fila se ve apagada, cambio en DB | [ ] |
| 2.4.7 | Toggle reactiva | Click switch de nuevo | Fila activa, cambio en DB | [ ] |
| 2.4.8 | Editar regla | Click Edit → cambiar puerto → "Save Rule" | Toast "Rule saved", cambio visible | [ ] |
| 2.4.9 | Confirmar antes de borrar | Click Trash → AlertDialog aparece | Texto: "will be permanently deleted" | [ ] |
| 2.4.10 | Cancel en borrar | AlertDialog → click "Cancel" | Regla NO se borra | [ ] |
| 2.4.11 | Borrar regla | AlertDialog → click "Delete" | Toast "Rule deleted", regla desaparece | [ ] |
| 2.4.12 | Persistencia del borrado | Recargar tras 2.4.11 | Regla borrada NO reaparece | [ ] |

**Observaciones 2.4:**
```
(anotar aquí)
```

---

### 2.5 User Management (tab "Users" — solo admin)

| # | Prueba | Pasos | Resultado esperado | Estado |
|---|--------|-------|-------------------|--------|
| 2.5.1 | Tab visible para admin | Login como admin | Tab "Users" aparece | [ ] |
| 2.5.2 | Lista todos los usuarios | Ver tab Users | Tu usuario en la lista | [ ] |
| 2.5.3 | Registrar segundo usuario | Abrir ventana privada → signup | Nuevo usuario creado con rol `user` | [ ] |
| 2.5.4 | Tab "Users" oculto para user normal | Login como el usuario de 2.5.3 | Tab "Users" NO aparece | [ ] |
| 2.5.5 | Cambiar rol (admin→user) | Como admin: cambiar rol de otro usuario | Cambio guardado | [ ] |

**Observaciones 2.5:**
```
(anotar aquí)
```

---

## FASE 3 — Pruebas de Robustez

**Duración estimada:** 20-30 min  
**Objetivo:** Verificar comportamiento ante errores, edge cases y condiciones no ideales

---

### 3.1 Estados de error

| # | Prueba | Pasos | Resultado esperado | Estado |
|---|--------|-------|-------------------|--------|
| 3.1.1 | Error de escaneo | Renombrar `./nmap` → `./nmap_bak` → Restart server → ir a Devices | Mensaje de error claro, botón "Try again" | [ ] |
| 3.1.2 | Recuperación del error | Restaurar `./nmap_bak` → `./nmap` → Restart → "Try again" | Escaneo funciona de nuevo | [ ] |
| 3.1.3 | Sin WiFi | Desconectar del WiFi → Devices → "Refresh" | Error o lista vacía (no crash) | [ ] |
| 3.1.4 | Supabase inaccesible | Poner URL falsa en .env → restart → ir a Firewall | Error manejado (no pantalla blanca) | [ ] |

**Observaciones 3.1:**
```
(anotar aquí)
```

---

### 3.2 Persistencia y sincronización

| # | Prueba | Pasos | Resultado esperado | Estado |
|---|--------|-------|-------------------|--------|
| 3.2.1 | Sync entre tabs | Abrir 2 tabs → crear regla en tab 1 → recargar tab 2 | Regla aparece en tab 2 | [ ] |
| 3.2.2 | Sobrevive cierre del browser | Crear regla → cerrar browser → reabrir | Regla persiste, sesión activa | [ ] |
| 3.2.3 | Reload en medio de scan | Iniciar scan en Devices → F5 inmediatamente | No crash, scan arranca de nuevo | [ ] |
| 3.2.4 | Datos de otro usuario aislados | Login user A → crear regla → login user B | User B NO ve reglas de user A | [ ] |

**Observaciones 3.2:**
```
(anotar aquí)
```

---

### 3.3 Edge cases de nmap

| # | Prueba | Condición | Resultado esperado | Estado |
|---|--------|-----------|-------------------|--------|
| 3.3.1 | Dispositivos sin hostname DNS | Ver lista completa | Muestra vendor (Apple, etc.) o "Unknown Device" | [ ] |
| 3.3.2 | Router detectado | Ver si 192.168.X.1 aparece | Router en la lista con IP `.1` | [ ] |
| 3.3.3 | Tiempo de escaneo | Medir tiempo hasta ver resultados | Bajo 30 seg (timeout configurado) | [ ] |
| 3.3.4 | Dispositivo IoT | Si tienes smart TV, Alexa, etc. | Aparece con vendor reconocible | [ ] |
| 3.3.5 | Dispositivo sin MAC (sin sudo) | Correr sin sudo → ver Devices | IPs visibles, MACs como "N/A" | [ ] |

**Tiempo de escaneo medido:** `______ seg`  
**Dispositivos IoT detectados:** `______________________`

**Observaciones 3.3:**
```
(anotar aquí)
```

---

### 3.4 Seguridad básica

| # | Prueba | Pasos | Resultado esperado | Estado |
|---|--------|-------|-------------------|--------|
| 3.4.1 | RLS: usuario no ve datos de otro | Ver 3.2.4 | Aislamiento confirmado | [ ] |
| 3.4.2 | Acceso sin sesión a la app | Cerrar sesión → ir a `/` | Redirige a `/auth` | [ ] |
| 3.4.3 | URL directa sin auth | Sin login → ir a `http://localhost:8080/` | Redirige a `/auth` | [ ] |

**Observaciones 3.4:**
```
(anotar aquí)
```

---

## Resumen de resultados

Completar al finalizar todas las fases.

| Fase | Total tests | PASS | FAIL | SKIP |
|------|-------------|------|------|------|
| Fase 0 — Setup local | 7 | | | |
| Fase 1 — Setup Supabase | 7 | | | |
| 2.1 Auth Flow | 8 | | | |
| 2.2 Devices Page | 12 | | | |
| 2.3 Dashboard | 5 | | | |
| 2.4 Firewall Page | 12 | | | |
| 2.5 User Management | 5 | | | |
| 3.1 Estados de error | 4 | | | |
| 3.2 Persistencia | 4 | | | |
| 3.3 Edge cases nmap | 5 | | | |
| 3.4 Seguridad | 3 | | | |
| **TOTAL** | **72** | | | |

---

## Bugs encontrados

| # | Fase | Descripción | Severidad (Alta/Media/Baja) |
|---|------|-------------|----------------------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## Información del ambiente (completar al inicio)

| Campo | Valor |
|-------|-------|
| Sistema operativo | |
| Versión de Node.js (`node -v`) | |
| Subred de la red | |
| Cantidad de dispositivos en la red | |
| Router (marca/modelo) | |
| nmap usado (`./nmap` o sistema) | |
| Fecha de ejecución | Sabado |
