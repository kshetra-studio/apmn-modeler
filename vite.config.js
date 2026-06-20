import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
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
