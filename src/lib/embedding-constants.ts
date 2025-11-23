// Shared embedding configuration for the frontend runtime and Cloudflare Worker
// Ensure the dimension matches the configured Cloudflare Vectorize index
export const EMBEDDING_DIMENSION = 384
export const DEFAULT_CF_EMBEDDING_MODEL = '@cf/baai/bge-small-en-v1.5'
export const MAX_EMBEDDING_TEXT_LENGTH = 2000
