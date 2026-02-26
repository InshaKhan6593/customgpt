"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Database, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RsilEmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-4">
         <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
           <Database className="h-6 w-6 text-primary" />
         </div>
         <CardTitle className="text-xl">RSIL Inbox (Coming Soon)</CardTitle>
         <CardDescription className="max-w-md mx-auto">
           Review flagged conversations and extract knowledge into your RAG pipeline or system prompt to improve this weblet over time.
         </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground pb-8">
         <div className="p-8 border rounded-lg bg-muted/30 max-w-2xl mx-auto flex flex-col items-center gap-4">
           <Search className="h-8 w-8 text-muted-foreground opacity-50" />
           <p>This powerful feature is scheduled for Segment 14.<br/>Once active, you will see a queue of user-flagged interactions here.</p>
         </div>
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-6 bg-muted/20">
         <Button variant="outline" disabled className="gap-2"><Filter className="w-4 h-4"/> Filter Candidates</Button>
      </CardFooter>
    </Card>
  );
}
