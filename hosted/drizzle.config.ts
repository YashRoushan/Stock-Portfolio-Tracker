import { defineConfig } from 'drizzle-kit';
export default defineConfig({ out: './drizzle', schema: './hosted/src/schema.ts', dialect: 'sqlite' });
