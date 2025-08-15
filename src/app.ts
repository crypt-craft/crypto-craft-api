/**
 * Main application entry point
 * Initializes Express server with GraphQL and REST APIs
 */

import express, { Request } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { ApolloServer, ExpressContext } from 'apollo-server-express';
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore types may be missing in some environments
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore types may be missing in some environments
import depthLimit from 'graphql-depth-limit';

// Import core components
import { BlockchainManagerImpl } from '@/core/BlockchainManager';
import { AdapterFactoryImpl } from '@/core/AdapterFactory';
import Logger from '@/utils/logger';
import { DatabaseClient, prisma } from '@/database/prisma';
import authRoutes from '@/api/routes/authRoutes';
import transactionRoutes from '@/api/routes/transactionRoutes';
import airdropRoutes from '@/api/routes/airdropRoutes';
import { AuthService } from '@/services/AuthService';
import { AirdropService } from '@/services/AirdropService';
import { verifyJWT, AuthenticatedUser } from '@/middleware/auth';

// Import GraphQL schema and resolvers
import { typeDefs } from '@/api/graphql/schema';
import { resolvers } from '@/api/graphql/resolvers';

// Load environment variables
dotenv.config();

export interface Context {
  user?: AuthenticatedUser;
  blockchainManager: BlockchainManagerImpl;
  prisma: typeof import('@/database/prisma').prisma;
  authService: AuthService;
}

