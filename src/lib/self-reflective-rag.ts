import { Document } from './types'
import { RetrievalResult } from './retrieval-executor'
import { runtime } from './runtime/manager'

export type ReflectionToken = 'RELEVANT' | 'PARTIALLY_RELEVANT' | 'NOT_RELEVANT'
export type SupportToken = 'FULLY_SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_SUPPORTED'
export type UtilityToken = 'USEFUL' | 'SOMEWHAT_USEFUL' | 'NOT_USEFUL'

export type SelfEvaluation = {
  relevanceToken: ReflectionToken
  supportToken: SupportToken
  utilityToken: UtilityToken
  confidence: number
  needsRetry: boolean
  reasoning: string
  suggestions?: string[]
}

export type CriticFeedback = {
  logicalConsistency: number
  factualAccuracy: number
  completeness: number
  hallucinations: string[]
  gaps: string[]
  suggestions: string[]
}

export class SelfReflectiveRAG {
  async evaluateRetrievalRelevance(
    query: string,
    retrievalResult: RetrievalResult
  ): Promise<{ token: ReflectionToken; confidence: number; reasoning: string }> {
    if (retrievalResult.documents.length === 0) {
      return {
        token: 'NOT_RELEVANT',
        confidence: 1.0,
        reasoning: 'No documents retrieved'
      }
    }
    
    const avgScore = retrievalResult.scores.reduce((a, b) => a + b, 0) / retrievalResult.scores.length
    
    if (avgScore > 0.7) {
      return {
        token: 'RELEVANT',
        confidence: avgScore,
        reasoning: 'High relevance scores indicate strong document match'
      }
    } else if (avgScore > 0.4) {
      return {
        token: 'PARTIALLY_RELEVANT',
        confidence: avgScore,
        reasoning: 'Moderate relevance scores, may need refinement'
      }
    } else {
      return {
        token: 'NOT_RELEVANT',
        confidence: 1 - avgScore,
        reasoning: 'Low relevance scores, retrieval may have failed'
      }
    }
  }
  
  async evaluateResponseSupport(
    query: string,
    response: string,
    retrievedDocuments: Document[]
  ): Promise<{ token: SupportToken; confidence: number; reasoning: string }> {
    if (retrievedDocuments.length === 0) {
      return {
        token: 'NOT_SUPPORTED',
        confidence: 0.9,
        reasoning: 'No source documents to support the response'
      }
    }
    
    const prompt = `Evaluate if this AI response is supported by the provided source documents.

Query: "${query}"

Response: "${response}"

Source Documents:
${retrievedDocuments.map((doc, i) => `${i + 1}. ${doc.title}: ${doc.content.slice(0, 300)}...`).join('\n')}

Determine support level:
- FULLY_SUPPORTED: All claims in response are backed by sources
- PARTIALLY_SUPPORTED: Some claims backed, some may be inferred
- NOT_SUPPORTED: Response contains claims not in sources (potential hallucination)

Provide JSON: {"token": "...", "confidence": 0.0-1.0, "reasoning": "brief explanation"}

Respond with ONLY valid JSON.`

    try {
      const result = await runtime.llm.generate(prompt, 'gpt-4o', true)
      const evaluation = JSON.parse(result)
      
      return {
        token: evaluation.token || 'PARTIALLY_SUPPORTED',
        confidence: evaluation.confidence || 0.5,
        reasoning: evaluation.reasoning || 'Automated evaluation'
      }
    } catch {
      return {
        token: 'PARTIALLY_SUPPORTED',
        confidence: 0.5,
        reasoning: 'Unable to evaluate support level'
      }
    }
  }
  
  async evaluateResponseUtility(
    query: string,
    response: string
  ): Promise<{ token: UtilityToken; confidence: number; reasoning: string }> {
    const prompt = `Evaluate if this response is useful for answering the user's query.

Query: "${query}"
Response: "${response}"

Determine utility:
- USEFUL: Directly answers the question, actionable and complete
- SOMEWHAT_USEFUL: Partially answers, may be too vague or incomplete
- NOT_USEFUL: Doesn't answer the question or is off-topic

Provide JSON: {"token": "...", "confidence": 0.0-1.0, "reasoning": "brief explanation"}

Respond with ONLY valid JSON.`

    try {
      const result = await runtime.llm.generate(prompt, 'gpt-4o-mini', true)
      const evaluation = JSON.parse(result)
      
      return {
        token: evaluation.token || 'SOMEWHAT_USEFUL',
        confidence: evaluation.confidence || 0.6,
        reasoning: evaluation.reasoning || 'Automated evaluation'
      }
    } catch {
      return {
        token: 'SOMEWHAT_USEFUL',
        confidence: 0.6,
        reasoning: 'Unable to evaluate utility'
      }
    }
  }
  
