# Planning Guide

A knowledge base management system that allows users to create, organize, and query custom RAG (Retrieval-Augmented Generation) indexes from multiple data sources including real web scraping, GitHub repository ingestion, and cloud storage, with Azure AI Search integration for enhanced semantic search, document chunking visualization capabilities, and advanced agentic RAG patterns for intelligent query routing and self-correcting responses.

**Experience Qualities**:
1. **Professional** - Enterprise-grade interface that conveys trust and reliability for managing critical knowledge assets with transparent AI decision-making
2. **Efficient** - Streamlined workflows that minimize clicks between creating indexes, ingesting content, and retrieving answers with intelligent agent orchestration
3. **Intelligent** - Smart search and AI-powered responses that feel contextually aware and accurate, with cloud-powered vector search, embedding visualization, and autonomous agent routing that adapts strategies based on query characteristics

**Complexity Level**: Complex Application (advanced functionality, accounts)
  - Multiple interconnected features including knowledge base management, real document ingestion from web and GitHub, search interfaces, AI-powered querying with persistent state across sessions, Azure AI Search integration, document chunking with embedding visualization, and advanced agentic RAG with intent classification, multi-strategy retrieval, self-reflection, and automatic query reformulation

## Essential Features

### Knowledge Base Creation
- **Functionality**: Create and manage multiple knowledge bases with unique names, descriptions, and metadata
- **Purpose**: Organize different domains of knowledge separately (e.g., technical docs, customer support, product info)
- **Trigger**: User clicks "Create Knowledge Base" button from dashboard
- **Progression**: Click Create → Enter name/description → Select data sources → Configure settings → Save → View in dashboard
- **Success criteria**: Knowledge base appears in list, can be edited/deleted, persists across sessions

### Document Ingestion (Real Implementation)
- **Functionality**: Add content to knowledge bases through real web scraping, GitHub API integration, and simulated cloud storage sources
- **Purpose**: Build comprehensive indexes from diverse content sources for RAG queries with actual data extraction
- **Trigger**: User selects a knowledge base and clicks "Add Content"
- **Progression**: Select knowledge base → Choose source type (Web/GitHub/OneDrive/Dropbox) → Provide URL → System fetches and parses content → Extract metadata → Confirm addition → View indexed documents
- **Success criteria**: Real web content extracted with proper parsing, GitHub repositories fetched via API with file contents, metadata extracted, searchable within knowledge base

### Real Web Scraping
- **Functionality**: Fetch and parse actual web pages, extracting title, main content, and metadata
- **Purpose**: Enable real-world knowledge base building from public web sources
- **Trigger**: User provides web URL in add content dialog
- **Progression**: Enter URL → Fetch HTML → Parse with DOMParser → Extract article content → Remove unwanted elements → Convert to markdown → Index document
- **Success criteria**: Properly extracts main content, removes navigation/ads, preserves semantic structure, handles errors gracefully

### GitHub Repository Ingestion
- **Functionality**: Connect to GitHub API to fetch repository structure and file contents
- **Purpose**: Index source code, documentation, and technical content from GitHub repositories
- **Trigger**: User provides GitHub repository URL
- **Progression**: Parse GitHub URL → Fetch repo tree via API → Filter supported file types → Fetch file contents → Group by directory → Create multiple documents → Index all content
- **Success criteria**: Fetches up to 50 files per repo, supports multiple languages, preserves code structure, groups logically by directory

### Document Chunking & Embedding Visualization
- **Functionality**: Visualize how documents are split into chunks and their semantic embeddings in 2D space
- **Purpose**: Help users understand chunking strategies and semantic relationships between content pieces
- **Trigger**: User clicks "View Chunks" button on a document
- **Progression**: Click visualize → Select chunking strategy → System chunks document → Generate embeddings → Display chunk list and 2D projection → Show similarity scores between chunks
- **Success criteria**: Multiple chunking strategies available (fixed, sentence, paragraph, semantic), embeddings visualized in 2D space, similarity calculations between chunks, interactive selection

