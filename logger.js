const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory jika belum ada
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length > 0 && meta.stack) {
        metaStr = `\n${meta.stack}`;
      } else if (Object.keys(meta).length > 0) {
        metaStr = ` ${JSON.stringify(meta)}`;
      }
      return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
    })
  ),
  defaultMeta: { service: 'moodle-auto-grader' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      )
    }),
    
    // File output - All logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File output - Errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File output - Grading results
    new winston.transports.File({
      filename: path.join(logsDir, 'grading.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: winston.format.json()
    })
  ]
});

module.exports = logger;
