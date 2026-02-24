"use client"

import React from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeHighlight from "rehype-highlight"
import rehypeKatex from "rehype-katex"
import { PremiumCodeBlock } from "./premium-code-block"

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div
      className="prose prose-zinc w-full min-w-0 max-w-none break-words overflow-hidden text-[15px] prose-p:leading-relaxed prose-pre:my-0 prose-pre:p-0 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-h4:text-sm prose-h5:text-sm prose-h6:text-sm prose-a:text-blue-600 dark:prose-a:text-blue-400"
      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          pre(props) {
            const { node, children, ...rest } = props
            let language: string | undefined
            // Extract language from the <code> child
            React.Children.forEach(children, (child) => {
              if (React.isValidElement(child)) {
                const cls = (child.props as any)?.className || ""
                const match = /language-(\w+)/.exec(cls)
                if (match) language = match[1]
              }
            })
            return (
              <PremiumCodeBlock language={language} code={children} />
            )
          },
          code(props) {
            const { node, children, className, ...rest } = props
            const isBlock = /language-(\w+)/.exec(className || "")
            if (isBlock) {
              return <code className={className} {...rest}>{children}</code>
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-[13.5px] font-mono text-zinc-800 dark:text-zinc-200 before:hidden after:hidden" {...rest}>
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
