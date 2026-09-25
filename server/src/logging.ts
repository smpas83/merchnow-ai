import express from 'express';

export function generateId(): string {
  const hex = Math.random().toString(16).slice(2);
  return `req_${hex.slice(0, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function structuredLog(level: string, message: string, fields?: Record<string, any>): void {
  const entry: any = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields
  };
  delete entry.authorization;
  delete entry.password;
  delete entry.token;
  delete entry.cookie;
  console.log(JSON.stringify(entry));
}

export function requestLogger(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const start = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || generateId();
  res.setHeader('X-Request-ID', requestId);

  const userId = (req as any).user?.userId;
  const role = (req as any).user?.role;

  structuredLog('info', 'request.start', {
    requestId,
    method: req.method,
    route: req.route?.path || req.path,
    query: Object.keys(req.query).length > 0 ? Object.keys(req.query) : undefined
  });

  res.on('finish', () => {
    const latency = Date.now() - start;
    const status = res.statusCode;
    const level: string = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    structuredLog(level, 'request.finish', {
      requestId,
      method: req.method,
      route: req.route?.path || req.path,
      status,
      latency_ms: latency,
      userId: userId || undefined,
      role: role || undefined
    });
  });

  next();
}
