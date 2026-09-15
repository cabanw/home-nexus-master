# CLAUDE.md

## Proyecto

NetControl Pro (repo `cabanw/home-nexus-master`): app React para descubrir los dispositivos de la red local con nmap, controlar los interruptores TP-Link Kasa por la LAN, y administrar reglas de firewall y usuarios en Supabase.

## Regla principal: cero mock data

- Todo lo que muestra la app debe venir de una fuente real: el escaneo nmap (`GET /api/scan`), los equipos Kasa de la LAN (`/api/kasa/devices`) o Supabase.
- Prohibido: arrays de datos inventados, métricas o porcentajes fijos, timestamps falsos, acciones simuladas con `setTimeout`/`setInterval`, botones "Save"/"Connect" que no hacen nada, y clientes de APIs que no existen o que no se pueden usar.
- Si una función todavía no tiene fuente real, no se muestra. No se deja un placeholder, stub ni valores de ejemplo.
- Única excepción: dobles de prueba (`vi.mock`, fixtures) dentro de `src/test/` y `server/*.test.ts`.

## Comandos

```bash
npm run dev        # http://localhost:8080 (incluye /api/scan y /api/kasa/devices)
npm run test:run   # tests unitarios (vitest): src/**/*.test.* y server/**/*.test.ts
npm run lint
npm run build
```

## Arquitectura

- **Frontend:** Vite + React 18 + TypeScript + Tailwind + shadcn/ui, TanStack Query, react-router. `src/components/ui/` es código generado por shadcn.
- **Páginas:** `/` (pestañas Dashboard, Devices, Smart Home, Firewall, Users solo admin), `/profile`, `/auth`, `/forgot-password`, `/update-password`.
- **APIs del servidor de desarrollo:** plugins en `vite.config.ts`, disponibles **solo con `npm run dev`** (no existen en el build). Todas exigen un token Bearer de Supabase válido (401 sin sesión).
- **Código solo de Node** (sockets, HTTP a equipos, crypto) va en `server/`, no en `src/`: `tsconfig.app.json` no incluye tipos de Node.
- Cliente: `src/lib/apiAuth.ts` agrega el token y convierte errores; `src/lib/scanApi.ts` y `src/lib/kasaApi.ts` usan esas funciones.

### Escaneo de red (`GET /api/scan`)

- Ejecuta nmap con `execFile` y `-sn -T4 -oX -` (solo descubrimiento, sin escaneo de puertos). Si hay peticiones simultáneas, comparten una sola ejecución.
- `src/utils/scanConfig.ts`: valida `SCAN_SUBNET`, resuelve la ruta de nmap, arma los argumentos y tiene utilidades de IP (pertenencia a subred, broadcast, orden, adaptador local).
- `src/utils/nmapParser.ts`: XML de nmap → `ScannedDevice[]`.
- `src/utils/inventory.ts` + `src/config/infrastructure.ts`: nombra la infraestructura conocida; si un equipo conocido no responde, aparece offline.

### Smart Home: TP-Link Kasa por LAN (`/api/kasa/devices`)

Hay dos protocolos, según el firmware del interruptor:

| | Legacy | KLAP v2 |
|---|---|---|
| Transporte | JSON con XOR autokey (clave inicial 171) en TCP/UDP 9999; TCP con prefijo de longitud de 4 bytes | HTTP en el puerto 80 (`/app/handshake1`, `/app/handshake2`, `/app/request?seq=N`) |
| Descubrimiento | Broadcast UDP 9999 con `get_sysinfo` (responde con el estado completo) | Broadcast UDP 20002 con consulta estática de 16 bytes (responde modelo, MAC y tipo de cifrado) |
| Credenciales | No | Cuenta TP-Link/Kasa: `KASA_USERNAME` / `KASA_PASSWORD` |
| Código | `src/utils/kasaProtocol.ts`, `server/kasa.ts` | `server/klapCrypto.ts` (hashes, AES-128-CBC, firma), `server/klap.ts` (handshake y sesión por equipo) |

