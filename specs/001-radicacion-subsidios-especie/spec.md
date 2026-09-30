# Spec 001: Radicación en línea de subsidios en especie

- **Fecha:** 2026-09-29 (rev. 3: clarificaciones Q1–Q20 incorporadas)
- **Estado:** aprobada
- **Origen:** [requerimiento](../../docs/01-requerimiento.md) · [levantamiento](../../docs/02-levantamiento.md) (rondas 1–3 con la Jefatura de Tecnología)

## Resumen
Portal web donde el afiliado de una caja de compensación familiar **radica en línea** solicitudes de subsidio en especie (kit escolar o computador) para sus hijos, adjunta soportes y sigue su estado. El área de Subsidios **revisa y decide** desde una bandeja compartida, con control estricto del **cupo de computadores**.

## Por qué
- **Problema:** hoy la radicación es presencial. En temporada hay filas largas, se pierden papeles y el afiliado no sabe en qué va su solicitud hasta que lo llaman.
- **Valor:**
  - Menos filas y menos papel.
  - Solicitudes que no cumplen se descartan antes de llegar a un analista.
  - Trazabilidad de cada decisión.
  - El afiliado sabe el estado sin llamar.
  - Aporta a la transformación digital de la caja.
- **Para quién:** afiliados con hijos en edad escolar (unos 38.000) y el área de Subsidios (12 analistas y 2 coordinadores en temporada).

## Actores
| Actor | Descripción |
|---|---|
| **Afiliado** | Trabajador afiliado a la caja. Se autorregistra, radica para sus beneficiarios, corrige cuando se lo piden y consulta el estado. |
| **Analista de Subsidios** | Toma solicitudes de la bandeja, revisa los soportes y decide. Lo crea TI. |
| **Coordinador de Subsidios** | Supervisa, reasigna, gestiona la convocatoria y el cupo, y da la aprobación final de los computadores. Lo crea TI. |
| **TI (administrador)** | Crea las cuentas de funcionarios y mantiene el calendario de festivos. |
| **Sistema de afiliaciones (core)** | Sistema externo de la caja: afiliado activo, categoría y beneficiarios. En esta versión está **simulado**. |
| **Sistema (procesos automáticos)** | Vencimientos, rechazos automáticos y notificaciones. |

## Glosario
- **Convocatoria:** periodo de radicación con fecha de apertura, fecha de cierre y cupo de computadores.
- **Tipos de subsidio:** `KIT_ESCOLAR` y `COMPUTADOR`.
- **Radicado:** identificador único y legible que recibe el afiliado al radicar.
- **Días hábiles:** lunes a viernes, sin festivos de Colombia.
- **Motivos estándar de rechazo:**
  - Certificado no corresponde al año en curso.
  - Certificado no corresponde al beneficiario.
  - Documento ilegible o incompleto.
  - Beneficiario no está estudiando.
  - Información inconsistente con el core.
  - Otro (observación obligatoria).

  Además hay dos motivos automáticos: "No subsanó dentro del plazo" y "Cupos agotados".
- **Solicitud vigente:** una solicitud en cualquier estado distinto de `RECHAZADA` y `DESISTIDA`.
- **Estados de una solicitud:**
  - `RADICADA`: en la bandeja, sin analista asignado.
  - `EN_REVISION`: asignada a un analista.
  - `DEVUELTA`: esperando la corrección del afiliado.
  - `PREAPROBADA`: solo computador; espera la decisión del coordinador.
  - `APROBADA`.
  - `RECHAZADA`.
  - `DESISTIDA`: el afiliado retiró la solicitud antes de que fuera tomada.

---

## Requisitos funcionales (EARS)
Cada requisito es **una sola afirmación verificable**, en uno de estos patrones: ubicuo ("El sistema DEBE…"), por evento ("CUANDO…"), por estado ("MIENTRAS…"), de comportamiento no deseado ("SI…, ENTONCES…") u opcional ("DONDE…").

### Registro y acceso
- **FR-1** CUANDO una persona envíe el registro con número de documento, correo y contraseña, el sistema DEBE consultar en el core la afiliación de ese documento.
- **FR-2** SI el documento corresponde a un afiliado activo, ENTONCES el sistema DEBE crear una cuenta con el rol afiliado pendiente de verificación de correo.
- **FR-3** SI el documento no corresponde a un afiliado activo, ENTONCES el sistema DEBE rechazar el registro con un mensaje que no revele datos del core.
- **FR-4** MIENTRAS el correo de una cuenta no esté verificado, el sistema DEBE impedir el ingreso con esa cuenta.
- **FR-5** SI ya existe una cuenta con el mismo número de documento, ENTONCES el sistema DEBE rechazar el registro.
- **FR-6** El sistema DEBE exigir la aceptación de la autorización de tratamiento de datos personales para completar el registro y guardar la fecha y la versión aceptada.
- **FR-7** El sistema DEBE asignar exclusivamente el rol afiliado a las cuentas creadas por autorregistro.
- **FR-8** El sistema DEBE permitir a TI crear cuentas con el rol analista o coordinador.
- **FR-9** CUANDO un analista o un coordinador inicie sesión, el sistema DEBE exigir un segundo factor de autenticación.
- **FR-10** El sistema DEBE autorizar cada operación en el servidor según el rol del usuario y la propiedad del recurso.

### Convocatoria
- **FR-11** El sistema DEBE permitir a un coordinador crear una convocatoria con fecha de apertura, fecha de cierre y cupo de computadores.
- **FR-64** SI un coordinador intenta abrir una convocatoria mientras otra está abierta, ENTONCES el sistema DEBE rechazar la operación.
- **FR-12** MIENTRAS no haya una convocatoria abierta, el sistema DEBE impedir la radicación e informar que no hay convocatoria abierta.
- **FR-13** El sistema DEBE permitir ajustar el cupo de computadores únicamente a los coordinadores.
- **FR-14** SI el nuevo cupo es menor que la cantidad de computadores aprobados, ENTONCES el sistema DEBE rechazar el ajuste.
- **FR-15** CUANDO la convocatoria cierre, el sistema DEBE pasar a `RECHAZADA`, con el motivo "Cupos agotados", toda solicitud de computador que siga en `PREAPROBADA`.

