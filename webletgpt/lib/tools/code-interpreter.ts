import { z } from "zod"
import { Sandbox } from "@e2b/code-interpreter"

export const codeInterpreterTool = {
  description: `Execute Python code in a secure, isolated cloud sandbox environment.

WHEN TO USE:
- The user requests data analysis, complex mathematical calculations, chart generation, or executing algorithms.
- You need to write and test Python code to solve a logic puzzle or perform web scraping.
- The user explicitly asks you to 'write a script' or 'run python code'.

HOW IT WORKS:
- You can write python scripts that use common libraries (pandas, matplotlib, numpy, requests, etc.).
- The code is executed in an ephemeral Docker sandbox and is destroyed immediately after execution.
- OUTPUT: The tool returns the stdout, stderr, and any error tracebacks. 

ERROR HANDLING:
- If the tool returns an error in stderr or a traceback, analyze the error, fix the Python code, and call this tool again iteratively until it succeeds.`,
  inputSchema: z.object({
    code: z.string().describe("The absolute, runnable Python code to execute. Do not include markdown formatting (like ```python ... ```) in this parameter, just the raw python code."),
  }),
  execute: async ({ code }: any) => {
    const apiKey = process.env.E2B_API_KEY

    // Fallback if no API key
    if (!apiKey) {
      console.warn("E2B_API_KEY not found. Returning stubbed code execution.")
      return {
        stdout: "Stubbed output: Code execution requires E2B_API_KEY.",
        stderr: ""
      }
    }

    try {
      // Create a short-lived sandbox
      const sandbox = await Sandbox.create()

      // Execute code (v2 API syntax)
      const execution = await sandbox.runCode(code)

      // Close sandbox immediately when done
      await sandbox.kill()

      return {
        stdout: execution.results.map((r: any) => r.text).join("\n") + execution.logs.stdout.join("\n"),
        stderr: execution.logs.stderr.join("\n"),
        error: execution.error ? execution.error.traceback : null
      }
    } catch (error: any) {
      return { error: `Failed to execute code: ${error.message}` }
    }
  }
}
