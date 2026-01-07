import { FastifyRequest, FastifyReply } from 'fastify';

// Store simples em memória (em produção usar Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;  // Janela de tempo em ms
  maxRequests: number;  // Máximo de requisições por janela
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minuto
  maxRequests: 100,  // 100 requisições por minuto
};

const strictConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 10,  // 10 requisições por minuto (para endpoints sensíveis)
};

export function createRateLimiter(config: RateLimitConfig = defaultConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip || 'unknown';
    const key = `${ip}:${request.routeOptions.url}`;
    const now = Date.now();

    let record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + config.windowMs };
      requestCounts.set(key, record);
    } else {
      record.count++;
    }

    // Headers de rate limit
    reply.header('X-RateLimit-Limit', config.maxRequests);
    reply.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - record.count));
    reply.header('X-RateLimit-Reset', record.resetTime);

    if (record.count > config.maxRequests) {
      return reply.status(429).send({
        error: 'Muitas requisições. Tente novamente em alguns segundos.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }
  };
}

// Rate limiters pré-configurados
export const rateLimiter = createRateLimiter(defaultConfig);
export const strictRateLimiter = createRateLimiter(strictConfig);

// Limpar registros antigos periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 60 * 1000);
