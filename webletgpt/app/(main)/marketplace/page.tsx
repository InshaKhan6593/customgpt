import { prisma as db } from '@/lib/prisma';
import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarketplaceFilters } from '@/components/marketplace/filters';
import { ArrowRight, Bot } from 'lucide-react';

// Always fetch fresh data — never serve a stale static cache
export const dynamic = "force-dynamic";

interface MarketplacePageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
  }>;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const resolvedParams = await searchParams;
  const query = resolvedParams?.q || "";
  const category = resolvedParams?.category || "";

  // Only show publicly available weblets
  const where: any = {
    isActive: true,
    isPublic: true,
  };

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ];
  }

  if (category) {
    where.category = category;
  }

  const weblets = await db.weblet.findMany({
    where,
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      developer: {
        select: { name: true, image: true }
      }
    }
  });

  return (
    <div className="container max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="space-y-1 mb-10">
        <h2 className="text-base font-semibold flex items-center gap-2">
          Marketplace
        </h2>
        <p className="text-sm text-muted-foreground">
          Discover and subscribe to AI Weblets built by the community.
        </p>
      </div>

      <Suspense fallback={<div className="h-10 w-full mb-8 bg-muted animate-pulse rounded-md" />}>
        <MarketplaceFilters />
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-8">
        {weblets.length > 0 ? (
          weblets.map((weblet) => (
            <Link
              key={weblet.id}
              href={`/${weblet.slug || weblet.id}`}
              className="group rounded-lg border bg-card p-5 flex flex-col gap-4 hover:border-primary/30 hover:bg-accent/50 transition-all duration-200"
            >
              {/* Icon + Category */}
              <div className="flex items-start justify-between">
                <div className="shrink-0 size-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                  {weblet.iconUrl ? (
                    <Image
                      src={weblet.iconUrl}
                      alt={weblet.name}
                      width={40}
                      height={40}
                      className="size-10 object-cover"
                    />
                  ) : (
                    <Bot className="size-5 text-muted-foreground" />
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider">
                  {weblet.category || "General"}
                </Badge>
              </div>

              {/* Content */}
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  {weblet.name}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {weblet.description || "An AI-powered agent built to help you."}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">
                    By {weblet.developer?.name || 'Unknown'}
                  </span>
                  <span className="text-base font-semibold text-foreground">
                    {weblet.monthlyPrice ? `$${Number(weblet.monthlyPrice).toFixed(2)}/mo` : 'Free'}
                  </span>
                </div>
                <Button variant="secondary" size="sm" className="gap-1.5 text-sm">
                  View
                  <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full text-center py-24 border rounded-lg border-dashed">
            <h3 className="text-base font-semibold text-foreground">No Weblets found</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
              We couldn't find any weblets matching your criteria. Try adjusting your filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
