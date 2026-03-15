import { z } from "zod"
import { Sandbox } from "@e2b/code-interpreter"
import fs from 'fs'
import path from 'path'

export const codeInterpreterTool = {
  description: `Execute Python code in a secure, isolated cloud sandbox environment.

WHEN TO USE:
- The user requests data analysis, complex mathematical calculations, chart generation, or executing algorithms.
- You need to write and test Python code to solve a logic puzzle or perform web scraping.
- The user explicitly asks you to 'write a script', 'run python code', or 'create a file/app'.
- The user asks you to generate, build, or create any kind of file (scripts, apps, documents, CSVs, etc.).

CAPABILITIES:
- You can write and execute Python scripts using common libraries (pandas, matplotlib, numpy, requests, beautifulsoup4, flask, etc.).
- You CAN create files. Any file you write to /home/user/ (e.g. with open('calculator.py', 'w')) will be automatically saved and provided to the user as a downloadable artifact.
- You CAN generate charts and plots with matplotlib/plotly — they will be rendered as inline images.
- You CAN install additional packages using subprocess: import subprocess; subprocess.run(['pip', 'install', 'package_name'])
- The sandbox has full Linux environment access (file system, networking, shell commands via subprocess).

FILE CREATION:
- To create a file for the user, simply write it to /home/user/ using Python's open() function.
- Example: with open('app.py', 'w') as f: f.write(code)
- The file will be automatically detected and presented to the user as a clickable download link.
- You can create ANY type of file: .py, .html, .csv, .json, .txt, .zip, etc.

ERROR HANDLING:
- If the tool returns an error in stderr or a traceback, analyze the error, fix the Python code, and call this tool again iteratively until it succeeds.`,
  inputSchema: z.object({
    code: z.string().describe("The absolute, runnable Python code to execute. Do not include markdown formatting (like ```python ... ```) in this parameter, just the raw python code."),
  }),
  // Send only a plain text summary to the model (not the full data object).
  // This prevents Gemini/OpenRouter 500 errors on multi-turn tool results
  // while keeping the full result (with images/files) available on the client.
  experimental_toToolResultContent: (result: any) => {
    if (typeof result === 'string') return [{ type: 'text' as const, text: result }]
    const summary = result?.stdout || JSON.stringify(result)
    return [{ type: 'text' as const, text: summary }]
  },
  execute: async ({ code }: any) => {
    const apiKey = process.env.E2B_API_KEY

    // Fallback if no API key
    if (!apiKey) {
      console.warn("E2B_API_KEY not found. Returning stubbed code execution.")
      return {
        text: "Stubbed output: Code execution requires E2B_API_KEY.",
      }
    }

    try {
      // Create a short-lived sandbox
      const sandbox = await Sandbox.create()

      // Snapshot existing files BEFORE execution (recursive) so we only capture new ones
      const beforeList = await sandbox.commands.run("find /home/user -type f -not -path '*/\\.*' 2>/dev/null")
      const existingFiles = new Set(
        beforeList.stdout ? beforeList.stdout.trim().split('\n').filter(Boolean) : []
      )

      // Execute code (v2 API syntax)
      const execution = await sandbox.runCode(code)

      // Find only NEW files created during execution (recursive, includes subdirectories)
      const afterList = await sandbox.commands.run("find /home/user -type f -not -path '*/\\.*' 2>/dev/null")
      const generatedFiles = (afterList.stdout ? afterList.stdout.trim().split('\n').filter(Boolean) : [])
        .filter(f => !existingFiles.has(f))

      // Extract Images — save to disk and return URLs (not base64)
      // Sending base64 back in the tool result bloats the context and causes
      // 500 errors on models like Gemini when multi-step execution feeds
      // the tool result back into the conversation.
      const artifactsDir = path.join(process.cwd(), 'public', 'artifacts')
      if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true })
      }

      let imageFiles: { format: string, url: string }[] = []
      for (const result of execution.results) {
        const formats = [
          { key: 'png', ext: 'png' },
          { key: 'jpeg', ext: 'jpg' },
          { key: 'svg', ext: 'svg' },
        ] as const
        for (const { key, ext } of formats) {
          const b64 = (result as any)[key]
          if (b64) {
            const fileName = `${Date.now()}-chart.${ext}`
            const filePath = path.join(artifactsDir, fileName)
            fs.writeFileSync(filePath, Buffer.from(b64, 'base64'))
            imageFiles.push({ format: ext, url: `/artifacts/${fileName}` })
          }
        }
      }

      // Extract Files and Save to /public/artifacts
      let fileData: { name: string, url: string }[] = []
      for (const fullPath of generatedFiles) {
         try {
           const fileBytes = await sandbox.files.read(fullPath)

           // Show just the filename (e.g. "index.js") like Claude's artifact UI
           const displayName = path.basename(fullPath)
           // Prevent filename collisions by prepending a timestamp
           const safeFileName = `${Date.now()}-${displayName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
           const destPath = path.join(artifactsDir, safeFileName)
           
           // Write the file locally
           fs.writeFileSync(destPath, fileBytes as any)

           // Store the public URL path
           fileData.push({ name: displayName, url: `/artifacts/${safeFileName}` })
         } catch (e) {
           console.error(`Failed to read file ${fullPath} from sandbox:`, e)
         }
      }

      // Close sandbox immediately when done
      await sandbox.kill()

      const outputText = execution.results.map((r: any) => r.text).join("\n") + execution.logs.stdout.join("\n")
      
      const llmSummary = `Code executed successfully.
Stdout: ${outputText.substring(0, 1000)}
Images Generated: ${imageFiles.length}
Files Generated: ${fileData.map(f => f.name).join(', ') || 'None'}
Note: The UI has already received the images and files, you do not need to display them textually.`

      return {
        stdout: llmSummary,
        stderr: execution.logs.stderr.join("\n"),
        error: execution.error ? execution.error.traceback : "",
        data: {
          images: imageFiles,
          files: fileData,
          fullStdout: outputText
        }
      }
    } catch (error: any) {
      return { stdout: "", stderr: "", error: `Failed to execute code: ${error.message}` }
    }
  }
}