### Radicación y validaciones
- **FR-16** CUANDO el afiliado inicie una radicación, el sistema DEBE mostrarle los beneficiarios registrados a su nombre en el core.
- **FR-17** CUANDO el afiliado inicie una radicación, el sistema DEBE consultar en el core su estado de afiliación y su categoría vigentes.
- **FR-18** SI el afiliado no está activo o es de categoría C, ENTONCES el sistema DEBE impedir la radicación e indicar el motivo.
- **FR-19** SI el beneficiario no tiene entre 5 y 17 años cumplidos en la fecha de radicación, ENTONCES el sistema DEBE impedir la radicación de `KIT_ESCOLAR` e indicar el motivo.
- **FR-20** SI el beneficiario ya tiene una solicitud vigente de `KIT_ESCOLAR` en la convocatoria, radicada por cualquier afiliado, ENTONCES el sistema DEBE impedir la radicación e indicar el motivo.
- **FR-21** SI el afiliado no es de categoría A, ENTONCES el sistema DEBE impedir la radicación de `COMPUTADOR` e indicar el motivo.
- **FR-22** SI el beneficiario no tiene entre 10 y 17 años cumplidos en la fecha de radicación, ENTONCES el sistema DEBE impedir la radicación de `COMPUTADOR` e indicar el motivo.
- **FR-23** SI el afiliado ya tiene una solicitud vigente de `COMPUTADOR` en la convocatoria, ENTONCES el sistema DEBE impedir la radicación e indicar el motivo.
- **FR-24** El sistema DEBE exigir el certificado de estudio del beneficiario para radicar.
- **FR-25** El sistema DEBE aceptar hasta 3 soportes por solicitud, en formato PDF, JPG o PNG, de máximo 5 MB cada uno.
- **FR-26** SI un soporte no cumple el formato, el tamaño o la cantidad permitida, ENTONCES el sistema DEBE rechazar ese soporte antes de radicar e indicar la causa.
- **FR-27** CUANDO una radicación sea exitosa, el sistema DEBE registrar la solicitud en `RADICADA` con un radicado único con formato `SUB-<año de la convocatoria>-<consecutivo de 6 dígitos>` y la fecha y hora de radicación.

### Seguimiento del afiliado
- **FR-28** El sistema DEBE permitir al afiliado consultar sus solicitudes con radicado, tipo, beneficiario, estado, fechas y, cuando aplique, el motivo de rechazo o la indicación de corrección con su fecha límite.
- **FR-63** El sistema DEBE mostrar al afiliado la línea de tiempo de estados y fechas de cada solicitud sin identificar a los funcionarios.
- **FR-29** El sistema DEBE limitar el acceso de cada afiliado a sus propias solicitudes y soportes.
- **FR-30** MIENTRAS una solicitud esté `DEVUELTA` y su fecha límite no haya vencido, el sistema DEBE permitir al afiliado reemplazar o agregar soportes y reenviarla.
- **FR-31** MIENTRAS una solicitud esté `RADICADA`, el sistema DEBE permitir al afiliado desistir de ella.
- **FR-59** CUANDO el afiliado reenvíe una solicitud corregida, el sistema DEBE pasarla a `EN_REVISION` asignada al analista que la devolvió.

### Bandeja y revisión (analista)
- **FR-32** El sistema DEBE mostrar a los analistas las solicitudes `RADICADA` ordenadas por fecha de radicación, de la más antigua a la más reciente.
- **FR-33** CUANDO un analista tome una solicitud `RADICADA`, el sistema DEBE asignársela y pasarla a `EN_REVISION`.
- **FR-34** SI dos analistas intentan tomar la misma solicitud al mismo tiempo, ENTONCES el sistema DEBE asignarla a uno solo e informar al otro que ya fue tomada.
- **FR-35** El sistema DEBE permitir decidir una solicitud `EN_REVISION` únicamente al analista asignado.
- **FR-36** CUANDO el analista asignado libere una solicitud, el sistema DEBE devolverla a `RADICADA` conservando su fecha de radicación.
- **FR-37** CUANDO el analista asignado abra una solicitud, el sistema DEBE mostrarle sus datos, sus soportes mediante un acceso temporal y el resultado de una consulta actual al core.
- **FR-38** CUANDO el analista asignado apruebe un `KIT_ESCOLAR`, el sistema DEBE pasarlo a `APROBADA`.
- **FR-39** CUANDO el analista asignado apruebe un `COMPUTADOR`, el sistema DEBE pasarlo a `PREAPROBADA`.
- **FR-40** El sistema DEBE reservar a los coordinadores la aprobación final de las solicitudes de `COMPUTADOR`.
- **FR-41** CUANDO el analista asignado rechace una solicitud, el sistema DEBE exigir un motivo de la lista estándar y aceptar una observación libre.
- **FR-42** CUANDO el analista asignado devuelva una solicitud, el sistema DEBE exigir la indicación de qué corregir y pasarla a `DEVUELTA` con fecha límite a 5 días hábiles.
- **FR-43** SI la solicitud ya fue devuelta una vez, ENTONCES el sistema DEBE rechazar una nueva devolución.
- **FR-44** CUANDO venza la fecha límite de una solicitud `DEVUELTA` sin corrección, el sistema DEBE pasarla a `RECHAZADA` con el motivo "No subsanó dentro del plazo".
- **FR-45** El sistema DEBE calcular los días hábiles excluyendo sábados, domingos y los festivos registrados en el calendario que mantiene TI.
- **FR-65** SI el calendario de festivos no tiene registrado el año en curso, ENTONCES el sistema DEBE alertar a TI y calcular los días hábiles excluyendo solo sábados y domingos.

