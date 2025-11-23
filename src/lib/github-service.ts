import { Document as DocType } from './types'

export interface GitHubFile {
  path: string
  content: string
  sha: string
  size: number
  type: 'file' | 'dir'
}

export interface GitHubRepo {
  owner: string
  repo: string
  branch?: string
}

export interface RepoContent {
  files: GitHubFile[]
  readme?: string
  totalSize: number
}

const SUPPORTED_EXTENSIONS = [
  '.md',
  '.txt',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.cs',
  '.swift',
  '.kt',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.css',
  '.scss',
  '.sql',
]

export function parseGitHubUrl(url: string): GitHubRepo | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+)/,
    /github\.com\/([^\/]+)\/([^\/]+)\.git/,
    /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', ''),
        branch: match[3] || 'main',
      }
    }
  }

  return null
}

export async function fetchRepoContent(repoUrl: string): Promise<RepoContent> {
  const repo = parseGitHubUrl(repoUrl)
  if (!repo) {
    throw new Error('Invalid GitHub URL')
  }

  const apiBase = `https://api.github.com/repos/${repo.owner}/${repo.repo}`

  const tree = await fetchRepoTree(apiBase, repo.branch || 'main')
  const files = await Promise.all(
    tree
      .filter((item) => item.type === 'blob' && shouldIncludeFile(item.path))
      .slice(0, 50)
      .map((item) => fetchFileContent(apiBase, item.path, item.sha))
  )

  let readme: string | undefined
  try {
    const readmeResponse = await fetch(`${apiBase}/readme`, {
      headers: { Accept: 'application/vnd.github.v3.raw' },
    })
    if (readmeResponse.ok) {
      readme = await readmeResponse.text()
    }
  } catch {}

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return {
    files: files.filter((f) => f.content.length > 0),
    readme,
    totalSize,
  }
}

async function fetchRepoTree(
  apiBase: string,
  branch: string
): Promise<Array<{ path: string; type: string; sha: string }>> {
  // First, get the branch reference to find the commit SHA
  const branchResponse = await fetch(`${apiBase}/git/ref/heads/${branch}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!branchResponse.ok) {
    throw new Error(`Failed to fetch branch reference: ${branchResponse.status}`)
  }

  const branchData = await branchResponse.json()
  const commitSha = branchData.object.sha

  // Now fetch the tree using the commit SHA
  const treeResponse = await fetch(`${apiBase}/git/trees/${commitSha}?recursive=1`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch repository tree: ${treeResponse.status}`)
  }

  const data = await treeResponse.json()
  return data.tree || []
}

async function fetchFileContent(apiBase: string, path: string, sha: string): Promise<GitHubFile> {
  try {
    const response = await fetch(`${apiBase}/contents/${path}`, {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
      },
    })

    if (!response.ok) {
      return {
        path,
        content: '',
        sha,
        size: 0,
        type: 'file',
      }
    }

    const content = await response.text()

    if (content.length > 100000) {
      return {
        path,
        content: content.substring(0, 100000) + '\n\n[Content truncated - file too large]',
        sha,
        size: content.length,
        type: 'file',
      }
    }

    return {
      path,
      content,
      sha,
      size: content.length,
      type: 'file',
    }
  } catch {
    return {
      path,
      content: '',
      sha,
      size: 0,
      type: 'file',
    }
  }
}

function shouldIncludeFile(path: string): boolean {
  const extension = path.substring(path.lastIndexOf('.')).toLowerCase()
  return SUPPORTED_EXTENSIONS.includes(extension)
}

export function convertRepoToDocuments(repoContent: RepoContent, repoUrl: string): Omit<DocType, 'id' | 'addedAt' | 'knowledgeBaseId'>[] {
  const documents: Omit<DocType, 'id' | 'addedAt' | 'knowledgeBaseId'>[] = []

  if (repoContent.readme) {
    documents.push({
      title: 'README',
      content: repoContent.readme,
      sourceType: 'github',
      sourceUrl: repoUrl,
      metadata: {
        size: repoContent.readme.length,
        lastModified: Date.now(),
      },
    })
  }

  const filesByDir = groupFilesByDirectory(repoContent.files)

  for (const [dir, files] of Object.entries(filesByDir)) {
    const combinedContent = files
      .map((file) => {
        const extension = file.path.substring(file.path.lastIndexOf('.'))
        return `## ${file.path}\n\n\`\`\`${extension.substring(1)}\n${file.content}\n\`\`\``
      })
      .join('\n\n')

    documents.push({
      title: dir === '.' ? 'Root Files' : dir,
      content: combinedContent,
      sourceType: 'github',
      sourceUrl: repoUrl,
      metadata: {
        size: combinedContent.length,
        lastModified: Date.now(),
      },
    })
  }

  return documents
}

function groupFilesByDirectory(files: GitHubFile[]): Record<string, GitHubFile[]> {
  const groups: Record<string, GitHubFile[]> = {}

  for (const file of files) {
    const parts = file.path.split('/')
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'

    if (!groups[dir]) {
      groups[dir] = []
    }
    groups[dir].push(file)
  }

  return groups
}
