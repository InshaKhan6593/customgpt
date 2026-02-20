# WebletGPT Tech Stack

This document outlines the complete technology stack used to build the WebletGPT platform. It details what each technology is, why it was chosen, and where it specifically plays a role in the application architecture.

---

## 1. Core Framework & Language

### **Next.js 15 (App Router)**
*   **What it is:** A React framework for building fast, full-stack web applications.
*   **What it is used for:** The foundation of the entire platform. Handles routing, server-side rendering (SSR), static site generation (SSG), and API routes.
*   **Where it plays a role (Examples):**
    *   **Frontend UI:** Rendering the builder interface, chat UI, and dashboard pages.
    *   **Backend Logic:** API routes (`/api/weblets`, `/api/chat`) use Next.js server actions to handle database updates and AI interactions securely on the server.

### **React 19**
*   **What it is:** A JavaScript library for building user interfaces.
*   **What it is used for:** Creating interactive UI components.
*   **Where it plays a role (Examples):** Managing state in the Weblet Builder (e.g., toggling capabilities, updating the live preview) and handling user interactions in the chat interface.

### **TypeScript**
*   **What it is:** A strongly typed superset of JavaScript.
*   **What it is used for:** Providing type safety, catching errors during development, and improving code maintainability.
*   **Where it plays a role (Examples):** Enforcing strict data structures for Weblet configurations, API request payloads, and database models.

---

## 2. UI & Styling

### **Tailwind CSS v4**
*   **What it is:** A utility-first CSS framework.
*   **What it is used for:** Rapidly styling components without writing custom CSS files. Ensure consistent design across the platform.
*   **Where it plays a role (Examples):** Building the responsive layout of the dashboard, styling buttons, form inputs, and the chat interface.

### **shadcn/ui**
*   **What it is:** A collection of re-usable, accessible components built on top of Tailwind CSS and Radix UI.
*   **What it is used for:** Providing high-quality pre-built components like modals, dropdowns, tabs, and alerts to speed up development.
*   **Where it plays a role (Examples):**
    *   **Tabs:** Used in the Weblet Builder to switch between Configure, Capabilities, Knowledge, and Actions.
    *   **Dialogs:** Used for the Human-in-the-Loop approval modal and settings panels.

---

## 3. Database & Authentication

### **PostgreSQL + pgvector (Hosted on Neon/Supabase)**
*   **What it is:** A powerful, open-source relational database. `pgvector` is an extension for storing and querying vector embeddings.
*   **What it is used for:** Storing all application data reliably. `pgvector` specifically enables semantic search for RAG implementations.
*   **Where it plays a role (Examples):**
    *   **Relational Data:** Storing User profiles, Weblet configurations, and Chat Histories.
    *   **Vector Data:** Storing chunked document embeddings (Knowledge files) uploaded in the Weblet Builder (Segment 04) so the AI can search them during chat.

### **Prisma ORM**
*   **What it is:** A next-generation Object-Relational Mapper (ORM) for Node.js and TypeScript.
*   **What it is used for:** Providing a type-safe API to interact with the PostgreSQL database.
*   **Where it plays a role (Examples):** Used in Server Actions and API routes to query the database (e.g., `db.weblet.findUnique(...)`).

### **prisma-extension-pgvector**
*   **What it is:** A Prisma extension specifically built to support `pgvector` operations.
*   **What it is used for:** Allowing type-safe vector similarity searches (like cosine similarity) directly through Prisma, avoiding the need for raw SQL queries.
*   **Where it plays a role (Examples):** Retrieving the most relevant document chunks when a user asks a question about an uploaded knowledge file (Segment 04, Segment 05).

### **Auth.js (NextAuth v5)**
*   **What it is:** A complete open-source authentication solution for Next.js applications.
*   **What it is used for:** Handling user login, session management, and securing API routes.
*   **Where it plays a role (Examples):** Managing the passwordless email OTP login flow (Segment 01) and protecting dashboard/builder routes from unauthorized access.

### **Resend**
*   **What it is:** An email API for developers.
*   **What it is used for:** Sending transactional emails reliably.
*   **Where it plays a role (Examples):** Sending the Magic Link / OTP codes during user login (Segment 01).

---

## 4. AI & Orchestration Engine

