import { CompleteContext } from './context-builder.js';

export interface ValidationResult {
  isComplete: boolean;
  completenessScore: number;
  confidenceScore: number;
  missingElements: string[];
  suggestions: string[];
  warnings: string[];
  strengths: string[];
}

export class ContextValidator {
  
  async validateCompleteness(context: CompleteContext | { formattedContext: string }, query: string): Promise<ValidationResult> {
    const contextContent = 'formattedContext' in context ? context.formattedContext : '';
    
    // Initialize validation result
    const result: ValidationResult = {
      isComplete: false,
      completenessScore: 0,
      confidenceScore: 0,
      missingElements: [],
      suggestions: [],
      warnings: [],
      strengths: [],
    };

    // Parse query to understand what's being asked
    const queryAnalysis = this.analyzeQuery(query);
    
    // Validate different aspects
    const validations = [
      this.validateCodeCompleteness(contextContent, queryAnalysis),
      this.validateDependencyCompleteness(context, queryAnalysis),
      this.validateStructuralCompleteness(contextContent, queryAnalysis),
      this.validateContextCoherence(contextContent, queryAnalysis),
      this.validateUsageExamples(contextContent, queryAnalysis),
    ];

    // Aggregate results
    let totalScore = 0;
    let totalWeight = 0;

    for (const validation of validations) {
      totalScore += validation.score * validation.weight;
      totalWeight += validation.weight;
      
      result.missingElements.push(...validation.missingElements);
      result.suggestions.push(...validation.suggestions);
      result.warnings.push(...validation.warnings);
      result.strengths.push(...validation.strengths);
    }

    // Calculate final scores
    result.completenessScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
    result.confidenceScore = this.calculateConfidenceScore(result.completenessScore, contextContent);
    result.isComplete = result.completenessScore >= 0.8 && result.missingElements.length < 3;

    // Remove duplicates
    result.missingElements = [...new Set(result.missingElements)];
    result.suggestions = [...new Set(result.suggestions)];
    result.warnings = [...new Set(result.warnings)];
    result.strengths = [...new Set(result.strengths)];

    return result;
  }

  private analyzeQuery(query: string): QueryAnalysis {
    const queryLower = query.toLowerCase();
    const analysis: QueryAnalysis = {
      type: 'general',
      entities: [],
      scope: 'feature',
      requiresImplementation: false,
      requiresTests: false,
      requiresDocumentation: false,
      requiresDependencies: true,
      keywords: query.split(/\s+/).filter(word => word.length > 2),
    };

    // Determine query type
    if (queryLower.includes('function') || queryLower.includes('method')) {
      analysis.type = 'function';
    } else if (queryLower.includes('class') || queryLower.includes('object')) {
      analysis.type = 'class';
    } else if (queryLower.includes('module') || queryLower.includes('file')) {
      analysis.type = 'module';
    } else if (queryLower.includes('feature') || queryLower.includes('component')) {
      analysis.type = 'feature';
    }

    // Check requirements
    analysis.requiresImplementation = queryLower.includes('implement') || 
                                    queryLower.includes('code') || 
                                    queryLower.includes('how');
    analysis.requiresTests = queryLower.includes('test') || 
                            queryLower.includes('spec');
    analysis.requiresDocumentation = queryLower.includes('document') || 
                                   queryLower.includes('readme');
    
    // Extract entities (basic heuristic)
    const words = query.split(/\s+/);
    analysis.entities = words.filter(word => 
      word.length > 2 && 
      /^[A-Z]/.test(word) || 
      word.includes('.')
    );

    return analysis;
  }

  private validateCodeCompleteness(context: string, query: QueryAnalysis): ValidationDetail {
    const result: ValidationDetail = {
      score: 0,
      weight: 0.3,
      missingElements: [],
      suggestions: [],
      warnings: [],
      strengths: [],
    };

    // Check for presence of code blocks
    const codeBlocks = (context.match(/```[\s\S]*?```/g) || []).length;
    if (codeBlocks === 0) {
      result.missingElements.push('No code implementations found');
      result.suggestions.push('Include actual code implementations');
      result.score = 0.1;
    } else {
      result.strengths.push(`Contains ${codeBlocks} code blocks`);
      result.score = Math.min(1, codeBlocks / 5); // Up to 5 code blocks for full score
    }

    // Check for imports/dependencies
    if (context.includes('import') || context.includes('from')) {
      result.strengths.push('Dependencies and imports are included');
      result.score += 0.2;
    } else {
      result.missingElements.push('Missing import statements');
    }

    // Check for exports
    if (context.includes('export')) {
      result.strengths.push('Export statements included');
      result.score += 0.1;
    }

    // Check for type definitions (if TypeScript)
    if (context.includes('interface') || context.includes('type')) {
      result.strengths.push('Type definitions included');
      result.score += 0.1;
    }

    // Validate completeness based on query type
    if (query.type === 'function' && !context.includes('function')) {
      result.warnings.push('Query asks about functions but few function definitions found');
    }
    if (query.type === 'class' && !context.includes('class')) {
      result.warnings.push('Query asks about classes but few class definitions found');
    }

    result.score = Math.min(1, result.score);
    return result;
  }

