# Cloud Storage Integration Guide

This document provides comprehensive information about OneDrive and Dropbox integration in the RAG Knowledge Base Manager.

## Overview

The system now supports full document digestion from both OneDrive and Dropbox, enabling you to:

- **Browse and index folders**: Recursively fetch all files from specified paths
- **Multiple file formats**: Support for text, markdown, JSON, Office documents, PDFs, and code files
- **Metadata preservation**: Maintain file size, modification dates, and author information
- **Flexible authentication**: Works with or without access tokens (simulation mode for testing)

## OneDrive Integration

### Authentication Setup

1. **Navigate to Settings**: Click the "Cloud Storage" button in the header
2. **Enable OneDrive**: Toggle the OneDrive integration switch
3. **Provide Access Token**:
   - Visit the [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
   - Sign in with your Microsoft account
   - Grant permissions for `Files.Read.All`
   - Copy the access token from the top bar
   - Paste it into the Access Token field

### Supported File Paths

You can specify OneDrive content in several ways:

- **Folder paths**: `/Documents/ProjectFiles`
- **Root folder**: `/` or `root`
- **Shared links**: `https://1drv.ms/...` (requires parsing)
- **Specific folders**: `/Work/Reports/Q1`

### Supported File Types

OneDrive integration can process:

- **Text files**: `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`
- **Code files**: `.js`, `.ts`, `.py`, `.java`, `.cpp`, `.c`, `.go`, `.rs`, etc.
- **Office documents**: `.docx`, `.xlsx`, `.pptx` (metadata only without parser)
- **PDFs**: `.pdf` (metadata only without parser)

### API Details

The implementation uses the Microsoft Graph API v1.0:

```typescript
// Fetch folder contents
GET https://graph.microsoft.com/v1.0/me/drive/items/{itemId}/children

// Download file content
GET {downloadUrl from item metadata}

// Search files
GET https://graph.microsoft.com/v1.0/me/drive/root/search(q='{query}')
```

### Example Usage

```typescript
// In the Add Content dialog:
// 1. Select OneDrive tab
// 2. Enter path: /Documents/TechDocs
// 3. Click Add Content

// The system will:
// - Recursively fetch all files in the folder
// - Extract content from supported formats
// - Create document entries with metadata
// - Index in Azure AI Search (if enabled)
```

### Simulation Mode

When no access token is provided (or for testing), the system generates realistic sample documents:

- **Project Proposal.docx**: Strategic initiative proposal with budget and timeline
- **Meeting Notes.txt**: Q1 planning session notes with action items
- **Product Roadmap.md**: Comprehensive product roadmap with quarterly goals

This allows you to test the system without real OneDrive access.

## Dropbox Integration

### Authentication Setup

1. **Navigate to Settings**: Click the "Cloud Storage" button in the header
2. **Enable Dropbox**: Toggle the Dropbox integration switch
3. **Provide Access Token**:
   - Go to the [Dropbox App Console](https://www.dropbox.com/developers/apps)
   - Create a new app or select an existing one
   - Set permissions to `files.content.read`
   - Generate an access token in the settings
   - Copy and paste it into the Access Token field

### Supported File Paths

You can specify Dropbox content in several ways:

- **Folder paths**: `/Work/Documentation`
- **Root folder**: `/` or empty string
- **Subfolders**: `/Projects/2025/Q1`
- **Shared links**: `https://www.dropbox.com/...` (requires parsing)

### Supported File Types

Dropbox integration can process:

- **Text files**: `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`
- **Code files**: `.js`, `.ts`, `.py`, `.java`, `.cpp`, `.c`, `.go`, `.rs`, etc.
- **Office documents**: `.docx`, `.xlsx`, `.pptx` (metadata only without parser)
- **PDFs**: `.pdf` (metadata only without parser)

### API Details

The implementation uses the Dropbox API v2:

```typescript
// List folder contents (recursive)
POST https://api.dropboxapi.com/2/files/list_folder
Body: { path: "/folder", recursive: true }

// Download file content
POST https://content.dropboxapi.com/2/files/download
Header: Dropbox-API-Arg: { path: "/file.txt" }

// Search files
POST https://api.dropboxapi.com/2/files/search_v2
Body: { query: "search term" }
```

### Example Usage

```typescript
// In the Add Content dialog:
// 1. Select Dropbox tab
// 2. Enter path: /Work/Docs
// 3. Click Add Content

// The system will:
// - Recursively list all files in the path
// - Download and extract content
// - Create document entries with metadata
// - Index in Azure AI Search (if enabled)
```

### Simulation Mode

When no access token is provided (or for testing), the system generates realistic sample documents:

- **Technical Specification.md**: Detailed system architecture and data flow
- **API Documentation.txt**: Comprehensive API endpoint documentation
- **Data Schema.json**: Complete JSON schema definitions

This allows you to test the system without real Dropbox access.

## Implementation Architecture

### Service Layer

Both OneDrive and Dropbox have dedicated service classes:

```typescript
// OneDrive
class OneDriveService {
  fetchFolderContents(folderId: string): Promise<OneDriveContentResult>
  fetchFileContent(item: OneDriveItem): Promise<string>
  searchFiles(query: string): Promise<OneDriveItem[]>
  getItemByPath(path: string): Promise<OneDriveItem>
}

// Dropbox
class DropboxService {
  listFolder(path: string): Promise<DropboxContentResult>
  downloadFile(path: string): Promise<ArrayBuffer>
  getFileContent(file: DropboxFile): Promise<string>
  searchFiles(query: string): Promise<DropboxFile[]>
}
```

### Document Conversion

Both services include conversion functions that transform cloud storage items into knowledge base documents:

```typescript
interface Document {
  id: string
  title: string
  content: string
  sourceType: 'onedrive' | 'dropbox'
  sourceUrl: string
  addedAt: number
  metadata: {
    size: number
    lastModified: number
    author: string
  }
}
```

### Content Extraction Strategy

The system uses intelligent content extraction based on file type:

1. **Text-based files**: Direct UTF-8 decoding
2. **Binary formats**: Placeholder content with file metadata
3. **Unknown formats**: Graceful fallback with type information

For production deployments, integrate specialized parsers:
- **PDF**: `pdf-parse` or `pdfjs-dist`
- **Word**: `mammoth` or `docx`
- **Excel**: `xlsx` or `exceljs`
- **PowerPoint**: `officegen` or custom parser

## Security Considerations

### Token Storage

- Access tokens are stored in browser local storage via `useKV`
- Tokens never leave the client browser
- Tokens are not sent to any external servers
- Consider implementing secure token refresh mechanisms

### Token Expiration

- **OneDrive**: Microsoft Graph tokens expire after 1 hour
- **Dropbox**: App-generated tokens can be long-lived or short-lived

For production:
1. Implement OAuth 2.0 authorization flow
2. Use refresh tokens to obtain new access tokens
3. Handle token expiration gracefully with re-authentication prompts

### Permissions

Ensure minimal required permissions:

- **OneDrive**: `Files.Read.All` (or `Files.Read` for user files only)
- **Dropbox**: `files.content.read` (or `files.content.write` if editing)

### Data Privacy

- Documents are processed client-side when possible
- Azure AI Search indexing (if enabled) sends content to Azure
- Review data residency requirements for compliance

## Error Handling

The system includes comprehensive error handling:

```typescript
try {
  const docs = await convertOneDriveToDocuments(token, path, url)
} catch (error) {
  if (error.message.includes('401')) {
    // Token expired or invalid
    toast.error('Authentication failed. Please update your access token.')
  } else if (error.message.includes('404')) {
    // Path not found
    toast.error('Folder or file not found. Check the path.')
  } else {
    // Generic error
    toast.error(`Failed to fetch: ${error.message}`)
  }
}
```

## Performance Optimization

### Batch Processing

For large folders:
- Files are fetched in batches
- Progress indicators show status
- Failed files don't stop the entire process

### Caching Strategy

Consider implementing:
- File content caching to reduce API calls
- Metadata caching for folder structures
- Differential updates (only fetch changed files)

### Rate Limiting

Be aware of API rate limits:
- **OneDrive**: ~1,000 requests per user per app per hour
- **Dropbox**: ~20,000 requests per app per day

## Future Enhancements

Planned improvements include:

1. **OAuth 2.0 Flow**: Implement proper authorization flow
2. **Real-time Sync**: Monitor changes and auto-update knowledge base
3. **Advanced Parsing**: Integrate PDF, Word, Excel parsers
4. **Selective Sync**: Choose specific files/folders to sync
5. **Conflict Resolution**: Handle file conflicts and duplicates
6. **Incremental Updates**: Only fetch changed files
7. **Webhook Integration**: Receive notifications on file changes
8. **Multi-account Support**: Connect multiple OneDrive/Dropbox accounts

## Troubleshooting

### Common Issues

**"No access token configured"**
- Solution: Enable and configure the integration in Cloud Storage settings

**"Authentication failed"**
- Solution: Token may be expired, generate a new one

**"No readable documents found"**
- Solution: Ensure the path contains supported file types

**"Rate limit exceeded"**
- Solution: Wait before retrying, or reduce concurrent requests

### Debug Mode

Enable verbose logging:

```typescript
// Add to service constructor
console.log('OneDrive request:', url, body)
console.log('OneDrive response:', data)
```

## API Reference

### OneDrive Service

```typescript
// Fetch folder contents
const result = await service.fetchFolderContents('root')
// Returns: { items: OneDriveItem[], totalSize: number, fileCount: number }

// Get file content
const content = await service.fetchFileContent(item)
// Returns: string (text content or description)

// Search files
const results = await service.searchFiles('query')
// Returns: OneDriveItem[]
```

### Dropbox Service

```typescript
// List folder
const result = await service.listFolder('/path')
// Returns: { files: DropboxFile[], totalSize: number, fileCount: number }

// Get file content
const content = await service.getFileContent(file)
// Returns: string (text content or description)

// Search files
const results = await service.searchFiles('query')
// Returns: DropboxFile[]
```

## Testing

### Manual Testing

1. Enable simulation mode (no token)
2. Add OneDrive content with path: `/test`
3. Verify 3 sample documents are created
4. Test with Dropbox using path: `/demo`
5. Verify 3 different sample documents are created

### Integration Testing

1. Configure real access tokens
2. Create a test folder with various file types
3. Add the folder path
4. Verify all supported files are indexed
5. Test querying the indexed content

## Support

For issues or questions:
- Check the error messages in the UI
- Review the browser console for detailed logs
- Ensure access tokens are valid and not expired
- Verify folder paths are correct

## Conclusion

The OneDrive and Dropbox integrations provide powerful capabilities for ingesting documents from popular cloud storage platforms. With support for multiple file formats, flexible authentication, and comprehensive error handling, the system can handle real-world enterprise scenarios while maintaining ease of use through simulation mode for testing.
