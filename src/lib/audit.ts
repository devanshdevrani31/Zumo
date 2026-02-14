import { createHash } from 'crypto'
import prisma from '@/lib/db'

export interface AuditLogEntry {
  id: string
  employeeId: string | null
  action: string
  details: string
  hash: string
  previousHash: string
  timestamp: Date
  orgId: string | null
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

function computeHash(
  previousHash: string,
  action: string,
  details: string,
  timestamp: string,
): string {
  const payload = `${previousHash}|${action}|${details}|${timestamp}`
  return createHash('sha256').update(payload).digest('hex')
}

export class AuditLogger {
  async log(
    action: string,
    details: string,
    employeeId?: string,
    orgId?: string,
  ): Promise<AuditLogEntry> {
    const previousHash = await this.getLastHash(orgId)
    const timestamp = new Date()
    const hash = computeHash(previousHash, action, details, timestamp.toISOString())

    const entry = await prisma.auditLog.create({
      data: {
        action,
        details,
        hash,
        previousHash,
        timestamp,
        ...(employeeId ? { employeeId } : {}),
        ...(orgId ? { orgId } : {}),
      },
    })

    return entry as AuditLogEntry
  }

  async verifyChain(orgId?: string): Promise<{ valid: boolean; brokenAt?: number }> {
    const entries = await prisma.auditLog.findMany({
      where: orgId ? { orgId } : {},
      orderBy: { timestamp: 'asc' },
    })

    if (entries.length === 0) {
      return { valid: true }
    }

    let expectedPreviousHash = GENESIS_HASH

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      if (entry.previousHash !== expectedPreviousHash) {
        return { valid: false, brokenAt: i }
      }

      const recomputed = computeHash(
        entry.previousHash,
        entry.action,
        entry.details,
        entry.timestamp.toISOString(),
      )

      if (entry.hash !== recomputed) {
        return { valid: false, brokenAt: i }
      }

      expectedPreviousHash = entry.hash
    }

    return { valid: true }
  }

  async getLastHash(orgId?: string): Promise<string> {
    const lastEntry = await prisma.auditLog.findFirst({
      where: orgId ? { orgId } : {},
      orderBy: { timestamp: 'desc' },
      select: { hash: true },
    })

    return lastEntry?.hash ?? GENESIS_HASH
  }
}

export const auditLogger = new AuditLogger()
