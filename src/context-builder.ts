import { FileInfo, ProjectAnalyzer } from './analyzer.js';
import * as fs from 'fs';
import * as path from 'path';

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
  private analyzer: ProjectAnalyzer;

  constructor() {
    this.analyzer = new ProjectAnalyzer();
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
    try {
      console.error(`[ContextBuilder] Building context for query: "${options.query}"`);
      console.error(`[ContextBuilder] Project root: ${options.projectRoot}`);

      const validation = validateProjectRoot(options.projectRoot);
      if (!validation.valid) {
        // Trả về lỗi cho AI hoặc user, dừng workflow
        throw new Error(validation.message);
      }

      // Step 1: Index the project
      await this.analyzer.indexProject(validation.normalizedPath!);
      const stats = await this.analyzer.getIndexStats();
      console.error(`[ContextBuilder] Indexed ${stats.filesIndexed} files`);

      // Step 2: Get all files and analyze them
      const allFiles = this.analyzer.getAllFiles();
      console.error(`[ContextBuilder] Retrieved ${allFiles.length} files from cache`);

      // Step 3: Filter relevant files based on query and scope
      const relevantFiles = this.findRelevantFiles(allFiles, options.query, options.scope);
      console.error(`[ContextBuilder] Found ${relevantFiles.length} relevant files`);

      // Step 4: Build dependency graph
      const dependencyGraph = await this.buildDependencyGraph(relevantFiles);
      
      // Step 5: Analyze usage patterns
      const usagePatterns = this.analyzeUsagePatterns(allFiles, relevantFiles);

      // Step 6: Format the complete context
      const formattedContext = await this.formatContextForFiles(relevantFiles, dependencyGraph, usagePatterns, options.query);

      // Step 7: Calculate metadata
      const totalLines = relevantFiles.reduce((sum, f) => sum + f.content.split('\n').length, 0);
      const totalFunctions = relevantFiles.reduce((sum, f) => sum + f.functions.length, 0);
      const totalClasses = relevantFiles.reduce((sum, f) => sum + f.classes.length, 0);
      
      // Detect primary language
      const languageCount: Record<string, number> = {};
      relevantFiles.forEach(f => {
        languageCount[f.language] = (languageCount[f.language] || 0) + 1;
      });
      const primaryLanguage = Object.entries(languageCount).reduce((a, b) => 
        languageCount[a[0]] > languageCount[b[0]] ? a : b
      )[0] || 'typescript';

      const estimatedTokens = this.estimateTokenCount(formattedContext);
      
      // Step 8: Apply compression if needed
      let finalContext = formattedContext;
      let compressionLevel = options.completeness || 'full';
      
      if (options.maxTokens && estimatedTokens > options.maxTokens) {
        console.error(`[ContextBuilder] Context too large (${estimatedTokens} tokens), applying compression`);
        finalContext = await this.intelligentCompression(formattedContext, options.maxTokens);
        compressionLevel = 'compressed';
      }

      const finalTokenCount = this.estimateTokenCount(finalContext);
      console.error(`[ContextBuilder] Final context: ${finalTokenCount} tokens, ${relevantFiles.length} files`);

      return {
        formattedContext: finalContext,
        metadata: {
          totalFiles: relevantFiles.length,
          totalLines,
          totalFunctions,
          totalClasses,
          primaryLanguage,
          estimatedTokens: finalTokenCount
        },
        summary: this.generateContextSummary(relevantFiles, dependencyGraph, usagePatterns),
        dependencyGraph,
        usagePatterns,
        filesIncluded: relevantFiles.map(f => f.relativePath),
        totalLines,
        compressionLevel,
        tokenCount: finalTokenCount
      };

    } catch (error) {
      console.error('[ContextBuilder] Error building context:', error);
      
      // Fallback response
      return {
        formattedContext: `# Error Building Context\n\nAn error occurred while building context for query: "${options.query}"\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nPlease check the project path and try again.`,
        metadata: {
          totalFiles: 0,
          totalLines: 0,
          totalFunctions: 0,
          totalClasses: 0,
          primaryLanguage: 'unknown',
          estimatedTokens: 50
        },
        summary: 'Error occurred during context building',
        dependencyGraph: { nodes: [], edges: [] },
        usagePatterns: { patterns: [] },
        filesIncluded: [],
        totalLines: 0,
        compressionLevel: 'error',
        tokenCount: 50
      };
    }
  }

  private findRelevantFiles(allFiles: FileInfo[], query: string, scope?: string): FileInfo[] {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(word => word.length > 2);
    
    console.error(`[ContextBuilder] Searching for keywords: ${keywords.join(', ')}`);

    let relevantFiles = allFiles.filter(file => {
      // Skip non-code files for most queries
      if (!['typescript', 'javascript'].includes(file.language)) {
        return false;
      }

      const fileName = file.relativePath.toLowerCase();
      const fileContent = file.content.toLowerCase();
      
      // Check filename matches
      const fileNameMatches = keywords.some(keyword => 
        fileName.includes(keyword) || 
        file.functions.some(fn => fn.name.toLowerCase().includes(keyword)) ||
        file.classes.some(cls => cls.name.toLowerCase().includes(keyword))
      );

      // Check content matches for key programming concepts
      const contentMatches = keywords.some(keyword => 
        fileContent.includes(keyword) ||
        file.imports.some(imp => imp.path.toLowerCase().includes(keyword))
      );

      return fileNameMatches || contentMatches;
    });

    // If no specific matches, include main files based on scope
    if (relevantFiles.length === 0) {
      console.error('[ContextBuilder] No specific matches found, including main files');
      relevantFiles = allFiles.filter(file => {
        const fileName = file.relativePath.toLowerCase();
        return ['typescript', 'javascript'].includes(file.language) && 
               (fileName.includes('index') || fileName.includes('main') || 
                file.functions.length > 0 || file.classes.length > 0);
      }).slice(0, 10); // Limit to first 10 files
    }

    // Apply scope filtering
    if (scope === 'function') {
      relevantFiles = relevantFiles.filter(f => f.functions.length > 0);
    } else if (scope === 'class') {
      relevantFiles = relevantFiles.filter(f => f.classes.length > 0);
    }

    // Sort by relevance (files with more matches first)
    relevantFiles.sort((a, b) => {
      const aScore = this.calculateRelevanceScore(a, keywords);
      const bScore = this.calculateRelevanceScore(b, keywords);
      return bScore - aScore;
    });

    console.error(`[ContextBuilder] Selected ${relevantFiles.length} relevant files`);
    return relevantFiles.slice(0, 20); // Limit to top 20 most relevant files
  }

  private calculateRelevanceScore(file: FileInfo, keywords: string[]): number {
    let score = 0;
    const fileName = file.relativePath.toLowerCase();
    const content = file.content.toLowerCase();

    keywords.forEach(keyword => {
      // Filename matches (high priority)
      if (fileName.includes(keyword)) score += 10;
      
      // Function/class name matches (high priority)
      if (file.functions.some(fn => fn.name.toLowerCase().includes(keyword))) score += 8;
      if (file.classes.some(cls => cls.name.toLowerCase().includes(keyword))) score += 8;
      
      // Content matches (lower priority)
      const contentMatches = (content.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(contentMatches, 5); // Cap content matches
      
      // Import matches (medium priority)
      if (file.imports.some(imp => imp.path.toLowerCase().includes(keyword))) score += 5;
    });

    return score;
  }

  private buildDependencyGraph(files: FileInfo[]): any {
    const nodes = files.map(f => ({
      id: f.relativePath,
      type: f.language,
      size: f.size,
      functions: f.functions.length,
      classes: f.classes.length,
    }));

    const edges: Array<{source: string; target: string; type: string}> = [];
    
    files.forEach(file => {
      file.imports.forEach(imp => {
        const targetFile = files.find(f => 
          f.relativePath.includes(imp.path) || 
          f.relativePath === imp.path + '.ts' ||
          f.relativePath === imp.path + '.js'
        );
        
        if (targetFile) {
          edges.push({
            source: file.relativePath,
            target: targetFile.relativePath,
            type: 'import'
          });
        }
      });
    });

    return { nodes, edges };
  }

  private analyzeUsagePatterns(allFiles: FileInfo[], relevantFiles: FileInfo[]): any {
    // Find common imports
    const importCounts: Record<string, number> = {};
    relevantFiles.forEach(file => {
      file.imports.forEach(imp => {
        importCounts[imp.path] = (importCounts[imp.path] || 0) + 1;
      });
    });

    const commonImports = Object.entries(importCounts)
      .map(([path, count]) => ({ import: path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Detect architectural patterns
    const patterns: string[] = [];
    const hasServices = relevantFiles.some(f => f.relativePath.includes('service'));
    const hasComponents = relevantFiles.some(f => f.relativePath.includes('component'));
    const hasUtils = relevantFiles.some(f => f.relativePath.includes('util') || f.relativePath.includes('helper'));
    const hasModels = relevantFiles.some(f => f.relativePath.includes('model') || f.relativePath.includes('entity'));

    if (hasServices) patterns.push('Service Layer');
    if (hasComponents) patterns.push('Component Architecture');
    if (hasUtils) patterns.push('Utility Functions');
    if (hasModels) patterns.push('Data Models');

    // Function usage patterns
    const functionUsage: Record<string, number> = {};
    relevantFiles.forEach(file => {
      const content = file.content;
      file.functions.forEach(fn => {
        const usageCount = (content.match(new RegExp(fn.name, 'g')) || []).length;
        if (usageCount > 1) { // More than just the definition
          functionUsage[fn.name] = usageCount;
        }
      });
    });

    const functionUsagePatterns = Object.entries(functionUsage)
      .map(([fn, count]) => ({ function: fn, usageCount: count, contexts: [] }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    return {
      commonImports,
      architecturalPatterns: patterns,
      functionUsagePatterns,
      classUsagePatterns: [] // Can be expanded later
    };
  }

  async formatContextForFiles(files: FileInfo[], dependencyGraph?: any, usagePatterns?: any, query?: string): Promise<string> {
    if (!files || files.length === 0) {
      return `# Empty Project Context\n\nNo relevant files found for query: "${query || 'unknown'}"`;
    }

    const sections: string[] = [];
    
    // Project Summary
    sections.push('# Complete Project Context Analysis');
    if (query) {
      sections.push(`\n**Query:** ${query}`);
    }
    sections.push('');
    sections.push(this.generateContextSummary(files, dependencyGraph, usagePatterns));
    sections.push('');

    // Architecture Overview
    if (dependencyGraph && usagePatterns) {
      sections.push('## Architecture Overview');
      sections.push(this.formatArchitectureOverview(dependencyGraph, usagePatterns));
      sections.push('');
    }

    // File Structure
    sections.push('## Relevant Files Structure');
    for (const file of files) {
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
    if (dependencyGraph) {
      sections.push('## Dependency Relationships');
      sections.push(this.formatDependencyGraph(dependencyGraph));
      sections.push('');
    }

    // Usage Patterns
    if (usagePatterns) {
      sections.push('## Usage Patterns & Insights');
      sections.push(this.formatUsagePatterns(usagePatterns));
      sections.push('');
    }

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

    const graphInfo = dependencyGraph ? ` The dependency graph shows ${dependencyGraph.nodes.length} nodes and ${dependencyGraph.edges.length} relationships.` : '';
    const patternsInfo = usagePatterns && usagePatterns.architecturalPatterns.length > 0 ? 
      ` Key architectural patterns identified: ${usagePatterns.architecturalPatterns.join(', ')}.` : '';

    return `This context contains ${files.length} files with ${totalLines} total lines of code. ` +
           `The primary language is ${primaryLanguage} with ${totalFunctions} functions and ${totalClasses} classes.` +
           graphInfo + patternsInfo;
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
        sections.push(`- ${func.function} (${func.usageCount} calls)`);
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

/**
 * Utility function để normalize và validate đường dẫn project
 * Xử lý các trường hợp đường dẫn không chuẩn như URL encoding, relative paths, etc.
 */
export function normalizeProjectPath(rawPath: string): { 
  normalizedPath: string; 
  originalPath: string;
  wasNormalized: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  let normalizedPath = rawPath;
  let wasNormalized = false;

  // 1. Xử lý URL encoding (ví dụ: /d%3A/Working/...)
  if (rawPath.includes('%')) {
    try {
      const decodedPath = decodeURIComponent(rawPath);
      if (decodedPath !== rawPath) {
        normalizedPath = decodedPath;
        wasNormalized = true;
        issues.push(`URL encoded path detected and decoded: ${rawPath} -> ${decodedPath}`);
      }
    } catch (error) {
      issues.push(`Failed to decode URL encoded path: ${rawPath}`);
    }
  }

  // 2. Xử lý file:// protocol
  if (normalizedPath.startsWith('file://')) {
    normalizedPath = normalizedPath.replace('file://', '');
    wasNormalized = true;
    issues.push(`Removed file:// protocol from path`);
  }

  // 3. Xử lý Windows path với forward slashes và drive letter
  if (process.platform === 'win32') {
    // Handle the specific case of URL-decoded Windows paths like /d:/path
    if (normalizedPath.match(/^\/[a-zA-Z]:\//)) {
      // Convert /d:/path to d:\path
      normalizedPath = normalizedPath.replace(/^\/([a-zA-Z]):\//, '$1:\\');
      wasNormalized = true;
      issues.push(`Fixed URL-decoded Windows drive path: ${rawPath} -> ${normalizedPath}`);
    }
    // Handle the case where we have a leading slash but no drive letter (like /path)
    else if (normalizedPath.startsWith('/') && !normalizedPath.startsWith('//')) {
      // Remove leading slash for relative paths on Windows
      normalizedPath = normalizedPath.substring(1);
      wasNormalized = true;
      issues.push(`Removed leading slash for Windows path`);
    }
    // Handle regular forward slashes in Windows paths
    else if (normalizedPath.includes('/') && !normalizedPath.startsWith('//')) {
      // Don't convert if it's a network path (starts with //)
      normalizedPath = normalizedPath.replace(/\//g, '\\');
      wasNormalized = true;
      issues.push(`Converted forward slashes to backslashes for Windows`);
    }
  }

  // 4. Xử lý relative paths
  if (!path.isAbsolute(normalizedPath)) {
    try {
      normalizedPath = path.resolve(process.cwd(), normalizedPath);
      wasNormalized = true;
      issues.push(`Converted relative path to absolute: ${rawPath} -> ${normalizedPath}`);
    } catch (error) {
      issues.push(`Failed to resolve relative path: ${normalizedPath}`);
    }
  }

  // 5. Normalize đường dẫn (loại bỏ . và ..)
  try {
    const resolvedPath = path.resolve(normalizedPath);
    if (resolvedPath !== normalizedPath) {
      normalizedPath = resolvedPath;
      wasNormalized = true;
      issues.push(`Normalized path structure`);
    }
  } catch (error) {
    issues.push(`Failed to normalize path: ${normalizedPath}`);
  }

  // 6. Xử lý các ký tự đặc biệt trong đường dẫn (chỉ cảnh báo, không block)
  const specialChars = /[<>:"|?*]/;
  if (specialChars.test(normalizedPath)) {
    // Chỉ cảnh báo cho các ký tự thực sự có vấn đề, không phải dấu : trong Windows drive
    const problematicChars = normalizedPath.match(/[<>"|?*]/g);
    if (problematicChars) {
      issues.push(`Path contains special characters that may cause issues: ${problematicChars.join(', ')}`);
    }
  }

  return {
    normalizedPath,
    originalPath: rawPath,
    wasNormalized,
    issues
  };
}

export function validateProjectRoot(projectRoot: string): { 
  valid: boolean; 
  message?: string;
  normalizedPath?: string;
  issues?: string[];
} {
  // Normalize đường dẫn trước khi validate
  const pathInfo = normalizeProjectPath(projectRoot);
  
  // Log các vấn đề nếu có
  if (pathInfo.issues.length > 0) {
    console.error('[PathValidation] Issues found:', pathInfo.issues);
  }

  // Kiểm tra tồn tại và là thư mục
  if (!fs.existsSync(pathInfo.normalizedPath)) {
    return {
      valid: false,
      message: `❌ Không tìm thấy thư mục dự án tại đường dẫn: ${projectRoot}\n` +
               `Đường dẫn đã normalize: ${pathInfo.normalizedPath}\n` +
               `Vui lòng kiểm tra lại đường dẫn và đảm bảo thư mục tồn tại.\n` +
               `Gợi ý: Đảm bảo đường dẫn chính xác và thư mục tồn tại trên hệ thống.`,
      normalizedPath: pathInfo.normalizedPath,
      issues: pathInfo.issues
    };
  }

  if (!fs.lstatSync(pathInfo.normalizedPath).isDirectory()) {
    return {
      valid: false,
      message: `❌ Đường dẫn không phải là thư mục: ${projectRoot}\n` +
               `Đường dẫn đã normalize: ${pathInfo.normalizedPath}\n` +
               `Vui lòng nhập đường dẫn tới thư mục gốc của dự án.`,
      normalizedPath: pathInfo.normalizedPath,
      issues: pathInfo.issues
    };
  }

  // Kiểm tra có file mã nguồn không
  try {
    const files = fs.readdirSync(pathInfo.normalizedPath).filter(f =>
      f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.tsx') ||
      f.endsWith('.py') || f.endsWith('.java') || f.endsWith('.go') || f.endsWith('.php') ||
      f.endsWith('.rb') || f.endsWith('.rs') || f.endsWith('.cpp') || f.endsWith('.cs')
    );
    
    if (files.length === 0) {
      return {
        valid: false,
        message: `❌ Không tìm thấy file mã nguồn nào trong thư mục: ${projectRoot}\n` +
                 `Đường dẫn đã normalize: ${pathInfo.normalizedPath}\n` +
                 `Vui lòng kiểm tra lại thư mục mã nguồn.\n` +
                 `Gợi ý: Đảm bảo đây là thư mục gốc của dự án chứa các file mã nguồn.`,
        normalizedPath: pathInfo.normalizedPath,
        issues: pathInfo.issues
      };
    }
  } catch (error) {
    return {
      valid: false,
      message: `❌ Không thể đọc thư mục: ${projectRoot}\n` +
               `Đường dẫn đã normalize: ${pathInfo.normalizedPath}\n` +
               `Lỗi: ${error instanceof Error ? error.message : String(error)}\n` +
               `Gợi ý: Kiểm tra quyền truy cập thư mục và đảm bảo đường dẫn chính xác.`,
      normalizedPath: pathInfo.normalizedPath,
      issues: pathInfo.issues
    };
  }

  return { 
    valid: true,
    normalizedPath: pathInfo.normalizedPath,
    issues: pathInfo.issues
  };
}
