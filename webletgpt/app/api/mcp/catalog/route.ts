import { NextResponse } from "next/server"
import { MCP_CATALOG } from "@/lib/mcp/catalog"

// GET — Return the curated MCP server catalog
export async function GET() {
    return NextResponse.json({ catalog: MCP_CATALOG })
}
