import { FastifyRequest } from 'fastify';
import { UserRole } from '../middlewares/rbac.middleware';

declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            id: string;
            email?: string;
            [key: string]: any;
        };
        userRole?: UserRole;
    }
}
