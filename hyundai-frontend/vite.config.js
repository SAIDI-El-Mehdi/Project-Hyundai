import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true,
    // 🌟 HADI HYA S-S-I-7-R! K-t-g-o-u-l l-Vite y-d-w-w-z l-Backend o-t-o-m-a-t-i-q-i-y-a-n
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        name: 'Hyundai Flux Atelier',
        short_name: 'HyundaiFlux',
        description: 'Système de gestion des flux atelier pour Hyundai',
        theme_color: '#002C5F',
        background_color: '#020617',
        display: 'standalone', 
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
})