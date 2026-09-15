# CLAUDE.md

## Proyecto

NetControl Pro (repo `cabanw/home-nexus-master`): app React para descubrir los dispositivos de la red local con nmap, controlar los interruptores TP-Link Kasa por la LAN, y administrar reglas de firewall y usuarios en Supabase.

## Regla principal: cero mock data

- Todo lo que muestra la app debe venir de una fuente real: el escaneo nmap (`GET /api/scan`), los equipos Kasa de la LAN (`/api/kasa/devices`) o Supabase.
- Prohibido: arrays de datos inventados, métricas o porcentajes fijos, timestamps falsos, acciones simuladas con `setTimeout`/`setInterval`, botones "Save"/"Connect" que no hacen nada, y clientes de APIs que no existen o que no se pueden usar.
- Si una función todavía no tiene fuente real, no se muestra. No se deja un placeholder, stub ni valores de ejemplo.
- Única excepción: dobles de prueba (`vi.mock`, fixtures) dentro de `src/test/` para los tests unitarios.

## Comandos

```bash
npm run dev        # http://localhost:8080 (incluye /api/scan y /api/kasa/devices)
npm run test:run   # tests unitarios (vitest)
npm run lint
npm run build
```

## Arquitectura

- **Frontend:** Vite + React 18 + TypeScript + Tailwind + shadcn/ui, TanStack Query, react-router. `src/components/ui/` es código generado por shadcn.
- **Páginas:** `/` (pestañas Dashboard, Devices, Smart Home, Firewall, Users solo admin), `/profile`, `/auth`, `/forgot-password`, `/update-password`.
- **APIs del servidor de desarrollo:** plugins en `vite.config.ts`, disponibles **solo con `npm run dev`** (no existen en el build). Todas exigen un token Bearer de Supabase válido (401 sin sesión).
- **Código solo de Node** (sockets, procesos) va en `server/`, no en `src/`: `tsconfig.app.json` no incluye tipos de Node.
- Cliente: `src/lib/apiAuth.ts` agrega el token y convierte errores; `src/lib/scanApi.ts` y `src/lib/kasaApi.ts` usan esas funciones.

### Escaneo de red (`GET /api/scan`)

- Ejecuta nmap con `execFile` y `-sn -T4 -oX -` (solo descubrimiento, sin escaneo de puertos). Si hay peticiones simultáneas, comparten una sola ejecución.
- `src/utils/scanConfig.ts`: valida `SCAN_SUBNET`, resuelve la ruta de nmap, arma los argumentos y tiene utilidades de IP (pertenencia a subred, broadcast, orden).
- `src/utils/nmapParser.ts`: XML de nmap → `ScannedDevice[]`.
- `src/utils/inventory.ts` + `src/config/infrastructure.ts`: nombra la infraestructura conocida; si un equipo conocido no responde, aparece offline.

### Smart Home: TP-Link Kasa por LAN (`/api/kasa/devices`)

- Protocolo local de Kasa: JSON cifrado con XOR autokey (clave inicial 171) en el puerto 9999. Por TCP, cada mensaje lleva un prefijo de longitud de 4 bytes; por UDP no. No usa la nube ni credenciales.
- `GET /api/kasa/devices`: broadcast UDP `get_sysinfo` por cada subred de `SCAN_SUBNET` en la que esta PC tenga un adaptador, desde un socket enlazado a la IP de ese adaptador y hacia `255.255.255.255` (también al broadcast de la subred), 3 envíos en una ventana de 3 s.
  - En Windows solo esa combinación recibe respuestas. Verificado el 2026-09-14: con el socket sin enlazar, o enviando solo al broadcast de la subred, llegan 0 respuestas, porque hay varios adaptadores (OpenVPN, Npcap loopback).
  - Las subredes sin adaptador local se devuelven en `skippedSubnets` y la UI lo avisa.
  - A los interruptores ya vistos que no respondan se les pregunta por TCP; si siguen sin responder, se marcan offline con su último estado.
