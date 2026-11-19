# DECISIONES

Javier Cardona · Prueba Design Engineer · [Preview](https://skandia-design-challenge.vercel.app/) · [Repositorio](https://github.com/JavierCardonadev/skandia-design-challenge)

## 1. Proceso de diseño

Antes de escribir código boceté tres formas de la vista Encargo ([bocetos](docs/design-exploration/brief-view-alternatives.html)).

- **Conversación (descartada).** El plan queda enterrado en el hilo y editarlo es volver a escribir.
- **Formulario guiado (descartado).** Pide lo mismo a todos, aunque ya lo hayan dicho. Quedó como respaldo cuando el modelo falla.
- **Caja única y encargo vivo (elegida).** La persona escribe una vez; la plataforma muestra qué entendió, marca lo que supuso y solo pregunta lo que falta. El plan es un objeto editable.

También descarté: un panel dividido en Ejecución (no cabe en el celular de B) por una línea vertical de pasos; el porcentaje de avance (sería inventado) por la duración típica; y un veredicto sacado solo de reglas: ahora lo redacta el modelo y las reglas lo acotan.

## 2. Capacidades y Design System

- **Las capacidades son datos.** Cada una se valida y se dibuja desde su propio descriptor de salida: agregar una sexta es agregar un bloque al JSON, y una prueba lo demuestra.
- **Qué corre con el modelo real.** El encuadre, cuatro capacidades y el veredicto. Investigación sigue con el kit: representa evidencia real y un modelo solo podría inventarla. Esa regla sale del catálogo, no del código.
- **La evidencia no la decide el modelo.** La calcula el servidor: a lo sumo "parcial", heredada de los pasos aprobados, y siempre "débil" y simulada para lo que hace de cliente.
- **Componentes nuevos, sin tokens nuevos:** chips de opción, indicador de etapas, línea de pasos, panel de evidencia y texto progresivo.
- **Lo que cuestiono, con medidas** ([auditoría](docs/accessibility/audit-2026-11-19.txt)): blanco sobre el verde de marca da 2,3:1, igual que el anillo de foco; lo corregí con tokens del propio kit. El paquete es remoto y sin versión.

## 3. Dónde se equivocó la IA

- **Al construir (Claude Code).** Una prueba fallaba a veces y su primer arreglo tocó la prueba, no la causa: los botones se suscribían a los eventos un instante después de pintarse y un clic se perdía. La función de servidor se caía en producción aunque pasaba las pruebas.
- **El modelo del producto (`claude-haiku-5-5`), falla real.** Entrada: el encargo E1 del kit y la respuesta "ahorradores digitales". Salida: un plan con Investigación, Prototipado y Validación, sin Contenido ni Estrategia, que Prototipado necesita. Manejo: el plan se resuelve contra el catálogo; la interfaz agrega los dos pasos y lo dice ([captura y otras cuatro fallas](docs/llm-observations/observed-failures.txt)).
- **Validar la forma no bastó.** Con el primer prompt el modelo preguntó en los seis encargos sin proponer plan, y todas las respuestas pasaban el esquema. Por eso el veredicto se comprueba contra reglas fijas: no puede decir "hacerlo" con evidencia débil y cada razón debe citar fuentes que existen.

## 4. Personas B y C

Las mismas tres vistas, sin pantallas nuevas.

- **B (comercial).** Recibe una sola pregunta, el producto, y un plan corto: reunir lo que se sabe, definir el mensaje y probarlo con clientes simulados. Funciona en celular.
- **C (cumplimiento).** El Resultado dice quién elaboró cada parte, si una persona la revisó y de dónde sale cada fuente: real, simulada o elaborada por IA. Le falta la cita junto a cada afirmación; eso pediría una vista de auditoría.

## 5. Qué quedó fuera

- El texto progresivo es de presentación: el modelo responde completo y la interfaz lo revela palabra por palabra; no es streaming de red.
- El historial vive en el navegador, sin cuentas ni servidor, y solo guarda texto ya sin datos de clientes.
- La auditoría de accesibilidad fue automática y manual; falta probar con lector de pantalla y con personas.
- Con más tiempo: citas por afirmación para C y probar con duraciones reales.

**Supuestos.** Menos de dos fuentes reales es evidencia débil; máximo tres preguntas por encargo; el grupo de clientes se supone y se marca; la URL pública corre simulada, sin llave, y un panel de demostración lleva a cada estado.

**Uso de IA.** Construí con Claude Code (Claude Fable 5.2). [Registro de la sesión](docs/ai-log/session-2026-11-18.txt).
