import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.IS_PRODUCTION ? 'info' : 'debug',
  
  transport: env.IS_PRODUCTION
    ? undefined
    : {
        target: 'pino-pretty', // In development, for human readability, use pino-pretty
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
});
