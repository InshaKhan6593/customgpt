"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { TextSearch, ActivitySquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ObservabilityEmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-4">
         <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
           <ActivitySquare className="h-6 w-6 text-primary" />
         </div>
         <CardTitle className="text-xl">Execution Logs (Coming Soon)</CardTitle>
         <CardDescription className="max-w-md mx-auto">
           Deep dive into Langfuse traces, tool executions, and latency metrics for complete observability of your agent.
         </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground pb-8">
         <div className="p-8 border rounded-lg bg-muted/30 max-w-2xl mx-auto flex flex-col items-center gap-4">
           <TextSearch className="h-8 w-8 text-muted-foreground opacity-50" />
           <p>Powered by Langfuse. This integration is scheduled for Segment 15.<br/>Once active, you will see detailed execution trees here.</p>
         </div>
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-6 bg-muted/20">
         <Button variant="outline" disabled>View Trace Example</Button>
      </CardFooter>
    </Card>
  );
}
