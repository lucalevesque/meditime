# MediTime 🌿

*Tus horarios, organizados. care, in every moment.*

Aplicación web para registrar cuándo se toma un medicamento y calcular automáticamente cuándo corresponde la siguiente toma. Funciona en el celular desde un enlace, sin instalar nada, sin registrarse y sin servidores.

> **Aviso:** MediTime solo organiza registros y calcula horarios. No recomienda dosis, no cambia indicaciones y no reemplaza a tu profesional de salud. Los nombres, intervalos y horarios deben configurarse según lo que indique tu médico.

---

## 1. Qué es MediTime

- Dos medicamentos precargados: **Ultrabiotic Duo** (cada 12 h, horarios habituales 08:00 y 20:00) y **Letondal** (cada 8 h, última toma inicial a las 18:00).
- Cada tarjeta muestra la última toma, la próxima toma calculada y una cuenta regresiva independiente.
- Botones para registrar la toma **ahora**, registrar **otra hora** y **editar** la última.
- Historial de tomas, configuración editable y opción de restablecer los valores iniciales.
- Nunca marca una toma como realizada por sí sola: cuando llega la hora muestra "Horario de toma alcanzado" y espera a que la persona registre.

## 2. Tecnologías

| Tecnología | Para qué se usa |
|---|---|
| HTML5 | Estructura de las pantallas |
| CSS3 | Diseño (glassmorphism, colores, responsive) |
| JavaScript vanilla | Lógica, cálculos y eventos |
| LocalStorage | Guardar los datos en el navegador |
| SVG | Logo, favicon e íconos |
| GitHub Pages | Publicación gratuita |

No usa frameworks, Node.js, backend, base de datos ni librerías externas. Lo único externo son las tipografías de Google Fonts, y si no cargan se usan tipografías del sistema.

## 3. Qué hace cada archivo

```
MediTime/
├── index.html          Estructura: pantallas, formularios y ventanas
├── manifest.json       Datos para instalarla como app (nombre, colores, íconos)
├── sw.js               Service worker: permite abrirla sin conexión
├── README.md           Esta guía
├── css/
│   └── styles.css      Todos los estilos
├── js/
│   ├── storage.js      Lee y escribe en LocalStorage
│   ├── medication.js   Datos iniciales, cálculos y formato de fechas
│   ├── timer.js        Cuenta regresiva (se actualiza cada segundo)
│   └── app.js          Coordina todo: arranque, pantalla y botones
└── assets/
    ├── logo.svg        Logo principal
    ├── favicon.svg     Ícono de la pestaña
    ├── bg-leaves.svg   Hojas decorativas del fondo
    └── icons/          Íconos PNG para la pantalla de inicio
```

## 4. Cómo se comunican los archivos

`index.html` carga los scripts **en este orden**, porque cada uno usa a los anteriores:

```
storage.js  ->  medication.js  ->  timer.js  ->  app.js
```

Cada archivo define un objeto global (`MedStorage`, `Medication`, `Timer`) y `app.js` los usa:

```
Persona toca un botón
      │
   app.js ──► Medication (calcula) ──► MedStorage (guarda) ──► app.js dibuja la pantalla
      │
   Timer (cada segundo) lee los datos y actualiza solo los textos del contador
```

Regla útil: **`medication.js` no conoce la pantalla**, **`storage.js` solo conoce LocalStorage** y **`app.js` es el único que toca el HTML**. Así, cada cambio se hace en un solo lugar.

## 5. Cómo funciona HTML

HTML describe *qué hay* en la página. En `index.html`:

- `<main id="welcome">` es la pantalla de bienvenida (solo la primera vez).
- `<div id="app">` contiene el encabezado, las tres secciones (`view-home`, `view-history`, `view-settings`) y la barra inferior.
- `<dialog>` son las ventanas emergentes nativas (registrar/editar y confirmar).
- Cada campo tiene su `<label>` asociado con `for="id"`, lo que mejora la accesibilidad.
- Las tarjetas de medicamentos **no están escritas en el HTML**: las crea JavaScript a partir de los datos. Por eso agregar un medicamento no requiere tocar el HTML.

## 6. Cómo se aplican los estilos CSS

`styles.css` está dividido en secciones numeradas (variables, base, fondo, tarjetas, botones, formularios, etc.).

- **Variables** (`:root`): los colores y tipografías se definen una vez (`--forest`, `--sage`, etc.) y se usan con `var(--forest)`.
- **Glassmorphism**: la clase `.glass` combina un fondo translúcido, un borde fino y `backdrop-filter: blur(...)`, que difumina lo que hay detrás.
- **Mobile-first**: los estilos base son para celular; `@media (min-width: 900px)` los adapta a pantallas grandes (dos tarjetas lado a lado).
- **Estados**: los botones tienen `:hover`, `:active` y `:focus-visible` (el contorno que aparece al navegar con teclado).
- `prefers-reduced-motion` desactiva animaciones para quien lo pide en su dispositivo.