- `POST /api/kasa/devices/:ip/state` con `{ on?: boolean, brightness?: 1-100 }`: solo para IPs ya descubiertas dentro de `SCAN_SUBNET`; `brightness` solo en dimmers. Devuelve el estado que reporta el equipo después del cambio.
- `src/utils/kasaProtocol.ts`: cifrado, formato de mensajes, `parseSysinfo`, validación del body y comandos (código puro, con tests).
- `server/kasa.ts`: descubrimiento UDP y comandos TCP. `src/pages/SmartHome.tsx`: UI con un interruptor por equipo y slider de brillo para dimmers.
- **Privacidad:** `get_sysinfo` incluye la latitud y longitud de la casa. `parseSysinfo` copia solo los campos que usa la app; nunca reenviar el `sysinfo` crudo al navegador.
- **Equipos reales:** los comandos `set_*` encienden y apagan luces de verdad. No enviarlos desde scripts, pruebas ni verificaciones sin que el usuario lo pida explícitamente; para verificar, usar solo `get_sysinfo`.
- Soportados: interruptores `IOT.SMARTPLUGSWITCH` sin `children` (HS200, HS210, HS220 dimmer). Bulbs, power strips y Tapo/KLAP no están soportados.
- No agregar integraciones de ADT, Ring o Alexa sin una API real y usable: hasta donde sabemos no tienen API pública local o documentada para este uso.

### Supabase

- Auth, `profiles`, `user_roles` (el trigger `on_auth_user_created` → `handle_new_user` crea el perfil y hace admin al primer usuario registrado) y `firewall_rules`, todas con RLS. Migraciones en `supabase/migrations/`. `src/integrations/supabase/client.ts` y `types.ts` son generados.
- La función de timestamps se llama `public.update_updated_at()`.
- No crear otro trigger llamado `on_auth_user_created` ni reemplazar el existente: rompería el registro de usuarios.
- **Firewall:** las reglas solo se guardan en Supabase; no se aplican a ningún equipo de la red.
- **Secretos:** toda variable `VITE_*` termina en el JavaScript del navegador. Nunca poner client secrets, API keys privadas ni contraseñas en variables `VITE_*`; esos intercambios van en el servidor.

## Variables de entorno (`.env`, ignorado por git)

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (uso en navegador) |
| `SCAN_SUBNET` | Una o más subredes CIDR separadas por comas, de /16 a /32. La usan nmap y el descubrimiento Kasa |
| `NMAP_PATH` | Opcional. Ruta a nmap si no está en la ubicación estándar |

## Red real (verificado 2026-09-14)

- LAN actual: `172.16.40.0/24`. PC de desarrollo: `172.16.40.100` (Ethernet 4).
- `192.168.254.x` es el adaptador de OpenVPN: no es la red de casa y no se escanea.
- Infraestructura: gateway Nokia de AT&T en `.1`; Netgear WAX615 en `.250` y `.251` (no está confirmado cuál es AP1 y cuál AP2).
- Un escaneo nmap del /24 tarda ~22 s y encontró ~31 dispositivos.
- Kasa: 11 interruptores con protocolo local (1 HS220 dimmer, 6 HS200, 4 HS210). El descubrimiento UDP los encuentra todos; nmap solo reconoce algunos como TP-Link.
- Otros equipos vistos en el escaneo: Resideo (`.10`) y August Home (`.87`); todavía sin integración.
- La topología planificada (Linksys MR7200 en `.254`, VLAN 10/20/30 en `172.16.50/60/70.0/24`) todavía **no** está implementada. Cuando exista, agregar esas subredes a `SCAN_SUBNET` y los equipos a `src/config/infrastructure.ts`. Con VLANs y Client Isolation, el broadcast UDP de Kasa no cruza entre subredes.
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
- El estado de los Kasa "offline" vive en memoria del servidor de desarrollo; se pierde al reiniciarlo.

## Flujo de trabajo

- Cambios en una rama y luego Pull Request hacia `main`.
- Mensajes de commit en inglés.
