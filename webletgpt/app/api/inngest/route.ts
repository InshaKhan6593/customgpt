import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { resetBillingCycles } from "@/lib/inngest/functions";
import { executeFlow } from "@/lib/inngest/orchestrator";
import { rsilDailyOptimizer } from "@/lib/rsil/scheduler";

// Create an API that serves zero-cost routing and assembles your app
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    resetBillingCycles,
    executeFlow,
    rsilDailyOptimizer,
  ],
  streaming: "allow",
});