### Coordinación y cupo de computadores
- **FR-46** El sistema DEBE mostrar al coordinador el cupo total, los computadores aprobados, los preaprobados pendientes y los cupos disponibles de la convocatoria.
- **FR-47** El sistema DEBE presentar al coordinador las solicitudes `PREAPROBADA` ordenadas por fecha de radicación.
- **FR-48** CUANDO un coordinador apruebe una solicitud `PREAPROBADA` con cupo disponible, el sistema DEBE pasarla a `APROBADA` y consumir un cupo en una única operación atómica.
- **FR-49** SI no hay cupo disponible en el momento de la aprobación, ENTONCES el sistema DEBE rechazar la aprobación y mantener la solicitud en `PREAPROBADA`.
- **FR-61** El sistema DEBE permitir al coordinador decidir únicamente la solicitud `PREAPROBADA` más antigua pendiente.
- **FR-62** CUANDO un coordinador rechace una solicitud `PREAPROBADA`, el sistema DEBE exigir un motivo de la lista estándar y pasarla a `RECHAZADA`.
- **FR-50** CUANDO un coordinador reasigne una solicitud `EN_REVISION`, el sistema DEBE asignarla al analista elegido.
- **FR-51** El sistema DEBE mostrar al coordinador las solicitudes cuya meta de 5 días hábiles para decidir está vencida o por vencer, considerando por vencer la que tiene 1 día hábil o menos restante.
- **FR-60** MIENTRAS una solicitud esté `DEVUELTA`, el sistema DEBE pausar el conteo de días hábiles de la meta de 5 días para decidir.
- **FR-52** El sistema DEBE mostrar al coordinador el total de solicitudes de la convocatoria por estado y por tipo.

### Notificaciones
- **FR-53** CUANDO una solicitud pase a `RADICADA`, `DEVUELTA`, `APROBADA` o `RECHAZADA`, el sistema DEBE enviar un correo al afiliado con el radicado, el nuevo estado y, cuando aplique, el motivo o la indicación de corrección.
- **FR-54** SI el envío de una notificación falla, ENTONCES el sistema DEBE reintentarlo sin revertir el cambio de estado que la originó.

### Trazabilidad
- **FR-55** CUANDO ocurra un cambio de estado, una asignación, una liberación, una reasignación o un ajuste de cupo, el sistema DEBE registrar un evento de historial con fecha y hora, actor, estado anterior, estado nuevo y observación.
- **FR-56** El sistema DEBE conservar los eventos de historial sin permitir que ningún rol los modifique o elimine.
- **FR-57** El sistema DEBE permitir al coordinador consultar el historial completo de una solicitud.

### Evolución prevista
- **FR-58** CUANDO se almacene un soporte, el sistema DEBE publicar un evento "soporte cargado" con la referencia de la solicitud y del archivo.

---

## Requisitos no funcionales
| ID | Requisito (medible) | Cómo se verifica |
|---|---|---|
| **NFR-1** | Capacidad: 1.500 radicaciones por hora sostenidas durante 2 horas, sin errores. El pico estimado es de unas 6.000 radicaciones en 3 días, concentradas entre las 7 y las 9 p. m.; esto deja un margen de más de 2×. | Prueba de carga con perfil de pico |
| **NFR-2** | Latencia: p95 < 2 s en las pantallas y consultas del afiliado y de la bandeja. La carga de un soporte de 5 MB con conexión móvil 4G termina en < 15 s. | Prueba de carga y medición en navegador con red 4G simulada |
| **NFR-3** | Costo: fuera de temporada, cero recursos con costo fijo por hora; el costo escala con el uso. | Revisión de arquitectura y estimación de costos mensual (pico y valle) |
| **NFR-4** | Disponibilidad: 99,5% durante las 6 semanas de temporada. | Componentes gestionados con redundancia entre zonas; monitoreo de disponibilidad |
| **NFR-5** | Seguridad: <ul><li>autorización en el servidor (FR-10);</li><li>cifrado en tránsito y en reposo;</li><li>soportes nunca públicos, solo con acceso temporal;</li><li>mínimo privilegio entre componentes;</li><li>secretos fuera del código.</li></ul> | AC-9 y revisión de seguridad del código y la infraestructura |
| **NFR-6** | Datos personales (Ley 1581 de 2012) y de menores: minimización de datos y acceso solo por necesidad. | Revisión de datos almacenados y de permisos por rol |
| **NFR-7** | Integridad: la unicidad (kit por beneficiario, computador por afiliado), la asignación de la bandeja y el cupo se garantizan con operaciones atómicas en el servidor. | AC-20, AC-34 y AC-49 (pruebas concurrentes) |
| **NFR-8** | Usabilidad: interfaz responsive (celular primero para el afiliado) y WCAG 2.1 AA. | Revisión en 375 px y en escritorio; auditoría automática de accesibilidad sin errores críticos |
| **NFR-9** | Observabilidad: todo fallo de un proceso automático o de una notificación queda registrado y genera una alerta. | Provocar un fallo controlado y comprobar el registro y la alerta |
| **NFR-10** | Desacople del core: el sistema accede al core solo mediante un contrato de integración. | Sustituir la implementación simulada por otra que cumpla el contrato, sin cambiar el resto |
| **NFR-11** | Canales de notificación extensibles: agregar un canal no modifica la lógica que decide cuándo notificar. | Revisión de diseño en el plan y demostración con un segundo canal de prueba |
| **NFR-12** | Ambientes: un ambiente de desarrollo y uno de demostración en AWS, cada uno con su URL. | Ambas URL operativas |
| **NFR-13** | Datos de prueba: el core simulado cubre afiliado activo e inactivo, categorías A, B y C, edades límite (4, 5, 9, 10, 17 y 18) y un niño con ambos padres afiliados. | Revisión del conjunto de datos contra esta lista |

---

