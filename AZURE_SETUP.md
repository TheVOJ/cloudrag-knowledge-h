# Azure AI Search Integration Setup

This guide will help you set up Azure AI Search integration for enhanced semantic search capabilities in your RAG Knowledge Base Manager.

## Prerequisites

- An Azure account with an active subscription
- Access to create Azure Cognitive Search resources

## Step 1: Create an Azure Cognitive Search Service

1. Go to the [Azure Portal](https://portal.azure.com)
2. Click **Create a resource**
3. Search for "Azure Cognitive Search" and select it
4. Click **Create**
5. Fill in the required details:
   - **Resource Group**: Create a new one or select existing
   - **Service name**: Choose a unique name (e.g., `my-rag-search`)
   - **Location**: Select a region close to you
   - **Pricing tier**: Start with **Free** tier for testing (allows 50MB storage, 3 indexes)
6. Click **Review + create**, then **Create**
7. Wait for deployment to complete (usually 2-3 minutes)

## Step 2: Get Your Credentials

### Get the Endpoint URL

1. Go to your newly created Search service
2. On the **Overview** page, find and copy the **URL**
   - It will look like: `https://my-rag-search.search.windows.net`

### Get the API Key

1. In your Search service, click **Keys** in the left menu
2. Copy one of the **Admin Keys** (not Query Keys)
   - Admin keys allow creating indexes and uploading documents
   - Query keys only allow searching

## Step 3: Configure the Application

1. In the RAG Knowledge Base Manager, click the **Azure Search** button in the header (gear icon)
2. Toggle **Enable Azure AI Search** to ON
3. Paste your **Endpoint URL** in the first field
4. Paste your **Admin API Key** in the second field
5. Click **Test Connection** to verify your credentials
6. Click **Save Settings**

## Step 4: Using Azure AI Search

### For New Knowledge Bases

When you create a new knowledge base with Azure AI Search enabled:
- An Azure Search index is automatically created
- All documents added to the knowledge base are indexed in Azure
- Queries automatically use Azure's semantic search

### For Existing Knowledge Bases

If you enable Azure AI Search after creating knowledge bases:
1. Open a knowledge base
2. Click the **Sync to Azure** button
3. All existing documents will be uploaded to Azure AI Search

## Features Enabled by Azure AI Search

- **Semantic Search**: Better understanding of natural language queries
- **Relevance Scoring**: See how relevant each result is to your query
- **Highlighted Snippets**: View highlighted text showing where matches occur
- **Better Ranking**: More accurate results based on content similarity
- **Scalability**: Handle larger knowledge bases with better performance

## Pricing Information

Azure Cognitive Search pricing tiers:

- **Free**: 50MB storage, 3 indexes, 10,000 documents - Good for testing
- **Basic**: 2GB storage, 15 indexes, 1M documents - ~$75/month
- **Standard S1**: 25GB storage, 50 indexes, 12M documents - ~$250/month

[View detailed pricing](https://azure.microsoft.com/en-us/pricing/details/search/)

## Troubleshooting

### Connection Test Fails

- Verify your endpoint URL is correct and includes `https://`
- Ensure you're using an **Admin Key**, not a Query Key
- Check your Azure subscription is active
- Verify the Search service is fully deployed

### Documents Not Syncing

- Check your API key has admin permissions
- Verify the index was created (check Azure Portal > Search Service > Indexes)
- Look at browser console for detailed error messages

### Queries Not Using Azure Search

- Ensure Azure AI Search is enabled in settings
- Verify the knowledge base was created after enabling Azure Search
- Try syncing documents manually with the "Sync to Azure" button

## Security Best Practices

- Never share your Admin API Keys
- Consider using Query Keys for read-only operations in production
- Rotate API keys regularly from the Azure Portal
- Use Azure RBAC for fine-grained access control in production environments

## Additional Resources

- [Azure Cognitive Search Documentation](https://docs.microsoft.com/en-us/azure/search/)
- [REST API Reference](https://docs.microsoft.com/en-us/rest/api/searchservice/)
- [Semantic Search Documentation](https://docs.microsoft.com/en-us/azure/search/semantic-search-overview)
