import { z } from "zod"
import { Sandbox } from "@e2b/code-interpreter"
import fs from 'fs'
import path from 'path'

const TOOL_DESCRIPTION = `Execute Python code in a secure cloud sandbox (Jupyter IPython kernel). Returns stdout, stderr, display data (charts/images), and errors.

WHEN TO USE: ALWAYS execute code when the user asks to analyze data, create files, make charts, compute anything, scrape the web, or build something. NEVER paste code in your reply — run it.

EXECUTION MODEL:
- Each call runs in a Jupyter cell. State persists across calls — variables, imports, installed packages, and files carry over.
- Multiple calls encouraged: explore data first, then analyze, then visualize. Break complex tasks into steps.
- If code errors, read the traceback, fix the code, and call again. Do not give up after one failure.

VISUALIZATION RULES:
- ALWAYS call plt.show() for matplotlib/seaborn — this is how charts get captured and displayed. Without plt.show(), nothing renders.
- For plotly: use fig.write_image('/home/user/chart.png') to produce a downloadable file.
- For DataFrames: let the DataFrame be the last expression in the cell — it auto-renders as a rich HTML table. Avoid print(df) which loses formatting.
- Always include titles, axis labels, and legends on charts.

FILE CREATION:
- Write files to /home/user/<filename> to produce downloadable artifacts.
- Supported: .py, .csv, .xlsx, .html, .json, .zip, .pdf, .docx, .png, .svg, .mp3, or any format.
- Use openpyxl for Excel, python-docx for Word, Pillow/imageio for images.

INTERNET & APIs:
- Full internet access. Use requests, aiohttp, or urllib3 for HTTP calls, API integrations, and data downloads.
- Web scraping with beautifulsoup4 + requests works. curl via !curl also works.

PACKAGE MANAGEMENT:
- Install additional packages: !pip install package_name (do this in a separate cell before using the package).
- Install system tools: !apt-get install -y tool_name (Debian-based Linux).

PRE-INSTALLED PACKAGES (do NOT pip install these):
- Data: pandas, numpy, scipy, xarray, sympy
- ML: scikit-learn, joblib
- Visualization: matplotlib, seaborn, plotly, bokeh
- Web: requests, aiohttp, urllib3, beautifulsoup4
- NLP: spacy, nltk, gensim, textblob
- Images/Media: opencv-python, Pillow, imageio, scikit-image, librosa, soundfile
- Files: openpyxl, xlrd, python-docx
- NOT pre-installed (need pip install): torch, transformers, tensorflow, openai, langchain, sqlalchemy, fastapi

CONSTRAINTS:
- 60-second execution timeout per call — break long operations into chunks.
- 1 GB RAM default — avoid loading very large models or datasets all at once. Process in batches if needed.
- Headless environment — no GUI windows. Use plt.show() for charts (auto-captured), not tkinter/Qt.
- Top-level await is supported for async code.`

/**
 * Create a persistent E2B sandbox to be shared across multiple codeInterpreter calls
 * within a single child-weblet execution. State (variables, files, packages) persists.
 *
 * Returns null if E2B is not configured or sandbox creation fails.
 */
export async function createPersistentSandbox(): Promise<any | null> {
    if (!process.env.E2B_API_KEY) return null
    try {
        // 5-minute timeout — enough for complex data analysis pipelines
        return await Sandbox.create({ timeoutMs: 5 * 60 * 1000 })
    } catch (err) {
        console.error("[E2B] Failed to create persistent sandbox:", err)
        return null
    }
}

/**
 * Factory that creates a codeInterpreter tool definition.
 *
 * When `persistentSandbox` is provided (child-weblet execution), the tool reuses
 * the same E2B sandbox across all calls — variables, installed packages, and files
 * survive between calls. A file snapshot is taken on first use so only NEWLY created
 * files are returned in each call's result.
 *
 * When no sandbox is provided (direct parent-weblet execution), a fresh sandbox is
 * created and killed for each call — stateless, safe default.
 */