- **KLAP v2:**
  - `authHash = sha256(sha1(usuario) + sha1(contraseña))`.
  - handshake1: el equipo devuelve su semilla y `sha256(semillaCliente + semillaEquipo + authHash)`. Si no coincide, las credenciales son incorrectas.
  - handshake2: se envía `sha256(semillaEquipo + semillaCliente + authHash)`.
  - Clave, IV y firma se derivan con los prefijos `lsk`, `iv` y `ldk`. La sesión (cookie `TP_SESSIONID`) se reutiliza hasta su `TIMEOUT`; con un 403 se repite el handshake una vez.
- **Descubrimiento** (`GET /api/kasa/devices`): por cada subred de `SCAN_SUBNET` en la que esta PC tenga un adaptador, un socket UDP enlazado a la IP de ese adaptador envía a `255.255.255.255` (y al broadcast de la subred) las consultas de los puertos 9999 y 20002, 3 veces en una ventana de 3 s.
  - En Windows solo esa combinación recibe respuestas. Verificado el 2026-09-14: con el socket sin enlazar, o enviando solo al broadcast de la subred, llegan 0 respuestas, porque hay varios adaptadores (OpenVPN, Npcap loopback).
  - Los equipos KLAP se leen con las credenciales. Sin credenciales, o si fallan, se devuelven en `locked` con el motivo, y la UI los muestra en "Not controllable yet" sin interruptor.
  - Las subredes sin adaptador local se devuelven en `skippedSubnets`.
  - A los interruptores ya vistos que no respondan se les pregunta directamente; si siguen sin responder, se marcan offline con su último estado.
- `POST /api/kasa/devices/:ip/state` con `{ on?: boolean, brightness?: 1-100 }`: solo para IPs ya descubiertas (no `locked`) dentro de `SCAN_SUBNET`; `brightness` solo en dimmers. Usa el protocolo del equipo y devuelve el estado que reporta después del cambio.
- `src/pages/SmartHome.tsx`: un interruptor por equipo, slider de brillo para dimmers, insignia KLAP y lista de equipos no controlables.
- **Privacidad:** `get_sysinfo` incluye la latitud y longitud de la casa, y la respuesta de UDP 20002 incluye `device_id` y `owner` de la nube. `parseSysinfo` y `parseDiscoveryV2Reply` copian solo los campos que usa la app; nunca reenviar respuestas crudas al navegador.
- **Equipos reales:** los comandos `set_*` encienden y apagan luces de verdad. No enviarlos desde scripts, pruebas ni verificaciones sin que el usuario lo pida explícitamente; para verificar, usar solo `get_sysinfo`.
- Soportados: interruptores `IOT.SMARTPLUGSWITCH` sin `children` (HS200, HS210, HS220 dimmer). Bulbs, power strips, cámaras y Tapo (`SMART.*`) no están soportados.
- No agregar integraciones de ADT, Ring o Alexa sin una API real y usable: hasta donde sabemos no tienen API pública local o documentada para este uso.

### Supabase

- Auth, `profiles`, `user_roles` (el trigger `on_auth_user_created` → `handle_new_user` crea el perfil y hace admin al primer usuario registrado) y `firewall_rules`, todas con RLS. Migraciones en `supabase/migrations/`. `src/integrations/supabase/client.ts` y `types.ts` son generados.
- La función de timestamps se llama `public.update_updated_at()`.
- No crear otro trigger llamado `on_auth_user_created` ni reemplazar el existente: rompería el registro de usuarios.
- **Firewall:** las reglas solo se guardan en Supabase; no se aplican a ningún equipo de la red.
- **Secretos:** toda variable `VITE_*` termina en el JavaScript del navegador. Nunca poner client secrets, API keys privadas ni contraseñas en variables `VITE_*`; esos valores solo los lee el servidor.

