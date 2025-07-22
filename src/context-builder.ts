import { FileInfo, ProjectAnalyzer } from './analyzer.js';

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

export class ContextBuilder {
  constructor() {
    // Constructor
  }

  async buildCompleteContext(options: {
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
  }> {
    // For now, return a minimal implementation with expected structure
    // This will need to be implemented based on the project's requirements
    return {
      formattedContext: `# Project Context for: ${options.query}\n\n*This is a minimal implementation that needs to be expanded.*`,
      metadata: {
        totalFiles: 0,
        totalLines: 0,
        totalFunctions: 0,
        totalClasses: 0,
        primaryLanguage: 'typescript',
        estimatedTokens: 100
      },
      summary: `Context for query: ${options.query}`,
      dependencyGraph: { nodes: [], edges: [] },
      usagePatterns: { patterns: [] },
      filesIncluded: [],
      totalLines: 0,
      compressionLevel: options.completeness || 'full',
      tokenCount: 100
    };
  }

  async formatContextForFiles(files: FileInfo[]): Promise<string> {
    if (!files || files.length === 0) {
      return '# Empty Project Context\n\nNo files to analyze.';
    }

    const sections: string[] = [];
    
    // Project Summary
    sections.push('# Project Context Analysis');
    sections.push('');
    sections.push(this.generateContextSummary(files, {nodes: [], edges: []}, {
      commonImports: [],
      architecturalPatterns: [],
      functionUsagePatterns: [],
      classUsagePatterns: []
    }));
    sections.push('');

    // Architecture Overview
    const dependencyGraph = { nodes: [], edges: [] };
    const usagePatterns = { commonImports: [], architecturalPatterns: [], functionUsagePatterns: [], classUsagePatterns: [] };
    sections.push('## Architecture Overview');
    sections.push(this.formatArchitectureOverview(dependencyGraph, usagePatterns));
    sections.push('');

    // File Structure
    sections.push('## File Structure');
    for (const file of files) {
      if (file.functions.length > 0 || file.classes.length > 0) {
        sections.push(`### ${file.relativePath}`);
        sections.push(`**Language:** ${file.language}`);
        sections.push(`**Size:** ${file.size} bytes`);
        
        if (file.classes.length > 0) {
          sections.push(`**Classes:** ${file.classes.map(c => c.name).join(', ')}`);
        }
        
        if (file.functions.length > 0) {
          sections.push(`**Functions:** ${file.functions.map(f => f.name).join(', ')}`);
        }
        
        if (file.imports.length > 0) {
          sections.push(`**Dependencies:** ${file.imports.map(i => i.path).join(', ')}`);
        }
        
        sections.push('');
      }
    }

    // File Contents
    sections.push('## Complete File Contents');
    for (const file of files) {
      sections.push(`### ${file.relativePath}`);
      sections.push('');
      sections.push('```' + this.getLanguageForHighlighting(file.language));
      sections.push(file.content);
      sections.push('```');
      sections.push('');
    }

    // Dependency Relationships
    sections.push('## Dependency Relationships');
    sections.push(this.formatDependencyGraph(dependencyGraph));
    sections.push('');

    // Usage Patterns
    sections.push('## Usage Patterns & Insights');
    sections.push(this.formatUsagePatterns(usagePatterns));
    sections.push('');

    return sections.join('\n');
  }

  private generateContextSummary(files: FileInfo[], dependencyGraph: any, usagePatterns: any): string {
    const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);
    const totalFunctions = files.reduce((sum, f) => sum + f.functions.length, 0);
    const totalClasses = files.reduce((sum, f) => sum + f.classes.length, 0);
    
    const languages = new Set(files.map(f => f.language));
    const primaryLanguage = files.reduce((prev, current) => 
      files.filter(f => f.language === current.language).length > 
      files.filter(f => f.language === prev.language).length ? current : prev
    ).language;

    return `This context contains ${files.length} files with ${totalLines} total lines of code. ` +
           `The primary language is ${primaryLanguage} with ${totalFunctions} functions and ${totalClasses} classes. ` +
           `The dependency graph shows ${dependencyGraph.nodes.length} nodes and ${dependencyGraph.edges.length} relationships. ` +
           `Key architectural patterns identified: ${usagePatterns.architecturalPatterns.join(', ')}.`;
  }

  private formatArchitectureOverview(dependencyGraph: any, usagePatterns: any): string {
    const sections: string[] = [];
    
    sections.push('**Dependency Structure:**');
    sections.push(`- Total modules: ${dependencyGraph.nodes.length}`);
    sections.push(`- Total dependencies: ${dependencyGraph.edges.length}`);
    
    if (usagePatterns.commonImports.length > 0) {
      sections.push('');
      sections.push('**Most Common Dependencies:**');
      for (const imp of usagePatterns.commonImports.slice(0, 5)) {
        sections.push(`- ${imp.import} (used in ${imp.count} files)`);
      }
    }
    
    if (usagePatterns.architecturalPatterns.length > 0) {
      sections.push('');
      sections.push('**Architectural Patterns:**');
      for (const pattern of usagePatterns.architecturalPatterns) {
        sections.push(`- ${pattern}`);
      }
    }

    return sections.join('\n');
  }

