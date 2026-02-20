import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Star } from "lucide-react"
import type { MarketplaceWeblet } from "@/app/marketplace/page"

interface WebletGridProps {
  weblets: MarketplaceWeblet[]
  searchQuery: string
}

export function WebletGrid({ weblets, searchQuery }: WebletGridProps) {
  if (weblets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-medium text-foreground">No Weblets found</p>
        {searchQuery && (
          <p className="mt-1 text-sm text-muted-foreground">
            {"No results for \""}{searchQuery}{"\""}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {weblets.map((weblet) => (
        <Link key={weblet.slug} href={`/marketplace/weblet/${weblet.slug}`}>
          <Card className="h-full transition-colors hover:border-primary/30">
            <CardContent className="flex h-full flex-col gap-3 pt-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {weblet.icon}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground">{weblet.name}</h3>
                  <p className="text-xs text-muted-foreground">by {weblet.developerName}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-medium text-foreground">{weblet.rating}</span>
                </div>
              </div>

              <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                {weblet.description}
              </p>

              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {weblet.category.replace(/_/g, " ")}
                </Badge>
                <span
                  className={
                    weblet.price === "Free"
                      ? "text-sm font-medium text-primary"
                      : "text-sm font-medium text-foreground"
                  }
                >
                  {weblet.price}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