### **Vercel AI SDK 4.x**
*   **What it is:** A library for building AI-powered user interfaces in React/Next.js.
*   **What it is used for:** Handling streaming responses, managing chat state, and orchestrating tool calls between the UI and LLMs.
*   **Where it plays a role (Examples):** Powering the core Chat Engine (Segment 05), streaming the AI's response to the user, and triggering Server-Side tools automatically during a conversation.

### **OpenRouter**
*   **What it is:** A unified API router that provides access to dozens of LLMs (OpenAI, Anthropic, Meta, Google, etc.).
*   **What it is used for:** Allowing creators to select different models for their Weblets without needing separate integration code or managing multiple API keys.
*   **Where it plays a role (Examples):** The underlying engine that powers `chatWithWeblet()`. A creator might configure their Weblet to use `anthropic/claude-3.5-sonnet` via the OpenRouter connection.

### **LlamaParse API**
*   **What it is:** A specialized API designed to parse and extract text/tables from complex documents.
*   **What it is used for:** Reliably parsing uploaded PDFs and DOCX files into clean Markdown without running heavy parsing libraries in memory.
*   **Where it plays a role (Examples):** In the Weblet Builder (Segment 04), when a user uploads a large handbook, it's sent to LlamaParse to extract the text safely before chunking and embedding, bypassing Vercel's serverless memory restrictions.

### **Inngest**
*   **What it is:** A background job and workflow engine for serverless environments.
*   **What it is used for:** Executing long-running tasks, scheduling cron jobs, and orchestrating complex workflows that would otherwise time out on standard serverless infrastructure.
*   **Where it plays a role (Examples):**
    *   **Multi-Agent Workflows (Segment 10):** Running complex, multi-step LLM operations (Sequential, Concurrent, Hybrid) safely without hitting Vercel's 60-second execution limits.
    *   **RSIL Scheduler (Segment 13):** Running the daily automated optimization processes across the database.

### **Ably**
*   **What it is:** A highly scalable real-time messaging platform (WebSockets as a Service).
*   **What it is used for:** Pushing live updates to clients without needing a persistent server connection (which Vercel doesn't support well).
*   **Where it plays a role (Examples):** In Multi-Agent Orchestration (Segment 10/12), it pushes real-time execution progress to the UI (e.g., "Agent 1 is planning... -> Agent 2 is researching... -> Agent 3 is writing...").

---

## 5. Tool Integrations (Capabilities)

### **Tavily Search API**
*   **What it is:** A search engine optimized specifically for LLMs.
*   **What it is used for:** Executing the **Web Search** capability.
*   **Where it plays a role (Examples):** When a user asks a Weblet about a recent news event, the AI calls the Tavily tool to fetch current, clean information from the web before generating a response (Segment 05).

### **E2B (English2Bits) Sandbox**
*   **What it is:** Cloud-based, secure sandboxes for AI agents.
*   **What it is used for:** Executing the **Code Interpreter** capability.
*   **Where it plays a role (Examples):** If a user asks a Data Analyst Weblet to generate a graph from a CSV, the AI generates Python code, sends it to the E2B sandbox for execution, and returns the resulting image safely (Segment 05).

### **DALL-E 3 API (OpenAI)**
*   **What it is:** An image generation model.
*   **What it is used for:** Executing the **Image Generation** capability.
*   **Where it plays a role (Examples):** When a user asks a design Weblet to "create a logo for a coffee shop," the AI calls the DALL-E 3 tool to generate and return the image.

---

## 6. Payments & Monetization

### **Stripe (Connect & Billing)**
*   **What it is:** A comprehensive payment processing platform.
*   **What it is used for:** Handling user subscriptions, billing logic, and split payments.
*   **Where it plays a role (Examples):** When a User upgrades to a Developer account or subscribes to a paid Weblet in the Marketplace, Stripe manages the checkout session and recurring billing (Segment 06, Segment 07).

### **PayPal Payouts API**
*   **What it is:** An API for sending mass payments globally.
*   **What it is used for:** Allowing creators to withdraw their earned revenue.
*   **Where it plays a role (Examples):** In the Developer Dashboard (Segment 09), creators can view their balance and trigger a payout directly to their verified PayPal account.

---

## 7. Storage

### **Vercel Blob**
*   **What it is:** Managed cloud storage for Vercel applications.
*   **What it is used for:** Storing uploaded files securely in the cloud.
*   **Where it plays a role (Examples):** Uploading Knowledge Base documents (PDFs, CSVs) via the Weblet Builder (Segment 04) and storing user profile pictures.
