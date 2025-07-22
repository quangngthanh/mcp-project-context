export interface FileInfo {
    path: string;
    relativePath: string;
    content: string;
    size: number;
    lastModified: Date;
    imports: Array<{
        path: string;
        imports: string[];
        isDefault: boolean;
    }>;
    exports: Array<{
        name: string;
        type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'default';
        line: number;
    }>;
    functions: Array<{
        name: string;
        startLine: number;
        endLine: number;
        params: string[];
        isAsync: boolean;
        isExported: boolean;
    }>;
    classes: Array<{
        name: string;
        startLine: number;
        endLine: number;
        methods: string[];
        extends?: string;
        implements?: string[];
        isExported: boolean;
    }>;
    interfaces: Array<{
        name: string;
        startLine: number;
        endLine: number;
        properties: string[];
        isExported: boolean;
    }>;
    types: Array<{
        name: string;
        startLine: number;
        definition: string;
        isExported: boolean;
    }>;
    dependencies: string[];
    language: 'typescript' | 'javascript' | 'python' | 'other';
}
export declare class ProjectAnalyzer {
    private cache;
    private projectRoot;
    indexProject(projectRoot: string): Promise<void>;
    analyzeFile(filePath: string): Promise<FileInfo>;
    private detectLanguage;
    private extractImports;
    private extractExports;
    private extractFunctions;
    private extractClasses;
    private extractInterfaces;
    private extractTypes;
    private findFile;
    getProjectStructure(projectRoot: string): Promise<any>;
    buildDependencyGraph(target: string, projectRoot: string, includeTests?: boolean): Promise<any>;
    getDependencyGraph(projectRoot: string): Promise<any>;
    getProjectAnalysis(projectRoot: string): Promise<any>;
    private groupFilesByType;
    private buildDirectoryTree;
    private analyzeLanguages;
    private detectArchitecturalPatterns;
    private analyzeArchitecture;
    private calculateProjectComplexity;
    private calculateArchitectureComplexity;
    private analyzeDependencyComplexity;
    private buildDependencyEdges;
    private identifyModuleClusters;
    private generateProjectSummary;
    private calculateMetrics;
    private calculateMaintainabilityScore;
    private estimateTestCoverage;
    private generateRecommendations;
    reindexFiles(changedFiles: string[]): Promise<void>;
    getIndexStats(): Promise<any>;
    getFileInfo(filePath: string): FileInfo | undefined;
    getAllFiles(): FileInfo[];
    searchFiles(query: string): FileInfo[];
    findReferences(symbol: string): Array<{
        file: FileInfo;
        references: Array<{
            line: number;
            type: string;
        }>;
    }>;
}
//# sourceMappingURL=analyzer.d.ts.map