## 7. Cómo funciona JavaScript en el proyecto

- **Estado**: un único objeto (`state`) con los medicamentos. Todo lo que se ve sale de ahí.
- **Render**: funciones `render...()` que arman el HTML de las tarjetas, el historial y la configuración.
- **Eventos**: `addEventListener` conecta botones con funciones (`takeNow`, `onDoseSubmit`, etc.). Las tarjetas usan *delegación de eventos*: un solo listener en el contenedor y `event.target.closest(...)` para saber qué botón se tocó.
- **Async/await**: las confirmaciones (`askConfirm`) devuelven una promesa; el código "espera" la respuesta con `await`.

Ciclo de cada acción: **cambiar `state` → `persist()` (guardar) → `renderAll()` (redibujar)**.

## 8. Cómo se utiliza LocalStorage

`storage.js` guarda todo el estado como texto JSON bajo la clave `meditime:v1`.

1. **Al abrir**: `MedStorage.load()` lee la clave. Si no hay nada, se usan los valores iniciales (`Medication.defaultState()`).
2. **Al cambiar algo**: `persist()` llama a `MedStorage.save(state)`.
3. **Validación**: `Medication.normalizeState()` descarta fechas o intervalos inválidos que pudieran estar guardados.
4. **Errores**: si LocalStorage no existe (por ejemplo, modo privado) se muestra un aviso; si los datos están dañados se hace una copia en `meditime:v1:corrupt-backup` y se empieza de cero.
5. **Lo que NO se guarda**: la cuenta regresiva. Se calcula siempre restando "ahora" a la próxima toma.

Importante:
- LocalStorage guarda datos **en ese navegador y en ese dispositivo**. No se sincroniza con otros celulares ni computadoras.
- **GitHub Pages solo aloja los archivos de la aplicación**; nunca recibe ni guarda los registros.
- Borrar los datos del navegador o desinstalar el navegador **elimina los registros**.

Para ver lo guardado: F12 → pestaña *Application* → *Local Storage*.

## 9. Cómo se calculan las fechas y horarios

Se guardan **fechas completas en formato ISO 8601** (por ejemplo `2026-11-26T21:00:00.000Z`), nunca solo "18:00". La fórmula (en `medication.js`, función `getNextDose`) es:

```
próxima toma = última toma + intervalo (en horas)
```

Se suman milisegundos (`horas × 3 600 000`) a una fecha completa, así que los cambios de día, mes y año salen bien sin código especial (ejemplo: 31/12/2026 20:00 + 12 h = 01/01/2027 08:00). Las horas se muestran en la zona horaria local del dispositivo.

Los horarios habituales (08:00 y 20:00) son **informativos**: el cálculo siempre parte de la última toma realmente registrada. No se hacen ajustes automáticos.

La última toma de Letondal viene con la hora 18:00 como dato inicial, pero **la fecha la confirma la persona** en la pantalla de bienvenida; no hay una fecha fija en el código.

## 10. Cómo se actualiza la cuenta regresiva

`timer.js` usa `setInterval(tick, 1000)`. En cada segundo:

1. Calcula `próxima toma − ahora` para cada medicamento.
2. Actualiza el texto ("Próxima toma en 2 h 35 min") y la barra de progreso.
3. Si el tiempo llegó a cero, muestra "Horario de toma alcanzado" y cuánto pasó. **No registra nada ni reinicia el contador**: solo cambia cuando la persona registra o edita una toma.

Al volver a la pestaña tras un rato, se recalcula al instante (los navegadores frenan los temporizadores en segundo plano).

## 11. Cómo modificar los medicamentos

- **Desde la app**: sección *Ajustes* (nombre, intervalo, horarios habituales y última toma).
- **Desde el código**: en `js/medication.js`, función `defaultState()`. Cada medicamento es un bloque:

```js
{
  id: 'letondal',          // identificador único, sin espacios
  name: 'Letondal',
  intervalHours: 8,
  schedule: [],            // horarios habituales, ej. ['08:00', '20:00']
  suggestedTime: '18:00',  // hora propuesta en la bienvenida (opcional)
  history: []
}
```

Para agregar un tercer medicamento, copiá un bloque y cambiá `id` y `name`. La interfaz se adapta sola. Si ya usaste la app en tu navegador, usá *Restablecer valores iniciales* para ver los cambios.

## 12. Cómo cambiar colores y tipografías

- **Colores**: en `css/styles.css`, bloque `:root`. Cambiar `--forest` cambia el fondo; `--sage` y `--eucalyptus` los acentos; `--cream` el texto.
- **Tipografías**: variables `--font-display` (títulos) y `--font-body` (textos). Para usar otra de Google Fonts, cambiá el enlace en `<head>` de `index.html` y el nombre en la variable. Mantené una alternativa del sistema al final de la lista.
- **Fondo**: `assets/bg-leaves.svg`.

## 13. Cómo modificar el logo