### Intelligent Search & Query
- **Functionality**: Natural language search with AI-powered responses using LLM and indexed content, with Azure AI Search for semantic vector search. Supports both standard RAG and advanced agentic RAG with intelligent routing.
- **Purpose**: Retrieve contextually relevant answers from knowledge bases using RAG methodology with enhanced relevance scoring, and provide transparent insight into AI decision-making processes
- **Trigger**: User enters question in search interface
- **Progression**: Enter query → User selects Standard or Agentic mode → System analyzes intent (agentic only) → Routes to optimal strategy (semantic/keyword/hybrid/multi-query/RAG fusion) → Executes retrieval → LLM generates response with source citations → Self-evaluates quality (agentic only) → Displays answer with optional detailed agent breakdown → Auto-corrects if confidence low
- **Success criteria**: Responses reference indexed content, include source citations with relevance scores when using Azure Search, feel contextually accurate. In agentic mode: shows intent classification, retrieval strategy selection, confidence scores, self-evaluation tokens, and improvement suggestions when needed.

### Agentic RAG Query Routing
- **Functionality**: Intelligent agent-based query routing that analyzes query intent, selects optimal retrieval strategies, performs multi-stage retrieval with self-evaluation, and auto-corrects low-confidence responses
- **Purpose**: Transform simple one-shot RAG into adaptive, self-improving retrieval system that makes intelligent decisions about how to answer queries
- **Trigger**: User selects "Agentic" mode toggle in query interface
- **Progression**: Enter query → Agent classifies intent (factual/analytical/comparative/procedural/clarification/chitchat/out_of_scope) → Analyzes query complexity, specificity, and scope → Routes to optimal strategy (semantic/keyword/hybrid/multi_query/rag_fusion) → Executes retrieval with quality evaluation → Generates response → Self-evaluates with reflection tokens (RELEVANT/SUPPORTED/USEFUL) → Optional critic feedback on logic/accuracy/completeness → If confidence low, automatically reformulates and retries → Returns answer with full transparency of decision path
- **Success criteria**: Intent correctly classified, appropriate strategy selected, multi-iteration refinement when needed, high confidence final answers, transparent decision trail visible in agent details panel

### Query Intent Classification
- **Functionality**: LLM-based classification of user queries into intent categories to guide retrieval strategy selection
- **Purpose**: Enable context-aware routing by understanding what type of answer the user needs
- **Trigger**: Query submitted in agentic mode
- **Progression**: Analyze query → LLM classifies into factual/analytical/comparative/procedural/clarification/chitchat/out_of_scope → Intent used for strategy selection
- **Success criteria**: Accurate intent classification, appropriate handling of chitchat and out-of-scope queries, influences retrieval strategy selection

### Multi-Strategy Retrieval
- **Functionality**: Support for multiple retrieval strategies including semantic (embedding-based), keyword (BM25-style), hybrid (combined), multi-query (query decomposition), and RAG fusion (query expansion with reciprocal rank fusion)
- **Purpose**: Match retrieval approach to query characteristics for optimal results
- **Trigger**: Agentic router selects strategy based on query analysis
- **Progression**: Strategy selected → Execute retrieval (may include sub-query generation, query expansion, or parallel retrieval) → Rank and merge results → Return top-k with scores
- **Success criteria**: Different strategies produce meaningfully different result sets, complex queries handled via multi-query decomposition, RAG fusion improves recall

### Self-Reflective RAG
- **Functionality**: Automated evaluation of retrieval relevance, response support, and utility using reflection tokens (RELEVANT/PARTIALLY_RELEVANT/NOT_RELEVANT, FULLY_SUPPORTED/PARTIALLY_SUPPORTED/NOT_SUPPORTED, USEFUL/SOMEWHAT_USEFUL/NOT_USEFUL)
- **Purpose**: Enable system to self-assess quality and trigger corrections without human intervention
- **Trigger**: After response generation in agentic mode
- **Progression**: Generate response → Evaluate retrieval relevance → Check if response supported by sources → Assess utility for answering query → Calculate confidence score → Determine if retry needed → Provide improvement suggestions
- **Success criteria**: Accurate quality assessment, appropriate retry decisions, hallucinations detected via support evaluation, confidence scores correlate with actual quality

