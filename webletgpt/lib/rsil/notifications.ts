import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function notifyDeveloper(input: {
  webletId: string
  eventType:
    | 'rsil.approval-required'
    | 'rsil.ab-test-concluded'
    | 'rsil.rollback-triggered'
    | 'rsil.canary-advanced'
  notificationType: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'success'
  context?: Prisma.InputJsonObject
}) {
  const eventData = {
    notificationType: input.notificationType,
    title: input.title,
    message: input.message,
    severity: input.severity,
    context: input.context ?? {},
  } satisfies Prisma.InputJsonObject

  return prisma.analyticsEvent.create({
    data: {
      webletId: input.webletId,
      eventType: input.eventType,
      eventData,
    },
  })
}
