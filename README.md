# RAG Knowledge Base Manager

A comprehensive knowledge base management system with **advanced agentic RAG patterns**, intelligent query routing, self-reflective evaluation, and optional Azure AI Search integration for enhanced semantic retrieval.

## Features

### Core Capabilities
- 📚 **Knowledge Base Management**: Create and organize multiple knowledge bases
- 🌐 **Multi-Source Ingestion**: Add content from web (real scraping), GitHub (API), OneDrive, and Dropbox
- 📝 **Document Management**: View, edit, and organize indexed documents with chunking visualization
- 📊 **Analytics**: Track query history and usage patterns
- 💾 **Persistent Storage**: All data saved locally using Spark KV storage

### Standard RAG
- 🔍 **Intelligent Search**: Natural language queries with AI-powered responses
- ⚡ **Azure AI Search Integration**: Optional cloud-powered semantic search with relevance scoring
- 🎯 **Source Citations**: Responses include references to source documents

### 🤖 Agentic RAG (Advanced)
- 🧠 **Intent Classification**: Automatically detects query type (factual, analytical, comparative, procedural, etc.)
- 🎯 **Smart Routing**: Selects optimal retrieval strategy based on query characteristics
- 🔄 **Multi-Strategy Retrieval**: Semantic, keyword, hybrid, multi-query, and RAG fusion
- ✅ **Self-Evaluation**: Automatic quality assessment with confidence scoring
- 🔍 **Critic Agent**: Optional secondary evaluation for logic, accuracy, and completeness
- 🔁 **Auto-Correction**: Reformulates queries and retries when confidence is low
- 📊 **Full Transparency**: Visual flow diagrams showing agent decision-making process

## Getting Started

### Basic Usage

1. **Create a Knowledge Base**: Click "Create Knowledge Base" and provide a name and description
2. **Add Content**: Select your knowledge base and add documents from various sources
3. **Query**: Ask questions in natural language and get AI-powered answers with source citations
4. **View Analytics**: Track your queries and understand usage patterns

### Using Agentic RAG

1. Navigate to any knowledge base with documents
2. Go to the Query tab
3. Toggle to **Agentic Mode** (Brain icon)
4. Ask your question
5. Watch the agent:
   - Classify your query intent
   - Select the optimal retrieval strategy
   - Execute multi-stage retrieval
   - Generate and self-evaluate the response
   - Automatically retry if confidence is low
6. View the detailed decision flow and quality metrics

## Azure AI Search (Optional)

For enhanced search capabilities, you can integrate Azure AI Search:

1. Click the **Azure Search** button (gear icon) in the header
2. Follow the setup wizard to connect your Azure Cognitive Search service
3. New knowledge bases will automatically use Azure AI Search
4. Existing knowledge bases can be synced manually

**Benefits of Azure AI Search:**
- Better semantic understanding of queries
- Relevance scoring for each result
- Highlighted text snippets
- Improved ranking and accuracy
- Scalability for large document collections

See [AZURE_SETUP.md](./AZURE_SETUP.md) for detailed setup instructions.

## Technology Stack

- **Frontend**: React + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **AI**: Spark LLM API (GPT-4o / GPT-4o-mini)
- **Search**: Simulated search + optional Azure AI Search
- **Storage**: Spark KV (persistent key-value store)
- **Icons**: Phosphor Icons
- **Animations**: Framer Motion

## Architecture

### Query Processing Modes

**Standard RAG**:
- Simple one-shot retrieval
- Fixed hybrid search strategy
- Direct answer generation

**Agentic RAG**:
- Multi-stage intelligent pipeline
- Dynamic strategy selection (semantic, keyword, hybrid, multi-query, RAG fusion)
- Intent classification (7 types)
- Self-reflective evaluation (relevance, support, utility)
- Optional critic feedback (logic, accuracy, completeness)
- Automatic query reformulation on low confidence
- Up to 3 refinement iterations

### Search Backends

- **Simulated Mode**: Local document matching with BM25-style ranking
- **Azure Mode**: Azure Cognitive Search with semantic ranking and vector search
- **Hybrid Approach**: Graceful fallback if Azure unavailable

## Documentation

- **[PRD.md](./PRD.md)** - Complete product requirements and design specifications
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Technical implementation details
- **[AGENTIC_VERIFICATION.md](./AGENTIC_VERIFICATION.md)** - End-to-end verification of agentic patterns
- **[AZURE_SETUP.md](./AZURE_SETUP.md)** - Azure AI Search setup guide

## License

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
