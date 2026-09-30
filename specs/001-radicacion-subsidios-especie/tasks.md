# Tareas 001: Radicación en línea de subsidios en especie

- **Plan:** [plan.md](plan.md) (aprobado) · **Spec:** [spec.md](spec.md) (aprobada)
- **Convenciones:**
  - `[P]` = puede ir en paralelo con la tarea anterior.
  - Capas de prueba: **U** unidad (Vitest) · **I** integración (Vitest + DynamoDB Local) · **C** contrato · **E** extremo a extremo (Playwright) · **L** carga (k6) · **M** manual o revisión.
  - Cada prueba lleva en su nombre la etiqueta del AC, por ejemplo `it('@AC-20 ambos padres radican al mismo tiempo', …)`.
  - Se trabaja en la rama `dev`; `main` (demo) solo recibe PR en `/ship`.
  - Perfil AWS: `export AWS_PROFILE=<perfil de la cuenta personal>`.
- **Seguimiento:** este archivo. El proyecto no usa issues ni tablero.

---

## F0: Base (setup y pruebas técnicas)
- [x] T1: Inicializar git en la raíz del proyecto, `.gitignore` (node_modules, `.amplify/`, `amplify_outputs.json`, `.env*`) y crear el repo público `sergioaramos/family-subsidy-portal` con las ramas `main` y `dev`. — _Hecha cuando: `git push` de ambas ramas funciona y gitleaks pasa._ (ref: NFR-12)
- [x] T2: Crear el proyecto Vite + React + TypeScript en la raíz. — _Hecha cuando: `npm run dev` muestra la página inicial._ (ref: ADR-11)
- [ ] T3: `npm create amplify@latest`, agregar `aws-amplify` y `@aws-amplify/ui-react`, y levantar `npx ampx sandbox`. — _Hecha cuando: se genera `amplify_outputs.json` y el stack del sandbox está en CREATE_COMPLETE._ (ref: ADR-1)
- [ ] T4 [P]: Configurar Vitest con carpetas `tests/unit` y `tests/contract`, y el script `npm test`. — _Hecha cuando: una prueba de humo pasa._ (ref: ADR-13)
- [ ] T5 [P]: DynamoDB Local con `docker compose` y un helper que crea y limpia las tablas por prueba en `tests/integration`. — _Hecha cuando: una prueba de integración de humo escribe y lee un ítem._ (ref: ADR-13)
- [ ] T6: **Prueba técnica R-2.** Modelo de prueba con `disableOperations(['mutations','subscriptions'])`. — _Hecha cuando: el esquema desplegado no expone mutaciones del modelo. Resultado anotado en el plan §7 (o se aplica el plan B)._ (ref: ADR-2)
- [ ] T7: **Prueba técnica R-1.** Escribir un ítem con el SDK usando `owner = sub` y leerlo con el token del dueño mediante `allow.owner().identityClaim('sub')`. — _Hecha cuando: el dueño lo lee y otro usuario no. Resultado anotado en el plan §7._ (ref: ADR-2, FR-29)
- [ ] T8: **Prueba técnica R-3.** Trigger `preTokenGeneration` que quita los grupos a un funcionario sin TOTP, más la configuración de TOTP en Authenticator. — _Hecha cuando: el funcionario sin TOTP entra sin grupos, configura TOTP y en el siguiente ingreso tiene grupos y se le pide el código. Resultado anotado en el plan §7._ (ref: ADR-7, FR-9)
- [ ] T9: Borrar los modelos de prueba de T6–T8 y dejar el backend limpio. — _Hecha cuando: el sandbox despliega sin recursos de prueba._
- [ ] T10: Crear `amplify.yml` con `npm ci`, `npm test` (U, C, I) y `npx ampx pipeline-deploy` en el backend. — _Hecha cuando: si una prueba falla, el build falla._ (ref: ADR-12)
- [ ] T11: Conectar Amplify Hosting al repo con las ramas `dev` y `main`. — _Hecha cuando: las dos URL responden, cada una con su backend._ (ref: NFR-12)

## F1: Esqueleto de punta a punta
### Core simulado
- [ ] T12: Prueba de contrato del puerto `CoreAfiliaciones` contra `CoreSimulado` y `CoreFake`, y prueba de que el dataset cubre los casos de NFR-13. — _Hecha cuando: la prueba existe y falla (rojo)._ (ref: NFR-10, NFR-13)
- [ ] T13: Implementar el puerto, `CoreSimulado`, `CoreFake` y `datos/core-simulado.json`. — _Hecha cuando: T12 en verde._ (ref: FR-1, FR-16, ADR-5)

