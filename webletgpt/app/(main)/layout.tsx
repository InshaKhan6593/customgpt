import { NavHeader } from "@/components/nav-header"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh bg-background">
      <NavHeader />
      <main>{children}</main>
    </div>
  )
}