  async performSelfEvaluation(
    query: string,
    response: string,
    retrievalResult: RetrievalResult
  ): Promise<SelfEvaluation> {
    const [relevance, support, utility] = await Promise.all([
      this.evaluateRetrievalRelevance(query, retrievalResult),
      this.evaluateResponseSupport(query, response, retrievalResult.documents),
      this.evaluateResponseUtility(query, response)
    ])
    
    const avgConfidence = (relevance.confidence + support.confidence + utility.confidence) / 3
    
    const needsRetry = 
      relevance.token === 'NOT_RELEVANT' ||
      support.token === 'NOT_SUPPORTED' ||
      utility.token === 'NOT_USEFUL' ||
      avgConfidence < 0.5
    
    const suggestions: string[] = []
    
    if (relevance.token !== 'RELEVANT') {
      suggestions.push('Try reformulating the query for better retrieval')
      suggestions.push('Use a different retrieval strategy (e.g., hybrid or multi-query)')
    }
    
    if (support.token === 'NOT_SUPPORTED') {
      suggestions.push('Response may contain hallucinations, retrieve more documents')
      suggestions.push('Use stricter grounding to source documents')
    }
    
    if (utility.token !== 'USEFUL') {
      suggestions.push('Regenerate response with clearer instructions')
      suggestions.push('Break query into sub-questions')
    }
    
    return {
      relevanceToken: relevance.token,
      supportToken: support.token,
      utilityToken: utility.token,
      confidence: avgConfidence,
      needsRetry,
      reasoning: `Relevance: ${relevance.reasoning}. Support: ${support.reasoning}. Utility: ${utility.reasoning}.`,
      suggestions: needsRetry ? suggestions : undefined
    }
  }
  
  async criticResponse(
    query: string,
    response: string,
    sources: Document[]
  ): Promise<CriticFeedback> {
    const prompt = `You are a critical evaluator of RAG system responses. Evaluate this response for quality issues.

Query: "${query}"
Response: "${response}"

Sources Available: ${sources.length} documents

Evaluate:
1. Logical consistency (0.0-1.0): Is the reasoning sound?
2. Factual accuracy (0.0-1.0): Are claims verifiable from sources?
3. Completeness (0.0-1.0): Does it fully answer the question?
4. Hallucinations: List any claims not supported by sources
5. Gaps: List missing information that should be included
6. Suggestions: How to improve this response

Provide JSON:
{
  "logicalConsistency": 0.0-1.0,
  "factualAccuracy": 0.0-1.0,
  "completeness": 0.0-1.0,
  "hallucinations": ["claim 1", "claim 2"],
  "gaps": ["missing info 1", "missing info 2"],
  "suggestions": ["suggestion 1", "suggestion 2"]
}

Respond with ONLY valid JSON.`

    try {
      const result = await runtime.llm.generate(prompt, 'gpt-4o', true)
      const feedback = JSON.parse(result)
      
      return {
        logicalConsistency: feedback.logicalConsistency || 0.7,
        factualAccuracy: feedback.factualAccuracy || 0.7,
        completeness: feedback.completeness || 0.7,
        hallucinations: Array.isArray(feedback.hallucinations) ? feedback.hallucinations : [],
        gaps: Array.isArray(feedback.gaps) ? feedback.gaps : [],
        suggestions: Array.isArray(feedback.suggestions) ? feedback.suggestions : []
      }
    } catch {
      return {
        logicalConsistency: 0.7,
        factualAccuracy: 0.7,
        completeness: 0.7,
        hallucinations: [],
        gaps: [],
        suggestions: ['Unable to provide detailed feedback']
      }
    }
  }
  
  async suggestImprovements(
    selfEval: SelfEvaluation,
    criticFeedback?: CriticFeedback
  ): Promise<{ shouldRetry: boolean; actions: string[] }> {
    const actions: string[] = []
    let shouldRetry = selfEval.needsRetry
    
    if (selfEval.relevanceToken === 'NOT_RELEVANT') {
      actions.push('Reformulate query with more specific terms')
      actions.push('Try alternative retrieval strategy')
      shouldRetry = true
    }
    
    if (selfEval.supportToken === 'NOT_SUPPORTED') {
      actions.push('Retrieve additional documents')
      actions.push('Use stricter citation requirements')
      shouldRetry = true
    }
    
    if (criticFeedback) {
      if (criticFeedback.logicalConsistency < 0.6) {
        actions.push('Improve logical flow in response generation')
        shouldRetry = true
      }
      
      if (criticFeedback.factualAccuracy < 0.7) {
        actions.push('Verify all facts against source documents')
        shouldRetry = true
      }
      
      if (criticFeedback.completeness < 0.7) {
        actions.push('Expand response to cover all aspects of query')
        actions.push('Consider missing information: ' + criticFeedback.gaps.join(', '))
      }
      
      if (criticFeedback.hallucinations.length > 0) {
        actions.push('Remove hallucinated claims: ' + criticFeedback.hallucinations.join(', '))
        shouldRetry = true
      }
    }
    
    if (selfEval.suggestions) {
      actions.push(...selfEval.suggestions)
    }
    
    return { shouldRetry, actions }
  }
}
