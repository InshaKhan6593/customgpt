import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"

export default async function WebletSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const weblet = await prisma.weblet.findUnique({
    where: { slug },
    select: { id: true, name: true, isActive: true, isPublic: true },
  })

  if (!weblet || !weblet.isActive || !weblet.isPublic) {
    notFound()
  }

  const session = await auth()

  if (!session?.user) {
    redirect(`/login?callbackUrl=/${slug}`)
  }

  // Add weblet to user's sidebar
  await prisma.userWeblet.upsert({
    where: {
      userId_webletId: {
        userId: session.user.id!,
        webletId: weblet.id,
      },
    },
    create: { userId: session.user.id!, webletId: weblet.id },
    update: {},
  })

  redirect(`/chats?w=${weblet.id}`)
}
