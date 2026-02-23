import { z } from "zod"
import CodeInterpreter from "@e2b/code-interpreter"

export const codeInterpreterTool = {
  description: "Execute Python code in a secure cloud sandbox. Useful for data analysis, math, generating charts, and scraping.",
  inputSchema: z.object({
    code: z.string().describe("The Python code to execute."),
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
      const sandbox: any = await CodeInterpreter.create()

      // Execute code
      const execution = await sandbox.notebook.execCell(code)

      // Close sandbox immediately when done
      await sandbox.close()

      return {
        stdout: execution.results.map((r: any) => r.text).join("\n") + execution.logs.stdout.join("\n"),
        stderr: execution.logs.stderr.join("\n"),
      }
    } catch (error: any) {
      return { error: `Failed to execute code: ${error.message}` }
    }
  }
}