class CryptoCraftServer {
  private app: express.Application;
  private httpServer: any;
  private apolloServer: ApolloServer | null = null;
  private blockchainManager: BlockchainManagerImpl;
  private adapterFactory: AdapterFactoryImpl;
  private authService: AuthService;
  private airdropService: AirdropService;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    
    // Initialize blockchain components
    this.adapterFactory = new AdapterFactoryImpl(Logger);
    this.blockchainManager = new BlockchainManagerImpl(this.adapterFactory, Logger);
    this.authService = new AuthService();
    this.airdropService = new AirdropService();
  }

  async initialize(): Promise<void> {
    try {
      // Setup middleware
      await this.setupMiddleware();
      
      // Initialize database connection according to mode flags
      const DB_OFF = process.env.DB_OFF_MODE === 'true';
      if (DB_OFF) {
        Logger.warn('DB_OFF_MODE enabled: skipping database initialization entirely');
      } else if (process.env.AUTH_STATELESS_MODE === 'true') {
        try {
          await this.initializeDatabase();
        } catch (error) {
          // Allow server to start without DB when in stateless mode
          Logger.warn('Database initialization failed, continuing in AUTH_STATELESS_MODE', { error });
        }
      } else {
        await this.initializeDatabase();
      }
      
      // Initialize blockchain connections
      await this.initializeBlockchainAdapters();
      
      // Setup GraphQL server
      await this.setupGraphQL();
      
      // Setup REST routes
      this.setupRestRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      Logger.info('CryptoCraft API server initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize server:', error);
      throw error;
    }
  }

  private async setupMiddleware(): Promise<void> {
    // CORS configuration (supports multiple origins via comma-separated list)
const rawOrigins = process.env.CORS_ORIGIN || 'https://app.crypto-craft.local,http://localhost:5173,http://localhost:3000';
    const allowedOrigins = rawOrigins
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    const corsOptions = {
      origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!requestOrigin) return callback(null, true);
        if (allowedOrigins.includes('*') && process.env.NODE_ENV !== 'production') return callback(null, true);
        if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
        // Dev convenience: allow localhost/*.local automatically when not production
        try {
          const url = new URL(requestOrigin);
          const host = url.hostname;
          if (process.env.NODE_ENV !== 'production' && (host === 'localhost' || host.endsWith('.local'))) {
            return callback(null, true);
          }
        } catch {}
        return callback(new Error(`CORS: Origin ${requestOrigin} is not allowed`));
      },
      credentials: true,
      optionsSuccessStatus: 204
    } as cors.CorsOptions;
    this.app.use(cors(corsOptions));

    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }));

    // Request logging (concise in development)
    const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'tiny';
    this.app.use(morgan(morganFormat, {
      stream: {
        write: (message: string) => Logger.http(message.trim())
      }
    }));

    // Rate limiting
    // Honour reverse proxy headers for rate-limit and IP detection
    // Use a safer trust proxy setting to avoid express-rate-limit ValidationError
    const trustProxy = process.env.TRUST_PROXY || 'loopback';
    this.app.set('trust proxy', trustProxy);

    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
      max: parseInt(process.env.RATE_LIMIT_RPM || '100'),
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api', (req, res, next) => {
      if (req.path.startsWith('/auth/')) return next();
      return (limiter as any)(req, res, next);
    });

    // Explicitly allow auth endpoints preflight without CORS error
    this.app.options('/api/auth/*', cors());
    // GraphQL rate limit at app level
    const gqlLimiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
      max: parseInt(process.env.GRAPHQL_RATE_LIMIT_RPM || '60'),
      message: 'Too many GraphQL requests',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/graphql', gqlLimiter);

    // Body parsing
    this.app.use(express.json({ limit: '2mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    Logger.info('Middleware setup completed');
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Initialize Prisma database connection
      await DatabaseClient.connect();
      
      // Perform database health check
      const dbHealth = await DatabaseClient.healthCheck();
      if (dbHealth.status === 'healthy') {
        Logger.info('✅ Database connected and healthy (Prisma)');
      } else {
        Logger.error('❌ Database health check failed', { error: dbHealth.error });
        throw new Error(`Database unhealthy: ${dbHealth.error}`);
      }
      
    } catch (error) {
      Logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async initializeBlockchainAdapters(): Promise<void> {
    try {
      // Initialize Solana adapter
      if (process.env.SOLANA_RPC_URL) {
        const solanaAdapter = await this.blockchainManager.getAdapter('solana');
        Logger.info('Solana adapter initialized and connected');
      } else {
        Logger.warn('SOLANA_RPC_URL not configured, Solana adapter not initialized');
      }

      // Future blockchain initializations can be added here
      
    } catch (error) {
      Logger.error('Failed to initialize blockchain adapters:', error);
      throw error;
    }
  }

  private async setupGraphQL(): Promise<void> {
    try {
      this.apolloServer = new ApolloServer<ExpressContext>({
        typeDefs,
        resolvers,
        introspection: process.env.NODE_ENV !== 'production',
        validationRules: [depthLimit(10)],
        plugins: process.env.NODE_ENV !== 'production' 
          ? [ApolloServerPluginLandingPageGraphQLPlayground({ settings: { 'request.credentials': 'include' } })]
          : [],
        context: async ({ req }): Promise<Context> => {
          const request = req as Request;
          return {
            user: await this.extractUserFromToken(request.headers?.authorization),
            blockchainManager: this.blockchainManager,
            prisma: prisma,
            authService: this.authService
          };
        }
      });

      await this.apolloServer.start();
      // Apply middleware at /graphql
      // apollo-server-express v3 integrates with Express via applyMiddleware
      // Apply middleware
      (this.apolloServer as ApolloServer).applyMiddleware({ app: this.app as any, path: '/graphql' });

      Logger.info('GraphQL server setup completed');
    } catch (error) {
      Logger.error('Failed to setup GraphQL server:', error);
      throw error;
    }
  }

  private setupRestRoutes(): void {
    // Root redirect to API info for better DX
    this.app.get('/', (req, res) => res.redirect('/api'));

    // API info endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'CryptoCraft API',
        version: process.env.npm_package_version || '1.0.0',
        description: 'GraphQL/REST API platform for business tokenization and airdrop operations',
        endpoints: {
          graphql: '/graphql',
          health: '/health',
          docs: '/api/docs'
        },
        blockchain: {
          supported: this.blockchainManager.getSupportedBlockchains(),
          active: this.blockchainManager.getActiveAdapters()
        }
      });
    });

    // Blockchain status endpoint
    this.app.get('/api/blockchain/status', async (req, res) => {
      try {
        const status = await this.blockchainManager.getHealthStatus();
        res.json(status);
      } catch (error) {
        Logger.error('Failed to get blockchain status:', error);
        res.status(500).json({ error: 'Failed to get blockchain status' });
      }
    });

    // Token operations endpoints (placeholder kept, narrower scope if needed)
    this.app.get('/api/tokens', (req, res) => {
      res.status(501).json({
        message: 'Token list endpoint not implemented yet',
        availableViaGraphQL: true
      });
    });

    // Auth routes
    this.app.use('/api/auth', authRoutes);

    // Transaction routes (безпечна Web3 взаємодія)
    this.app.use('/api/transactions', transactionRoutes);

    // IPFS routes (backend proxy to Pinata)
    // Lazy import to avoid circular deps
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ipfsRoutes = require('@/api/routes/ipfsRoutes').default;
    this.app.use('/api/ipfs', ipfsRoutes);

    // Airdrop root placeholder only (do not block sub-routes)
    this.app.get('/api/airdrops', (req, res) => {
      res.status(501).json({
        message: 'Airdrop endpoints not implemented yet',
        availableViaGraphQL: true
      });
    });

    // Airdrop routes (з queue system)
    this.app.use('/api/airdrops', airdropRoutes);

    Logger.info('REST routes setup completed');
  }

  private setupErrorHandling(): void {
    // Handle 404
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        message: `The endpoint ${req.originalUrl} does not exist`,
        availableEndpoints: [
          '/health', 
          '/api', 
          '/graphql', 
          '/api/blockchain/status',
          '/api/auth/*',
          '/api/transactions/*',
          '/api/airdrops/*'
        ]
      });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      Logger.error('Unhandled error:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
      });
    });

    Logger.info('Error handling setup completed');
  }

  private async extractUserFromToken(authorization?: string): Promise<AuthenticatedUser | undefined> {
    if (!authorization) {
      return undefined;
    }

    try {
      const token = authorization.startsWith('Bearer ') 
        ? authorization.substring(7) 
        : authorization;

      const result = await this.authService.validateToken(token);
      
      if (result.valid && result.user && result.payload) {
        return {
          ...result.user,
          role: result.payload.role
        };
      }

      return undefined;

    } catch (error) {
      Logger.debug('Token extraction failed', { error });
      return undefined;
    }
  }

  async start(): Promise<void> {
    const port = process.env.PORT || 4000;
    
      return new Promise((resolve, reject) => {
        this.httpServer.listen(port, (error?: Error) => {
          if (error) {
            Logger.error('Failed to start server:', error);
            reject(error);
          } else {
            Logger.info(`🚀 Server ready at http://localhost:${port}`);
            Logger.info(`📊 GraphQL playground available at http://localhost:${port}/graphql`);
            Logger.info(`🏥 Health check available at http://localhost:${port}/health`);
            resolve();
          }
        });
      });
  }

  async stop(): Promise<void> {
    try {
      // Stop Apollo Server
      if (this.apolloServer) {
        await this.apolloServer.stop();
        Logger.info('Apollo Server stopped');
      }

      // Disconnect blockchain adapters
      await this.blockchainManager.disconnectAll();
      Logger.info('Blockchain adapters disconnected');

      // Disconnect database (skip if DB_OFF_MODE)
      if (process.env.DB_OFF_MODE === 'true') {
        Logger.warn('DB_OFF_MODE enabled: skipping database disconnect');
      } else {
        await DatabaseClient.disconnect();
        Logger.info('Database disconnected');
      }

      // Close HTTP server
      return new Promise((resolve) => {
        this.httpServer.close(() => {
          Logger.info('HTTP server stopped');
          resolve();
        });
      });
    } catch (error) {
      Logger.error('Error stopping server:', error);
      throw error;
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Initialize and start server
async function startServer() {
  const server = new CryptoCraftServer();
  
  try {
    await server.initialize();
    await server.start();
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      Logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        Logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    Logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

export { CryptoCraftServer };
export default startServer;