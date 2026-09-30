# Plan 001: Radicación en línea de subsidios en especie

- **Spec:** [spec.md](spec.md) (aprobada, rev. 3: 65 FR · 13 NFR · 63 AC)
- **Fecha:** 2026-09-29 · **Estado:** aprobado
- **Restricciones del proyecto:**
  - Amplify Gen 2 (TypeScript) + React.
  - Cuenta AWS personal en Free plan, región `us-east-1`; los comandos usan el perfil de `AWS_PROFILE`.
  - Sin recursos con costo fijo por hora (NFR-3; además la cuenta se cierra si se agotan los créditos).

---

## 1. Decisiones técnicas (mini-ADR)

### ADR-1: Plataforma de backend
- **Elegida:** Amplify Gen 2, con extensiones CDK en `amplify/backend.ts` para lo que Amplify no modela directamente: tabla de control, stream, DLQ, alarmas, EventBridge y SNS.
- **Descartadas:**
  - CDK puro o Terraform: más control, pero más código propio para auth, API, storage y hosting, que Amplify ya resuelve.
  - Amplify Gen 1: en mantenimiento hasta el 1 may 2027; Gen 2 es la línea actual.
- **Por qué:** Amplify da auth, API, datos, storage, funciones y hosting con CI/CD por rama con un solo pipeline. CDK cubre lo que falta sin salir del proyecto.
- **Consecuencias:**
  - Todo es CloudFormation generado; hay que cuidar las dependencias circulares entre stacks usando `resourceGroupName` en las funciones.
  - Se acopla a AppSync y DynamoDB.

### ADR-2: Escrituras por comandos, lecturas por modelos (CQRS liviano)
- **Elegida:**
  - Toda escritura de negocio es una **mutación personalizada** (`a.mutation().handler(a.handler.function(...))`) atendida por Lambda en TypeScript, que valida reglas y escribe en DynamoDB con el SDK.
  - Los modelos de Amplify Data se exponen **solo para lectura**: sus mutaciones y suscripciones generadas se deshabilitan.
- **Descartadas:**
  - CRUD generado con reglas `owner` / `group`: no puede expresar "solo el analista asignado decide", transiciones de estado válidas ni cupos. Además un dueño podría modificar campos como `estado`.
  - Resolvers JS de AppSync (`a.handler.custom`): sirven para una escritura condicional sobre un ítem, pero las transacciones entre tablas, la consulta al core y la lógica de días hábiles quedan difíciles de probar.
- **Por qué:** las reglas de negocio viven en código TypeScript puro, probable con Vitest sin AWS. La autorización se aplica **dos veces**: el grupo en el esquema de AppSync y la propiedad o asignación dentro del comando (FR-10, NFR-5).
- **Consecuencias:**
  - Escribir en DynamoDB fuera de AppSync implica llenar a mano `createdAt`, `updatedAt` y `__typename`, y no dispara suscripciones de AppSync (no se necesitan: la spec no pide tiempo real).
  - Hay que verificar en la Fase 0 el formato del campo dueño con `identityClaim('sub')` (riesgo R-1).

### ADR-3: Unicidad, cupo y concurrencia
- **Elegida:** `TransactWriteItems` de DynamoDB con **ítems de bloqueo** y **contadores** con `ConditionExpression`:
  - `LOCK#KIT#<conv>#<docBeneficiario>`: un kit por niño (FR-20, AC-19/20).
  - `LOCK#PC#<conv>#<docAfiliado>`: un computador por afiliado (FR-23).
  - Asignación con `attribute_not_exists(analistaAsignado) AND estado = RADICADA` (FR-34, AC-34).
  - Cupo con `aprobadosPC < cupoPC` en el ítem de convocatoria, en la misma transacción que la aprobación (FR-48/49, AC-49).
  - Consecutivo de radicado con `ADD` atómico (FR-27).
  - Al rechazar o desistir, la transacción borra el bloqueo para permitir re-radicar (Q8).
- **Descartadas:**
  - Validar antes de escribir (leer y luego escribir): tiene condiciones de carrera y viola NFR-7.
  - PostgreSQL (RDS o Aurora) con restricciones `UNIQUE` y `SELECT … FOR UPDATE`: es la solución relacional natural, pero RDS tiene costo por hora (viola NFR-3) y Aurora Serverless v2 con pausa a 0 ACU tiene reanudación en frío de segundos. Queda como alternativa si la reportería relacional crece.
- **Por qué:** atomicidad real sin servidor fijo; la condición la evalúa DynamoDB, no el código.
- **Consecuencias:**
  - Las transacciones cuestan el doble en unidades de capacidad (irrelevante a este volumen).
  - Los errores `TransactionCanceledException` se traducen a mensajes de negocio.

### ADR-4: Almacenamiento de datos
- **Elegida:**
  - Modelos de Amplify Data (tablas DynamoDB on-demand): `Convocatoria`, `Solicitud`, `EventoHistorial` y `Festivo`.
  - Una tabla **`Control`** creada con CDK, no expuesta por la API: bloqueos, contadores y reservas de documento.
- **Descartadas:**
  - Single-table design para todo: más eficiente, pero opaco para aprender y explicar, y pelea con Amplify Data.
  - Poner los bloqueos como modelos: quedarían expuestos en el esquema GraphQL.
- **Consecuencias:** las Lambdas reciben los nombres de las tablas por variable de entorno desde `backend.ts`, con permisos mínimos por tabla y acción.

