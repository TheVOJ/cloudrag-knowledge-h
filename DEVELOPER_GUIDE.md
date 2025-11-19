# Developer Guide

This guide provides instructions for setting up, running, and building the RAG Knowledge Base Manager for development.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher (usually comes with Node.js)
- **Git**: For version control

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd cloudrag-knowledge-h
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

## Development

To start the local development server:

```bash
npm run dev
```

This will start the Vite development server, usually at `http://localhost:5173`. The server supports Hot Module Replacement (HMR), so changes to the code will automatically update in the browser.

## Building for Production

To build the application for production deployment:

```bash
npm run build
```

This command will:
1. Run the TypeScript compiler (`tsc`) to check for type errors.
2. Use Vite to bundle the application into the `dist/` directory.
3. Optimize assets for performance.

To preview the production build locally:

```bash
npm run preview
```

## Project Structure

- **`/src`**: Source code
  - **`/components`**: React components (UI, Dialogs, Dashboards)
  - **`/hooks`**: Custom React hooks
  - **`/lib`**: Core logic and services
    - `agentic-router.ts`: Intent classification and query routing
    - `retrieval-executor.ts`: Handles search strategies (Semantic, Keyword, Hybrid, etc.)
    - `agentic-rag-orchestrator.ts`: Main agent loop
    - `strategy-performance-tracker.ts`: Learning and analytics system
  - **`/styles`**: CSS and styling files
- **`/public`**: Static assets
- **`package.json`**: Dependencies and scripts
- **`tsconfig.json`**: TypeScript configuration
- **`vite.config.ts`**: Vite configuration

## Testing

Currently, the project relies on manual verification as detailed in `AGENTIC_VERIFICATION.md`.

**Future Work:**
- Implement unit tests using `vitest` or `jest`.
- Add integration tests for the Agentic RAG flow.
- Add e2e tests using Playwright or Cypress.

To add a test runner (recommended):
```bash
npm install -D vitest
```
Then add `"test": "vitest"` to `package.json` scripts.

## Troubleshooting

### Common Issues

**1. `npm install` fails**
- **Cause:** Node version mismatch or network issues.
- **Solution:** Ensure you are using Node 18+. Clear cache with `npm cache clean --force` and try again.

**2. Azure Search Connection Fails**
- **Cause:** Incorrect API Key or Endpoint.
- **Solution:** Verify credentials in `AZURE_SETUP.md`. Ensure you are using an **Admin Key** for indexing, not just a Query Key.

**3. "Spark LLM API" errors**
- **Cause:** Network connectivity or rate limits.
- **Solution:** Check your internet connection. If the issue persists, check the browser console for specific API error messages.

**4. Large File Uploads Fail**
- **Cause:** Browser memory limits or parsing timeouts.
- **Solution:** The app currently limits parsing to files under 10MB. Break large documents into smaller files.

**5. GitHub API Rate Limits**
- **Cause:** Unauthenticated requests are limited to 60/hour.
- **Solution:** Wait for the limit to reset or implement authentication in `github-service.ts` (see code comments).
