import { defineConfig } from 'vite';
import { getChiangRaiRainSnapshot } from './src/services/rainfallProxy';

export default defineConfig({
  plugins: [{
    name: 'chiangrai-rain-proxy',
    configureServer(server) {
      server.middlewares.use('/api/chiangrai-rain', async (_request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          response.end(JSON.stringify(await getChiangRaiRainSnapshot()));
        } catch (error) {
          console.error('Chiang Rai rain proxy failed:', error);
          response.statusCode = 503;
          response.end(JSON.stringify({ error: 'ยังไม่สามารถอัปเดตข้อมูลฝนจังหวัดเชียงรายได้' }));
        }
      });
    },
  }],
  server: { port: 5173, host: '0.0.0.0', allowedHosts: true },
  preview: { port: 4173, host: '0.0.0.0', allowedHosts: true }
});