### ADR-5: Integración con el core simulado
- **Elegida:** **puerto** `CoreAfiliaciones` (interfaz TypeScript: `consultarAfiliado(doc)` y `listarBeneficiarios(doc)`) con el **adaptador** `CoreSimulado`, que lee un dataset JSON versionado en el repo (NFR-13). Todas las funciones dependen del puerto, no del adaptador.
- **Descartadas:**
  - Tabla DynamoDB con datos del core: agrega escritura y siembra sin aportar al objetivo.
  - API simulada externa (una Lambda con URL): más realista, pero añade red y autenticación sin aportar a la demo.
- **Por qué:** cumple NFR-10 de forma demostrable: la prueba de contrato corre contra `CoreSimulado` y contra un `CoreFake` distinto.
- **Consecuencias:** el día del core real se agrega un adaptador `CoreHttp` y cambia la inyección en un solo punto.

### ADR-6: Registro del afiliado con validación del core
- **Elegida:** `<Authenticator>` de Amplify UI con campos adicionales (documento y aceptación de la autorización de datos) y dos triggers de Cognito:
  - **`preSignUp`:**
    1. Consulta el core (FR-1/2/3).
    2. Crea una **reserva** `DOC#<documento>` en `Control` con condición `attribute_not_exists OR (estado = PENDIENTE AND ttl < ahora)` y TTL de 24 h (FR-5).
    3. Valida que se aceptó la autorización (FR-6).
  - **`postConfirmation`:** marca la reserva como `CONFIRMADA`, guarda la fecha y versión de la autorización y agrega al usuario al grupo `AFILIADO`.
- **Atributos:** `custom:documento` (inmutable) y `custom:autorizacionDatos` (versión).
- **Descartadas:**
  - Validar solo en el frontend: evitable desde la API de Cognito.
  - Validar después del registro: deja cuentas inválidas creadas.
- **Consecuencias:** si el usuario nunca confirma el correo, la reserva expira a las 24 h y el documento queda libre.

### ADR-7: MFA solo para funcionarios
- **Elegida:** user pool con MFA **OPTIONAL** (TOTP) y un trigger **`preTokenGeneration`**:
  - Si el usuario pertenece a `ANALISTA` o `COORDINADOR` y **no tiene TOTP configurado** (consulta `AdminGetUser`), el token se emite **sin grupos**.
  - Así, el funcionario sin MFA no tiene ningún permiso de funcionario ni en AppSync ni en S3; el frontend lo lleva a la pantalla de configuración TOTP (`setUpTOTP`).
  - Una vez configurado como preferido, Cognito exige el código en cada ingreso (FR-9).
- **Descartadas:**
  - MFA REQUIRED para todos: castiga a 38.000 afiliados.
  - Dos user pools (afiliados y funcionarios): aislamiento limpio, pero AppSync y Amplify Data trabajan con un pool por defecto; se reserva para la federación con Microsoft 365 (fuera de alcance).
- **Consecuencias:**
  - La regla se hace cumplir en el servidor, no en la UI.
  - Los funcionarios los crea TI con un script (FR-8) que usa `AdminCreateUser` y `AdminAddUserToGroup`.

### ADR-8: Notificaciones desacopladas y con reintentos
- **Elegida:**
  - **DynamoDB Stream** de `Solicitud` → Lambda **`notificador`**, que detecta el cambio de estado y arma una `Notificacion` → la despacha a los **adaptadores de canal** registrados (hoy `CanalCorreo` con SES).
  - El event source mapping tiene reintentos, *bisect on error* y **destino en caso de falla a una SQS DLQ con alarma** (FR-53/54, NFR-9/11).
- **Descartadas:**
  - Enviar el correo dentro del comando: acopla y viola FR-54 (una falla del correo afectaría la decisión).
  - SNS o EventBridge intermedio: válido, pero una capa más sin beneficio en esta versión.
- **Por qué:** el cambio de estado queda confirmado antes de notificar; agregar SMS o WhatsApp es registrar otro adaptador.
- **Consecuencias:**
  - SES empieza en **sandbox**: solo envía a correos verificados. Para la demo se verifican los correos de prueba; en producción se pide salida del sandbox (riesgo R-4).
  - El stream entrega al menos una vez, así que el notificador es **idempotente**: clave `solicitudId#estado#version`.

### ADR-9: Procesos programados
- **Elegida:** una función **`vencimientos`** con `schedule` diario a las **00:05 America/Bogotá** (05:05 UTC). Hace tres cosas:
  1. Rechaza las `DEVUELTA` con fecha límite vencida (FR-44).
  2. Cierra la convocatoria vencida y rechaza su lista de espera (FR-15).
  3. Verifica el calendario de festivos del año y alerta a TI si falta (FR-65).
- **Descartadas:** EventBridge Scheduler con un schedule por solicitud. Es más preciso, pero crea miles de schedules y la spec define el vencimiento "al terminar el día".
- **Consecuencias:** latencia máxima de 5 minutos después de medianoche. Las alertas de meta (FR-51) se calculan **al consultar**, no en el barrido.

### ADR-10: Soportes con POST prefirmado emitido por el servidor
- **Elegida:** el bucket se define con `defineStorage`, **sin acceso directo del cliente** a los soportes.
  - El comando `solicitarCargaSoporte(nombre, tipo, tamaño)` valida y devuelve un **POST prefirmado de S3** con condiciones `content-length-range ≤ 5 MB` y `Content-Type` en {PDF, JPG, PNG} y una clave `pendientes/<sub>/<uuid>`.
  - `radicarSolicitud` verifica con `HeadObject` que cada clave exista, sea del llamador, tenga el tamaño y tipo permitidos y que sean como máximo 3. Luego las mueve a `solicitudes/<id>/`.
  - La lectura (analista, coordinador o dueño) es con `urlSoporte`, que devuelve una **URL GET prefirmada de 5 minutos** tras verificar la autorización (FR-37, NFR-5).
  - El trigger `onUpload` del bucket publica `soporte.cargado` en EventBridge (FR-58).
