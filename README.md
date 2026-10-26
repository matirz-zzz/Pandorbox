# 📈 Pandorbox - Gestor de Inversiones

Aplicación web moderna, 100% responsive e independiente para organizar y monitorear inversiones (acciones, CEDEARs, ETFs y criptomonedas), utilizando Google Sheets como base de datos headless a través de Google Apps Script.

---

## 🏛️ Arquitectura Desacoplada

El proyecto está diseñado bajo una arquitectura de dos capas:

```
[ Frontend: GitHub Pages / Vercel ]
              │
              │  Peticiones HTTPS (JSON)
              ▼
[ Backend: Google Apps Script Web App ]
              │
              │  Lectura / Escritura
              ▼
[ Base de Datos: Google Sheets ]
```

- **Frontend (Vanilla HTML/CSS/JS):**
  - **100% Responsive:** Experiencia fluida tanto en computadoras de escritorio como en dispositivos móviles (barra de navegación inferior táctil, tablas adaptables con búsqueda rápida).
  - **Modo Oscuro / Claro:** Tema moderno con estética glassmorphic, tipografía profesional (*Plus Jakarta Sans* y *JetBrains Mono*).
  - **Gráficos Interactivos (Chart.js):** Evolución histórica de la cartera, distribución porcentual por activo y rendimiento neto en USD.
  - **Mercado en Vivo:** Dólar MEP, Dólar Cripto, NVIDIA, S&P 500 y Bitcoin con actualización automática.
  - **Modo Demo Integrado:** Permite abrir y probar la aplicación de inmediato incluso sin haber configurado el backend aún.

- **Backend (`Código.gs`):**
  - Corre en los servidores de Google y expone una API REST ligera mediante `doGet` y `doPost`.
  - Mantiene tu Google Sheet como base de datos viva, permitiéndote ver o editar filas desde Excel / Sheets cuando lo desees.

---

## 🚀 Guía de Puesta en Marcha

### 1. Desplegar el Backend en Google Apps Script

1. Abre tu planilla de Google Sheets y ve a **Extensiones** > **Apps Script**.
2. Copia y pega el contenido actualizado de [`Código.gs`](Código.gs) en el editor.
3. Arriba a la derecha, haz clic en **Implementar** (Deploy) > **Nueva implementación** (New deployment).
4. En el engranaje ⚙️ de la izquierda, selecciona **Aplicación web** (Web app):
   - **Descripción:** `API v1 Pandorbox`
   - **Ejecutar como:** `Yo` (tu cuenta de Google)
   - **Quién tiene acceso:** `Cualquier usuario` (Anyone) *(necesario para que tu web externa pueda leer los datos).*
5. Haz clic en **Implementar** y autoriza los permisos requeridos.
6. Copia la **URL de la aplicación web** generada (termina en `/exec`).

### 2. Conectar el Frontend

1. Abre [`index.html`](index.html) en tu navegador (puedes hacer doble clic en el archivo).
2. Haz clic en el ícono de engranaje **⚙️** en la esquina superior derecha.
3. Pega la URL del Web App que copiaste en el paso anterior y haz clic en **Guardar Configuración**.
4. ¡Listo! La web se sincronizará con tu planilla de Google Sheets.

---

## 🐙 Publicar en GitHub y GitHub Pages

Para publicar tu web gratis en GitHub Pages con tu propio repositorio:

1. Abre una terminal en esta carpeta (`c:\Users\mrossi\Desktop\Pandorbox`).
2. Inicializa el repositorio Git:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit for pandorbox modern web app"
   ```
3. Crea un nuevo repositorio en [GitHub](https://github.com/new) llamado `pandorbox`.
4. Vincula tu repositorio local y sube los cambios:
   ```bash
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/pandorbox.git
   git push -u origin main
   ```
5. En GitHub, ve a **Settings** > **Pages**:
   - En **Build and deployment** > **Branch**, selecciona `main` y la carpeta `/(root)`.
   - Haz clic en **Save**.
6. En un par de minutos tendrás tu web publicada en `https://TU_USUARIO.github.io/pandorbox/`.

---

## 📁 Estructura del Proyecto

```
Pandorbox/
├── css/
│   └── style.css            # Sistema de diseño, tokens, modo oscuro y responsive
├── js/
│   ├── config.js            # Configuración, claves de LocalStorage y datos demo
│   ├── api.js               # Conector con la API REST de Google Apps Script
│   ├── charts.js            # Control y renderizado visual con Chart.js
│   └── app.js               # Lógica de la aplicación, formularios y navegación
├── Código.gs                # Backend para Google Apps Script con endpoints REST
├── index.html               # Interfaz web moderna (punto de entrada)
├── Index_original_gas.html  # Respaldo del index monolítico original
└── README.md                # Documentación del proyecto
```
