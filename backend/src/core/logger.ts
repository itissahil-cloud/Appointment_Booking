type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function maskPhoneNumber(phone?: string): string {
  if (!phone || phone.length < 5) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}

function sanitizeLogPayload(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeLogPayload);

  const sensitiveKeys = [
    'password',
    'passwordHash',
    'token',
    'secret',
    'hdfcSecret',
    'apiKey',
    'accessToken',
    'medicalNotes',
    'note',
  ];

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (lowerKey.includes('phone')) {
      sanitized[key] = typeof value === 'string' ? maskPhoneNumber(value) : '[REDACTED_PHONE]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogPayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function formatLog(level: LogLevel, message: string, meta?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { metadata: sanitizeLogPayload(meta) } : {}),
  };
  return JSON.stringify(logEntry);
}

export const logger = {
  info: (message: string, meta?: any) => console.log(formatLog('info', message, meta)),
  warn: (message: string, meta?: any) => console.warn(formatLog('warn', message, meta)),
  error: (message: string, meta?: any) => console.error(formatLog('error', message, meta)),
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('debug', message, meta));
    }
  },
};