- **Descartada:** Amplify Storage desde el cliente (`uploadData` con `{entity_id}`). Es más simple, pero el tamaño y el tipo solo se validarían en el navegador, y el servidor no puede comprobar con facilidad que la clave del identity id pertenece al usuario de AppSync.
- **Consecuencias:** S3 impone los límites (FR-25/26) y el servidor controla las rutas; es más código que `uploadData`.

### ADR-11: Frontend
- **Elegida:** React 19 + Vite + TypeScript, `aws-amplify` v6, `@aws-amplify/ui-react` (Authenticator y componentes accesibles) y `react-router`. Tres áreas por rol:
  - `/afiliado`: radicar, mis solicitudes, corregir.
  - `/analista`: bandeja, revisión.
  - `/coordinador`: tablero, preaprobadas, alertas, convocatoria, historial.
- **Descartadas:**
  - Next.js: el SSR no aporta detrás de un login y suma piezas móviles.
  - Una librería de UI adicional: Amplify UI ya trae accesibilidad y responsive (NFR-8).
- **Consecuencias:** las rutas solo organizan la UI; la seguridad está en el servidor.

### ADR-12: Ambientes y CI/CD
- **Elegida:** repo propio en GitHub (`sergioaramos/family-subsidy-portal`), conectado a Amplify Hosting:
  - la rama **`dev`** es el ambiente de desarrollo;
  - la rama **`main`** es el ambiente de demostración;
  - cada rama tiene su backend completo (NFR-12);
  - además, un `npx ampx sandbox` local por desarrollador.
- **Consecuencias:** dos copias de todos los recursos. En Free plan el costo es marginal porque todo es por uso.

### ADR-13: Pruebas
- **Elegida:**
  - **Vitest** para el dominio puro (reglas, días hábiles, máquina de estados, SLA).
  - **Vitest + DynamoDB Local** (Docker) para los comandos, incluida la concurrencia real con `Promise.all`.
  - **Playwright** end-to-end contra el sandbox para los flujos por rol y las llamadas directas a GraphQL (AC-9).
  - **k6** para una prueba de carga corta y acotada (NFR-1/2).
- **Descartada:** mocks del SDK de DynamoDB para probar la concurrencia: no prueban las condiciones reales.
- **Consecuencias:** hace falta Docker para las pruebas de integración (ya está instalado).

### ADR-14: Tiempo y zona horaria
- **Elegida:** toda fecha de negocio (radicación, límites, días hábiles) la calcula el **servidor** en `America/Bogota`; se guarda en ISO-8601 con zona.
- **Consecuencias:** el reloj del cliente no influye; las pruebas inyectan un reloj (`Clock`) para fijar fechas como el 7 de enero de 2027.

---

## 2. Arquitectura del cambio

```
                              ┌──────────────── Amplify Hosting (CloudFront) ─ ramas dev / main ─┐
 Afiliado / Analista /  ────▶ │ React SPA  (Authenticator · /afiliado · /analista · /coordinador) │
 Coordinador                  └───────────────┬───────────────────────────────┬───────────────────┘
                                              │ JWT (Cognito)                 │ POST/GET prefirmado
                              ┌───────────────▼──────────────┐         ┌──────▼──────────────────┐
                              │ Cognito User Pool            │         │ S3 (defineStorage)      │
                              │ grupos AFILIADO/ANALISTA/    │         │ pendientes/  solicitudes/│
                              │ COORDINADOR · MFA OPTIONAL   │         └──────┬──────────────────┘
                              │ triggers: preSignUp,         │                │ onUpload
                              │ postConfirmation,            │                ▼
                              │ preTokenGeneration           │         EventBridge "soporte.cargado"
                              └───────────────┬──────────────┘         (sin consumidor aún, FR-58)
                                              ▼
                              ┌──────────────────────────────┐
                              │ AppSync (Amplify Data)       │
                              │ queries de modelos (lectura) │
                              │ + mutaciones/queries custom  │
                              └──────┬───────────────┬───────┘
                                     │               │
                     ┌───────────────▼───┐   ┌───────▼────────────┐
                     │ λ comandos        │   │ λ consultas        │──▶ Puerto CoreAfiliaciones
                     │ (router fieldName)│   │ (beneficiarios,    │    └─ CoreSimulado (JSON)
                     └───────┬───────────┘   │ core, alertas, URL)│
                             │ TransactWrite └────────────────────┘
          ┌──────────────────▼─────────────────────────────────────┐
          │ DynamoDB: Convocatoria · Solicitud · EventoHistorial ·  │
          │           Festivo · Control (bloqueos/contadores)       │
          └──────────────────┬─────────────────────────────────────┘
                             │ Stream (Solicitud)
                     ┌───────▼────────┐  falla  ┌──────────┐   ┌──────────────┐
                     │ λ notificador  │────────▶│ SQS DLQ  │──▶│ Alarma → SNS │──▶ correo TI
                     │ → CanalCorreo  │         └──────────┘   └──────────────┘
                     │   (SES)        │
                     └────────────────┘
   λ vencimientos (diaria 00:05 Bogotá) ── rechaza devueltas vencidas · cierra convocatoria · revisa festivos
```

