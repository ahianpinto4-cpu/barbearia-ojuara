import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Testes de integração usam um PostgreSQL real (TEST_DATABASE_URL), recriado a
 * cada execução por tests/global-setup.ts. Nenhuma chamada externa é feita:
 * WHATSAPP_DRY_RUN=true e a Claude API é substituída por um cliente roteirizado.
 */
const testDb = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:54329/ojuara_test";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      DATABASE_URL: testDb,
      APP_ENV: "test",
      WHATSAPP_DRY_RUN: "true",
      META_APP_SECRET: "test-app-secret",
      META_VERIFY_TOKEN: "test-verify-token",
      META_PHONE_NUMBER_ID: "123456789",
      SESSION_SECRET: "test-session-secret-with-at-least-32-chars!!",
      CRON_SECRET: "test-cron-secret",
      CLAUDE_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
  },
});
