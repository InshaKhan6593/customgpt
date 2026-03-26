import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { resetBillingCycles } from "@/lib/inngest/functions";
import { executeFlow } from "@/lib/inngest/orchestrator";
import { rsilOptimizationCron, rsilMonitoringCron } from "@/lib/rsil/scheduler";
import { rsilEvaluationCron } from "@/lib/inngest/rsil-evaluation";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    resetBillingCycles,
    executeFlow,
    rsilOptimizationCron,
    rsilMonitoringCron,
    rsilEvaluationCron,
  ],
  streaming: "allow",
});
