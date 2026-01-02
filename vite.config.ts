
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const dbUrl = env.DATABASE_URL || env.VITE_DATABASE_URL || '';
  const apiKey = env.API_KEY || env.VITE_API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // Shimming both for maximum compatibility across different code styles
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.DATABASE_URL': JSON.stringify(dbUrl),
      'import.meta.env.VITE_DATABASE_URL': JSON.stringify(dbUrl),
      'import.meta.env.VITE_API_KEY': JSON.stringify(apiKey),
      'process.env': {
         API_KEY: apiKey,
         DATABASE_URL: dbUrl
      }
    }
  };
});