## Criterios de aceptación (Gherkin)
Etiquetas: `@AC-n` identifica el escenario; `@FR-n` / `@NFR-n`, lo que verifica.

### Registro y acceso
```gherkin
# language: es
Característica: Registro y acceso

  @AC-1 @FR-1 @FR-2 @FR-6
  Escenario: Registro de un afiliado activo
    Dado que el documento "10010001" pertenece a un afiliado activo en el core
    Cuando una persona se registra con el documento "10010001", un correo y una contraseña válida, aceptando la autorización de datos
    Entonces se crea una cuenta con el rol afiliado pendiente de verificación de correo
    Y queda registrada la fecha y la versión de la autorización aceptada

  @AC-2 @FR-6
  Escenario: Registro sin aceptar la autorización de datos
    Dado que el documento "10010001" pertenece a un afiliado activo en el core
    Cuando una persona se registra sin aceptar la autorización de datos
    Entonces el registro no se completa
    Y se le indica que la autorización es obligatoria

  @AC-3 @FR-3
  Esquema del escenario: Registro de un documento sin afiliación activa
    Dado que el documento "<documento>" está "<situacion>" en el core
    Cuando una persona se registra con ese documento
    Entonces el registro se rechaza con el mensaje "No encontramos una afiliación activa con este documento"
    Y no se crea ninguna cuenta

    Ejemplos:
      | documento | situacion   |
      | 20020002  | inactivo    |
      | 99999999  | inexistente |

  @AC-4 @FR-4
  Escenario: Ingreso sin verificar el correo
    Dado una cuenta de afiliado cuyo correo no está verificado
    Cuando intenta iniciar sesión con credenciales correctas
    Entonces el ingreso se impide
    Y se le indica que debe verificar su correo

  @AC-5 @FR-5
  Escenario: Registro con un documento ya registrado
    Dado que ya existe una cuenta con el documento "10010001"
    Cuando otra persona se registra con el documento "10010001"
    Entonces el registro se rechaza

  @AC-6 @FR-7
  Escenario: El autorregistro solo crea afiliados
    Cuando una persona completa el registro público
    Entonces la cuenta creada tiene únicamente el rol afiliado

  @AC-7 @FR-8
  Escenario: TI crea un analista
    Cuando TI crea una cuenta con el rol analista
    Entonces esa cuenta puede acceder a la bandeja de solicitudes

  @AC-8 @FR-9
  Escenario: Segundo factor para funcionarios
    Dado un analista con la contraseña correcta
    Cuando inicia sesión
    Entonces el sistema le exige el segundo factor antes de darle acceso

  @AC-9 @FR-10 @FR-13 @FR-29 @FR-40 @NFR-5
  Esquema del escenario: Operaciones denegadas por rol o propiedad, invocadas directamente en el servidor
    Dado un usuario autenticado con el rol "<rol>"
    Cuando invoca directamente en el servidor, sin usar la interfaz, la operación "<operacion>"
    Entonces la operación es denegada

    Ejemplos:
      | rol      | operacion                                      |
      | afiliado | aprobar una solicitud                          |
      | afiliado | consultar una solicitud de otro afiliado       |
      | afiliado | descargar un soporte de otro afiliado          |
      | analista | ajustar el cupo de computadores                |
      | analista | aprobar en forma final una solicitud de computador |
```

### Convocatoria
```gherkin
# language: es
Característica: Convocatoria

  @AC-10 @FR-11
  Escenario: Crear una convocatoria
    Dado un coordinador autenticado
    Cuando crea una convocatoria con apertura el 12 de enero de 2027, cierre el 22 de febrero de 2027 y cupo de 400 computadores
    Entonces la convocatoria queda registrada con esas fechas y ese cupo

  @AC-62 @FR-64
  Escenario: Abrir una segunda convocatoria
    Dado una convocatoria abierta
    Cuando un coordinador intenta abrir otra convocatoria
    Entonces la operación se rechaza indicando que ya hay una convocatoria abierta

  @AC-11 @FR-12
  Esquema del escenario: Radicar sin convocatoria abierta
    Dado una convocatoria con apertura el 12 de enero de 2027 y cierre el 22 de febrero de 2027
    Cuando un afiliado intenta radicar el "<fecha>"
    Entonces la radicación se impide con el mensaje "No hay una convocatoria abierta"

    Ejemplos:
      | fecha                 |
      | 11 de enero de 2027   |
      | 23 de febrero de 2027 |

  @AC-12 @FR-13 @FR-55
  Escenario: Un coordinador amplía el cupo
    Dado una convocatoria con cupo de 100 y 80 computadores aprobados
    Cuando un coordinador ajusta el cupo a 120
    Entonces el cupo queda en 120
    Y el ajuste queda en el historial

  @AC-13 @FR-14
  Escenario: Ajuste de cupo por debajo de lo aprobado
    Dado una convocatoria con cupo de 100 y 80 computadores aprobados
    Cuando un coordinador ajusta el cupo a 70
    Entonces el ajuste se rechaza
    Y el cupo sigue en 100

  @AC-14 @FR-15 @FR-53
  Escenario: Cierre con lista de espera
    Dado 3 solicitudes de computador en PREAPROBADA sin cupo disponible
    Cuando la convocatoria cierra
    Entonces las 3 quedan en RECHAZADA con el motivo "Cupos agotados"
    Y cada afiliado recibe un correo con ese motivo
```

