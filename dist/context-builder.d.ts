import { FileInfo } from './analyzer.js';
export interface CompleteContext {
    formattedContext: string;
    metadata: {
        totalFiles: number;
        totalLines: number;
        totalFunctions: number;
        totalClasses: number;
        primaryLanguage: string;
        estimatedTokens: number;
    };
    summary: string;
}
export declare class ContextBuilder {
    private analyzer;
    constructor();
    buildCompleteContext(options: {
        query: string;
        projectRoot: string;
        scope?: string;
        completeness?: string;
        maxTokens?: number;
    }): Promise<CompleteContext & {
        dependencyGraph: any;
        usagePatterns: any;
        filesIncluded: string[];
        totalLines: number;
        compressionLevel: string;
        tokenCount: number;
    }>;
    private findRelevantFiles;
    private calculateRelevanceScore;
    private buildDependencyGraph;
    private analyzeUsagePatterns;
    formatContextForFiles(files: FileInfo[], dependencyGraph?: any, usagePatterns?: any, query?: string): Promise<string>;
    private generateContextSummary;
    private formatArchitectureOverview;
    private formatDependencyGraph;
    private formatUsagePatterns;
    private getLanguageForHighlighting;
    private estimateTokenCount;
    private intelligentCompression;
    private aggressiveCompression;
}
//# sourceMappingURL=context-builder.d.ts.map