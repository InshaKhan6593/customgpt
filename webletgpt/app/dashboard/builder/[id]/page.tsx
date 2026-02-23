"use client"

import { use } from "react"
import { BuilderLayout } from "@/components/builder/builder-layout"

export default function BuilderStudioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <BuilderLayout webletId={id} />
}

