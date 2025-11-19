# PDF and Word Document Parsing Implementation

## Overview

The RAG Knowledge Base Manager now supports real PDF and Word document parsing capabilities. Users can upload PDF (.pdf) and Word (.doc, .docx) files directly from their computer, which will be automatically parsed and indexed into their knowledge bases.

## Features

### Supported File Types

- **PDF Documents** (.pdf)
  - Full text extraction from all pages
  - Metadata extraction (author, page count, file size)
  - Multi-page document support
  - Preserves document structure

- **Word Documents** (.doc, .docx)
  - Raw text extraction
  - Metadata extraction (file size, last modified date)
  - Supports both legacy (.doc) and modern (.docx) formats

### User Interface

#### File Upload Dialog

A dedicated file upload dialog provides:

- **Drag-and-drop interface** - Simply drag files onto the upload area
- **Click-to-browse** - Traditional file picker for selecting documents
- **Multiple file support** - Upload multiple documents at once
- **Real-time progress tracking** - Visual progress bars showing parsing status
- **File preview** - See selected files before uploading with icons and file sizes
- **Per-file status** - Check marks indicate successfully processed files
- **Error handling** - Clear error messages if parsing fails

#### Integration with Add Content Dialog

The "Add Content" dialog now includes a new "Upload" tab alongside existing options (Web, GitHub, OneDrive, Dropbox). This provides a unified interface for all content ingestion methods.

## Technical Implementation

### Libraries Used

1. **pdfjs-dist** - Mozilla's PDF.js library for browser-based PDF parsing
   - Extracts text content from PDF pages
   - Retrieves metadata (author, creation date, etc.)
   - Handles multi-page documents efficiently

2. **mammoth** - Converts Word documents to plain text
   - Supports .doc and .docx formats
   - Extracts raw text while preserving basic structure
   - Browser-compatible implementation

### Architecture

```
src/lib/document-parser.ts
├── parsePDF(file: File): Promise<ParsedDocument>
├── parseWord(file: File): Promise<ParsedDocument>
├── parseDocument(file: File): Promise<ParsedDocument>
├── getSupportedFileTypes(): string
└── isSupportedFileType(filename: string): boolean

src/components/FileUploadDialog.tsx
└── File upload UI with drag-and-drop, progress tracking, and validation

src/App.tsx
└── handleFileUpload() - Processes uploaded files and adds to knowledge base
```

### Data Flow

1. **User selects files** via drag-and-drop or file picker
2. **Files are validated** against supported types (.pdf, .doc, .docx)
3. **Each file is parsed**:
   - PDF: Text extracted page-by-page using pdf.js
   - Word: Text extracted using mammoth.js
4. **Metadata is collected**:
   - File name, size, type
   - Document-specific metadata (page count, author, etc.)
5. **Documents are created** with unique IDs and timestamps
6. **Documents are indexed**:
   - Stored in local KV storage
   - Optionally indexed in Azure AI Search (if enabled)
7. **Knowledge base is updated** with new document count and source types

### Parsed Document Structure

```typescript
interface ParsedDocument {
  title: string              // Filename without extension
  content: string           // Full extracted text
  metadata: {
    pageCount?: number      // PDF only
    size: number           // File size in bytes
    lastModified?: number  // Timestamp
    author?: string        // PDF metadata
    fileType: 'pdf' | 'docx'
  }
}
```

### Type System Updates

The `SourceType` union type now includes:

```typescript
export type SourceType = 
  | 'web' 
  | 'github' 
  | 'onedrive' 
  | 'dropbox' 
  | 'pdf'    // New
  | 'docx'   // New
```

Each uploaded document is tagged with its source type, enabling:
- Filtering by document type
- Source-specific icons and labels
- Analytics and tracking by ingestion method

## User Workflow

### Uploading Documents

1. **Select a knowledge base** from the dashboard
2. **Click "Add Content"** button
3. **Navigate to "Upload" tab** in the dialog
4. **Select files**:
   - Drag and drop PDF or Word files onto the upload area, OR
   - Click the upload area to browse and select files
5. **Review selected files** - Files appear in a list with icons and sizes
6. **Click "Upload X files"** button
7. **Monitor progress** - Progress bar shows parsing and upload status
8. **Success confirmation** - Toast notification confirms successful upload

### Querying Uploaded Documents

Once uploaded, documents are immediately searchable:

- **Standard mode** - Vector similarity search across document content
- **Agentic mode** - Advanced query routing and multi-strategy retrieval
- **Azure AI Search** - Enterprise-grade search with semantic ranking (if enabled)

### Managing Uploaded Documents

