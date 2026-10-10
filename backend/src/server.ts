import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { pool, initDb } from './core/db.js';

const PORT = env.PORT || 4000;

async function bootstrap() {
  try {
    // Verify PostgreSQL connection and initialize schema DDL
    await initDb();
    logger.info('✅ Native PostgreSQL connected & schema ready');

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Clinic Booking Backend running on http://localhost:${PORT}`);
      logger.info(`📡 WhatsApp Webhook URL: http://localhost:${PORT}/api/webhooks/whatsapp`);
      logger.info(`💳 HDFC Payment Webhook URL: http://localhost:${PORT}/api/webhooks/payment/hdfc`);
    });

    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      server.close(async () => {
        await pool.end();
        logger.info('Server closed. PostgreSQL pool closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start backend server', { error });
    process.exit(1);
  }
}

bootstrap();
