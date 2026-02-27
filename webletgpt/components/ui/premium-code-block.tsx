"use client"

import React, { useState } from "react"
import { Copy, Check } from "lucide-react"

interface CodeBlockProps {
  language?: string
  code: string | React.ReactNode
}

export function PremiumCodeBlock({ language = "code", code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = typeof code === "string" ? code : extractText(code)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    // min-w-0: allow this block to shrink in flex/grid contexts (prevents it
    // from dictating the width of its flex parent).
    // overflow-hidden: clip anything that escapes the rounded border.
    <div className="relative group my-4 min-w-0 w-full overflow-hidden">
      <div className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#2f2f2f] text-zinc-300">
          <span className="font-sans text-xs tracking-tight lowercase">
            {language}
          </span>

          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs ${
              copied
                ? "text-green-400"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy code</span>
              </>
            )}
          </button>
        </div>

        {/* Code Body
            w-full gives this div a definite width (100% of the rounded card
            above), which is what makes overflow-x-auto actually scroll rather
            than expand. Without a definite width the div grows to fit the pre's
            natural content width and no scrollbar ever appears. */}
        <div className="overflow-x-auto w-full p-4 bg-[#0d0d0d]">
          <pre className="m-0 bg-transparent font-mono text-[13px] leading-relaxed text-zinc-100 whitespace-pre [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
            {code}
          </pre>
        </div>
      </div>

      {/* Subtle Glow */}
      <div className="absolute -inset-px bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 rounded-lg blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
    </div>
  )
}

/** Recursively extract text from React children */
export function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (React.isValidElement(node)) return extractText((node.props as any).children)
  return ""
}
