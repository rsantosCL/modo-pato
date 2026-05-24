import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/vite-env.d.ts', 'src/main.ts'],
      reporter: ['text', 'html'],
      thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
    },
  },
}))
