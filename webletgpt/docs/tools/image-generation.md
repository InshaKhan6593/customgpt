# Image Generation

**Description (The Prompt):**
> "Invoke an image generation model to create a custom visual image based on a text prompt.
> 
> **WHEN TO USE:**
> - The user explicitly asks to 'generate an image', 'draw', 'create a picture', or similar visual requests.
> - Do NOT use this tool if the user is asking you to return code for a UI component or an SVG.
> 
> **HOW IT WORKS:**
> - You must craft a highly detailed, descriptive prompt.
> - The tool will generate the image and it will be displayed automatically to the user.
> - **IMPORTANT:** Do NOT write markdown image syntax like `![](url)`. The image is rendered automatically from the tool result. Just acknowledge that the image was generated and add any relevant commentary about it."

**Input Schema (`prompt`):**
> "A highly detailed, descriptive prompt for the image generator. You MUST specify the style (e.g., photorealistic, watercolor, 3D render), lighting, composition, time period, and color scheme. Do not request text rendering inside the image. Be extremely specific."

**Architecture:**
- Image generated server-side via OpenAI (preferred) or OpenRouter
- Base64 result stored in in-memory cache (`lib/tools/image-store.ts`)
- Short `/api/image/{uuid}` URL returned to LLM (never the base64)
- Chat UI renders image directly from tool result (no markdown rendering)
- Images expire after 30 minutes
