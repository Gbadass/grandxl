import { utilities as nestWinstonModuleUtilities } from 'nest-winston'
import * as winston from 'winston'
import 'winston-daily-rotate-file'

export function createWinstonConfig(): winston.LoggerOptions {
  const isDev = process.env.NODE_ENV !== 'production'

  const devTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.ms(),
      nestWinstonModuleUtilities.format.nestLike('GrandXL', {
        prettyPrint: true,
        colors: true,
      }),
    ),
  })

  const prodTransports: winston.transport[] = [
    // Combined log — all levels
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    // Error log — error level only
    new winston.transports.DailyRotateFile({
      level: 'error',
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ]

  return {
    level: isDev ? 'debug' : 'info',
    transports: isDev ? [devTransport] : prodTransports,
  }
}