export function createCodeInterpreterTool(persistentSandbox?: any) {
    // Track files that existed before this tool session (for new-file detection).
    // Only used for persistent sandbox (child-weblet) — stateless calls use a local set.
    const persistentKnownFiles = new Set<string>()
    let sandboxInitialized = false

    async function snapshotFiles(sandbox: any, targetSet: Set<string>): Promise<void> {
        try {
            const res = await sandbox.commands.run("find /home/user -type f -not -path '*/\\.*' 2>/dev/null")
            for (const f of (res.stdout || "").trim().split('\n').filter(Boolean)) {
                targetSet.add(f)
            }
        } catch { /* non-fatal */ }
    }

    const artifactsDir = process.env.VERCEL
        ? path.join('/tmp', 'artifacts')
        : path.join(process.cwd(), 'public', 'artifacts')

    return {
        description: TOOL_DESCRIPTION,
        inputSchema: z.object({
            code: z.string().describe(
                "Python code to execute in a single Jupyter cell. No markdown fences — just raw code. " +
                "State persists: variables, imports, and files from previous calls are in scope. " +
                "Can include !pip install for packages, !command for shell, file I/O, and HTTP requests."
            ),
        }),
        toModelOutput: ({ output: result }: { toolCallId: string; input: unknown; output: any }) => {
            if (typeof result === 'string') return { type: 'text' as const, value: result }
            const parts: string[] = []
            if (result?.data?.fullStdout?.trim()) {
                parts.push(result.data.fullStdout.trim().substring(0, 1500))
            } else if (result?.stdout?.trim()) {
                const cleanStdout = result.stdout.trim()
                    .split('\n')
                    .filter((line: string) => !line.startsWith('Files created:') && !line.match(/^\d+ chart\(s\)/))
                    .join('\n')
                    .trim()
                if (cleanStdout) parts.push(cleanStdout)
            }
            if (result?.error?.trim()) parts.push(`Error:\n${result.error.trim()}`)
            // Tell the model about artifacts WITHOUT exposing URLs — it must call presentToUser to display them.
            // The URLs are still in the raw `execute` result (result.data.images/files) for presentToUser to reference.
            const images: any[] = result?.data?.images || []
            const files: any[] = result?.data?.files || []
            const artifactCount = images.length + files.length
            if (artifactCount > 0) {
                const artifactDescriptions: string[] = []
                for (let i = 0; i < images.length; i++) {
                    artifactDescriptions.push(`- Chart image #${i + 1} (url: available in tool result)`)
                }
                for (const f of files) {
                    artifactDescriptions.push(`- File "${f.name}" (url: available in tool result)`)
                }
                parts.push(
                    `[${artifactCount} artifact(s) produced — call presentToUser for EACH to display them:\n` +
                    `${artifactDescriptions.join('\n')}\n` +
                    `Use the artifact URLs from the tool result data to call presentToUser. Do NOT embed URLs in markdown.]`
                )
            }
            return { type: 'text' as const, value: parts.join('\n') || 'Code executed successfully.' }
        },
        execute: async ({ code }: { code: string }) => {
            if (!process.env.E2B_API_KEY) {
                return {
                    stdout: "Code execution unavailable — E2B_API_KEY not configured.",
                    stderr: "", error: "",
                    data: { images: [], files: [], fullStdout: "" },
                }
            }

            const isOwnSandbox = !persistentSandbox
            let sandbox: any = null

            try {
                // For persistent sandbox (child-weblet): use shared set across calls.
                // For stateless (direct chat): use a fresh local set per call so files
                // from previous requests don't contaminate detection.
                let knownFiles: Set<string>

                if (persistentSandbox) {
                    sandbox = persistentSandbox
                    knownFiles = persistentKnownFiles
                    if (!sandboxInitialized) {
                        await snapshotFiles(sandbox, knownFiles)
                        sandboxInitialized = true
                    }
                } else {
                    sandbox = await Sandbox.create()
                    knownFiles = new Set<string>()
                    await snapshotFiles(sandbox, knownFiles)
                }

                // Execute the code
                const execution = await sandbox.runCode(code)

                // Detect NEW files created during this execution
                const afterRes = await sandbox.commands.run(
                    "find /home/user -type f -not -path '*/\\.*' 2>/dev/null"
                )
                const newFilePaths = (afterRes.stdout || "")
                    .trim().split('\n').filter(Boolean)
                    .filter((f: string) => !knownFiles.has(f))

                // Record for persistent sandbox so subsequent calls don't double-report
                if (!isOwnSandbox) {
                    for (const f of newFilePaths) knownFiles.add(f)
                }

                // Ensure artifacts directory exists
                if (!fs.existsSync(artifactsDir)) {
                    fs.mkdirSync(artifactsDir, { recursive: true })
                }

                // Save chart images from E2B execution results
                const imageFiles: { format: string; url: string }[] = []
                for (const result of execution.results) {
                    for (const { key, ext } of [
                        { key: 'png', ext: 'png' },
                        { key: 'jpeg', ext: 'jpg' },
                        { key: 'svg', ext: 'svg' },
                    ] as const) {
                        const b64 = (result as any)[key]
                        if (b64) {
                            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-chart.${ext}`
                            fs.writeFileSync(path.join(artifactsDir, fileName), Buffer.from(b64, 'base64'))
                            imageFiles.push({ format: ext, url: `/artifacts/${fileName}` })
                        }
                    }
                }

                // Save created files from the sandbox filesystem
                const fileData: { name: string; url: string }[] = []
                for (const fullPath of newFilePaths) {
                    try {
                        const fileBytes = await sandbox.files.read(fullPath)
                        const displayName = path.basename(fullPath)
                        const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${displayName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                        fs.writeFileSync(path.join(artifactsDir, safeFileName), fileBytes as any)
                        fileData.push({ name: displayName, url: `/artifacts/${safeFileName}` })
                    } catch (e) {
                        console.error(`[E2B] Failed to read file ${fullPath}:`, e)
                    }
                }

                // Debug: log what E2B returned
                console.log(`[E2B] execution.results count: ${execution.results.length}, imageFiles: ${imageFiles.length}, newFiles: ${newFilePaths.length}`)
                if (execution.results.length > 0) {
                    for (const r of execution.results) {
                        const keys = Object.keys(r as any).filter(k => (r as any)[k])
                        console.log(`[E2B] result keys with data: ${keys.join(', ')}`)
                    }
                }
                if (imageFiles.length > 0) console.log(`[E2B] images: ${imageFiles.map(i => i.url).join(', ')}`)
                if (fileData.length > 0) console.log(`[E2B] files: ${fileData.map(f => f.url).join(', ')}`)

                const rawOutput = [
                    ...execution.results.map((r: any) => r.text).filter(Boolean),
                    ...execution.logs.stdout,
                ].join('\n')

                const llmSummary = [
                    rawOutput.trim() ? `Output:\n${rawOutput.substring(0, 1500)}` : 'No text output.',
                    imageFiles.length
                        ? `${imageFiles.length} chart(s) generated and rendered in the UI.`
                        : '',
                    fileData.length
                        ? `Files created: ${fileData.map(f => f.name).join(', ')} — shown as downloads.`
                        : '',
                ].filter(Boolean).join('\n')

                return {
                    stdout: llmSummary,
                    stderr: execution.logs.stderr.join('\n'),
                    error: execution.error ? execution.error.traceback : '',
                    data: {
                        images: imageFiles,
                        files: fileData,
                        fullStdout: rawOutput.slice(0, 2000),
                    },
                }
            } catch (error: any) {
                return {
                    stdout: '',
                    stderr: '',
                    error: `Execution failed: ${error.message}`,
                    data: { images: [], files: [], fullStdout: '' },
                }
            } finally {
                // Only kill the sandbox if we created it — persistent sandboxes are
                // managed by the caller (executor.ts) and killed after generateText completes.
                if (isOwnSandbox && sandbox) {
                    sandbox.kill().catch(() => {})
                }
            }
        },
    }
}

/** Default stateless tool — used by parent weblets in direct chat (fresh sandbox per call) */
export const codeInterpreterTool = createCodeInterpreterTool()
