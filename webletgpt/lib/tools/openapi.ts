import { tool } from "ai"
import { z } from "zod"

/**
 * Converts an OpenAPI parameter schema to a Zod schema.
 *
 * Cross-provider compatibility rules:
 * - Keep non-required params as .optional() — OpenRouter doc confirms this
 *   format is valid for all providers (including Google Gemini via OpenRouter).
 * - Use z.enum() for string params with an "enum" constraint.
 * - Use z.array(z.string()) for array-type params (the doc's search_terms example).
 * - Avoid .nullable() — Google Gemini rejects anyOf schemas it generates.
 */
function buildParamSchema(param: any): z.ZodTypeAny {
  const s = param.schema || {}
  const desc = param.description || s.description || ""
  let schema: z.ZodTypeAny

  if (s.type === "array") {
    // Array of items — use z.array with the item type
    const itemType = s.items?.type
    let itemSchema: z.ZodTypeAny = z.string()
    if (itemType === "integer" || itemType === "number") itemSchema = z.number()
    else if (itemType === "boolean") itemSchema = z.boolean()
    schema = z.array(itemSchema)
  } else if (s.type === "integer" || s.type === "number") {
    schema = z.number()
  } else if (s.type === "boolean") {
    schema = z.boolean()
  } else if (s.enum && Array.isArray(s.enum) && s.enum.length > 0) {
    // Enum values — use z.enum for best LLM guidance (shows allowed values in schema)
    const values = s.enum.map(String) as [string, ...string[]]
    schema = z.enum(values)
  } else {
    schema = z.string()
  }

  if (desc) schema = schema.describe(desc)

  // Non-required params stay optional — this is the correct JSON Schema format
  // and is explicitly supported by OpenRouter for all providers.
  if (!param.required) schema = (schema as any).optional()

  return schema
}

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

        const parameterShape: Record<string, z.ZodTypeAny> = {}
        const parameters = endpointDef.parameters || []

        let hasParams = false
        parameters.forEach((param: any) => {
          hasParams = true
          parameterShape[param.name] = buildParamSchema(param)
        })

        // For endpoints with no parameters, use a sentinel param.
        // Empty z.object({}) produces "properties: {}" which some providers reject.
        // A literal sentinel is universally accepted and safely ignored by the executor.
        const paramsSchema = hasParams
          ? z.object(parameterShape)
          : z.object({
              _: z.literal("none").describe("This endpoint requires no parameters. Always pass the exact string 'none'."),
            })

        tools[operationId] = tool({
          description,
          inputSchema: paramsSchema,
          // @ts-ignore: TS struggles to infer execute args from a dynamic zod union
          execute: async (args: any) => {
            try {
              let finalUrl = `${baseUrl}${path}`
              const queryParams = new URLSearchParams()

              parameters.forEach((param: any) => {
                const val = args[param.name]
                // Skip absent/empty values — handles both optional params the LLM
                // omitted entirely and cases where the LLM passes "" for an optional.
                if (val === undefined || val === null || val === "") return

                const strVal = Array.isArray(val) ? val.join(",") : String(val)

                if (param.in === "path") {
                  finalUrl = finalUrl.replace(`{${param.name}}`, encodeURIComponent(strVal))
                } else if (param.in === "query") {
                  // For arrays, repeat the param key for each item (OpenAPI style)
                  if (Array.isArray(val)) {
                    val.forEach((item: any) => queryParams.append(param.name, String(item)))
                  } else {
                    queryParams.append(param.name, strVal)
                  }
                }
              })

              const queryString = queryParams.toString()
              if (queryString) {
                finalUrl += finalUrl.includes("?") ? `&${queryString}` : `?${queryString}`
              }

              const response = await fetch(finalUrl, {
                method: method.toUpperCase(),
                headers: {
                  "Content-Type": "application/json",
                  "Accept": "application/json",
                },
              })

              if (!response.ok) {
                return `API Error: ${response.status} ${response.statusText}`
              }

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
          },
        }) as any
      })
    })

    return tools
  } catch (error) {
    console.error("Failed to parse OpenAPI schema into tools:", error)
    return tools
  }
}