### Contratos de la API (GraphQL) y quién los consume
| Operación | Tipo | Grupos | Consumidor | Requisitos |
|---|---|---|---|---|
| `listSolicitudByOwner` (índice) | query de modelo | dueño (`sub`) | `/afiliado` | FR-28, FR-29 |
| `listSolicitudByEstado` (índice `estado` + `fechaRadicacion`) | query de modelo | ANALISTA, COORDINADOR | bandeja, preaprobadas | FR-32, FR-47 |
| `getConvocatoriaAbierta` | query de modelo | autenticados | todas | FR-12, FR-46 |
| `listEventoHistorialBySolicitud` | query de modelo; `actor` solo COORDINADOR | dueño, COORDINADOR | detalle | FR-57, FR-63 |
| `misBeneficiarios` | query custom | AFILIADO | radicar | FR-16 |
| `consultaCore(solicitudId)` | query custom | ANALISTA (asignado), COORDINADOR | revisión | FR-37 |
| `urlSoporte(solicitudId, clave)` | query custom | dueño, analista asignado, COORDINADOR | detalle | FR-37, NFR-5 |
| `alertasServicio` | query custom | COORDINADOR | tablero | FR-51 |
| `listarAnalistas` | query custom | COORDINADOR | reasignar | FR-50 |
| `solicitarCargaSoporte` | mutación | AFILIADO | radicar, corregir | FR-25, FR-26 |
| `radicarSolicitud` | mutación | AFILIADO | radicar | FR-17 a FR-24, FR-27 |
| `desistirSolicitud` · `reenviarCorreccion` | mutación | AFILIADO (dueño) | detalle | FR-31, FR-30, FR-59 |
| `tomar` · `liberar` · `aprobar` · `rechazar` · `devolver` | mutación | ANALISTA (asignado) | revisión | FR-33 a FR-43 |
| `aprobarComputador` · `rechazarPreaprobada` · `reasignar` | mutación | COORDINADOR | coordinador | FR-48 a FR-50, FR-61, FR-62 |
| `crearConvocatoria` · `ajustarCupo` | mutación | COORDINADOR | coordinador | FR-11, FR-13, FR-14, FR-64 |

Contratos internos:
- el puerto `CoreAfiliaciones`;
- la interfaz `CanalNotificacion { nombre; enviar(notificacion) }`;
- el evento EventBridge `soporte.cargado`, con `source: subsidios.radicacion` y `detail: { solicitudId?, clave, tamaño, tipo }`.

---

## 3. Modelo de datos
DynamoDB, sin DDL relacional: no aplica `/db-change`. Todas las tablas son on-demand y tienen PITR activado en la rama `main`.

**`Solicitud`** (modelo; mutaciones y suscripciones deshabilitadas)
- **Campos:**
  - `id`, `radicado`, `convocatoriaId`
  - `tipo` (KIT_ESCOLAR | COMPUTADOR), `estado` (7 valores)
  - `owner` (sub del afiliado), `afiliadoDocumento`, `afiliadoNombre`, `categoria`
  - `beneficiarioDocumento`, `beneficiarioNombre`, `beneficiarioFechaNacimiento`
  - `soportes` (lista de claves S3)
  - `analistaAsignado` (sub), `devuelta` (bool), `indicacionCorreccion`, `fechaLimiteCorreccion`
  - `diasMetaAcumulados`, `inicioConteoMeta`
  - `motivoRechazo`, `observacion`
  - `fechaRadicacion`, `version`
- **Índices:** `estado + fechaRadicacion` (bandeja y preaprobadas), `owner + fechaRadicacion` (afiliado), `analistaAsignado + fechaRadicacion`, `estado + fechaLimiteCorreccion` (barrido de vencimientos).
- **Autorización:** `allow.owner().identityClaim('sub').to(['read'])` y `allow.groups(['ANALISTA','COORDINADOR']).to(['read'])`.
- **Stream:** `NEW_AND_OLD_IMAGES`.

**`Convocatoria`** (modelo, solo lectura)
- `id`, `nombre`, `apertura`, `cierre`, `estado` (PROGRAMADA | ABIERTA | CERRADA), `cupoPC`, `aprobadosPC`, `preaprobadosPC`, `conteos` (JSON por estado y tipo, actualizado en cada transacción: FR-52 sin *scan*).
- Lectura: autenticados.
- El ítem `CONVOCATORIA_ACTIVA` en `Control` garantiza una sola abierta (FR-64).

**`EventoHistorial`** (modelo, solo lectura)
- `id`, `solicitudId`, `fecha`, `tipoEvento`, `estadoAnterior`, `estadoNuevo`, `observacion`, `owner`, `actor`.
- `actor` tiene autorización de campo: solo COORDINADOR (FR-63).
- Índice `solicitudId + fecha`.
- **Inmutable (FR-56):**
  - no hay mutaciones en la API;
  - el rol de las Lambdas solo tiene `PutItem` con `attribute_not_exists(id)` sobre esta tabla, sin `UpdateItem` ni `DeleteItem`.

**`Festivo`** (modelo, solo lectura)
- `fecha` (identificador), `nombre`.
- Lo carga TI con el script `scripts/cargar-festivos.ts` (2026–2027 de Colombia).

**`Control`** (CDK, no expuesta)
- Clave `pk`, atributo `ttl`.
- Ítems:
  - `DOC#<doc>`: reserva o confirmación de registro;
  - `LOCK#KIT#<conv>#<docBenef>` y `LOCK#PC#<conv>#<docAfil>`: bloqueos de unicidad;
  - `SEQ#<año>`: consecutivo de radicado;
  - `CONVOCATORIA_ACTIVA`;
  - `NOTIF#<solicitudId>#<estado>#<version>`: idempotencia del notificador, con TTL de 7 días.

---