### Critic Agent Feedback
- **Functionality**: Optional secondary evaluation pass that analyzes logical consistency, factual accuracy, completeness, identifies hallucinations and gaps, and provides actionable suggestions
- **Purpose**: Provide deeper quality analysis and catch issues the primary evaluator might miss
- **Trigger**: Enabled by default in agentic mode after self-evaluation
- **Progression**: Response generated → Critic evaluates logic/accuracy/completeness → Identifies specific hallucinations and gaps → Suggests improvements → Feedback used for retry decisions
- **Success criteria**: Identifies factual errors, spots logical inconsistencies, detects missing information, provides actionable improvement suggestions

### Automatic Query Reformulation
- **Functionality**: When confidence is low or retrieval quality poor, system automatically reformulates the query based on evaluation feedback and retries (up to 3 iterations)
- **Purpose**: Self-correct poor initial results without requiring user intervention
- **Trigger**: Low confidence score (<0.6) or poor retrieval quality detected
- **Progression**: Initial query fails quality check → System analyzes failure reasons → LLM reformulates query to address issues (e.g., add specificity, break into sub-queries, expand context) → Retry with reformulated query → Repeat until confidence threshold met or max iterations reached
- **Success criteria**: Reformulations improve results, iterative refinement visible in metadata, final answers have higher confidence than initial attempts, system stops when quality acceptable

### Azure AI Search Integration
- **Functionality**: Configure and connect Azure Cognitive Search service for enhanced semantic search and vector-based retrieval
- **Purpose**: Provide enterprise-grade search capabilities with better relevance ranking and semantic understanding
- **Trigger**: User clicks Azure Search settings in header
- **Progression**: Open settings → Enable Azure Search toggle → Enter endpoint and API key → Test connection → Save → New knowledge bases automatically create Azure indexes → Documents are indexed to Azure → Queries use Azure semantic search
- **Success criteria**: Connection tests successfully, indexes are created automatically, documents sync to Azure, queries show relevance scores, better search results than simulated mode

### Source Management
- **Functionality**: View, filter, and manage all indexed documents and their metadata with visualization capabilities
- **Purpose**: Maintain visibility and control over what content is indexed and how it's chunked
- **Trigger**: User navigates to knowledge base details
- **Progression**: Select knowledge base → View document list → Filter by source type → Review metadata → View chunks and embeddings → Option to remove documents → Changes reflected immediately
- **Success criteria**: All documents visible with metadata, filtering works, removal updates index, chunking visualization available

### Query History & Analytics
- **Functionality**: Track all queries made, responses generated, and usage patterns
- **Purpose**: Understand how knowledge bases are being used and improve content coverage
- **Trigger**: User navigates to analytics section
- **Progression**: Open analytics → View query history → See most common queries → Identify knowledge gaps → Take action to improve index
- **Success criteria**: History persists, displays usage trends, helps identify missing content areas

### Strategy Performance Tracking & Learning
- **Functionality**: Autonomous system that records routing decisions, strategy effectiveness, and user feedback to continuously optimize future queries
- **Purpose**: Enable the agentic system to learn from every interaction and improve routing decisions over time
- **Trigger**: Automatically tracks each agentic query; user can provide explicit feedback (helpful/neutral/not helpful)
- **Progression**: Query executed → Performance metrics recorded (confidence, iterations, time, strategy used) → User provides optional feedback → Metrics aggregated by intent/strategy combination → Historical patterns analyzed → Recommendations generated for similar future queries → Learning insights auto-generated → System adapts strategy selection based on success rates
- **Success criteria**: Performance data persists across sessions, success rates calculated per strategy/intent, recommendations based on >3 queries, user feedback incorporated into learning, similar query detection works, improvement trends visible

