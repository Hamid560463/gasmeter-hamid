import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // process.cwd() is available in the Node.js environment where Vite runs
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This ensures process.env.API_KEY works in the browser for the existing code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // We don't redefine the whole process object to avoid conflicts, just specific keys if needed,
      // but 'process.env' usage in code is common so we define it partially or rely on replacement.
      // A safer approach for Vite is often to use import.meta.env, but to keep existing code working:
      'process.env': {
         API_KEY: env.API_KEY
      }
    }
  };
});