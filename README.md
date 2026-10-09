# ECOESPEJO

Prototipo educativo e interactivo; funciona en el navegador sin cuenta, backend, API key ni conexión a internet.

## Instalación y ejecución

Requiere Node.js 20 o posterior.

```bash
npm install
npm run dev
```

Abre la URL local que muestra Vite. Usa **Ver demo** en la portada para enseñar un resultado completo, o responde las cinco preguntas.

## Build y Render Static Site

```bash
npm install
npm run build
npm run preview
```

En Render crea un **Static Site** desde este repositorio con:

- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`

No hace falta configurar rutas de fallback: la navegación usa el hash (`#inicio`, `#pregunta/0`, `#resultado`) y los recursos se construyen con rutas relativas (`base: './'`).

## IA opcional

La IA no está incluida ni se necesita para el resultado. Este prototipo no incorpora un backend. Para integrarla, configura `VITE_AI_ENDPOINT` con la URL base de un backend Node/Express propio y despliega ese servidor por separado. El servidor debe implementar `GET /api/health` (JSON `{ "available": true }` solo cuando dispone de una clave guardada en el servidor) y `POST /api/recommendations`, que recibe `{ "answers": [...], "score": 0 }` y devuelve JSON `{ "recommendations": ["...", "...", "..."] }`. Limita el tamaño de las peticiones en Express, valida la salida, no registres claves ni credenciales y mantén un timeout de servidor. El adaptador del navegador también valida el JSON, limita la espera a 15 segundos y conserva el resultado local como respaldo. La clave debe vivir exclusivamente en el entorno del servidor; nunca la pongas en `VITE_*` ni en este proyecto estático.

Para desarrollar con la integración opcional, copia `.env.example` a `.env.local`, configura `VITE_AI_ENDPOINT` y reinicia Vite. Sin endpoint o backend disponible, ECOESPEJO permanece en **Modo demo local** y nunca bloquea el resultado.

La puntuación es educativa y orientativa; no es una huella de carbono medida científicamente ni una evaluación certificada.
