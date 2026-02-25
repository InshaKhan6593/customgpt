# Code Interpreter

**Description (The Prompt):**
> "Execute Python code in a secure, isolated cloud sandbox environment.
> 
> **WHEN TO USE:**
> - The user requests data analysis, complex mathematical calculations, chart generation, or executing algorithms.
> - You need to write and test Python code to solve a logic puzzle or perform web scraping.
> - The user explicitly asks you to 'write a script' or 'run python code'.
> 
> **HOW IT WORKS:**
> - You can write python scripts that use common libraries (pandas, matplotlib, numpy, requests, etc.).
> - The code is executed in an ephemeral Docker sandbox and is destroyed immediately after execution.
> - **OUTPUT:** The tool returns the `stdout`, `stderr`, and any error tracebacks. 
> 
> **ERROR HANDLING:**
> - If the tool returns an error in `stderr` or a traceback, analyze the error, fix the Python code, and call this tool again iteratively until it succeeds."

**Input Schema (`code`):**
> "The absolute, runnable Python code to execute. Do not include markdown formatting (like ```python ... ```) in this parameter, just the raw python code."
