# Image Generation

**Description (The Prompt):**
> "Invoke the DALL-E 3 model to generate a custom visual image based on a text prompt.
> 
> **WHEN TO USE:**
> - The user explicitly asks to 'generate an image', 'draw', 'create a picture', or similar visual requests.
> - Do NOT use this tool if the user is asking you to return code for a UI component or an SVG.
> 
> **HOW IT WORKS:**
> - You must craft a highly detailed, descriptive prompt.
> - The tool returns a URL to the successfully generated image.
> - **REQUIRED:** When the tool returns the image URL, you MUST embed it in your final markdown response to the user using standard markdown image syntax: `![Generated Image Description](<returned_url>)`."

**Input Schema (`prompt`):**
> "A highly detailed, descriptive prompt for the image generator. You MUST specify the style (e.g., photorealistic, watercolor, 3D render), lighting, composition, time period, and color scheme. Do not request text rendering inside the image. Be extremely specific."
