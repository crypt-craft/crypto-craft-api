/**
 * Application Entry Point
 * Simple entry point that imports and starts the main app
 */

import startServer from './app';

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});