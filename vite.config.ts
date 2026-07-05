import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

// Bake .env into the compiled output so packaged builds don't need the file at runtime.
// Values are inlined at build time — never shipped as a plain-text file in the bundle.
const envPath = path.resolve(__dirname, '.env')
const rawEnv = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath, 'utf-8')) : {}

// Inject .env values via dot-notation defines (the only form esbuild/Vite accepts).
// Bracket-notation accesses like process.env['KEY'] are also replaced because esbuild
// resolves process.env to the same object and substitutes matched property accesses.
const defineEnv: Record<string, string> = {}
for (const [key, value] of Object.entries(rawEnv)) {
  defineEnv[`process.env.${key}`] = JSON.stringify(value)
}

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: path.resolve(__dirname, 'src/main/main.ts'),
        onstart(options) {
          options.startup()
        },
        vite: {
          define: defineEnv,
          build: {
            outDir: path.resolve(__dirname, 'dist-electron'),
            rollupOptions: {
              external: ['electron'],
              output: { entryFileNames: '[name].js' },
            },
          },
          resolve: {
            alias: {
              '@shared': path.resolve(__dirname, 'src/shared'),
            },
          },
        },
      },
      {
        entry: path.resolve(__dirname, 'src/main/preload.ts'),
        onstart(args) { args.reload() },
        vite: {
          define: defineEnv,
          build: {
            outDir: path.resolve(__dirname, 'dist-electron'),
            rollupOptions: {
              external: ['electron'],
              output: { entryFileNames: '[name].js' },
            },
          },
        },
      },
      {
        entry: path.resolve(__dirname, 'src/main/messengerPreload.ts'),
        onstart(args) { args.reload() },
        vite: {
          define: defineEnv,
          build: {
            outDir: path.resolve(__dirname, 'dist-electron'),
            rollupOptions: {
              external: ['electron'],
              output: { entryFileNames: '[name].js' },
            },
          },
        },
      },
    ]),
  ],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
})
