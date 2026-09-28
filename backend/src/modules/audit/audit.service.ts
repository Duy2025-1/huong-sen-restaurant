import { prisma } from '../../config/prisma.js';

export interface AuditLogParams {
  staffId?: number | null;
  action: string;
  entity: string;
  entityId?: number | null;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  static async log(params: AuditLogParams) {
    try {
      return await prisma.auditLog.create({
        data: {
          staffId: params.staffId || null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId || null,
          oldValue: params.oldValue !== undefined ? JSON.stringify(params.oldValue) : null,
          newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (err) {
      console.error('Failed to create audit log:', err);
      // Non-blocking for primary transaction flow
      return null;
    }
  }

  static async getLogs(limit: number = 100) {
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: { select: { code: true, name: true } },
          },
        },
      },
    });
  }
}