## 4. Cambios por archivo o módulo (repo nuevo)
```
amplify/
  backend.ts                 defineBackend + CDK: tabla Control, stream→notificador, DLQ, alarmas, SNS alertas-ti,
                             EventBridge, variables de entorno y permisos mínimos por función
  auth/resource.ts           email login, custom:documento, custom:autorizacionDatos, grupos, MFA OPTIONAL TOTP, triggers
  auth/pre-sign-up/          valida core + reserva DOC# (ADR-6)
  auth/post-confirmation/    confirma reserva + grupo AFILIADO
  auth/pre-token-generation/ quita grupos a funcionarios sin TOTP (ADR-7)
  data/resource.ts           modelos (solo lectura) + queries/mutaciones custom con autorización por grupo
  storage/resource.ts        bucket de soportes + trigger onUpload
  functions/comandos/        router por fieldName → casos de uso
  functions/consultas/       beneficiarios, consultaCore, urlSoporte, alertasServicio, listarAnalistas
  functions/notificador/     stream → Notificacion → canales (CanalCorreo/SES)
  functions/vencimientos/    barrido diario (ADR-9)
  functions/on-upload/       publica soporte.cargado
  shared/dominio/            reglas de elegibilidad, máquina de estados, días hábiles, SLA (puro, sin AWS)
  shared/puertos/            CoreAfiliaciones, Repositorio, CanalNotificacion, Clock
  shared/adaptadores/        CoreSimulado (+ datos/core-simulado.json), RepositorioDynamo, CanalCorreoSes
src/                         React: rutas por rol, páginas, hooks de datos, componentes
scripts/                     crear-funcionario.ts, cargar-festivos.ts, sembrar-demo.ts
tests/unit · tests/integration (DynamoDB Local) · e2e (Playwright) · load (k6)
amplify.yml                  build con pipeline-deploy + npm test en preBuild
README.md                    qué es, arquitectura, cómo correr, decisiones (portafolio)
```

---

## 5. Fases (primero de punta a punta, luego lo difícil)
| Fase | Entrega | Criterio de "hecha" |
|---|---|---|
| **F0 Base** | Repo, Vite + React, Amplify Gen 2 en sandbox, Hosting con ramas `dev` y `main`, Vitest y DynamoDB Local, **pruebas técnicas de los riesgos R-1, R-2 y R-3** | Las dos URL responden y el pipeline corre las pruebas |
| **F1 Esqueleto de punta a punta** | Registro con core simulado; radicar KIT con un soporte; el afiliado ve su estado; analista (por script) con bandeja, tomar y aprobar o rechazar; desplegado en `main` | Demo del flujo feliz completo en la URL pública |
| **F2 Radicación completa** | Todas las validaciones, COMPUTADOR, bloqueos atómicos, consecutivo de radicado, soportes con POST prefirmado, desistir, re-radicar | Pruebas de integración de concurrencia en verde (AC-20) |
| **F3 Revisión completa** | Liberar, devolver una vez, corrección al mismo analista, días hábiles con festivos, pausa de la meta, barrido diario | AC-44 y AC-58 en verde con reloj inyectado |
| **F4 Coordinación y cupo** | Convocatoria única, ajuste de cupo, preaprobadas en orden, aprobación atómica, reasignar, alertas, tablero | AC-49 en verde (dos coordinadores concurrentes) |
| **F5 Transversales** | Notificador con SES, DLQ y alarmas; historial inmutable con actor oculto; MFA de funcionarios; evento `soporte.cargado` | AC-54, AC-56, AC-8 y AC-57 en verde |
| **F6 Endurecimiento** | E2E de autorización directa (AC-9), carga con k6, accesibilidad, README con diagrama, limpieza de costos | Matriz completa en verde; sandbox borrado |

---

## 6. Estrategia de pruebas
| Capa | Herramienta | Qué cubre | Casos borde clave |
|---|---|---|---|
| **U: Unidad** | Vitest | `shared/dominio`: elegibilidad por edad y categoría, transiciones de estado válidas, días hábiles, fecha límite, SLA y pausa, formato de radicado | Edades 4/5/9/10/17/18 y cumpleaños el mismo día de la radicación; festivos que caen en lunes; año sin festivos; fin de año (31 dic → 2 ene) |
| **I: Integración** | Vitest + DynamoDB Local (Docker) | Casos de uso de `comandos` y `vencimientos` con tablas reales, el core simulado y el reloj inyectado | **Concurrencia real** con `Promise.all`: dos radicaciones del mismo niño, dos tomas, dos aprobaciones por el último cupo; reintento idempotente del notificador |
| **C: Contrato** | Vitest | El puerto `CoreAfiliaciones` contra `CoreSimulado` y `CoreFake` (NFR-10); `CanalNotificacion` con un canal de prueba (NFR-11) | Afiliado inexistente, beneficiario sin fecha de nacimiento |
| **E: Extremo a extremo** | Playwright contra el sandbox | Flujos por rol en el navegador y **llamadas GraphQL directas** con tokens de cada rol (AC-9, AC-35, AC-56) | Funcionario sin TOTP; enlace de soporte expirado |
| **L: Carga** | k6, 10 minutos | NFR-1 y NFR-2 en la rama `dev`, con un perfil de 1.500 radicaciones por hora escalado y acotado para cuidar los créditos | p95, errores 5xx, *throttling* |
| **M: Manual o revisión** | Checklist | Correo real recibido en SES, auditoría de accesibilidad (Lighthouse/axe), revisión de costos (NFR-3) y de seguridad (agente `security-reviewer`) | Vista en 375 px |

El pipeline de Amplify corre las pruebas U, C e I en `preBuild`; si fallan, no se despliega.

---

