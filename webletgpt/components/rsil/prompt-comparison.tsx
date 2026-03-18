"use client";

import { motion } from "framer-motion";
import { Sparkles, FlaskConical, Rocket } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface PromptComparisonProps {
  currentPrompt: string;
  proposedPrompt: string;
  changelog: string;
  draftVersionId: string;
  webletId: string;
  loading?: boolean;
  onOptimize: () => void;
  onStartTest: (versionId: string) => void;
  onDeploy: (versionId: string) => void;
}

export function PromptComparison({
  currentPrompt,
  proposedPrompt,
  changelog,
  draftVersionId,
  loading,
  onOptimize,
  onStartTest,
  onDeploy,
}: PromptComparisonProps) {
  const hasContent = currentPrompt || proposedPrompt;
  const isActionDisabled = !draftVersionId || loading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>Prompt Optimization</CardTitle>
          <Button onClick={onOptimize} disabled={loading} variant="default">
            <Sparkles className="mr-2 h-4 w-4" />
            Optimize Now
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <Skeleton className="h-[200px] w-full rounded-xl" />
              </div>
              <Skeleton className="h-[100px] w-full rounded-xl" />
              <div className="flex justify-end gap-3">
                <Skeleton className="h-10 w-[140px]" />
                <Skeleton className="h-10 w-[140px]" />
              </div>
            </div>
          ) : !hasContent ? (
            <div className="text-center py-12 text-muted-foreground">
              Click &quot;Optimize Now&quot; to generate an improved prompt
              based on Langfuse weakness scores
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Current Prompt */}
                <Card className="bg-card/50">
                  <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                    <span className="font-medium text-sm">
                      Current Prompt (Active)
                    </span>
                    <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10">
                      Active
                    </Badge>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <pre className="bg-muted/30 rounded-lg p-4 max-h-80 overflow-y-auto text-sm font-mono whitespace-pre-wrap break-words text-muted-foreground">
                      {currentPrompt || "No active prompt."}
                    </pre>
                  </CardContent>
                </Card>

                {/* Proposed Prompt */}
                <Card className="bg-card/50 border-amber-500/20">
                  <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                    <span className="font-medium text-sm">
                      Proposed Prompt (Draft)
                    </span>
                    <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10">
                      Draft
                    </Badge>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <pre className="bg-muted/30 rounded-lg p-4 max-h-80 overflow-y-auto text-sm font-mono whitespace-pre-wrap break-words text-muted-foreground">
                      {proposedPrompt || "No draft prompt."}
                    </pre>
                  </CardContent>
                </Card>
              </div>

              {/* What Changed */}
              {changelog && (
                <Card className="bg-card/50">
                  <CardHeader className="py-3 px-4">
                    <span className="font-medium text-sm">What Changed</span>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {changelog}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2">
                <Button
                  variant="default"
                  disabled={isActionDisabled}
                  onClick={() => onStartTest(draftVersionId)}
                >
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Test This (A/B)
                </Button>
                <Button
                  variant="outline"
                  disabled={isActionDisabled}
                  onClick={() => onDeploy(draftVersionId)}
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  Deploy Directly
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