## Variables de entorno (`.env`, ignorado por git)

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (uso en navegador) |
| `SCAN_SUBNET` | Una o más subredes CIDR separadas por comas, de /16 a /32. La usan nmap y el descubrimiento Kasa |
| `NMAP_PATH` | Opcional. Ruta a nmap si no está en la ubicación estándar |
| `KASA_USERNAME` / `KASA_PASSWORD` | Opcional. Cuenta TP-Link/Kasa para interruptores KLAP. Solo servidor (sin `VITE_`) |

## Red real (verificado 2026-09-14)

- LAN actual: `172.16.40.0/24`. PC de desarrollo: `172.16.40.100` (Ethernet 4).
- `192.168.254.x` es el adaptador de OpenVPN: no es la red de casa y no se escanea.
- Infraestructura: gateway Nokia de AT&T en `.1`; Netgear WAX615 en `.250` y `.251` (no está confirmado cuál es AP1 y cuál AP2).
- Un escaneo nmap del /24 tarda ~22 s y encontró ~31 dispositivos.
- Kasa: 11 interruptores (1 HS220 dimmer, 6 HS200, 4 HS210).
  - El 2026-09-14, durante la sesión, 10 pasaron del protocolo legacy a KLAP v2 por una actualización de firmware (HS200 1.0.11 → 1.1.2, HS210 1.0.10 → 1.1.0): puerto 9999 cerrado, HTTP 80 abierto.
  - Solo el HS220 (firmware 1.0.8) sigue en legacy.
  - Los KLAP están vinculados a la cuenta (`factory_default: false`). Con `KASA_USERNAME`/`KASA_PASSWORD` se leen los 11.
  - Verificado por el usuario desde la UI el 2026-09-14: encender/apagar por KLAP (un HS200 y un HS210) y encender/apagar + brillo por legacy (HS220).
- Otros equipos vistos en el escaneo: Resideo (`.10`) y August Home (`.87`); todavía sin integración.
- La topología planificada (Linksys MR7200 en `.254`, VLAN 10/20/30 en `172.16.50/60/70.0/24`) todavía **no** está implementada. Cuando exista, agregar esas subredes a `SCAN_SUBNET` y los equipos a `src/config/infrastructure.ts`. Con VLANs y Client Isolation, los broadcasts de descubrimiento no cruzan entre subredes.
- El repo en GitHub es **público**: no agregar nombres de habitaciones, coordenadas, MACs completas ni otros datos de la casa a archivos versionados.

## Entorno Windows

- nmap 7.80 (32 bits) en `C:\Program Files (x86)\Nmap\nmap.exe`, fuera del PATH. Necesita Visual C++ 2013 **x86** (`winget install Microsoft.VCRedist.2013.x86`).
- Npcap 0.9982 permite usarlo sin admin (`AdminOnly = 0`), así que nmap obtiene MACs sin elevar permisos.
- `./nmap` en la raíz es un binario Linux x86-64; solo sirve en Linux.
- El proyecto está dentro de OneDrive: `node_modules` puede sincronizarse lento.
- PowerShell 5.1 rompe argumentos con comillas dobles al llamar programas nativos (por ejemplo `gh pr create --body`): usar `--body-file`.

## Supabase (proyecto)

- Proyecto `psjfmqxngodknlyctelx`, plan gratis: se pausa tras días sin actividad.
- Las 5 migraciones se aplicaron a mano por SQL Editor el 2026-09-14 y no están registradas en `supabase_migrations`. Antes de usar `supabase db push`, marcarlas con `supabase migration repair --status applied <id>`.

## Estado conocido

- `tsc` ya reportaba errores antes de estos cambios en `src/components/ui/sidebar.tsx`, `src/components/ui/toggle-group.tsx`, `xml2js` sin tipos y `test.deps` en `vite.config.ts`. No son regresiones.
- No hay historial de dispositivos de red: offline solo se detecta para la infraestructura conocida. Siguiente fase: tabla `devices` en Supabase.
- El estado de los Kasa (offline, sesiones KLAP) vive en memoria del servidor de desarrollo; se pierde al reiniciarlo.

## Flujo de trabajo

- Cambios en una rama y luego Pull Request hacia `main`.
- Mensajes de commit en inglés.
