import { GovernancePanel } from "@/components/rsil/governance-panel"

type AdvancedSettingsPageProps = {
  params: Promise<{ webletId: string }>
}

export default async function AdvancedSettingsPage({ params }: AdvancedSettingsPageProps) {
  const { webletId } = await params
  
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Advanced Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure governance rules and safety guardrails for automated optimization
        </p>
      </div>

      <GovernancePanel webletId={webletId} />
    </div>
  )
}
