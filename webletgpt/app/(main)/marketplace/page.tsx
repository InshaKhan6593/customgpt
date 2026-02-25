import { prisma as db } from '@/lib/prisma';
import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarketplaceFilters } from '@/components/marketplace/filters';

interface MarketplacePageProps {
  searchParams: {
    q?: string;
    category?: string;
  };
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const query = searchParams?.q || "";
  const category = searchParams?.category || "";

  // Construct where clause based on search params
  const where: any = {};
  
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
      <div className="flex flex-col space-y-4 mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Marketplace</h1>
        <p className="text-xl text-muted-foreground">
          Discover and subscribe to powerful AI Weblets built by the community.
        </p>
      </div>

      <Suspense fallback={<div className="h-10 w-full mb-8 bg-muted animate-pulse rounded-md" />}>
        <MarketplaceFilters />
      </Suspense>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {weblets.length > 0 ? (
          weblets.map((weblet) => (
            <Card key={weblet.id} className="flex flex-col h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl line-clamp-1">{weblet.name}</CardTitle>
                </div>
                <CardDescription className="mt-2 text-sm">
                  {weblet.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                 <div className="flex flex-wrap gap-2 mb-4">
                  {weblet.category ? (
                    <Badge variant="secondary">{weblet.category}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-transparent border-transparent select-none">None</Badge>
                  )}
                 </div>
                 <div className="text-sm text-muted-foreground mt-4">
                   By {weblet.developer?.name || 'Unknown'}
                 </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t pt-4">
                <div className="text-lg font-semibold">
                  {weblet.monthlyPrice ? `$${Number(weblet.monthlyPrice).toFixed(2)}/mo` : 'Free'}
                </div>
                <Link href={`/${weblet.slug || weblet.id}`}>
                  <Button variant="default">View details</Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-24 border rounded-xl bg-muted/20">
            <h3 className="text-lg font-medium">No Weblets found</h3>
            <p className="text-muted-foreground mt-2">
              Try adjusting your search query or category filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