## 7. Riesgos y mitigaciones
| # | Riesgo | Mitigación |
|---|---|---|
| R-1 | El formato del campo `owner` con `identityClaim('sub')` al escribir desde Lambda no coincide con lo que AppSync espera | Prueba técnica en F0: escribir con el SDK y leer con el token del dueño. Plan B: resolver la lectura del afiliado con una query custom |
| R-2 | `disableOperations` o el nombre exacto de la API difiere en la versión instalada | Prueba técnica en F0. Plan B: autorización del modelo solo `.to(['read'])` para todos, que igualmente impide escribir |
| R-3 | `preTokenGeneration` que quita grupos rompe el flujo de configuración TOTP de Amplify UI | Prueba técnica en F0 con un funcionario de prueba. Plan B: exigir TOTP en la primera sesión con la configuración del lado del cliente, más la verificación en cada comando de funcionario |
| R-4 | SES en sandbox: solo envía a correos verificados | Verificar los correos de la demo; documentar la solicitud de salida del sandbox como paso de producción |
| R-5 | Dependencias circulares entre stacks (funciones de auth y data que usan tablas) | `resourceGroupName` explícito por función; la tabla `Control` en su propio stack |
| R-6 | Consumo de créditos del Free plan (builds de Hosting, dos ambientes, k6) | Presupuesto de USD 5 con alertas; carga acotada a 10 minutos; `sandbox delete` al cerrar el día |
| R-7 | Zona horaria o reloj del servidor mal manejados (fechas límite corridas un día) | Todo con `Clock` inyectado y `America/Bogota`; pruebas con fechas fijas (ADR-14) |
| R-8 | El alcance es grande para el tiempo de preparación | Fases F0–F6: al terminar F1 hay algo demostrable; F2–F5 suben de nivel sin romper lo anterior |

## 8. Rollback
- **Frontend y backend por rama:**
  - Amplify Hosting permite **volver a desplegar un build anterior** desde la consola.
  - O `git revert` en la rama, y el pipeline redespliega el backend de esa rama con CloudFormation.
- **Datos:**
  - PITR en las tablas de `main` permite restaurar a un punto en el tiempo.
  - Los cambios de esquema de Amplify Data son aditivos en este plan.
  - Renombrar o borrar un índice o una tabla es destructivo: requiere nota explícita en la tarea y confirmación.
- **Sandbox:** `npx ampx sandbox delete --profile $AWS_PROFILE` elimina todo el ambiente personal.
- **Emergencia de costos:** borrar la app de Amplify Hosting (quedan los dos backends) y los stacks de CloudFormation. La cuenta es de aprendizaje: no hay datos reales.

---

## 9. Análisis de consistencia (spec ↔ plan)
Capas de prueba: **U** unidad · **I** integración · **C** contrato · **E** extremo a extremo · **L** carga · **M** manual o revisión.