### Radicación
```gherkin
# language: es
Característica: Radicación de solicitudes

  Antecedentes:
    Dado una convocatoria abierta
    Y un afiliado autenticado

  @AC-15 @FR-16
  Escenario: Ver los beneficiarios del core
    Dado que el afiliado tiene 2 hijos registrados como beneficiarios en el core
    Cuando inicia una radicación
    Entonces ve esos 2 beneficiarios para elegir

  @AC-16 @FR-17 @FR-24 @FR-25 @FR-27 @FR-53
  Escenario: Radicación exitosa de un kit escolar
    Dado que el afiliado es activo, de categoría B, con un hijo de 8 años sin solicitudes
    Cuando radica un KIT_ESCOLAR adjuntando un certificado de estudio en PDF de 2 MB
    Entonces la solicitud queda en RADICADA con un radicado único y la fecha y hora de radicación
    Y el afiliado recibe un correo con el radicado

  @AC-17 @FR-17 @FR-18
  Esquema del escenario: Afiliado que no cumple
    Dado que el core reporta al afiliado como "<estado>" y de categoría "<categoria>"
    Cuando intenta radicar un KIT_ESCOLAR
    Entonces la radicación se impide con el motivo "<motivo>"

    Ejemplos:
      | estado   | categoria | motivo                                   |
      | inactivo | A         | Tu afiliación no está activa             |
      | activo   | C         | Tu categoría no aplica para este subsidio |

  @AC-18 @FR-19
  Esquema del escenario: Edad del beneficiario para kit escolar
    Dado que el afiliado es activo, de categoría A, con un hijo de <edad> años cumplidos
    Cuando intenta radicar un KIT_ESCOLAR para ese hijo
    Entonces la radicación "<resultado>"

    Ejemplos:
      | edad | resultado                         |
      | 4    | se impide por edad                |
      | 5    | se permite                        |
      | 17   | se permite                        |
      | 18   | se impide por edad                |

  @AC-19 @FR-20
  Escenario: El otro padre ya radicó el kit del mismo niño
    Dado un niño registrado como beneficiario de su madre y de su padre, ambos afiliados
    Y la madre ya radicó un KIT_ESCOLAR vigente para ese niño
    Cuando el padre intenta radicar un KIT_ESCOLAR para el mismo niño
    Entonces la radicación se impide con el motivo "Este beneficiario ya tiene una solicitud"

  @AC-20 @FR-20 @NFR-7
  Escenario: Ambos padres radican al mismo tiempo
    Dado un niño registrado como beneficiario de su madre y de su padre, ambos afiliados
    Cuando la madre y el padre radican un KIT_ESCOLAR para ese niño en el mismo instante
    Entonces solo una de las dos solicitudes queda registrada
    Y la otra persona recibe el motivo "Este beneficiario ya tiene una solicitud"

  @AC-21 @FR-21
  Escenario: Computador para un afiliado de categoría B
    Dado que el afiliado es de categoría B con un hijo de 12 años
    Cuando intenta radicar un COMPUTADOR
    Entonces la radicación se impide con el motivo de categoría

  @AC-22 @FR-22
  Esquema del escenario: Edad del beneficiario para computador
    Dado que el afiliado es de categoría A con un hijo de <edad> años cumplidos
    Cuando intenta radicar un COMPUTADOR para ese hijo
    Entonces la radicación "<resultado>"

    Ejemplos:
      | edad | resultado          |
      | 9    | se impide por edad |
      | 10   | se permite         |
      | 17   | se permite         |
      | 18   | se impide por edad |

  @AC-23 @FR-23
  Escenario: Segundo computador del mismo afiliado
    Dado que el afiliado de categoría A ya tiene una solicitud vigente de COMPUTADOR en la convocatoria
    Cuando intenta radicar otro COMPUTADOR para otro hijo de 14 años
    Entonces la radicación se impide con el motivo "Ya tienes una solicitud de computador en esta convocatoria"

  @AC-24 @FR-24
  Escenario: Radicar sin certificado de estudio
    Cuando el afiliado intenta radicar un KIT_ESCOLAR sin adjuntar el certificado de estudio
    Entonces la radicación se impide indicando que el certificado es obligatorio

  @AC-25 @FR-25 @FR-26
  Esquema del escenario: Soporte inválido
    Cuando el afiliado intenta adjuntar "<soporte>"
    Entonces el soporte se rechaza antes de radicar con la causa "<causa>"

    Ejemplos:
      | soporte                                  | causa                     |
      | un archivo .docx                         | Formato no permitido      |
      | un JPG de 6 MB                           | Supera 5 MB               |
      | un cuarto archivo con 3 ya adjuntos      | Máximo 3 soportes         |

  @AC-26 @FR-20
  Escenario: Radicar de nuevo después de un rechazo
    Dado que el hijo del afiliado tiene un KIT_ESCOLAR en RECHAZADA en la convocatoria
    Cuando el afiliado radica un nuevo KIT_ESCOLAR para ese hijo
    Entonces la nueva solicitud queda en RADICADA
```

### Seguimiento del afiliado
```gherkin
# language: es
Característica: Seguimiento del afiliado

  @AC-27 @FR-28
  Escenario: Consultar una solicitud devuelta
    Dado un afiliado con una solicitud en DEVUELTA por "Certificado ilegible" con fecha límite 15 de enero de 2027
    Cuando consulta sus solicitudes
    Entonces ve el radicado, el estado DEVUELTA, la indicación "Certificado ilegible" y la fecha límite 15 de enero de 2027

  @AC-61 @FR-63
  Escenario: Línea de tiempo sin funcionarios
    Dado una solicitud del afiliado que fue radicada, tomada por la analista "Laura" y aprobada
    Cuando el afiliado consulta la solicitud
    Entonces ve los estados RADICADA, EN_REVISION y APROBADA con sus fechas
    Pero no ve el nombre "Laura" ni el de ningún otro funcionario

  @AC-28 @FR-30 @FR-59
  Escenario: Corregir dentro del plazo
    Dado una solicitud en DEVUELTA cuya fecha límite no ha vencido
    Cuando el afiliado reemplaza el certificado y la reenvía
    Entonces la solicitud queda en EN_REVISION asignada al analista que la devolvió
    Y la corrección queda en el historial

  @AC-29 @FR-30
  Escenario: Corregir con el plazo vencido
    Dado una solicitud cuya fecha límite de corrección ya venció
    Cuando el afiliado intenta reenviarla
    Entonces la operación se impide

  @AC-30 @FR-31
  Escenario: Desistir de una solicitud sin tomar
    Dado una solicitud en RADICADA
    Cuando el afiliado desiste
    Entonces la solicitud queda en DESISTIDA

  @AC-31 @FR-31
  Escenario: Desistir de una solicitud ya tomada
    Dado una solicitud en EN_REVISION
    Cuando el afiliado intenta desistir
    Entonces la operación se impide
```

