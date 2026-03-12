import React from "react";
import { cn } from "@/lib/utils";

/**
 * A premium, high-contrast loading spinner with concentric animated rings.
 */
export function PremiumSpinner({ className }: { className?: string }) {
    return (
        <div className={cn("relative flex items-center justify-center size-full", className)}>
            {/* Outer rotating ring */}
            <div className="absolute inset-0 rounded-full border-[1.5px] border-zinc-800/50" />
            <div
                className="absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-amber-500/80 animate-spin"
                style={{ animationDuration: '0.8s' }}
            />

            {/* Inner pulsing core */}
            <div className="size-1.5 rounded-full bg-amber-500/40 animate-pulse transition-all duration-700" />
        </div>
    );
}
