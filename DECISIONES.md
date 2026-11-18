# DECISIONES

Javier Cardona · Prueba Design Engineer · [Repositorio](https://github.com/JavierCardonadev/skandia-design-challenge) · Uso de IA declarado al final.

## 1. Proceso de diseño

Antes de escribir código boceté tres formas de la vista Encargo ([bocetos](docs/design-exploration/brief-view-alternatives.html)).

- **Conversación (descartada).** Familiar, pero el plan queda enterrado en el hilo y editarlo es volver a escribir.
- **Formulario guiado (descartado).** Pide lo mismo a todos, aunque ya lo hayan dicho: lo que frustra a la persona B. Lo conservé como respaldo cuando el modelo falla.
- **Caja única y encargo vivo (elegida).** La persona escribe una vez; la plataforma muestra qué entendió, marca lo que supuso y solo pregunta lo que falta. El plan es un objeto editable.

Otros descartes: panel dividido en Ejecución (no cabe en el celular de B) por una línea vertical de pasos; porcentaje de avance (las capacidades tardan minutos, sería inventado) por barra indeterminada y duración típica; reordenar el plan (el orden sale de las dependencias); y un veredicto "hazlo / no lo hagas": la plataforma dice qué permite la evidencia y la decisión sigue siendo de la persona.

## 2. Capacidades y Design System

- **Las capacidades son datos.** El catálogo del kit se valida al arrancar. El contenido de cada capacidad se valida y se dibuja a partir de su propio descriptor de salida, así que agregar una sexta es agregar un bloque al JSON (hay una prueba que lo demuestra). Costo: el contenido se lee como ficha, no como documento.
- **Extendí el contrato** con dos fallas (`invalid-output`, `provider-error`), con `addedByPlatform` en los pasos del plan y con un esquema propio para el encuadre.
- **Componentes nuevos, sin tokens nuevos:** chips de opción (el kit no tiene nada seleccionable), indicador de etapas, línea de pasos y panel de evidencia.
- **Lo que cuestiono del Design System:** el botón terciario verde sobre blanco se lee poco; el paquete es remoto y sin versión (la app espera a que cargue y ofrece reintentar); React pasa propiedades y no atributos, así que la regla `sk-button[label]` del kit no aplica.

## 3. Dónde se equivocó la IA

- **Al construir (Claude Code).** Subió un commit con un error de tipos que rompió un despliegue; lo corrigió la CI en el siguiente. Al probar en el navegador, la vista Ejecución abría a mitad de página y sin foco: se corrigió y quedó con prueba.
- **El modelo del producto (`claude-haiku-5-5`), falla real.** Entrada: el encargo E1 del kit y la respuesta "ahorradores digitales". Salida: un plan con Investigación, Prototipado y Validación, sin Contenido ni Estrategia, que Prototipado necesita. Manejo: el plan se resuelve contra el catálogo antes de mostrarse; la interfaz agrega los dos pasos y los marca "Lo agregamos al plan porque un paso siguiente lo necesita" ([captura y otras tres fallas](docs/llm-observations/observed-failures.txt)).
- **Corrección de prompt.** Con la primera versión el modelo preguntó en los seis encargos y nunca propuso un plan, y todas las respuestas pasaban el esquema. Validar la forma no bastó: reescribí cuándo puede avanzar y qué es un hecho.

## 4. Personas B y C

Las mismas tres vistas, sin pantallas nuevas.

- **B (comercial).** Su encargo recibe una sola pregunta, el producto, y un plan corto: reunir lo que se sabe, definir el mensaje y probarlo con clientes simulados. Funciona a 375 px. Le falta un botón para copiar el mensaje.
- **C (cumplimiento).** El Resultado dice quién elaboró cada parte, si una persona la revisó y, en una tabla, de dónde sale cada fuente y si es real, simulada o elaborada por IA; se puede guardar o imprimir. Le falta la cita junto a cada afirmación y un registro de la revisión; eso sí pediría una vista de auditoría.

## 5. Qué quedó fuera

- Solo el encuadre usa un modelo real; las cinco capacidades usan las respuestas del kit, y un ajuste devuelve la misma respuesta.
- Sin streaming de texto, sin historial ni guardado, y sin prueba con lector de pantalla.
- El detector de datos sensibles no ve nombres sueltos ni en minúscula, y prefiere ocultar de más.
- Con más tiempo: citas por afirmación para C, veredicto redactado por el modelo y probar con duraciones reales.

**Supuestos.** Menos de dos fuentes reales es evidencia débil; máximo tres preguntas por encargo; el grupo de clientes se supone y se marca, no se pregunta; la URL pública corre simulada y un panel de demostración permite llegar a cada estado.

**Uso de IA.** Construí con Claude Code (Claude Fable 5.2); el registro está en [docs/ai-log](docs/ai-log/session-2026-11-18.txt).