### Bandeja y revisión
```gherkin
# language: es
Característica: Bandeja y revisión del analista

  @AC-32 @FR-32
  Escenario: Orden de la bandeja
    Dado tres solicitudes en RADICADA radicadas a las 19:05, 19:01 y 19:03
    Cuando un analista abre la bandeja
    Entonces las ve en el orden 19:01, 19:03, 19:05

  @AC-33 @FR-33 @FR-55
  Escenario: Tomar una solicitud
    Dado una solicitud en RADICADA
    Cuando el analista A la toma
    Entonces queda en EN_REVISION asignada al analista A
    Y la asignación queda en el historial

  @AC-34 @FR-34 @NFR-7
  Escenario: Dos analistas toman la misma solicitud
    Dado una solicitud en RADICADA
    Cuando los analistas A y B la toman en el mismo instante
    Entonces queda asignada a uno solo de ellos
    Y el otro recibe el aviso "Ya fue tomada por otro analista"

  @AC-35 @FR-35
  Escenario: Decidir una solicitud asignada a otro analista
    Dado una solicitud en EN_REVISION asignada al analista A
    Cuando el analista B intenta aprobarla
    Entonces la operación es denegada

  @AC-36 @FR-36
  Escenario: Liberar una solicitud
    Dado una solicitud radicada a las 19:01 y asignada al analista A
    Cuando el analista A la libera
    Entonces vuelve a RADICADA en la bandeja con su fecha de radicación de las 19:01

  @AC-37 @FR-37
  Escenario: Revisar una solicitud
    Dado una solicitud en EN_REVISION asignada al analista A
    Cuando el analista A la abre
    Entonces ve los datos de la solicitud y el resultado de una consulta actual al core
    Y accede a los soportes mediante un enlace que expira

  @AC-38 @FR-38 @FR-53
  Escenario: Aprobar un kit escolar
    Dado un KIT_ESCOLAR en EN_REVISION asignado al analista A
    Cuando el analista A lo aprueba
    Entonces queda en APROBADA
    Y el afiliado recibe un correo

  @AC-39 @FR-39 @FR-40
  Escenario: Aprobar un computador como analista
    Dado un COMPUTADOR en EN_REVISION asignado al analista A
    Cuando el analista A lo aprueba
    Entonces queda en PREAPROBADA

  @AC-40 @FR-41
  Escenario: Rechazar sin motivo
    Dado una solicitud en EN_REVISION asignada al analista A
    Cuando el analista A intenta rechazarla sin elegir motivo
    Entonces el rechazo se impide

  @AC-41 @FR-41 @FR-53
  Escenario: Rechazar con motivo
    Dado una solicitud en EN_REVISION asignada al analista A
    Cuando el analista A la rechaza con el motivo "Certificado no corresponde al año en curso" y una observación
    Entonces queda en RECHAZADA con ese motivo y esa observación
    Y el afiliado recibe el motivo por correo

  @AC-42 @FR-42 @FR-53
  Escenario: Devolver para corrección
    Dado una solicitud nunca devuelta, en EN_REVISION asignada al analista A, el jueves 7 de enero de 2027
    Cuando el analista A la devuelve indicando "Certificado ilegible"
    Entonces queda en DEVUELTA con fecha límite viernes 15 de enero de 2027
    Y el afiliado recibe la indicación por correo

  @AC-43 @FR-43
  Escenario: Segunda devolución
    Dado una solicitud que ya fue devuelta una vez y está de nuevo en EN_REVISION
    Cuando el analista intenta devolverla otra vez
    Entonces la devolución se rechaza

  @AC-44 @FR-44 @FR-45 @FR-53
  Esquema del escenario: Rechazo automático por plazo con festivo
    Dado una solicitud devuelta el jueves 7 de enero de 2027
    Y el lunes 11 de enero de 2027 está registrado como festivo
    Y el afiliado no ha corregido
    Cuando termina el "<dia>"
    Entonces la solicitud está en "<estado>"

    Ejemplos:
      | dia                            | estado    |
      | jueves 14 de enero de 2027     | DEVUELTA  |
      | viernes 15 de enero de 2027    | RECHAZADA |

  @AC-63 @FR-65 @NFR-9
  Escenario: Falta el calendario de festivos del año
    Dado que el calendario no tiene festivos registrados para 2027
    Cuando se calcula la fecha límite de una devolución hecha el jueves 7 de enero de 2027
    Entonces la fecha límite es el jueves 14 de enero de 2027
    Y TI recibe una alerta de calendario incompleto
```
En el caso `RECHAZADA`, el motivo es "No subsanó dentro del plazo" y el afiliado recibe un correo (FR-53).

