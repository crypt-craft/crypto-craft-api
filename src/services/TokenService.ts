import { BlockchainManagerImpl } from '@/core/BlockchainManager';

export class TokenService {
  // Accept optional manager to align with resolver usage, but keep it optional for tests
  constructor(_manager?: BlockchainManagerImpl) {}

  async buildUnsigned(): Promise<string> {
    return 'unsigned-tx';
  }
}
