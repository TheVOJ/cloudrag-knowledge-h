# RAG Knowledge Base Manager

A comprehensive knowledge base management system with AI-powered search and optional Azure AI Search integration for enhanced semantic retrieval.

## Features

- 📚 **Knowledge Base Management**: Create and organize multiple knowledge bases
- 🔍 **Intelligent Search**: Natural language queries with AI-powered responses
- 🌐 **Multi-Source Ingestion**: Add content from web, GitHub, OneDrive, and Dropbox (simulated)
- 📝 **Document Management**: View, edit, and organize indexed documents
- 📊 **Analytics**: Track query history and usage patterns
- ⚡ **Azure AI Search Integration**: Optional cloud-powered semantic search with relevance scoring
- 💾 **Persistent Storage**: All data saved locally using Spark KV storage

## Getting Started

1. **Create a Knowledge Base**: Click "Create Knowledge Base" and provide a name and description
2. **Add Content**: Select your knowledge base and add documents from various sources
3. **Query**: Ask questions in natural language and get AI-powered answers with source citations
4. **View Analytics**: Track your queries and understand usage patterns

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
- **AI**: Spark LLM API (GPT-4o-mini)
- **Search**: Simulated search + optional Azure AI Search
- **Storage**: Spark KV (persistent key-value store)
- **Icons**: Phosphor Icons

## Architecture

- **Simulated Mode**: Uses local document matching and LLM context
- **Azure Mode**: Leverages Azure Cognitive Search with semantic ranking and vector search capabilities
- **Hybrid Approach**: Falls back gracefully if Azure is unavailable

## License

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