### Coordinación y cupo
```gherkin
# language: es
Característica: Coordinación y cupo de computadores

  @AC-45 @FR-46
  Escenario: Tablero del cupo
    Dado una convocatoria con cupo de 100, 60 computadores aprobados y 15 preaprobados
    Cuando el coordinador abre el tablero
    Entonces ve cupo total 100, aprobados 60, preaprobados 15 y disponibles 40

  @AC-46 @FR-47
  Escenario: Orden de las preaprobadas
    Dado las preaprobadas P1, P2 y P3, radicadas en ese orden
    Cuando el coordinador abre la lista de preaprobadas
    Entonces las ve en el orden P1, P2, P3

  @AC-47 @FR-48
  Escenario: Aprobar con cupo disponible
    Dado una convocatoria con cupo de 100 y 60 aprobados
    Cuando el coordinador aprueba la preaprobada P1
    Entonces P1 queda en APROBADA
    Y los aprobados pasan a 61

  @AC-48 @FR-49
  Escenario: Aprobar sin cupo disponible
    Dado una convocatoria con cupo de 100 y 100 aprobados
    Cuando el coordinador intenta aprobar la preaprobada P1
    Entonces la aprobación se rechaza con el aviso "Sin cupo disponible"
    Y P1 sigue en PREAPROBADA

  @AC-49 @FR-48 @FR-49 @NFR-7
  Escenario: Dos coordinadores compiten por el último cupo
    Dado una convocatoria con cupo de 100 y 99 aprobados
    Cuando los dos coordinadores aprueban dos preaprobadas distintas en el mismo instante
    Entonces exactamente una queda en APROBADA
    Y la otra sigue en PREAPROBADA con el aviso "Sin cupo disponible"
    Y el total de aprobados es 100

  @AC-59 @FR-61
  Escenario: Aprobar saltándose el orden
    Dado las preaprobadas P1 y P2, radicadas en ese orden y con cupo disponible
    Cuando el coordinador intenta aprobar P2
    Entonces la operación se impide indicando que primero debe decidir P1

  @AC-60 @FR-62 @FR-53
  Escenario: Rechazar una preaprobada
    Dado las preaprobadas P1 y P2, radicadas en ese orden
    Cuando el coordinador rechaza P1 con el motivo "Información inconsistente con el core"
    Entonces P1 queda en RECHAZADA con ese motivo
    Y P2 pasa a ser la siguiente por decidir

  @AC-50 @FR-50 @FR-55
  Escenario: Reasignar una solicitud
    Dado una solicitud en EN_REVISION asignada al analista A
    Cuando el coordinador la reasigna al analista B
    Entonces queda asignada al analista B
    Y la reasignación queda en el historial

  @AC-51 @FR-51
  Esquema del escenario: Solicitudes vencidas y por vencer
    Dado una solicitud sin decisión que lleva <dias> días hábiles contados para la meta
    Cuando el coordinador consulta las alertas de servicio
    Entonces la solicitud aparece como "<alerta>"

    Ejemplos:
      | dias | alerta      |
      | 1    | sin alerta  |
      | 4    | por vencer  |
      | 6    | vencida     |

  @AC-58 @FR-60
  Escenario: La devolución pausa la meta
    Dado una solicitud que acumuló 2 días hábiles para la meta y luego estuvo DEVUELTA durante 3 días hábiles
    Cuando el afiliado la corrige
    Entonces la solicitud lleva 2 días hábiles contados para la meta

  @AC-52 @FR-52
  Escenario: Totales por estado y tipo
    Dado una convocatoria con solicitudes en distintos estados y tipos
    Cuando el coordinador abre el tablero
    Entonces ve la cantidad de solicitudes por cada estado y por cada tipo
    Y la suma coincide con el total de solicitudes de la convocatoria
```

### Notificaciones
```gherkin
# language: es
Característica: Notificaciones al afiliado

  @AC-53 @FR-53
  Esquema del escenario: Correo por cada cambio relevante
    Dado una solicitud del afiliado
    Cuando la solicitud pasa a "<estado>"
    Entonces el afiliado recibe un correo con el radicado, el estado "<estado>" y "<detalle>"

    Ejemplos:
      | estado    | detalle                       |
      | RADICADA  | la confirmación de radicación |
      | DEVUELTA  | la indicación de qué corregir |
      | APROBADA  | la confirmación de aprobación |
      | RECHAZADA | el motivo del rechazo         |

  @AC-54 @FR-54 @NFR-9
  Escenario: Falla del servicio de correo
    Dado que el servicio de correo no está disponible
    Cuando un analista aprueba un KIT_ESCOLAR
    Entonces la solicitud queda en APROBADA
    Y el correo se reintenta hasta enviarse o queda registrado como fallido con una alerta
```

### Trazabilidad y evolución
```gherkin
# language: es
Característica: Trazabilidad y evolución

  @AC-55 @FR-55 @FR-57
  Escenario: Historial completo
    Dado una solicitud que fue radicada, tomada, devuelta, corregida y aprobada
    Cuando el coordinador consulta su historial
    Entonces ve cada evento con fecha y hora, actor, estado anterior, estado nuevo y observación

  @AC-56 @FR-56
  Escenario: El historial no se puede alterar
    Dado un evento de historial de una solicitud
    Cuando un usuario de cualquier rol intenta modificarlo o eliminarlo
    Entonces la operación es denegada

  @AC-57 @FR-58
  Escenario: Evento de soporte cargado
    Cuando un afiliado radica con un certificado de estudio
    Entonces se publica un evento "soporte cargado" con la referencia de la solicitud y del archivo
    Y la radicación se completa aunque ningún proceso consuma ese evento
```

---

