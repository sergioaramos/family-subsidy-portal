# Levantamiento de requerimientos

Respuestas de la Jefatura de Tecnología de la caja, 29 sep 2026. Junto con el [requerimiento inicial](01-requerimiento.md), es la fuente de la [especificación](../specs/001-radicacion-subsidios-especie/spec.md).

## Ronda 1
**¿Qué usuarios y roles tendrá el sistema?**
- Afiliado: radica solicitudes para sus hijos y consulta el estado.
- Analista de Subsidios: revisa y decide. Son 12 en temporada.
- Coordinador de Subsidios: son 2. Ven todo, supervisan y toman la decisión final sobre los computadores.

**¿Tendrá integraciones?**
Una obligatoria: el sistema de afiliaciones (core, en el datacenter de la caja), que dice si el afiliado está activo, su categoría y sus beneficiarios. En esta versión no hay acceso: debe quedar simulada y desacoplada, para poder conectar el core real sin rehacer la aplicación.

**¿Cuántos soportes y de qué peso?**
Máximo 3 por solicitud. El certificado de estudio vigente del beneficiario es obligatorio. Formatos PDF, JPG o PNG, máximo 5 MB cada uno (muchas fotos se toman con el celular).

**¿Cuántos usuarios?**
Unos 38.000 afiliados con hijos en edad escolar y unas 15.000 solicitudes por temporada. La temporada dura 6 semanas (enero y febrero). En los primeros 3 días llega cerca del 40% de las solicitudes, con pico entre las 7 y las 9 de la noche. El resto del año el uso es casi nulo.

**¿La consulta de estado es en tiempo real? ¿Cada cuánto se consulta?**
El afiliado puede consultar cuando quiera y siempre ve el estado actual. No hace falta que la pantalla se actualice sola, pero el afiliado debe enterarse cuando algo cambie sin tener que entrar a revisar.

**¿Qué puede decidir Subsidios?**
- Aprobar.
- Rechazar, siempre con motivo de una lista estándar más una observación libre.
- Devolver para corrección: el afiliado tiene 5 días hábiles para corregir, y solo se puede devolver una vez.
- Computadores: hay cupos limitados por convocatoria. El analista solo preaprueba; la aprobación final es del coordinador, que no puede superar el cupo.

## Ronda 2
**¿Quién tiene derecho y con qué requisitos?**
- Afiliado activo en el core, de categoría A o B. La categoría C no tiene derecho.
- Beneficiario: hijo registrado como beneficiario en el core, de 5 a 17 años cumplidos al radicar, y estudiando, con certificado del año en curso.
- Kit escolar: uno por beneficiario por temporada. Si papá y mamá son afiliados, el niño recibe un solo kit.
- Computador: solo categoría A, beneficiario de 10 a 17 años, máximo uno por afiliado por convocatoria.

**¿Hay aprobaciones o rechazos automáticos?**
- Aprobación automática: no, un analista siempre revisa el certificado. En una fase futura se quiere leer el certificado automáticamente, así que el diseño debe permitir agregarlo sin rehacer.
- Rechazo automático: lo que no cumple ni siquiera se puede radicar (afiliado inactivo, categoría C, beneficiario no registrado o fuera del rango de edad, o beneficiario con solicitud existente). El sistema lo impide y le explica el motivo al afiliado.

**¿Qué pasa si el afiliado no corrige en 5 días hábiles?**
La solicitud se rechaza automáticamente con el motivo "No subsanó dentro del plazo" y se le avisa al afiliado. Días hábiles: sin sábados, domingos ni festivos de Colombia.

**¿El coordinador ve cuántos computadores ha aprobado y cuántos quedan?**
Sí: cupo total, aprobados, preaprobados pendientes y disponibles.
- El cupo lo define un coordinador al abrir la convocatoria, y solo un coordinador puede ajustarlo.
- Se aprueba en orden de radicación. Si hay más preaprobados que cupos, el resto queda en lista de espera; al cierre de la convocatoria, los que sigan en espera se rechazan con el motivo "Cupos agotados".
- Regla innegociable: nunca se aprueban más computadores que el cupo, aunque los dos coordinadores aprueben al mismo tiempo.

## Ronda 3 (preguntas clave)
**¿Cómo se registra e identifica el afiliado? ¿Cómo se crean los funcionarios?**
- El afiliado se autorregistra con número de documento, correo y contraseña, y verifica su correo. Al registrarse se valida el documento contra el core: si no es afiliado activo, no puede crear la cuenta. El reconocimiento facial queda fuera de esta versión.
- Analistas y coordinadores no se autorregistran: los crea TI. En producción deberían entrar con su cuenta corporativa de Microsoft 365, pero en esta versión basta con que TI los cree. Los funcionarios deben tener MFA.

**¿Por qué canal se notifica al afiliado?**
Por correo electrónico en esta versión. SMS y WhatsApp vendrán después, así que agregar un canal no debe obligar a rehacer. Se notifica:
- La radicación exitosa, con su número de radicado.
- La devolución, indicando qué debe corregir.
- La decisión final: aprobada o rechazada, con el motivo.
- El rechazo automático por no corregir a tiempo.

**¿Cómo se reparten las solicitudes entre los analistas?**
- Hay una bandeja compartida, ordenada por fecha de radicación, de la más antigua a la más nueva.
- El analista toma una solicitud y queda asignada a él; los demás no pueden tomarla ni decidirla. Puede liberarla, y el coordinador puede reasignarla.
- Meta de servicio: decisión en máximo 5 días hábiles desde la radicación. El coordinador debe ver cuáles están vencidas o por vencer.
