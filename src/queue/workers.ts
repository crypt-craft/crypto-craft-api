import Logger from '@/utils/logger';
import { AirdropService } from '@/services/AirdropService';

async function main() {
  Logger.info('Starting queue workers...');
  // Instantiate service to set up processors
  // AirdropService constructor wires up Bull processors
  // Keep process alive
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const service = new AirdropService();
  process.on('SIGINT', async () => {
    Logger.info('Shutting down workers (SIGINT)');
    try {
      await service.shutdown();
      process.exit(0);
    } catch (e) {
      Logger.error('Shutdown error', { error: (e as any)?.message });
      process.exit(1);
    }
  });
  process.on('SIGTERM', async () => {
    Logger.info('Shutting down workers (SIGTERM)');
    try {
      await service.shutdown();
      process.exit(0);
    } catch (e) {
      Logger.error('Shutdown error', { error: (e as any)?.message });
      process.exit(1);
    }
  });
}

main().catch((e) => {
  Logger.error('Worker fatal error', { error: (e as any)?.message });
  process.exit(1);
});


