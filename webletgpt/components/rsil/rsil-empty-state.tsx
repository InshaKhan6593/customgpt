"use client";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function RsilEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      <BarChart3 className="h-16 w-16 text-muted-foreground/30" />
      <h3 className="mt-6 text-xl font-semibold text-foreground">No RSIL Data Yet</h3>
      <p className="mt-2 text-muted-foreground max-w-md">
        Enable RSIL on a weblet to start tracking prompt performance and running optimizations
      </p>
      <Button variant="outline" className="mt-6" asChild>
        <Link href="/dashboard/weblets">Go to Weblets</Link>
      </Button>
    </motion.div>
  );
}
