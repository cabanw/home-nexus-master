# CLAUDE.md

## Proyecto

NetControl Pro (repo `cabanw/home-nexus-master`): app React para descubrir los dispositivos de la red local con nmap y administrar reglas de firewall y usuarios en Supabase.

## Regla principal: cero mock data

- Todo lo que muestra la app debe venir de una fuente real: el escaneo nmap (`GET /api/scan`) o Supabase.
- Prohibido: arrays de datos inventados, métricas o porcentajes fijos, timestamps falsos, acciones simuladas con `setTimeout`/`setInterval`, y botones "Save" que no guardan nada.
- Si una función todavía no tiene fuente real, no se muestra. No se deja un placeholder con valores de ejemplo.
- Única excepción: dobles de prueba (`vi.mock`, fixtures) dentro de `src/test/` para los tests unitarios.

## Comandos

```bash
npm run dev        # http://localhost:8080 (incluye /api/scan)
npm run test:run   # tests unitarios (vitest)
npm run lint
npm run build
```

## Arquitectura

- **Frontend:** Vite + React 18 + TypeScript + Tailwind + shadcn/ui, TanStack Query, react-router. `src/components/ui/` es código generado por shadcn.
- **Páginas:** `/` (Dashboard, Devices, Firewall, Users solo admin), `/profile`, `/auth`, `/forgot-password`, `/update-password`.
- **Escaneo de red:** un plugin en `vite.config.ts` expone `GET /api/scan` **solo con `npm run dev`** (no existe en el build).
  - Exige un token Bearer de Supabase válido (401 sin sesión).
  - Ejecuta nmap con `execFile` y `-sn -T4 -oX -` (solo descubrimiento, sin escaneo de puertos). Si hay peticiones simultáneas, comparten una sola ejecución.
  - `src/utils/scanConfig.ts`: valida `SCAN_SUBNET`, resuelve la ruta de nmap y arma los argumentos.
  - `src/utils/nmapParser.ts`: XML de nmap → `ScannedDevice[]`.
  - `src/utils/inventory.ts` + `src/config/infrastructure.ts`: nombra la infraestructura conocida; si un equipo conocido no responde, aparece offline.
  - Cliente: `src/lib/scanApi.ts` (`fetchScan`, `SCAN_QUERY_KEY`), compartido por Dashboard y Devices.
- **Supabase:** auth, `profiles`, `user_roles` (el trigger `handle_new_user` hace admin al primer usuario registrado) y `firewall_rules`, todas con RLS. Migraciones en `supabase/migrations/`. `src/integrations/supabase/client.ts` y `types.ts` son generados.
- **Firewall:** las reglas solo se guardan en Supabase; no se aplican a ningún equipo de la red.

## Variables de entorno (`.env`, ignorado por git)

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (uso en navegador) |
| `SCAN_SUBNET` | Una o más subredes CIDR separadas por comas, de /16 a /32 |
| `NMAP_PATH` | Opcional. Ruta a nmap si no está en la ubicación estándar |

## Red real (verificado 2026-09-14)

- LAN actual: `172.16.40.0/24`. PC de desarrollo: `172.16.40.100` (Ethernet 4).
- `192.168.254.x` es el adaptador de OpenVPN: no es la red de casa y no se escanea.
- Infraestructura: gateway Nokia de AT&T en `.1`; Netgear WAX615 en `.250` y `.251` (no está confirmado cuál es AP1 y cuál AP2).
- Un escaneo del /24 tarda ~22 s y encontró ~31 dispositivos.
- La topología planificada (Linksys MR7200 en `.254`, VLAN 10/20/30 en `172.16.50/60/70.0/24`) todavía **no** está implementada. Cuando exista, agregar esas subredes a `SCAN_SUBNET` y los equipos a `src/config/infrastructure.ts`.

## Entorno Windows

- nmap 7.80 (32 bits) en `C:\Program Files (x86)\Nmap\nmap.exe`, fuera del PATH. Necesita Visual C++ 2013 **x86** (`winget install Microsoft.VCRedist.2013.x86`).
- Npcap 0.9982 permite usarlo sin admin (`AdminOnly = 0`), así que nmap obtiene MACs sin elevar permisos.
- `./nmap` en la raíz es un binario Linux x86-64; solo sirve en Linux.
- El proyecto está dentro de OneDrive: `node_modules` puede sincronizarse lento.

## Supabase

- Proyecto `psjfmqxngodknlyctelx`, plan gratis: se pausa tras días sin actividad.
- Las 5 migraciones se aplicaron a mano por SQL Editor el 2026-09-14 y no están registradas en `supabase_migrations`. Antes de usar `supabase db push`, marcarlas con `supabase migration repair --status applied <id>`.

## Estado conocido

- `tsc` ya reportaba errores antes de estos cambios en `src/components/ui/sidebar.tsx`, `src/components/ui/toggle-group.tsx`, `xml2js` sin tipos y `test.deps` en `vite.config.ts`. No son regresiones.
- No hay historial de dispositivos: offline solo se detecta para la infraestructura conocida. Siguiente fase: tabla `devices` en Supabase.

## Flujo de trabajo

- Cambios en una rama y luego Pull Request hacia `main`.
- Mensajes de commit en inglés.
