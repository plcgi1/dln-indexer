import { register } from 'prom-client';
import http from 'http';
import pino from 'pino';
import { AppConfig } from '../config';

export function initPromServer(port: number, target: string = 'indexer', config: AppConfig) {
  const logger = pino({
    name: 'InitPromServer',
    ...config.logging,
  });

  http
    .createServer(async (req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      }
    })
    .listen(port, () => {
      logger.info(`${target}.Metrics server started on port ${port}`);
    });
}
