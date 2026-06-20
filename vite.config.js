import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [cloudflare()],
  server: {
    port: parseInt(process.env.PORT || '5174'),
    strictPort: false,
  },
  optimizeDeps: {
    include: ['bpmn-js', 'diagram-js', 'js-yaml', 'tiny-svg'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
