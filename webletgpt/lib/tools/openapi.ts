import { tool } from "ai"
import { z } from "zod"

export function getToolsFromOpenAPI(schemaString: string | null) {
  const tools: Record<string, any> = {}

  if (!schemaString) return tools

  try {
    const schema = JSON.parse(schemaString)
    
    // Support basic OpenAPI 3 structure
    if (!schema.paths) return tools

    const baseUrl = schema.servers?.[0]?.url || ""

    Object.entries(schema.paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, endpointDef]: [string, any]) => {
        // Only safely support GET and POST for now to prevent destructive unattended actions
        if (!["get", "post"].includes(method.toLowerCase())) return

        const operationId = endpointDef.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`
        const description = endpointDef.description || endpointDef.summary || `Call to ${method.toUpperCase()} ${path}`
        
        // Build Zod schema from parameters
        const parameterShape: Record<string, z.ZodTypeAny> = {}
        const parameters = endpointDef.parameters || []
        
        let hasParams = false
        parameters.forEach((param: any) => {
          hasParams = true
          let paramSchema: z.ZodTypeAny = z.string() // Default to string format
          
          if (param.schema?.type === "integer" || param.schema?.type === "number") {
            paramSchema = z.number()
          } else if (param.schema?.type === "boolean") {
            paramSchema = z.boolean()
          }

          if (param.description) {
            paramSchema = paramSchema.describe(param.description)
          }

          if (!param.required) {
            paramSchema = paramSchema.optional()
          }

          parameterShape[param.name] = paramSchema
        })

        const paramsSchema = hasParams ? z.object(parameterShape) : z.object({
          _empty: z.string().optional().describe('No parameters required')
        })

        // Generate the executable AI tool using the ai SDK helper
        // For Azure OpenAI, if there are no params, we still need a valid object schema
        tools[operationId] = tool({
          description,
          inputSchema: paramsSchema,
          // @ts-ignore: TS struggles to infer execute args from a dynamic zod union
          execute: async (args: any) => {
            try {
              let finalUrl = `${baseUrl}${path}`
              const queryParams = new URLSearchParams()

              // Map arguments to path or query
              parameters.forEach((param: any) => {
                const val = args[param.name]
                if (val === undefined) return

                if (param.in === "path") {
                  finalUrl = finalUrl.replace(`{${param.name}}`, String(val))
                } else if (param.in === "query") {
                  queryParams.append(param.name, String(val))
                }
              })

              const queryString = queryParams.toString()
              if (queryString) {
                // Handle cases where the path might already have some query parameters
                finalUrl += finalUrl.includes("?") ? `&${queryString}` : `?${queryString}`
              }

              const response = await fetch(finalUrl, {
                method: method.toUpperCase(),
                headers: {
                  "Content-Type": "application/json",
                  "Accept": "application/json"
                }
              })

              if (!response.ok) {
                return `API Error: ${response.status} ${response.statusText}`
              }

              // Assume JSON for now, fallback to text
              const contentType = response.headers.get("content-type")
              if (contentType && contentType.includes("application/json")) {
                const data = await response.json()
                return JSON.stringify(data)
              } else {
                return await response.text()
              }
            } catch (error: any) {
              return `Execution failed: ${error.message}`
            }
          }
        }) as any
      })
    })

    return tools
  } catch (error) {
    console.error("Failed to parse OpenAPI schema into tools:", error)
    return tools // Return empty tools object if parsing fails
  }
}
