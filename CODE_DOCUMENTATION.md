# Source Code Documentation

This document provides a technical overview of the codebase structure and key components of the RAG Knowledge Base Manager.

## Directory Structure

- **`src/`**: Root source directory
  - **`components/`**: React UI components
    - **`ui/`**: Reusable atomic components (shadcn/ui)
  - **`hooks/`**: Custom React hooks
  - **`lib/`**: Core business logic and services
  - **`styles/`**: Global styles and theme definitions

## Core Libraries (`src/lib/`)

This directory contains the "brain" of the application.

### Agentic RAG System

The application implements an advanced Agentic RAG (Retrieval-Augmented Generation) pattern.

*   **`agentic-rag-orchestrator.ts`** (`AgenticRAGOrchestrator`)
    *   **Role**: The main controller that manages the entire query lifecycle.
    *   **Key Functions**:
        *   `query()`: Executes the agentic loop (Routing -> Retrieval -> Generation -> Evaluation -> Loop).
        *   Manages conversation history and state.
        *   Handles retry logic and query reformulation.

*   **`agentic-router.ts`** (`AgenticQueryRouter`)
    *   **Role**: The "decision maker" that analyzes queries to determine the best approach.
    *   **Key Functions**:
        *   `classifyIntent()`: Determines if a query is factual, analytical, chitchat, etc.
        *   `routeQuery()`: Selects the optimal retrieval strategy (e.g., Semantic, Multi-Query).
        *   `shouldClarify()`: Detects ambiguous queries.

*   **`retrieval-executor.ts`** (`RetrievalExecutor`)
    *   **Role**: The "search engine" that fetches documents.
    *   **Strategies**:
        *   **Semantic**: Embedding-based search (via Azure or simulated).
        *   **Keyword**: BM25-style text matching.
        *   **Hybrid**: Combines semantic and keyword scores.
        *   **Multi-Query**: Breaks complex queries into sub-queries.
        *   **RAG Fusion**: Generates variations and uses Reciprocal Rank Fusion (RRF).

*   **`self-reflective-rag.ts`** (`SelfReflectiveRAG`)
    *   **Role**: The "quality control" system.
    *   **Key Functions**:
        *   `performSelfEvaluation()`: Scores response based on Relevance, Support, and Utility.
        *   `criticResponse()`: Detailed analysis of logic and hallucinations.
        *   `suggestImprovements()`: Decides if a query needs to be retried.

*   **`strategy-performance-tracker.ts`** (`StrategyPerformanceTracker`)
    *   **Role**: The "learning system" that optimizes routing over time.
    *   **Key Functions**:
        *   Records success/failure of strategies for different query intents.
        *   `getStrategyRecommendation()`: Suggests the best strategy based on historical data.
        *   Generates insights and analytics.

### Data Ingestion & Management

*   **`web-scraper.ts`**: Fetches and parses content from public URLs.
*   **`github-service.ts`**: Connects to GitHub API to fetch repository contents.
*   **`document-parser.ts`**: Handles PDF, Word, and text file parsing in the browser.
*   **`chunking.ts`**: Implements text splitting strategies (Fixed, Sentence, Semantic) and embedding generation.
*   **`azure-search.ts`**: Client for interacting with Azure AI Search service.

## Key Components (`src/components/`)

### Interface
*   **`AgenticQueryInterface.tsx`**: The main search UI. Handles user input, displays the streaming response, and visualizes the agent's thought process.
*   **`AgenticFlowDiagram.tsx`**: Visualizes the decision path taken by the agent (Routing -> Retrieval -> etc.).
*   **`StrategyPerformanceDashboard.tsx`**: Analytics view showing how well different strategies are performing.

### Dialogs
*   **`AddContentDialog.tsx`**: Multi-tab wizard for adding content (Web, GitHub, Upload, etc.).
*   **`ChunkVisualizerDialog.tsx`**: Tool for inspecting how documents are split and visualizing embeddings.
*   **`CreateKnowledgeBaseDialog.tsx`**: Form for creating new knowledge bases.

## State Management
The application primarily uses React local state and `useEffect` for component-level logic. Persistent data (Knowledge Bases, Documents, Analytics) is stored using the global `window.spark.kv` store (Spark KV).

## Data Types
Core type definitions are located in **`src/lib/types.ts`**.
*   `KnowledgeBase`: Container for documents and settings.
*   `Document`: Unit of indexed content.
*   `Chunk`: Segment of a document with vector embedding.