### Requisitos funcionales
| FR | Decisión del plan | Prueba prevista |
|---|---|---|
| FR-1 | `preSignUp` consulta el puerto `CoreAfiliaciones` (ADR-5/6) | I · AC-1 |
| FR-2 | `preSignUp` permite el alta; `postConfirmation` agrega el grupo AFILIADO | I, E · AC-1 |
| FR-3 | `preSignUp` lanza un error con mensaje genérico | I · AC-3 |
| FR-4 | Verificación de correo nativa de Cognito | E · AC-4 |
| FR-5 | Reserva `DOC#` condicional con TTL (ADR-6) | I · AC-5 |
| FR-6 | Campo del Authenticator + validación en `preSignUp` + `custom:autorizacionDatos` | I, E · AC-1, AC-2 |
| FR-7 | `postConfirmation` solo agrega AFILIADO; no hay operación pública para otros grupos | E · AC-6 |
| FR-8 | `scripts/crear-funcionario.ts` (AdminCreateUser + grupo) | M · AC-7 |
| FR-9 | MFA OPTIONAL TOTP + `preTokenGeneration` (ADR-7) | E · AC-8 |
| FR-10 | Grupo en el esquema + verificación de propiedad y asignación en cada comando (ADR-2) | E · AC-9 |
| FR-11 | `crearConvocatoria` | I · AC-10 |
| FR-12 | `radicarSolicitud` verifica convocatoria ABIERTA y fechas | I · AC-11 |
| FR-13 | `ajustarCupo` solo para COORDINADOR | I, E · AC-12, AC-9 |
| FR-14 | Condición `nuevoCupo >= aprobadosPC` | I · AC-13 |
| FR-15 | `vencimientos` cierra la convocatoria y rechaza PREAPROBADA | I · AC-14 |
| FR-16 | `misBeneficiarios` vía el puerto del core | I · AC-15 |
| FR-17 | `radicarSolicitud` consulta el core en ese momento | I · AC-16, AC-17 |
| FR-18 | Regla de dominio `afiliadoApto` | U, I · AC-17 |
| FR-19 | Regla `edadValida(KIT, 5..17)` | U · AC-18 |
| FR-20 | Bloqueo `LOCK#KIT` en transacción; se libera al rechazar o desistir (ADR-3) | I · AC-19, AC-20, AC-26 |
| FR-21 | Regla `categoriaPC = A` | U · AC-21 |
| FR-22 | Regla `edadValida(PC, 10..17)` | U · AC-22 |
| FR-23 | Bloqueo `LOCK#PC` | I · AC-23 |
| FR-24 | `radicarSolicitud` exige un soporte marcado como certificado | I · AC-24 |
| FR-25 | POST prefirmado con condiciones + `HeadObject` (ADR-10) | I, E · AC-16, AC-25 |
| FR-26 | Validación en `solicitarCargaSoporte` + condición de S3 | I, E · AC-25 |
| FR-27 | `ADD` atómico en `SEQ#<año>` + formato `SUB-AAAA-NNNNNN` | U, I · AC-16 |
| FR-28 | Índice `owner + fechaRadicacion` y página "Mis solicitudes" | E · AC-27 |
| FR-29 | Regla de dueño en el modelo + verificación en `urlSoporte` | E · AC-9 |
| FR-30 | `reenviarCorreccion` con condición de fecha límite | I · AC-28, AC-29 |
| FR-31 | `desistirSolicitud` con condición `estado = RADICADA` | I · AC-30, AC-31 |
| FR-32 | Índice `estado + fechaRadicacion` en orden ascendente | I, E · AC-32 |
| FR-33 | `tomar` con asignación condicional | I · AC-33 |
| FR-34 | Condición `attribute_not_exists(analistaAsignado)` (ADR-3) | I · AC-34 |
| FR-35 | Cada comando de decisión verifica `analistaAsignado = sub` | I, E · AC-35 |
| FR-36 | `liberar` elimina la asignación y conserva `fechaRadicacion` | I · AC-36 |
| FR-37 | `consultaCore` + `urlSoporte` con URL prefirmada de 5 minutos | I, E · AC-37 |
| FR-38 | `aprobar` KIT pasa a APROBADA | I · AC-38 |
| FR-39 | `aprobar` PC pasa a PREAPROBADA y suma a `preaprobadosPC` | I · AC-39 |
| FR-40 | `aprobarComputador` solo para el grupo COORDINADOR | E · AC-9, AC-39 |
| FR-41 | `rechazar` valida el motivo contra un catálogo en el dominio | U, I · AC-40, AC-41 |
| FR-42 | `devolver` calcula la fecha límite con días hábiles | U, I · AC-42 |
| FR-43 | Condición `devuelta = false` | I · AC-43 |
| FR-44 | Barrido diario de `vencimientos` (ADR-9) | I · AC-44 |
| FR-45 | `diasHabiles()` del dominio con la tabla `Festivo` | U · AC-44 |
| FR-46 | Contadores en `Convocatoria` y tablero | I, E · AC-45 |
| FR-47 | Índice `estado = PREAPROBADA + fechaRadicacion` | I · AC-46 |
| FR-48 | Transacción: estado + `aprobadosPC < cupoPC` (ADR-3) | I · AC-47, AC-49 |
| FR-49 | Condición fallida → mensaje "Sin cupo disponible" | I · AC-48, AC-49 |
| FR-50 | `reasignar` + `listarAnalistas` | I · AC-50 |
| FR-51 | `alertasServicio` calculada al consultar con la regla de SLA del dominio | U, I · AC-51 |
| FR-52 | `conteos` en `Convocatoria` actualizados en cada transacción | I · AC-52 |
| FR-53 | Stream → `notificador` → `CanalCorreo` (ADR-8) | I, M · AC-53 |
| FR-54 | Reintentos del event source + DLQ + alarma | I · AC-54 |
| FR-55 | Cada comando escribe `EventoHistorial` en la misma transacción | I · AC-55 |
| FR-56 | Sin mutaciones en la API; IAM solo `PutItem` condicional | E · AC-56 |
| FR-57 | Índice `solicitudId + fecha` para el coordinador | E · AC-55 |
| FR-58 | `onUpload` → EventBridge `soporte.cargado` | I · AC-57 |
| FR-59 | `reenviarCorreccion` reasigna a `analistaAsignado` previo | I · AC-28 |
| FR-60 | `diasMetaAcumulados` e `inicioConteoMeta`: se pausa al devolver y se reanuda al corregir | U, I · AC-58 |
| FR-61 | `aprobarComputador` y `rechazarPreaprobada` verifican que sea la más antigua pendiente | I · AC-59 |
| FR-62 | `rechazarPreaprobada` con motivo del catálogo | I · AC-60 |
| FR-63 | Autorización de campo en `actor`: solo COORDINADOR | E · AC-61 |
| FR-64 | Ítem `CONVOCATORIA_ACTIVA` condicional en `Control` | I · AC-62 |
| FR-65 | `vencimientos` y `diasHabiles` detectan el año faltante → SNS alertas-ti | U, I · AC-63 |

### Requisitos no funcionales
| NFR | Decisión del plan | Prueba prevista |
|---|---|---|
| NFR-1 | Todo serverless con escalado automático; DynamoDB on-demand | L: k6 en `dev` con perfil escalado |
| NFR-2 | Lambdas con clientes fuera del handler y dependencias mínimas; POST directo a S3 | L + M: medición con red 4G simulada |
| NFR-3 | Sin recursos de costo por hora (sin RDS, NAT ni instancias) | M: revisión de CloudFormation y estimación pico/valle |
| NFR-4 | Servicios gestionados con redundancia entre zonas | M: revisión de arquitectura |
| NFR-5 | Doble autorización; soportes privados con URLs de 5 minutos; roles IAM por función; secretos en Amplify secrets | E: AC-9 · M: agente `security-reviewer` |
| NFR-6 | Solo los datos del menor necesarios (documento, nombre, fecha de nacimiento); acceso por rol; soportes en prefijo privado | M: revisión de modelos y permisos |
| NFR-7 | Transacciones condicionales (ADR-3) | I: AC-20, AC-34, AC-49 con concurrencia real |
| NFR-8 | Amplify UI; diseño celular primero para el afiliado | M: 375 px + axe/Lighthouse |
| NFR-9 | Alarmas de errores de Lambda y de DLQ → SNS alertas-ti | I: AC-54, AC-63 · M: fallo provocado |
| NFR-10 | Puerto `CoreAfiliaciones` (ADR-5) | C: prueba de contrato con dos adaptadores |
| NFR-11 | Interfaz `CanalNotificacion` + registro de canales (ADR-8) | C: canal de prueba sin tocar el notificador |
| NFR-12 | Ramas `dev` y `main` en Amplify Hosting (ADR-12) | M: dos URL operativas |
| NFR-13 | `datos/core-simulado.json` con los casos listados | U: la prueba recorre el dataset contra la lista de NFR-13 |