Uploaded documents appear in the "Documents" tab with:
- Document icon (📄 for PDF, 📝 for Word)
- Title and metadata
- Options to view, edit, delete, or visualize chunks

## Performance Considerations

### Browser-Based Parsing

All parsing happens in the browser:
- **No server upload required** - Files never leave the user's device during parsing
- **Privacy-focused** - Sensitive documents remain local until explicitly uploaded to knowledge base
- **Efficient** - Leverages Web Workers for PDF parsing (via pdf.js)

### Memory Management

For large files:
- Files are processed sequentially to avoid memory spikes
- Progress tracking provides feedback during long operations
- Error handling prevents partial uploads

### File Size Limits

While there are no hard-coded limits, practical constraints include:
- Browser memory limitations
- PDF.js performs best with files under 100MB
- Very large Word documents may take longer to parse

## Error Handling

The implementation includes comprehensive error handling:

### Validation Errors
- Unsupported file types are rejected with clear messages
- Empty file lists prevent accidental empty uploads

### Parsing Errors
- PDF parsing failures (corrupted files, unsupported formats)
- Word document parsing failures
- Each error shows which file failed and why

### Upload Errors
- Knowledge base not selected
- Azure indexing failures (if enabled)
- Network or storage errors

All errors display user-friendly toast notifications with actionable information.

## Integration with Azure AI Search

When Azure AI Search is enabled for a knowledge base:

1. **Documents are parsed locally** (same as always)
2. **Content is indexed in Azure** alongside local storage
3. **Metadata is preserved** including page counts, file types, etc.
4. **Queries leverage both** local and Azure search capabilities

This enables:
- Semantic search across uploaded documents
- Hybrid retrieval combining keyword and vector search
- Enterprise-grade scale and performance

## Future Enhancements

Potential improvements for future iterations:

### Additional Format Support
- Excel spreadsheets (.xlsx)
- PowerPoint presentations (.pptx)
- Plain text files (.txt, .md)
- CSV data files

### Enhanced PDF Parsing
- OCR for scanned documents
- Table extraction
- Image extraction and description
- Preserve formatting and structure

### Advanced Features
- Batch processing for large file sets
- Duplicate detection
- Automatic language detection
- Document summarization on upload

### Performance Optimizations
- Streaming parser for large files
- Web Worker-based parsing for better UI responsiveness
- Chunking during upload for immediate searchability

## Security Considerations

### File Validation
- Only whitelisted file extensions are accepted
- Files are validated before parsing begins
- Malformed files are rejected with appropriate errors

### Privacy
- Files are parsed entirely in the browser
- No data sent to external services during parsing
- Only parsed text content is stored (not original files)

### Storage
- Parsed content stored in secure KV storage
- Azure integration uses encrypted connections
- Access controlled via knowledge base permissions

## Testing Recommendations

When testing the document upload feature:

1. **Test various PDF types**:
   - Simple text PDFs
   - Complex multi-column layouts
   - Scanned documents (note: OCR not supported yet)
   - Password-protected PDFs (will fail gracefully)

2. **Test Word documents**:
   - .docx files (modern format)
   - .doc files (legacy format)
   - Documents with formatting (italics, bold, etc.)
   - Documents with tables and images

3. **Test edge cases**:
   - Very large files (50MB+)
   - Empty documents
   - Corrupted files
   - Multiple files simultaneously
   - Mixed PDF and Word uploads

4. **Test integration**:
   - Query uploaded documents
   - Edit uploaded document content
   - Delete uploaded documents
   - Visualize document chunks
   - Azure Search integration (if available)

## Troubleshooting

### "Unsupported file type" error
- Ensure file has .pdf, .doc, or .docx extension
- Check file is not corrupted
- Verify file is actually the format it claims to be

### "Failed to parse" error
- File may be corrupted or password-protected
- Try opening file in native application first
- For PDFs, ensure they contain actual text (not just images)

### Slow parsing
- Large PDF files can take time (1-2 seconds per page)
- Multiple large files extend processing time
- Progress bar shows real-time status

### Missing text from PDF
- Scanned PDFs without OCR layer won't extract text
- Image-based PDFs require OCR (not currently supported)
- Some PDF security settings may prevent text extraction

## Resources

### Documentation
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [Mammoth.js GitHub](https://github.com/mwilliamson/mammoth.js)

### Related Features
- See `IMPLEMENTATION.md` for overall RAG system architecture
- See `AZURE_SETUP.md` for Azure AI Search integration
- See `CLOUD_STORAGE_INTEGRATION.md` for OneDrive/Dropbox support

---

**Implementation Date**: Current iteration  
**Status**: ✅ Complete and functional  
**Dependencies**: pdfjs-dist, mammoth