  private formatDependencyGraph(dependencyGraph: any): string {
    const sections: string[] = [];
    
    sections.push('**Modules:**');
    for (const node of dependencyGraph.nodes.slice(0, 20)) {
      sections.push(`- **${node.id}** (${node.type}, ${node.functions} functions, ${node.classes} classes)`);
    }
    
    if (dependencyGraph.nodes.length > 20) {
      sections.push(`... and ${dependencyGraph.nodes.length - 20} more modules`);
    }
    
    sections.push('');
    sections.push('**Key Dependencies:**');
    for (const edge of dependencyGraph.edges.slice(0, 15)) {
      sections.push(`- ${edge.source} → ${edge.target} (${edge.type})`);
    }
    
    if (dependencyGraph.edges.length > 15) {
      sections.push(`... and ${dependencyGraph.edges.length - 15} more dependencies`);
    }

    return sections.join('\n');
  }

  private formatUsagePatterns(usagePatterns: any): string {
    const sections: string[] = [];
    
    if (usagePatterns.functionUsagePatterns.length > 0) {
      sections.push('**Most Used Functions:**');
      for (const func of usagePatterns.functionUsagePatterns.slice(0, 10)) {
        sections.push(`- ${func.function} (${func.usageCount} calls across ${func.contexts.length} files)`);
      }
      sections.push('');
    }
    
    if (usagePatterns.classUsagePatterns.length > 0) {
      sections.push('**Most Instantiated Classes:**');
      for (const cls of usagePatterns.classUsagePatterns.slice(0, 5)) {
        sections.push(`- ${cls.class} (${cls.instantiations} instantiations in ${cls.files.length} files)`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  private getLanguageForHighlighting(language: string): string {
    switch (language) {
      case 'typescript': return 'typescript';
      case 'javascript': return 'javascript';
      case 'python': return 'python';
      default: return '';
    }
  }

  private estimateTokenCount(content: string): number {
    // Rough estimation: 1 token ≈ 4 characters for code
    return Math.ceil(content.length / 4);
  }

  private async intelligentCompression(context: string, maxTokens: number): Promise<string> {
    console.error("Applying intelligent compression to fit token limit");
    
    // Split context into sections
    const sections = context.split(/\n## /);
    const compressedSections: string[] = [];
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      
      if (section.includes('Complete File Contents')) {
        // Compress file contents more aggressively
        const files = section.split('### ').slice(1);
        const compressedFiles = files.map((file: string) => {
          const lines = file.split('\n');
          const filename = lines[0];
          
          // Keep only essential parts of each file
          const essentialLines = lines.filter((line: string) => {
            const trimmed = line.trim();
            return trimmed.startsWith('export') ||
                   trimmed.startsWith('import') ||
                   trimmed.startsWith('function') ||
                   trimmed.startsWith('class') ||
                   trimmed.startsWith('interface') ||
                   trimmed.startsWith('type') ||
                   trimmed.startsWith('const') ||
                   trimmed.startsWith('//') ||
                   trimmed.includes('TODO') ||
                   trimmed.includes('FIXME') ||
                   line.startsWith('```');
          });
          
          return filename + '\n' + essentialLines.join('\n');
        });
        
        compressedSections.push('## ' + section.split('\n')[0] + '\n\n' + compressedFiles.map((f: string) => '### ' + f).join('\n\n---\n\n'));
      } else {
        // Keep other sections as-is for now
        compressedSections.push(i === 0 ? section : '## ' + section);
      }
    }
    
    const compressedContext = compressedSections.join('\n\n');
    
    // If still too large, apply more aggressive compression
    if (this.estimateTokenCount(compressedContext) > maxTokens) {
      console.error("Applying more aggressive compression...");
      return this.aggressiveCompression(compressedContext, maxTokens);
    }
    
    return compressedContext;
  }

  private aggressiveCompression(context: string, maxTokens: number): string {
    // More aggressive compression while preserving key information
    const lines = context.split('\n');
    const importantLines: string[] = [];
    
    let inCodeBlock = false;
    let currentLanguage = '';
    
    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          importantLines.push(line); // Closing code block
          inCodeBlock = false;
        } else {
          currentLanguage = line.substring(3);
          importantLines.push(line); // Opening code block
          inCodeBlock = true;
        }
      } else if (inCodeBlock) {
        // In code block - keep only essential lines
        const trimmed = line.trim();
        if (
          trimmed.startsWith('export') ||
          trimmed.startsWith('import') ||
          trimmed.startsWith('function') ||
          trimmed.startsWith('class') ||
          trimmed.startsWith('interface') ||
          trimmed.startsWith('type') ||
          trimmed.startsWith('const') ||
          trimmed.startsWith('let') ||
          trimmed.startsWith('var') ||
          trimmed.includes('//') ||
          trimmed.includes('/*') ||
          trimmed === '' ||
          line.startsWith('#') // Headers
        ) {
          importantLines.push(line);
        }
      } else {
        // Outside code blocks - keep structure and important content
        if (
          line.startsWith('#') ||
          line.startsWith('**') ||
          line.startsWith('- ') ||
          line.startsWith('*') ||
          line.trim() === '' ||
          line.includes('Summary') ||
          line.includes('Insights')
        ) {
          importantLines.push(line);
        }
      }
    }
    
    return importantLines.join('\n');
  }
}