### Registro
- [ ] T14: Pruebas de integración de `preSignUp`: alta de afiliado activo, rechazo sin autorización, rechazo de inactivo e inexistente. — _Hecha cuando: existen y fallan._ (ref: AC-1, AC-2, AC-3)
- [ ] T15: `defineAuth` con login por email, `custom:documento` (inmutable), `custom:autorizacionDatos` y los grupos AFILIADO, ANALISTA y COORDINADOR. — _Hecha cuando: el sandbox despliega el user pool con esos atributos y grupos._ (ref: FR-7, FR-8)
- [ ] T16: Trigger `preSignUp`: valida el core y la aceptación de la autorización. — _Hecha cuando: T14 en verde._ (ref: FR-1, FR-2, FR-3, FR-6)
- [ ] T17: Trigger `postConfirmation`: agrega al grupo AFILIADO y guarda la versión y fecha de la autorización. — _Hecha cuando: un usuario confirmado queda en AFILIADO con la autorización guardada._ (ref: FR-2, FR-6, FR-7)
- [ ] T18: `<Authenticator>` con los campos documento y la casilla de autorización de datos. — _Hecha cuando: un registro desde el navegador con el documento 1001 llega al correo de verificación._ (ref: FR-1, FR-4, AC-1)

### Datos
- [ ] T19: Modelos `Solicitud` y `Convocatoria` de solo lectura, con índices `owner + fechaRadicacion` y `estado + fechaRadicacion` y la autorización del plan §3. — _Hecha cuando: el sandbox expone solo queries para esos modelos._ (ref: FR-28, FR-32, ADR-2, ADR-4)
- [ ] T20: Tabla `Control` con CDK en `backend.ts`, variables de entorno con los nombres de las tablas y permisos mínimos por función. — _Hecha cuando: el sandbox despliega y la función `comandos` ve las variables._ (ref: ADR-3, ADR-4)
- [ ] T21: Script `scripts/sembrar-demo.ts` que crea una convocatoria ABIERTA de prueba. — _Hecha cuando: la convocatoria aparece en `getConvocatoriaAbierta`._ (ref: FR-12)

### Radicación mínima (kit escolar)
- [ ] T22: Pruebas unitarias de dominio: `afiliadoApto` (inactivo, categoría C) y edad del KIT (4, 5, 17, 18). — _Hecha cuando: existen y fallan._ (ref: AC-17, AC-18)
- [ ] T23: Implementar las reglas de elegibilidad del dominio. — _Hecha cuando: T22 en verde._ (ref: FR-18, FR-19)
- [ ] T24: Prueba de `misBeneficiarios` (el afiliado con dos hijos ve dos). — _Hecha cuando: existe y falla._ (ref: AC-15)
- [ ] T25: Query `misBeneficiarios` en la Lambda `consultas`. — _Hecha cuando: T24 en verde._ (ref: FR-16)
- [ ] T26: Prueba de `solicitarCargaSoporte`: el POST prefirmado tiene `content-length-range ≤ 5 MB`, los tipos permitidos y la clave `pendientes/<sub>/…`. — _Hecha cuando: existe y falla._ (ref: AC-25)
- [ ] T27: Mutación `solicitarCargaSoporte` y `defineStorage` sin acceso de cliente a los soportes. — _Hecha cuando: T26 en verde y una carga real desde `curl` con un archivo de 6 MB es rechazada por S3._ (ref: FR-25, FR-26, ADR-10)
- [ ] T28: Prueba de integración del flujo feliz de `radicarSolicitud` para KIT: queda RADICADA con radicado `SUB-2027-000001` y fecha y hora. — _Hecha cuando: existe y falla._ (ref: AC-16)
- [ ] T29: Comando `radicarSolicitud` (router por `fieldName`): consulta al core, reglas, consecutivo `SEQ#`, `HeadObject` y traslado a `solicitudes/<id>/`. — _Hecha cuando: T28 en verde._ (ref: FR-17, FR-27)

### Frontend del afiliado
- [ ] T30: Página "Radicar": elegir beneficiario y tipo, subir el certificado y radicar. — _Hecha cuando: la radicación desde el navegador muestra el radicado._ (ref: FR-16, FR-27)
- [ ] T31: Página "Mis solicitudes" con radicado, tipo, beneficiario, estado y fechas. — _Hecha cuando: el afiliado ve la solicitud recién radicada y no ve las de otros._ (ref: FR-28, FR-29, AC-27)