### Strategy Performance Dashboard
- **Functionality**: Comprehensive visualization of routing effectiveness, success rates, confidence trends, and optimization opportunities with learning insights
- **Purpose**: Provide transparency into the agentic system's learning progress and enable data-driven optimization
- **Trigger**: User clicks "Performance" in main navigation
- **Progression**: View dashboard → Review overall statistics (total queries, avg confidence, success rate, avg iterations) → Explore top 5 performing strategies → Filter metrics by intent type → Read auto-generated learning insights (strategy performance, intent patterns, failure modes, optimization opportunities) → Review recent query history with performance breakdown → Identify trends and patterns → Act on suggested improvements
- **Success criteria**: Real-time metrics display, intent-based filtering, top performers ranked by success rate, actionable insights with impact levels, trend indicators, query-level performance visible, recommendations data-driven

## Edge Case Handling
- **Empty Knowledge Bases**: Guide users with helpful empty states suggesting first actions to take
- **Long Document Processing**: Show progress indicators during real web scraping and GitHub API calls
- **Fetch Failures**: Handle network errors, CORS issues, and rate limits gracefully with clear error messages
- **Large Repositories**: Limit to 50 files per repository to prevent overwhelming the system
- **Large Files**: Truncate files over 100KB to prevent memory issues
- **Malformed HTML**: Robust parsing that handles broken HTML gracefully
- **Invalid URLs**: Validate and provide clear error messages for malformed or inaccessible sources
- **Query Failures**: Gracefully handle cases where LLM cannot generate good responses with fallback messages
- **Large Knowledge Bases**: Implement pagination and virtual scrolling for performance with many documents
- **Azure Connection Failures**: Handle network errors gracefully, fall back to simulated search if Azure is unavailable
- **API Key Security**: Mask API keys in UI, validate credentials before saving
- **Index Naming Conflicts**: Generate unique index names automatically to prevent collisions
- **Embedding Generation Failures**: Fall back to simulated embeddings when LLM calls fail
- **Chunk Visualization with Many Chunks**: Handle documents with 50+ chunks efficiently
- **Agentic RAG Failures**: Gracefully degrade to standard RAG if agent orchestration fails, show error details in agent panel
- **Low Confidence Loops**: Prevent infinite retry loops with max iteration limits (3 iterations)
- **Intent Misclassification**: Provide fallback routing strategy when intent classification fails or is ambiguous
- **Multi-Query Performance**: Limit sub-queries to 5 maximum to prevent excessive LLM calls
- **RAG Fusion Overhead**: Cache query expansions to avoid redundant generation on retries

## Design Direction
The design should feel professional, technical, and trustworthy like enterprise AI platforms (think Notion AI meets Azure Portal) with a clean, data-dense interface that prioritizes information hierarchy and efficient workflows over decorative elements.

## Color Selection
Triadic color scheme balanced between technical professionalism and visual interest using cool blues, warm accents, and neutral grays.

- **Primary Color**: Deep Blue (oklch(0.45 0.15 250)) - Represents intelligence, trust, and technical depth; used for key actions and navigation
- **Secondary Colors**: Slate Gray (oklch(0.55 0.02 250)) for secondary UI elements; Light Blue (oklch(0.85 0.08 250)) for cards and containers
- **Accent Color**: Vibrant Amber (oklch(0.72 0.15 65)) - Draws attention to important actions, AI-powered features, and success states
- **Foreground/Background Pairings**:
  - Background (White oklch(0.98 0 0)): Foreground Dark Gray (oklch(0.25 0.01 250)) - Ratio 14.1:1 ✓
  - Card (Light Blue oklch(0.96 0.01 250)): Foreground Dark Gray (oklch(0.25 0.01 250)) - Ratio 13.2:1 ✓
  - Primary (Deep Blue oklch(0.45 0.15 250)): White (oklch(0.98 0 0)) - Ratio 7.8:1 ✓
  - Secondary (Slate Gray oklch(0.55 0.02 250)): White (oklch(0.98 0 0)) - Ratio 4.9:1 ✓
  - Accent (Amber oklch(0.72 0.15 65)): Dark Gray (oklch(0.25 0.01 250)) - Ratio 8.2:1 ✓
  - Muted (Light Gray oklch(0.92 0.01 250)): Muted Foreground (oklch(0.50 0.02 250)) - Ratio 5.1:1 ✓

