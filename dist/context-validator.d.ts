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
export declare class ContextValidator {
    validateCompleteness(context: CompleteContext | {
        formattedContext: string;
    }, query: string): Promise<ValidationResult>;
    private analyzeQuery;
    private validateCodeCompleteness;
    private validateDependencyCompleteness;
    private validateStructuralCompleteness;
    private validateContextCoherence;
    private validateUsageExamples;
    private calculateConfidenceScore;
}
//# sourceMappingURL=context-validator.d.ts.map