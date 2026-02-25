import { prisma as db } from '@/lib/prisma';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function MarketplacePage() {
  // Fetch public weblets logic will go here
  // For now, let's just make a mock structure or fetch whatever weblets are available.
  const weblets = await db.weblet.findMany({
    where: { 
      // isPublic: true - In reality we'd filter by a public flag, but for now we'll show all or a mock.
    },
    take: 10,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {weblets.length > 0 ? (
          weblets.map((weblet) => (
            <Card key={weblet.id} className="flex flex-col h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{weblet.name}</CardTitle>
                </div>
                <CardDescription className="line-clamp-2 mt-2 text-sm">
                  {weblet.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                 <div className="flex flex-wrap gap-2 mb-4">
                  {weblet.category && <Badge variant="secondary">{weblet.category}</Badge>}
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
          <div className="col-span-fulltext-center py-12 text-muted-foreground">
            No Weblets found in the marketplace. Check back later!
          </div>
        )}
      </div>
    </div>
  );
}