### Analista mínimo
- [ ] T32: Script `scripts/crear-funcionario.ts` (AdminCreateUser + AdminAddUserToGroup). — _Hecha cuando: un analista creado con el script entra y ve la bandeja._ (ref: FR-8, AC-7)
- [ ] T33: Pruebas de integración: orden de la bandeja, tomar, aprobar KIT, rechazar sin motivo y rechazar con motivo. — _Hecha cuando: existen y fallan._ (ref: AC-32, AC-33, AC-38, AC-40, AC-41)
- [ ] T34: Catálogo de motivos en el dominio y comandos `tomar`, `aprobar` (KIT) y `rechazar`. — _Hecha cuando: T33 en verde._ (ref: FR-32, FR-33, FR-38, FR-41)
- [ ] T35: Páginas "Bandeja" y "Revisión" con tomar, aprobar y rechazar con motivo. — _Hecha cuando: el analista decide una solicitud desde el navegador y el afiliado ve el nuevo estado._ (ref: FR-32, FR-38, FR-41)
- [ ] T36: Desplegar F1 en `dev` y, con un PR, en `main`. — _Hecha cuando: el flujo feliz completo (registro → radicar → aprobar → consultar) funciona en la URL pública de `main`._ (ref: NFR-12)

## F2: Radicación completa
- [ ] T37: Pruebas unitarias del computador: categoría A obligatoria y edades 9, 10, 17 y 18. — _Hecha cuando: existen y fallan._ (ref: AC-21, AC-22)
- [ ] T38: Reglas de dominio del computador. — _Hecha cuando: T37 en verde._ (ref: FR-21, FR-22)
- [ ] T39: Pruebas de integración de bloqueos:
  - kit ya radicado por el otro padre;
  - **ambos padres en el mismo instante (`Promise.all`)**;
  - segundo computador del mismo afiliado;
  - re-radicar después de un rechazo.

  — _Hecha cuando: existen y fallan._ (ref: AC-19, AC-20, AC-23, AC-26)
- [ ] T40: Bloqueos `LOCK#KIT` y `LOCK#PC` dentro de la transacción de `radicarSolicitud`, liberados al rechazar; traducción de `TransactionCanceledException` a mensajes de negocio. — _Hecha cuando: T39 en verde, 20 ejecuciones seguidas de AC-20 sin fallos._ (ref: FR-20, FR-23, NFR-7)
- [ ] T41: Prueba de integración de la reserva de documento (duplicado rechazado; reserva vencida reutilizable). — _Hecha cuando: existe y falla._ (ref: AC-5)
- [ ] T42: Reserva `DOC#` con TTL en `preSignUp` y confirmación en `postConfirmation`; TTL activado en `Control`. — _Hecha cuando: T41 en verde._ (ref: FR-5)
- [ ] T43: Pruebas de soportes en el servidor: sin certificado, `.docx`, JPG de 6 MB y cuarto archivo. — _Hecha cuando: existen y fallan._ (ref: AC-24, AC-25)
- [ ] T44: Validaciones de soportes en `radicarSolicitud` (`HeadObject`: dueño, tamaño, tipo, cantidad, certificado presente). — _Hecha cuando: T43 en verde._ (ref: FR-24, FR-25, FR-26)
- [ ] T45: Prueba de radicar sin convocatoria abierta (antes de la apertura y después del cierre). — _Hecha cuando: existe y falla._ (ref: AC-11)
- [ ] T46: Validación de la convocatoria abierta con reloj inyectado (`Clock`, America/Bogota). — _Hecha cuando: T45 en verde._ (ref: FR-12, ADR-14)
- [ ] T47: Pruebas de desistir (en RADICADA sí; en EN_REVISION no). — _Hecha cuando: existen y fallan._ (ref: AC-30, AC-31)
- [ ] T48: Comando `desistirSolicitud` (libera el bloqueo) y botón en el detalle. — _Hecha cuando: T47 en verde y el afiliado desiste desde el navegador._ (ref: FR-31)
- [ ] T49: Mensajes de negocio visibles en "Radicar" para cada motivo de rechazo. — _Hecha cuando (M): cada caso de AC-17 a AC-25 muestra su mensaje en el navegador._ (ref: FR-18 a FR-26)