  private validateDependencyCompleteness(context: CompleteContext | { formattedContext: string }, query: QueryAnalysis): ValidationDetail {
    const result: ValidationDetail = {
      score: 0,
      weight: 0.25,
      missingElements: [],
      suggestions: [],
      warnings: [],
      strengths: [],
    };

    const contextContent = 'formattedContext' in context ? context.formattedContext : '';

    // Check for dependency information
    if (contextContent.includes('Dependencies') || contextContent.includes('imports')) {
      result.strengths.push('Dependency information included');
      result.score += 0.4;
    } else {
      result.missingElements.push('Missing dependency information');
      result.suggestions.push('Include dependency relationships and import statements');
    }

    // Check for dependency graph
    if (contextContent.includes('Dependency') && contextContent.includes('Graph')) {
      result.strengths.push('Dependency graph visualization included');
      result.score += 0.3;
    }

    // Check for usage patterns
    if (contextContent.includes('Usage') || contextContent.includes('Pattern')) {
      result.strengths.push('Usage patterns documented');
      result.score += 0.3;
    }

    result.score = Math.min(1, result.score);
    return result;
  }

  private validateStructuralCompleteness(context: string, query: QueryAnalysis): ValidationDetail {
    const result: ValidationDetail = {
      score: 0,
      weight: 0.2,
      missingElements: [],
      suggestions: [],
      warnings: [],
      strengths: [],
    };

    // Check for proper structure
    const hasHeaders = (context.match(/^##? /gm) || []).length;
    if (hasHeaders >= 3) {
      result.strengths.push('Well-structured with multiple sections');
      result.score += 0.3;
    } else {
      result.suggestions.push('Add more structural sections for clarity');
    }

    // Check for file organization
    if (context.includes('File Contents') || context.includes('Components')) {
      result.strengths.push('File organization included');
      result.score += 0.3;
    }

    // Check for summary
    if (context.includes('Summary') || context.includes('Overview')) {
      result.strengths.push('Contains summary/overview section');
      result.score += 0.2;
    } else {
      result.missingElements.push('Missing project summary');
    }

    // Check for insights
    if (context.includes('Insights') || context.includes('Analysis')) {
      result.strengths.push('Includes analysis and insights');
      result.score += 0.2;
    }

    result.score = Math.min(1, result.score);
    return result;
  }

  private validateContextCoherence(context: string, query: QueryAnalysis): ValidationDetail {
    const result: ValidationDetail = {
      score: 0,
      weight: 0.15,
      missingElements: [],
      suggestions: [],
      warnings: [],
      strengths: [],
    };

    // Check if query keywords appear in context
    const contextLower = context.toLowerCase();
    const keywordMatches = query.keywords.filter(keyword => 
      contextLower.includes(keyword.toLowerCase())
    );

    const coherenceRatio = keywordMatches.length / Math.max(query.keywords.length, 1);
    result.score = coherenceRatio;

    if (coherenceRatio >= 0.7) {
      result.strengths.push('High coherence between query and context');
    } else if (coherenceRatio >= 0.4) {
      result.strengths.push('Good coherence between query and context');
    } else {
      result.warnings.push('Low coherence between query and provided context');
      result.suggestions.push('Ensure context directly addresses the query');
    }

    // Check for query entities
    const entityMatches = query.entities.filter(entity =>
      contextLower.includes(entity.toLowerCase())
    );

    if (entityMatches.length > 0) {
      result.strengths.push(`Found ${entityMatches.length} requested entities`);
      result.score += 0.2;
    }

    result.score = Math.min(1, result.score);
    return result;
  }

  private validateUsageExamples(context: string, query: QueryAnalysis): ValidationDetail {
    const result: ValidationDetail = {
      score: 0,
      weight: 0.1,
      missingElements: [],
      suggestions: [],
      warnings: [],
      strengths: [],
    };

    // Check for examples
    if (context.includes('example') || context.includes('Example')) {
      result.strengths.push('Contains usage examples');
      result.score += 0.5;
    }

    // Check for test cases
    if (query.requiresTests) {
      if (context.includes('test') || context.includes('spec')) {
        result.strengths.push('Test cases included');
        result.score += 0.3;
      } else {
        result.missingElements.push('Missing test cases');
        result.suggestions.push('Include relevant test files');
      }
    }

    // Check for documentation
    if (query.requiresDocumentation) {
      if (context.includes('README') || context.includes('doc')) {
        result.strengths.push('Documentation included');
        result.score += 0.2;
      } else {
        result.missingElements.push('Missing documentation');
      }
    }

    result.score = Math.min(1, result.score);
    return result;
  }

  private calculateConfidenceScore(completenessScore: number, context: string): number {
    let confidence = completenessScore;
    
    // Adjust confidence based on context richness
    const contextLength = context.length;
    if (contextLength < 1000) {
      confidence *= 0.7; // Reduce confidence for very short contexts
    } else if (contextLength > 10000) {
      confidence *= 1.1; // Increase confidence for comprehensive contexts
      confidence = Math.min(1, confidence);
    }

    // Check for code diversity
    const codeBlockCount = (context.match(/```[\s\S]*?```/g) || []).length;
    if (codeBlockCount >= 3) {
      confidence *= 1.05;
      confidence = Math.min(1, confidence);
    }

    return Math.round(confidence * 100) / 100;
  }
}

interface QueryAnalysis {
  type: 'function' | 'class' | 'module' | 'feature' | 'general';
  entities: string[];
  scope: string;
  requiresImplementation: boolean;
  requiresTests: boolean;
  requiresDocumentation: boolean;
  requiresDependencies: boolean;
  keywords: string[];
}

interface ValidationDetail {
  score: number;
  weight: number;
  missingElements: string[];
  suggestions: string[];
  warnings: string[];
  strengths: string[];
}
