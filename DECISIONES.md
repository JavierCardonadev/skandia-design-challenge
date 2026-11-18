# DECISIONES

Javier Cardona · Prueba Design Engineer · [Preview](https://skandia-design-challenge.vercel.app/) · [Repositorio](https://github.com/JavierCardonadev/skandia-design-challenge)

## 1. Proceso de diseño

Antes de escribir código boceté tres formas de la vista Encargo ([bocetos](docs/design-exploration/brief-view-alternatives.html)).

- **Conversación (descartada).** El plan queda enterrado en el hilo y editarlo es volver a escribir.
- **Formulario guiado (descartado).** Pide lo mismo a todos, aunque ya lo hayan dicho. Quedó como respaldo cuando el modelo falla.
- **Caja única y encargo vivo (elegida).** La persona escribe una vez; la plataforma muestra qué entendió, marca lo que supuso y solo pregunta lo que falta. El plan es un objeto editable.

También descarté: un panel dividido en Ejecución (no cabe en el celular de B) por una línea vertical de pasos; el porcentaje de avance (sería inventado) por la duración típica; y un veredicto "hazlo / no lo hagas": la plataforma dice qué permite la evidencia y la decisión sigue siendo de la persona.

## 2. Capacidades y Design System

- **Las capacidades son datos.** El contenido de cada una se valida y se dibuja desde su propio descriptor de salida: agregar una sexta es agregar un bloque al JSON, y hay una prueba que lo demuestra. Costo: se lee como ficha, no como documento.
- **Extendí el contrato** con dos fallas (`invalid-output`, `provider-error`) y con `addedByPlatform` en los pasos del plan.
- **Componentes nuevos, sin tokens nuevos:** chips de opción (el kit no tiene nada seleccionable), indicador de etapas, línea de pasos y panel de evidencia.
- **Lo que cuestiono:** el botón terciario verde sobre blanco se lee poco; el paquete es remoto y sin versión, así que la app espera a que cargue y ofrece reintentar.

## 3. Dónde se equivocó la IA

- **Al construir (Claude Code).** Subió un commit con un error de tipos que rompió un despliegue, y la función de servidor se caía en producción aunque pasaba las pruebas. Ahora la CI carga la función empaquetada antes de desplegar.
- **El modelo del producto (`claude-haiku-5-5`), falla real.** Entrada: el encargo E1 del kit y la respuesta "ahorradores digitales". Salida: un plan con Investigación, Prototipado y Validación, sin Contenido ni Estrategia, que Prototipado necesita. Manejo: el plan se resuelve contra el catálogo; la interfaz agrega los dos pasos y los marca "Lo agregamos al plan porque un paso siguiente lo necesita" ([captura y otras tres fallas](docs/llm-observations/observed-failures.txt)).
- **Corrección de prompt.** Con la primera versión el modelo preguntó en los seis encargos y nunca propuso un plan, y todas las respuestas pasaban el esquema. Validar la forma no bastó.

## 4. Personas B y C

Las mismas tres vistas, sin pantallas nuevas.

- **B (comercial).** Recibe una sola pregunta, el producto, y un plan corto: reunir lo que se sabe, definir el mensaje y probarlo con clientes simulados. Funciona a 375 px. Le falta un botón para copiar el mensaje.
- **C (cumplimiento).** El Resultado dice quién elaboró cada parte, si una persona la revisó y, en una tabla, de dónde sale cada fuente y si es real, simulada o elaborada por IA. Le falta la cita junto a cada afirmación; eso sí pediría una vista de auditoría.

## 5. Qué quedó fuera

Solo el encuadre usa un modelo real: las cinco capacidades usan las respuestas del kit y un ajuste devuelve la misma respuesta. No hay streaming de texto, historial ni prueba con lector de pantalla. El detector de datos sensibles no ve nombres sueltos. Con más tiempo: citas por afirmación para C y probar con duraciones reales.

**Supuestos.** Menos de dos fuentes reales es evidencia débil; máximo tres preguntas por encargo; el grupo de clientes se supone y se marca; la URL pública corre simulada y un panel de demostración lleva a cada estado.

**Uso de IA.** Construí con Claude Code (Claude Fable 5.2). [Registro de la sesión](docs/ai-log/session-2026-11-18.txt).