## F3: Revisión completa
- [ ] T50: Pruebas unitarias de días hábiles:
  - fecha límite del 7 al 15 de enero de 2027 con el festivo del 11;
  - cruce de fin de año;
  - año sin festivos → solo fines de semana + señal de alerta.

  — _Hecha cuando: existen y fallan._ (ref: AC-42, AC-44, AC-63)
- [ ] T51: `diasHabiles()` y `fechaLimite()` en el dominio. — _Hecha cuando: T50 en verde._ (ref: FR-45, FR-65)
- [ ] T52 [P]: Modelo `Festivo` (solo lectura) y script `cargar-festivos.ts` con los festivos 2026–2027 de Colombia. — _Hecha cuando: los festivos de 2027 se ven en la query._ (ref: FR-45)
- [ ] T53: Pruebas unitarias de la meta de servicio: 1, 4 y 6 días (sin alerta, por vencer, vencida) y pausa durante la devolución. — _Hecha cuando: existen y fallan._ (ref: AC-51, AC-58)
- [ ] T54: Regla de SLA con `diasMetaAcumulados` e `inicioConteoMeta`. — _Hecha cuando: T53 en verde._ (ref: FR-51, FR-60)
- [ ] T55: Pruebas de integración: **toma concurrente (`Promise.all`)**, decisión por un analista no asignado y liberar conservando la fecha. — _Hecha cuando: existen y fallan._ (ref: AC-34, AC-35, AC-36)
- [ ] T56: Asignación condicional en `tomar`, verificación de asignación en todos los comandos de decisión y comando `liberar`. — _Hecha cuando: T55 en verde, 20 ejecuciones seguidas de AC-34 sin fallos._ (ref: FR-34, FR-35, FR-36, NFR-7)
- [ ] T57: Pruebas de devolver (fecha límite y pausa de la meta) y de la segunda devolución. — _Hecha cuando: existen y fallan._ (ref: AC-42, AC-43)
- [ ] T58: Comando `devolver`. — _Hecha cuando: T57 en verde._ (ref: FR-42, FR-43, FR-60)
- [ ] T59: Pruebas de `reenviarCorreccion`: dentro del plazo vuelve al mismo analista y reanuda la meta; con el plazo vencido se impide. — _Hecha cuando: existen y fallan._ (ref: AC-28, AC-29, AC-58)
- [ ] T60: Comando `reenviarCorreccion` (con reemplazo de soportes). — _Hecha cuando: T59 en verde._ (ref: FR-30, FR-59, FR-60)
- [ ] T61: Pruebas de integración de `vencimientos`: rechazo el viernes 15 de enero de 2027 (no el jueves 14), y año sin festivos que publica una alerta en SNS. — _Hecha cuando: existen y fallan._ (ref: AC-44, AC-63)
- [ ] T62: Función `vencimientos` con `schedule` a las 05:05 UTC y tema SNS `alertas-ti` con suscripción por correo. — _Hecha cuando: T61 en verde y la ejecución manual en el sandbox rechaza una devolución vencida sembrada._ (ref: FR-44, FR-65, ADR-9)
- [ ] T63: Pruebas de `consultaCore` y `urlSoporte` (asignado sí, otro analista no, URL que expira a los 5 minutos). — _Hecha cuando: existen y fallan._ (ref: AC-37)
- [ ] T64: Queries `consultaCore` y `urlSoporte`. — _Hecha cuando: T63 en verde._ (ref: FR-37, NFR-5)
- [ ] T65: UI: en revisión, liberar, devolver y ver soportes y datos del core; en el afiliado, ver la indicación, la fecha límite y corregir. — _Hecha cuando (M): el ciclo devolver → corregir → aprobar funciona en el navegador._ (ref: FR-28, FR-30, FR-37, FR-42)