### Criterios de aceptación
| AC | Decisión del plan | Prueba prevista |
|---|---|---|
| AC-1 | `preSignUp` + `postConfirmation` | I + E (`e2e/registro.spec.ts`) |
| AC-2 | Validación de la autorización en `preSignUp` | I |
| AC-3 | `preSignUp` rechaza documento inactivo o inexistente | I |
| AC-4 | Verificación de correo de Cognito | E |
| AC-5 | Reserva `DOC#` | I |
| AC-6 | Solo grupo AFILIADO en `postConfirmation` | E |
| AC-7 | Script `crear-funcionario` | M |
| AC-8 | MFA + `preTokenGeneration` | E |
| AC-9 | Doble autorización, llamada GraphQL directa por rol | E (`e2e/autorizacion.spec.ts`) |
| AC-10 | `crearConvocatoria` | I |
| AC-11 | Verificación de fechas de la convocatoria | I |
| AC-12 | `ajustarCupo` + historial | I |
| AC-13 | Condición de cupo mínimo | I |
| AC-14 | `vencimientos` al cierre | I |
| AC-15 | `misBeneficiarios` | I |
| AC-16 | `radicarSolicitud` flujo feliz | I + E |
| AC-17 | Regla `afiliadoApto` | U + I |
| AC-18 | Regla de edad del KIT | U |
| AC-19 | Bloqueo `LOCK#KIT` | I |
| AC-20 | Bloqueo `LOCK#KIT` con concurrencia | I (`Promise.all`) |
| AC-21 | Regla de categoría para PC | U |
| AC-22 | Regla de edad para PC | U |
| AC-23 | Bloqueo `LOCK#PC` | I |
| AC-24 | Certificado obligatorio | I |
| AC-25 | Condiciones del POST prefirmado | I + E |
| AC-26 | Liberación del bloqueo al rechazar | I |
| AC-27 | Página "Mis solicitudes" | E |
| AC-28 | `reenviarCorreccion` | I |
| AC-29 | Condición de fecha límite | I |
| AC-30 | `desistirSolicitud` | I |
| AC-31 | Condición `estado = RADICADA` | I |
| AC-32 | Orden del índice | I |
| AC-33 | `tomar` | I |
| AC-34 | `tomar` concurrente | I (`Promise.all`) |
| AC-35 | Verificación de asignación | I + E |
| AC-36 | `liberar` | I |
| AC-37 | `consultaCore` + `urlSoporte` | I + E |
| AC-38 | `aprobar` KIT | I |
| AC-39 | `aprobar` PC → PREAPROBADA | I |
| AC-40 | Catálogo de motivos | U |
| AC-41 | `rechazar` con motivo | I |
| AC-42 | `devolver` con fecha límite | U + I (reloj fijo en el 7 de enero de 2027) |
| AC-43 | Condición de una sola devolución | I |
| AC-44 | `vencimientos` + festivos | U + I (reloj inyectado) |
| AC-45 | Contadores de `Convocatoria` | I |
| AC-46 | Orden de las preaprobadas | I |
| AC-47 | Aprobación con cupo | I |
| AC-48 | Aprobación sin cupo | I |
| AC-49 | Último cupo con dos coordinadores | I (`Promise.all`) |
| AC-50 | `reasignar` | I |
| AC-51 | Regla de SLA | U + I |
| AC-52 | Conteos por estado y tipo | I |
| AC-53 | `notificador` + `CanalCorreo` | I (canal falso) + M (correo real SES) |
| AC-54 | Reintentos + DLQ | I (canal que falla) |
| AC-55 | Historial en la transacción | I + E |
| AC-56 | Inmutabilidad del historial | E (GraphQL directo) + M (política IAM) |
| AC-57 | `onUpload` → EventBridge | I |
| AC-58 | Pausa de la meta | U + I |
| AC-59 | Orden estricto de preaprobadas | I |
| AC-60 | `rechazarPreaprobada` | I |
| AC-61 | Autorización de campo en `actor` | E |
| AC-62 | `CONVOCATORIA_ACTIVA` | I |
| AC-63 | Año sin festivos | U + I |

**Huecos:** ninguno. 65/65 FR, 13/13 NFR y 63/63 AC tienen decisión y prueba. Tres decisiones dependen de pruebas técnicas en F0 (R-1, R-2, R-3), cada una con su plan B definido.

---

## Resumen
- **Arquitectura:** Amplify Gen 2 + React, con **comandos en Lambda** para toda escritura y **modelos de solo lectura** para consultar. Las reglas viven en un dominio TypeScript puro y probable.
- **Lo difícil se resuelve en DynamoDB:** unicidad, toma de la bandeja y cupo con **transacciones condicionales**, probadas con concurrencia real sobre DynamoDB Local.
- **Seguridad en el servidor:** doble autorización, MFA de funcionarios aplicado en el token, soportes privados con POST y GET prefirmados.
- **Desacople:** core detrás de un puerto; notificaciones por stream con reintentos, DLQ y canales enchufables; evento `soporte.cargado` listo para OCR.
- **Entrega en 7 fases (F0–F6)**, con demo pública desde F1. **Siguiente paso: `/tasks`.**