## Font Selection
Modern, highly legible sans-serif typefaces that balance technical precision with approachability - using Inter for UI elements and IBM Plex Mono for code/technical content.

- **Typographic Hierarchy**:
  - H1 (Page Titles): Inter SemiBold/32px/tight letter-spacing/-0.02em
  - H2 (Section Headers): Inter SemiBold/24px/tight letter-spacing/-0.01em
  - H3 (Subsections): Inter Medium/18px/normal letter-spacing
  - Body (Main Content): Inter Regular/14px/relaxed line-height/1.6
  - Small (Metadata): Inter Regular/12px/normal line-height/1.5/color-muted-foreground
  - Code/Technical: IBM Plex Mono Regular/13px/monospace

## Animations
Subtle, purposeful animations that reinforce the feeling of an intelligent system working in the background - smooth transitions for state changes, gentle loading indicators, and micro-interactions on data ingestion.

- **Purposeful Meaning**: Motion communicates system intelligence and processing through gentle pulsing on active operations, smooth page transitions that maintain spatial relationships, and satisfying micro-interactions on successful actions
- **Hierarchy of Movement**: 
  - Priority 1: Loading/processing states for document ingestion and query responses (continuous, prominent)
  - Priority 2: Page/modal transitions for navigation flow (smooth, directional)
  - Priority 3: Hover states and button interactions (instant feedback, subtle)
  - Priority 4: Success confirmations and toasts (brief, celebratory)

## Component Selection
- **Components**: 
  - Dialog for knowledge base creation/editing forms
  - Card for knowledge base tiles and document entries with hover states
  - Table for document lists with sortable columns
  - Tabs for switching between different source types and views
  - Input with search styling for query interface
  - Badge for source type indicators and status labels
  - Progress for document processing simulation
  - Scroll-area for long lists of documents
  - Separator for visual section breaks
  - Skeleton for loading states
  - Button with variants (default for primary actions, outline for secondary, ghost for tertiary)
- **Customizations**: 
  - Custom AI query component with streaming text effect for responses
  - Custom document upload zone with drag-and-drop styling
  - Custom analytics chart using recharts for query trends
  - Source connection cards with provider logos and status indicators
- **States**: 
  - Buttons: Subtle shadow in rest, lift on hover, press animation on click, disabled with opacity
  - Inputs: Border highlight on focus with accent color, error state with destructive color
  - Cards: Subtle border in rest, shadow and lift on hover for interactive cards
  - Loading: Skeleton screens for initial loads, inline spinners for actions
- **Icon Selection**: 
  - Database (package icon) for knowledge bases
  - MagnifyingGlass for search operations
  - Plus for creation actions
  - FileText for documents
  - GithubLogo, DropboxLogo, Link for source types
  - Sparkle for AI-powered features
  - ChartBar for analytics
  - Trash for deletion
- **Spacing**: 
  - Container padding: p-6 for main content areas, p-4 for cards
  - Gap between elements: gap-4 for related items, gap-6 for distinct sections, gap-2 for tight groupings
  - Margin for sections: mb-6 between major sections, mb-4 between subsections
- **Mobile**: 
  - Single column layout for knowledge base grid
  - Stacked form fields with full width
  - Hamburger menu for navigation
  - Bottom sheet for quick actions
  - Touch-optimized buttons (min 44px height)
  - Simplified table view with cards showing key info only