## F4: Coordinación y cupo
- [ ] T66: Pruebas de crear convocatoria y de rechazar una segunda abierta. — _Hecha cuando: existen y fallan._ (ref: AC-10, AC-62)
- [ ] T67: Comando `crearConvocatoria` con el ítem condicional `CONVOCATORIA_ACTIVA`. — _Hecha cuando: T66 en verde._ (ref: FR-11, FR-64)
- [ ] T68: Pruebas de ajuste de cupo (ampliar sí; por debajo de los aprobados no). — _Hecha cuando: existen y fallan._ (ref: AC-12, AC-13)
- [ ] T69: Comando `ajustarCupo`. — _Hecha cuando: T68 en verde._ (ref: FR-13, FR-14)
- [ ] T70: Prueba de que el analista que aprueba un COMPUTADOR lo deja en PREAPROBADA y suma a `preaprobadosPC`. — _Hecha cuando: existe y falla._ (ref: AC-39)
- [ ] T71: Rama COMPUTADOR de `aprobar`. — _Hecha cuando: T70 en verde._ (ref: FR-39, FR-40)
- [ ] T72: Pruebas del coordinador:
  - orden de las preaprobadas;
  - aprobar con cupo y sin cupo;
  - **dos coordinadores por el último cupo (`Promise.all`)**;
  - saltarse el orden;
  - rechazar una preaprobada.

  — _Hecha cuando: existen y fallan._ (ref: AC-46, AC-47, AC-48, AC-49, AC-59, AC-60)
- [ ] T73: Comandos `aprobarComputador` (transacción con cupo y verificación de "la más antigua") y `rechazarPreaprobada`. — _Hecha cuando: T72 en verde, 20 ejecuciones seguidas de AC-49 sin fallos._ (ref: FR-47, FR-48, FR-49, FR-61, FR-62, NFR-7)
- [ ] T74: Prueba de que el cierre de la convocatoria rechaza la lista de espera. — _Hecha cuando: existe y falla._ (ref: AC-14)
- [ ] T75: Cierre de convocatoria en `vencimientos`. — _Hecha cuando: T74 en verde._ (ref: FR-15)
- [ ] T76: Pruebas de reasignar y listar analistas. — _Hecha cuando: existen y fallan._ (ref: AC-50)
- [ ] T77: Comando `reasignar` y query `listarAnalistas` (ListUsersInGroup). — _Hecha cuando: T76 en verde._ (ref: FR-50)
- [ ] T78: Pruebas del tablero: contadores de cupo, conteos por estado y tipo que suman el total, y `alertasServicio`. — _Hecha cuando: existen y fallan._ (ref: AC-45, AC-51, AC-52)
- [ ] T79: Actualizar `conteos`, `aprobadosPC` y `preaprobadosPC` en cada transacción, y query `alertasServicio`. — _Hecha cuando: T78 en verde._ (ref: FR-46, FR-51, FR-52)
- [ ] T80: Páginas del coordinador: tablero, preaprobadas, alertas, convocatoria y cupo, y reasignar. — _Hecha cuando (M): el coordinador aprueba computadores hasta agotar el cupo desde el navegador._ (ref: FR-46, FR-47, FR-50, FR-51)

## F5: Transversales
### Historial
- [ ] T81: Prueba de integración de que cada comando escribe su `EventoHistorial` en la misma transacción (radicar, tomar, devolver, corregir, aprobar, reasignar, ajuste de cupo). — _Hecha cuando: existe y falla._ (ref: AC-55, AC-12, AC-33, AC-50)
- [ ] T82: Modelo `EventoHistorial` (índice `solicitudId + fecha`, `actor` con autorización de campo solo para COORDINADOR) y escritura en todos los comandos. — _Hecha cuando: T81 en verde._ (ref: FR-55, FR-57, FR-63)
- [ ] T83: IAM de las Lambdas sobre `EventoHistorial` limitado a `PutItem` con `attribute_not_exists(id)`. — _Hecha cuando (M): la política generada no tiene `UpdateItem` ni `DeleteItem` para esa tabla._ (ref: FR-56)
- [ ] T84: UI: línea de tiempo del afiliado (sin funcionarios) e historial completo del coordinador. — _Hecha cuando (M): el afiliado no ve nombres; el coordinador sí._ (ref: FR-57, FR-63)

### Notificaciones
- [ ] T85: Pruebas:
  - contrato de `CanalNotificacion` con un canal de prueba;
  - el notificador envía por cada estado;
  - es idempotente ante el mismo evento repetido;
  - un canal que falla no altera la solicitud y termina en la DLQ.

  — _Hecha cuando: existen y fallan._ (ref: AC-53, AC-54, NFR-11)
- [ ] T86: Stream `NEW_AND_OLD_IMAGES` en `Solicitud`, Lambda `notificador` con registro de canales, event source con reintentos, *bisect* y destino SQS DLQ, y alarma de la DLQ a `alertas-ti`. — _Hecha cuando: T85 en verde._ (ref: FR-53, FR-54, NFR-9, ADR-8)
- [ ] T87: `CanalCorreoSes` y verificación de las identidades de prueba en SES. — _Hecha cuando (M): al aprobar una solicitud llega un correo real con el radicado y el estado._ (ref: FR-53, AC-53)