## Matriz de trazabilidad
| FR | Escenarios (AC) |
|---|---|
| FR-1 | AC-1 |
| FR-2 | AC-1 |
| FR-3 | AC-3 |
| FR-4 | AC-4 |
| FR-5 | AC-5 |
| FR-6 | AC-1, AC-2 |
| FR-7 | AC-6 |
| FR-8 | AC-7 |
| FR-9 | AC-8 |
| FR-10 | AC-9 |
| FR-11 | AC-10 |
| FR-12 | AC-11 |
| FR-13 | AC-9, AC-12 |
| FR-14 | AC-13 |
| FR-15 | AC-14 |
| FR-16 | AC-15 |
| FR-17 | AC-16, AC-17 |
| FR-18 | AC-17 |
| FR-19 | AC-18 |
| FR-20 | AC-19, AC-20, AC-26 |
| FR-21 | AC-21 |
| FR-22 | AC-22 |
| FR-23 | AC-23 |
| FR-24 | AC-16, AC-24 |
| FR-25 | AC-16, AC-25 |
| FR-26 | AC-25 |
| FR-27 | AC-16 |
| FR-28 | AC-27 |
| FR-29 | AC-9 |
| FR-30 | AC-28, AC-29 |
| FR-31 | AC-30, AC-31 |
| FR-32 | AC-32 |
| FR-33 | AC-33 |
| FR-34 | AC-34 |
| FR-35 | AC-35 |
| FR-36 | AC-36 |
| FR-37 | AC-37 |
| FR-38 | AC-38 |
| FR-39 | AC-39 |
| FR-40 | AC-9, AC-39 |
| FR-41 | AC-40, AC-41 |
| FR-42 | AC-42 |
| FR-43 | AC-43 |
| FR-44 | AC-44 |
| FR-45 | AC-44 |
| FR-46 | AC-45 |
| FR-47 | AC-46 |
| FR-48 | AC-47, AC-49 |
| FR-49 | AC-48, AC-49 |
| FR-50 | AC-50 |
| FR-51 | AC-51 |
| FR-52 | AC-52 |
| FR-53 | AC-14, AC-16, AC-38, AC-41, AC-42, AC-44, AC-53, AC-60 |
| FR-54 | AC-54 |
| FR-55 | AC-12, AC-33, AC-50, AC-55 |
| FR-56 | AC-56 |
| FR-57 | AC-55 |
| FR-58 | AC-57 |
| FR-59 | AC-28 |
| FR-60 | AC-58 |
| FR-61 | AC-59 |
| FR-62 | AC-60 |
| FR-63 | AC-61 |
| FR-64 | AC-62 |
| FR-65 | AC-63 |

**Cobertura:** 65 de 65 FR con al menos un escenario · 13 de 13 NFR con método de verificación · 63 escenarios, todos con FR o NFR asociado.

---

## Fuera de alcance (esta versión)
- Reconocimiento facial y validación biométrica.
- Ingreso de funcionarios con la cuenta corporativa de Microsoft 365 (federación). En esta versión TI crea las cuentas.
- Conexión al core real: se usa la simulación con datos de prueba (NFR-13).
- Notificaciones por SMS y WhatsApp: solo se deja el punto de extensión (NFR-11).
- Lectura automática (OCR) del certificado: solo se publica el evento (FR-58).
- Aplicación móvil nativa: solo web responsive.
- Logística de entrega física después de aprobar.
- Reportes gerenciales más allá del tablero del coordinador.

---

## Decisiones de clarificación
Aceptadas el 2026-09-29 (todas las propuestas). Son supuestos de diseño explícitos: cada uno queda trazado a sus requisitos y escenarios.

1. **Q1 Trazabilidad:** ¿el afiliado ve el historial de su solicitud?
   **Decisión:** ve la línea de tiempo de estados y fechas, **sin** el nombre del funcionario. El historial completo con actores solo lo ve el coordinador.
2. **Q2 Retención de soportes:** ¿cuánto tiempo se guardan?
   **Decisión:** en esta versión no se eliminan; la política de retención documental queda para una fase posterior, anotada como riesgo.
3. **Q3 Autorización de datos:** ¿se pide aceptación explícita en el registro?
   **Decisión:** sí, obligatoria, guardando fecha y versión.
4. **Q4 Alcance de la primera versión:** ¿qué es imprescindible?
   **Decisión:** todo; si hay que recortar, lo último son los totales por estado (FR-52) y desistir (FR-31).
5. **Q5 Convocatorias:** **Decisión:** una sola abierta a la vez, creada por un coordinador.
6. **Q6 Después del cierre:** **Decisión:** las revisiones y correcciones en curso continúan; solo se impide radicar y se rechaza la lista de espera de computadores.
7. **Q7 Desistir y editar:** **Decisión:** desistir solo en `RADICADA` (estado `DESISTIDA`); no se edita una solicitud radicada.
8. **Q8 Re-radicar tras un rechazo:** **Decisión:** sí, si la anterior está `RECHAZADA` o `DESISTIDA` y la convocatoria sigue abierta.
9. **Q9 Solicitud corregida:** **Decisión:** vuelve a `EN_REVISION` asignada al **mismo analista** que la devolvió.
10. **Q10 Meta de 5 días durante la devolución:** **Decisión:** el conteo se **pausa** mientras está `DEVUELTA` y se reanuda con la corrección.
11. **Q11 "Por vencer":** **Decisión:** le queda 1 día hábil o menos (4 días contados sobre una meta de 5).
12. **Q12 Orden del coordinador:** **Decisión:** solo puede aprobar la preaprobada **más antigua**. Puede rechazarla con motivo, y entonces avanza la siguiente.
13. **Q13 Kit y computador para el mismo niño:** **Decisión:** sí, son subsidios independientes.
14. **Q14 Formato del radicado:** **Decisión:** `SUB-<año>-<consecutivo de 6 dígitos>`, por ejemplo `SUB-2027-000123`.
15. **Q15 Motivos estándar de rechazo:** **Decisión:**
    - Certificado no corresponde al año en curso.
    - Certificado no corresponde al beneficiario.
    - Documento ilegible o incompleto.
    - Beneficiario no está estudiando.
    - Información inconsistente con el core.
    - Otro (observación obligatoria).
    Más los automáticos: "No subsanó dentro del plazo" y "Cupos agotados".
16. **Q16 Dispositivos:** **Decisión:** web responsive, celular primero para el afiliado y escritorio para los funcionarios.
17. **Q17 Reportes:** **Decisión:** fuera de alcance, salvo el tablero del coordinador.
18. **Q18 Entrega física:** **Decisión:** fuera de alcance; el proceso termina en `APROBADA` o `RECHAZADA`.
19. **Q19 El core cambia después de radicar:** **Decisión:** el analista ve la consulta actual (FR-37); si ya no cumple, rechaza con "Información inconsistente con el core". No hay revalidación automática.
20. **Q20 Festivos:** **Decisión:** TI carga los festivos de cada año antes de abrir la convocatoria; si falta el año, el sistema alerta y cuenta solo los fines de semana.
