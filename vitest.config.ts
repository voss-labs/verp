import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    // Pure logic only. Every unit under test is a function of its arguments —
    // no database, no request, no clock of its own — which is what makes them
    // worth pinning down and cheap to keep green.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
