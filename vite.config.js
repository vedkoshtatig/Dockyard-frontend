import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendProxyUrl = env.BACKEND_PROXY_URL || 'http://localhost:9004';

  return {
    server: {
      port: 9010,
      proxy: {
        '/api': {
          changeOrigin: true,
          target: backendProxyUrl,
        },
      },
    },
  };
});
