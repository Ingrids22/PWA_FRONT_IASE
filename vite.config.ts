import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: "To-Do List",
        short_name: "To-Do",
        description: "Una aplicación de lista de tareas simple y eficiente.",
        theme_color: "#007bff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ], // <-- Aquí cerramos el arreglo de iconos
        screenshots: [ // <-- Screenshots es una propiedad nueva, fuera de icons
          {
            src: "screenshots/desktop-view.png",
            sizes: "1032x1028",
            type: "image/png",
            form_factor: "wide",
            label: "Vista de escritorio de To-Do List"
          }
          // Si llegas a agregar la versión móvil, iría aquí abajo
        ]
      }
    })
  ],
})