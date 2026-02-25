# File Search (RAG)

**Description (The Prompt):**
> "Perform a Retrieval-Augmented Generation (RAG) semantic database search over the Weblet's uploaded knowledge base and private documents.
> 
> **WHEN TO USE:**
> - **ALWAYS USE THIS TOOL FIRST** when a user asks about specific domains, company policies, uploaded documents, or niche topics related to this agent's persona.
> - Use this tool when the user refers to 'my files', 'the document', or specific proprietary information.
> 
> **HOW IT WORKS:**
> - The tool executes a vector similarity search across chunked document embeddings.
> - It returns relevant text snippets (chunks) and their source citations.
> - Read the returned snippets carefully. Synthesize your final answer based *only* on the provided context.
> - If the tool returns empty or irrelevant results, inform the user that the knowledge base does not contain the answer."

**Input Schema (`query`):**
> "A highly optimized semantic search string used for vector matching. Do NOT pass a full conversational question. Extract the core entities, keywords, and concepts from the user's prompt to formulate this query."