`assets/logo.svg` está hecho con formas simples y comentado por partes: círculo y marcas (reloj), dos hojas que forman el corazón, nervaduras, agujas y tallo con brote. Abrilo en VS Code, cambiá colores (`stroke`, `fill`) o coordenadas y mirá el resultado en el navegador.

Si cambiás el logo, regenerá también `favicon.svg` y los PNG de `assets/icons/` (192, 512, 180 px y el *maskable*), porque son los que usa el celular al agregar la app a la pantalla de inicio.

## 14. Ejecutar el proyecto localmente

1. Instalá **Visual Studio Code** y la extensión **Live Server**.
2. Abrí la carpeta `MediTime` (*Archivo → Abrir carpeta*).
3. Clic derecho en `index.html` → **Open with Live Server**.
4. Se abre en `http://127.0.0.1:5500/`. Al guardar un archivo, la página se recarga sola.

Usá Live Server (y no hacer doble clic en el archivo): el service worker y la instalación como app solo funcionan con `http://` o `https://`. La app funciona igual sin ellos, pero así probás todo.

## 15. Publicar en GitHub Pages

1. **Crear el repositorio**: en github.com → *New repository*. Nombre: `MediTime`. Público. Sin README inicial (ya tenés uno).
2. **Subir la carpeta** (con Git instalado, desde una terminal dentro de la carpeta del proyecto):
   ```bash
   git init
   git add .
   git commit -m "Primer commit: MediTime"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/MediTime.git
   git push -u origin main
   ```
   Alternativa sin terminal: en el repositorio, *Add file → Upload files* y arrastrá **el contenido** de la carpeta (no la carpeta misma) y conservá las subcarpetas.
3. **Activar Pages**: *Settings → Pages → Build and deployment → Source: Deploy from a branch*.
4. **Rama y carpeta**: Branch `main`, carpeta `/ (root)` → *Save*.
5. **Enlace público**: tras uno o dos minutos aparece arriba en la misma pantalla: `https://TU-USUARIO.github.io/MediTime/`.
6. **Abrirlo en el celular**: pegá ese enlace en el navegador del teléfono (por ejemplo, enviándotelo por mensaje).

Todas las rutas del proyecto son **relativas** (`css/styles.css`, `assets/logo.svg`), así que funcionan dentro de `/MediTime/`.

Para publicar cambios: `git add .` → `git commit -m "Descripción"` → `git push`. El service worker busca siempre la versión nueva primero, así que no queda una versión vieja trabada (si ves una vieja, recargá una vez).

### Agregarla a la pantalla de inicio

**Android (Chrome):** abrí el enlace → menú ⋮ → **Instalar aplicación** o **Agregar a pantalla principal** → confirmar.

**iPhone (Safari):** abrí el enlace en **Safari** → botón **Compartir** (cuadrado con flecha) → **Agregar a pantalla de inicio** → **Agregar**.

Una vez instalada, se abre a pantalla completa como una app. Los datos son los mismos que en el navegador **en ese dispositivo**; en iPhone, la app instalada puede tener su propio almacenamiento separado de Safari, así que conviene elegir un solo lugar (el ícono) y usar siempre ese.

---

## Avisos del navegador (opcional)

En *Ajustes* hay un interruptor de avisos. Limitaciones, para no esperar de más:

- Solo se disparan **mientras MediTime esté abierta** (en una pestaña o como app). Con la app cerrada no llegan: eso requeriría un servidor (notificaciones push), y este proyecto no usa servidores.
- En iPhone, las notificaciones web requieren iOS 16.4+ y tener la app instalada en la pantalla de inicio.
- El navegador puede detener los temporizadores si el teléfono está bloqueado.

Por eso **no reemplazan una alarma**. Lo principal de MediTime es mostrar los horarios al abrirla.

## Pruebas realizadas

Se probaron en un navegador real (Chromium) y con tests de cálculo en tres zonas horarias (Córdoba, UTC y Nueva York):

- Ultrabiotic Duo 20:00 → próxima 08:00 del día siguiente. ✔
- Letondal 18:00 → próxima 02:00 del día siguiente. ✔
- Cambio de mes (31/10), de año (31/12) y año bisiesto (28/02/2028). ✔
- Los datos persisten al recargar la página. ✔
- Registrar un medicamento no modifica al otro. ✔
- Editar manualmente la última toma recalcula la próxima. ✔
- Confirmación al agregar una toma anterior, editar o eliminar; rechazo de fechas futuras. ✔
- Historial, deshacer, restablecer valores y aviso cuando LocalStorage no está disponible. ✔
- La cuenta regresiva se actualiza, sin desplazamiento horizontal y sin errores en consola. ✔

## Ideas para seguir aprendiendo

1. Agregar un tercer medicamento desde `defaultState()` y ver cómo se adapta la interfaz.
2. Agregar un botón "Exportar datos" que descargue el historial como archivo (`Blob` + `URL.createObjectURL`).
3. Mostrar cuántas tomas se registraron en la última semana.
4. Separar `app.js` en módulos con `import`/`export`.

---

*Hecho con cuidado, en cada momento.* 🌿
