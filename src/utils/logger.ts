import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

const prettyPrint = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const ts = typeof timestamp === 'string' ? timestamp : new Date().toISOString();
  const levelPadded = level.toUpperCase().padEnd(7, ' ');
  const metaKeys = Object.keys(meta || {});
  const replacer = (_k: string, v: unknown) => {
    if (v instanceof Error) {
      return { name: v.name, message: v.message };
    }
    if (typeof v === 'number') {
      const rounded = Math.abs(v) < 1 ? Number(v.toFixed(6)) : Number(v.toFixed(2));
      return rounded;
    }
    return v as any;
  };
  const compactMeta = metaKeys.length > 0 ? ` ${JSON.stringify(meta, replacer)}` : '';
  return `${ts} ${levelPadded} ${message}${compactMeta}`;
});

const Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp(),
    isProduction
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), prettyPrint)
  ),
  transports: [new winston.transports.Console({ stderrLevels: ['error', 'warn'] })],
});

export default Logger;