### Evento para OCR
- [ ] T88: Prueba de que `onUpload` publica `soporte.cargado` y de que la radicación no depende de un consumidor. — _Hecha cuando: existe y falla._ (ref: AC-57)
- [ ] T89: Trigger `onUpload` que publica en EventBridge (`source: subsidios.radicacion`). — _Hecha cuando: T88 en verde._ (ref: FR-58)

### MFA y observabilidad
- [ ] T90: Prueba E2E: un analista con contraseña correcta debe dar el segundo factor; sin TOTP configurado no tiene permisos de funcionario. — _Hecha cuando: existe y falla._ (ref: AC-8)
- [ ] T91: MFA OPTIONAL TOTP, trigger `preTokenGeneration` definitivo y pantalla de configuración TOTP para funcionarios. — _Hecha cuando: T90 en verde._ (ref: FR-9, ADR-7)
- [ ] T92: Alarmas de errores de todas las Lambdas a `alertas-ti`. — _Hecha cuando (M): un error provocado en `comandos` genera un correo de alerta._ (ref: NFR-9)

## F6: Endurecimiento
- [ ] T93: Playwright contra el sandbox, con helpers para obtener tokens de afiliado, analista y coordinador y llamar GraphQL directamente. — _Hecha cuando: una prueba de humo inicia sesión con cada rol._ (ref: ADR-13)
- [ ] T94: E2E de registro: alta, ingreso sin verificar el correo y cuenta creada solo con el rol afiliado. — _Hecha cuando: en verde._ (ref: AC-1, AC-4, AC-6)
- [ ] T95: E2E de autorización con llamadas GraphQL directas:
  - las 5 filas de AC-9;
  - decisión de un analista no asignado;
  - intento de editar el historial;
  - `actor` oculto para el afiliado.

  — _Hecha cuando: en verde._ (ref: AC-9, AC-35, AC-56, AC-61, NFR-5)
- [ ] T96: E2E de los flujos por rol: radicar, "Mis solicitudes", bandeja, revisión con soporte e historial. — _Hecha cuando: en verde._ (ref: AC-16, AC-27, AC-32, AC-37, AC-55)
- [ ] T97: Prueba de carga con k6 en `dev`, 10 minutos, con un perfil escalado de 1.500 radicaciones por hora. — _Hecha cuando: el informe muestra p95 < 2 s y 0% de errores 5xx; resultado en el README._ (ref: NFR-1, NFR-2)
- [ ] T98 [P]: Accesibilidad y responsive: axe o Lighthouse sin errores críticos y revisión en 375 px. — _Hecha cuando (M): sin errores críticos y todas las pantallas del afiliado usables en el celular._ (ref: NFR-8)
- [ ] T99 [P]: Revisión de costos, disponibilidad y datos personales: sin NAT, RDS ni instancias en CloudFormation; estimación pico/valle; datos del menor mínimos. — _Hecha cuando (M): checklist firmado en el README._ (ref: NFR-3, NFR-4, NFR-6)
- [ ] T100: README de portafolio: qué es, diagrama, cómo correrlo, decisiones (enlace a los ADR), resultados de las pruebas y de la carga. — _Hecha cuando: alguien externo puede levantar el sandbox siguiendo el README._

## Entrega
- [ ] T101: Suite completa (U, C, I y E) con el agente `test-runner`. — _Hecha cuando: todo en verde; las fallas se corrigen con su causa anotada._
- [ ] T102: Revisión con los agentes `code-reviewer` y `security-reviewer`. — _Hecha cuando: sin hallazgos críticos abiertos._
- [ ] T103: `/ship`: PR `dev → main`, despliegue de la demo, checklist y **rollback probado** (redesplegar un build anterior en Amplify Hosting). — _Hecha cuando: la demo en `main` pasa el flujo completo y el rollback se probó una vez._
- [ ] T104: Limpieza de costos: `npx ampx sandbox delete`, revisar el presupuesto y los créditos restantes. — _Hecha cuando: solo quedan los ambientes `dev` y `main`._ (ref: NFR-3)

---

## Trazabilidad AC → tarea
Verificado con un script el 2026-09-29: los **63 de 63** `AC-n` de la spec aparecen en el `ref` de al menos una tarea. Sin huecos. 104 tareas con numeración correlativa.
