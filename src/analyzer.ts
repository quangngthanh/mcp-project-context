import * as fs from 'fs/promises';
import * as path from 'path';
import fastGlob from 'fast-glob';

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

export class ProjectAnalyzer {
  private cache: Map<string, FileInfo> = new Map();
  private projectRoot: string = '';

  async indexProject(projectRoot: string): Promise<void> {
    this.projectRoot = projectRoot;
    console.error(`Indexing project at: ${projectRoot}`);

    try {
      // Find all relevant source files
      const patterns = [
        '**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx',
        '**/*.py', '**/*.json', '**/*.md',
        '!node_modules/**',
        '!dist/**', '!build/**',
        '!coverage/**',
        '!.git/**'
      ];

      const files = await fastGlob(patterns, {
        cwd: projectRoot,
        absolute: true,
        dot: false,
      });

      console.error(`Found ${files.length} files to analyze`);

      // Analyze each file
      const analysisPromises = files.map(filePath => this.analyzeFile(filePath));
      await Promise.all(analysisPromises);

      console.error(`Indexed ${this.cache.size} files successfully`);
    } catch (error) {
      console.error('Error indexing project:', error);
      throw error;
    }
  }

  async analyzeFile(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(this.projectRoot, filePath);
      const language = this.detectLanguage(filePath);

      const fileInfo: FileInfo = {
        path: filePath,
        relativePath,
        content,
        size: stats.size,
        lastModified: stats.mtime,
        imports: this.extractImports(content, language),
        exports: this.extractExports(content, language),
        functions: this.extractFunctions(content, language),
        classes: this.extractClasses(content, language),
        interfaces: this.extractInterfaces(content, language),
        types: this.extractTypes(content, language),
        dependencies: [],
        language,
      };

      // Build dependencies list
      fileInfo.dependencies = fileInfo.imports.map(imp => imp.path);

      this.cache.set(filePath, fileInfo);
      return fileInfo;
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      // Return minimal file info on error
      const relativePath = path.relative(this.projectRoot, filePath);
      const fileInfo: FileInfo = {
        path: filePath,
        relativePath,
        content: '',
        size: 0,
        lastModified: new Date(),
        imports: [],
        exports: [],
        functions: [],
        classes: [],
        interfaces: [],
        types: [],
        dependencies: [],
        language: 'other',
      };
      this.cache.set(filePath, fileInfo);
      return fileInfo;
    }
  }

  private detectLanguage(filePath: string): 'typescript' | 'javascript' | 'python' | 'other' {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts': case '.tsx': return 'typescript';
      case '.js': case '.jsx': return 'javascript';
      case '.py': return 'python';
      default: return 'other';
    }
  }

  private extractImports(content: string, language: string): Array<{path: string; imports: string[]; isDefault: boolean}> {
    const imports: Array<{path: string; imports: string[]; isDefault: boolean}> = [];
    
    if (language === 'typescript' || language === 'javascript') {
      // Match ES6 imports
      const importRegex = /import\s+(?:(\w+)|{([^}]+)}|(\*\s+as\s+\w+))\s+from\s+['"]([^'"]+)['"];?/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const [, defaultImport, namedImports, namespaceImport, path] = match;
        
        if (defaultImport) {
          imports.push({
            path: path.trim(),
            imports: [defaultImport.trim()],
            isDefault: true,
          });
        } else if (namedImports) {
          imports.push({
            path: path.trim(),
            imports: namedImports.split(',').map(imp => imp.trim()),
            isDefault: false,
          });
        } else if (namespaceImport) {
          imports.push({
            path: path.trim(),
            imports: [namespaceImport.trim()],
            isDefault: false,
          });
        }
      }

      // Match require() calls
      const requireRegex = /(?:const|let|var)\s+(?:(\w+)|{([^}]+)})\s*=\s*require\(['"]([^'"]+)['"]\);?/g;
      while ((match = requireRegex.exec(content)) !== null) {
        const [, singleImport, destructured, path] = match;
        
        if (singleImport) {
          imports.push({
            path: path.trim(),
            imports: [singleImport.trim()],
            isDefault: true,
          });
        } else if (destructured) {
          imports.push({
            path: path.trim(),
            imports: destructured.split(',').map(imp => imp.trim()),
            isDefault: false,
          });
        }
      }
    } else if (language === 'python') {
      // Match Python imports
      const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const [, fromPath, importedItems] = match;
        const path = fromPath || importedItems.split(',')[0].trim();
        const items = importedItems.split(',').map(item => item.trim());
        
        imports.push({
          path: path.trim(),
          imports: items,
          isDefault: false,
        });
      }
    }
    
    return imports;
  }

  private extractExports(content: string, language: string): Array<{name: string; type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'default'; line: number}> {
    const exports: Array<{name: string; type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'default'; line: number}> = [];
    
    if (language === 'typescript' || language === 'javascript') {
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Export function
        if (trimmed.startsWith('export function ') || trimmed.startsWith('export async function ')) {
          const match = trimmed.match(/export\s+(?:async\s+)?function\s+(\w+)/);
          if (match) {
            exports.push({
              name: match[1],
              type: 'function',
              line: index + 1,
            });
          }
        }
        
        // Export class
        else if (trimmed.startsWith('export class ')) {
          const match = trimmed.match(/export\s+class\s+(\w+)/);
          if (match) {
            exports.push({
              name: match[1],
              type: 'class',
              line: index + 1,
            });
          }
        }
        
        // Export interface
        else if (trimmed.startsWith('export interface ')) {
          const match = trimmed.match(/export\s+interface\s+(\w+)/);
          if (match) {
            exports.push({
              name: match[1],
              type: 'interface',
              line: index + 1,
            });
          }
        }
        
        // Export type
        else if (trimmed.startsWith('export type ')) {
          const match = trimmed.match(/export\s+type\s+(\w+)/);
          if (match) {
            exports.push({
              name: match[1],
              type: 'type',
              line: index + 1,
            });
          }
        }
        
        // Export const/let/var
        else if (trimmed.match(/^export\s+(?:const|let|var)\s+/)) {
          const match = trimmed.match(/export\s+(?:const|let|var)\s+(\w+)/);
          if (match) {
            exports.push({
              name: match[1],
              type: 'const',
              line: index + 1,
            });
          }
        }
        
        // Default export
        else if (trimmed.startsWith('export default ')) {
          exports.push({
            name: 'default',
            type: 'default',
            line: index + 1,
          });
        }
      });
    }
    
    return exports;
  }

  private extractFunctions(content: string, language: string): Array<{
    name: string;
    startLine: number;
    endLine: number;
    params: string[];
    isAsync: boolean;
    isExported: boolean;
  }> {
    const functions: Array<{
      name: string;
      startLine: number;
      endLine: number;
      params: string[];
      isAsync: boolean;
      isExported: boolean;
    }> = [];

    if (language === 'typescript' || language === 'javascript') {
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Match function declarations
        const functionMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
        if (functionMatch) {
          const [, name, paramsStr] = functionMatch;
          const params = paramsStr ? paramsStr.split(',').map(p => p.trim()) : [];
          
          functions.push({
            name,
            startLine: index + 1,
            endLine: index + 1, // Simple approximation
            params,
            isAsync: trimmed.includes('async'),
            isExported: trimmed.includes('export'),
          });
        }

        // Match arrow functions
        const arrowMatch = trimmed.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>/);
        if (arrowMatch) {
          const [, name] = arrowMatch;
          
          functions.push({
            name,
            startLine: index + 1,
            endLine: index + 1,
            params: [], // Could parse this more thoroughly
            isAsync: trimmed.includes('async'),
            isExported: trimmed.includes('export'),
          });
        }
      });
    }
    
    return functions;
  }

  private extractClasses(content: string, language: string): Array<{
    name: string;
    startLine: number;
    endLine: number;
    methods: string[];
    extends?: string;
    implements?: string[];
    isExported: boolean;
  }> {
    const classes: Array<{
      name: string;
      startLine: number;
      endLine: number;
      methods: string[];
      extends?: string;
      implements?: string[];
      isExported: boolean;
    }> = [];

    if (language === 'typescript' || language === 'javascript') {
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Match class declarations
        const classMatch = trimmed.match(/(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/);
        if (classMatch) {
          const [, name, extendsClass, implementsStr] = classMatch;
          const implementsInterfaces = implementsStr ? implementsStr.split(',').map(i => i.trim()) : undefined;
          
          classes.push({
            name,
            startLine: index + 1,
            endLine: index + 1, // Simple approximation
            methods: [], // Could parse methods more thoroughly
            extends: extendsClass,
            implements: implementsInterfaces,
            isExported: trimmed.includes('export'),
          });
        }
      });
    }
    
    return classes;
  }

  private extractInterfaces(content: string, language: string): Array<{
    name: string;
    startLine: number;
    endLine: number;
    properties: string[];
    isExported: boolean;
  }> {
    const interfaces: Array<{
      name: string;
      startLine: number;
      endLine: number;
      properties: string[];
      isExported: boolean;
    }> = [];

    if (language === 'typescript') {
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Match interface declarations
        const interfaceMatch = trimmed.match(/(?:export\s+)?interface\s+(\w+)/);
        if (interfaceMatch) {
          const [, name] = interfaceMatch;
          
          interfaces.push({
            name,
            startLine: index + 1,
            endLine: index + 1, // Simple approximation
            properties: [], // Could parse properties more thoroughly
            isExported: trimmed.includes('export'),
          });
        }
      });
    }
    
    return interfaces;
  }

  private extractTypes(content: string, language: string): Array<{
    name: string;
    startLine: number;
    definition: string;
    isExported: boolean;
  }> {
    const types: Array<{
      name: string;
      startLine: number;
      definition: string;
      isExported: boolean;
    }> = [];

    if (language === 'typescript') {
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Match type declarations
        const typeMatch = trimmed.match(/(?:export\s+)?type\s+(\w+)\s*=\s*(.+)/);
        if (typeMatch) {
          const [, name, definition] = typeMatch;
          
          types.push({
            name,
            startLine: index + 1,
            definition: definition.trim(),
            isExported: trimmed.includes('export'),
          });
        }
      });
    }
    
    return types;
  }

  private findFile(importPath: string): FileInfo | undefined {
    // Simple file resolution logic
    const files = Array.from(this.cache.values());
    
    // Try exact match first
    let found = files.find(f => f.relativePath === importPath || f.path === importPath);
    if (found) return found;
    
    // Try with extensions
    const extensions = ['.ts', '.js', '.tsx', '.jsx'];
    for (const ext of extensions) {
      found = files.find(f => f.relativePath === importPath + ext || f.relativePath === importPath + '/index' + ext);
      if (found) return found;
    }
    
    // Try relative path matching
    found = files.find(f => f.relativePath.includes(importPath) || f.path.includes(importPath));
    return found;
  }

  async getProjectStructure(projectRoot: string): Promise<any> {
    const files = Array.from(this.cache.values());
    
    const structure = {
      totalFiles: files.length,
      filesByType: this.groupFilesByType(files),
      directoryTree: this.buildDirectoryTree(files),
      languages: this.analyzeLanguages(files),
      complexity: this.calculateProjectComplexity(files),
    };

    return structure;
  }

  async buildDependencyGraph(target: string, projectRoot: string, includeTests: boolean = true): Promise<any> {
    // Simple dependency graph builder
    const files = Array.from(this.cache.values());
    const filteredFiles = includeTests ? files : files.filter(f => !f.path.includes('test') && !f.path.includes('spec'));
    
    // Find target file
    const targetFile = this.findFile(target) || filteredFiles.find(f => f.relativePath.includes(target));
    
    if (!targetFile) {
      return {
        target,
        dependencies: [],
        dependents: [],
        graph: { nodes: [], edges: [] }
      };
    }

    // Build dependency tree
    const visited = new Set<string>();
    const dependencies: string[] = [];
    const dependents: string[] = [];

    const collectDependencies = (file: FileInfo, depth: number = 0) => {
      if (visited.has(file.path) || depth > 5) return; // Avoid infinite recursion
      
      visited.add(file.path);
      
      for (const dep of file.dependencies) {
        const depFile = this.findFile(dep);
        if (depFile && !dependencies.includes(depFile.relativePath)) {
          dependencies.push(depFile.relativePath);
          collectDependencies(depFile, depth + 1);
        }
      }
    };

    // Find dependents (files that import this target)
    for (const file of filteredFiles) {
      if (file.dependencies.includes(target) || file.imports.some(imp => imp.path === target)) {
        dependents.push(file.relativePath);
      }
    }

    collectDependencies(targetFile);

    return {
      target: targetFile.relativePath,
      dependencies,
      dependents,
      graph: {
        nodes: [targetFile.relativePath, ...dependencies, ...dependents],
        edges: dependencies.map(dep => ({ source: targetFile.relativePath, target: dep }))
          .concat(dependents.map(dep => ({ source: dep, target: targetFile.relativePath })))
      }
    };
  }

  async getDependencyGraph(projectRoot: string): Promise<any> {
    const files = Array.from(this.cache.values());
    
    return {
      nodes: files.map(f => ({
        id: f.relativePath,
        type: f.language,
        size: f.size,
        functions: f.functions.length,
        classes: f.classes.length,
      })),
      edges: this.buildDependencyEdges(files),
      clusters: this.identifyModuleClusters(files),
    };
  }

  async getProjectAnalysis(projectRoot: string): Promise<any> {
    const files = Array.from(this.cache.values());
    
    return {
      summary: this.generateProjectSummary(files),
      architecture: this.analyzeArchitecture(files),
      patterns: this.detectArchitecturalPatterns(files),
      metrics: this.calculateMetrics(files),
      recommendations: this.generateRecommendations(files),
    };
  }

  private groupFilesByType(files: FileInfo[]): Record<string, number> {
    const types: Record<string, number> = {};
    
    for (const file of files) {
      const ext = path.extname(file.path);
      types[ext] = (types[ext] || 0) + 1;
    }
    
    return types;
  }

  private buildDirectoryTree(files: FileInfo[]): any {
    const tree: any = {};
    
    for (const file of files) {
      const parts = file.relativePath.split(path.sep);
      let current = tree;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
      
      // Add file info
      const filename = parts[parts.length - 1];
      current[filename] = {
        type: 'file',
        size: file.size,
        language: file.language,
        functions: file.functions.length,
        classes: file.classes.length,
      };
    }
    
    return tree;
  }

  private analyzeLanguages(files: FileInfo[]): any {
    const languages: Record<string, {count: number; totalSize: number; totalFunctions: number; totalClasses: number}> = {};
    
    for (const file of files) {
      if (!languages[file.language]) {
        languages[file.language] = {
          count: 0,
          totalSize: 0,
          totalFunctions: 0,
          totalClasses: 0,
        };
      }
      
      const lang = languages[file.language];
      lang.count++;
      lang.totalSize += file.size;
      lang.totalFunctions += file.functions.length;
      lang.totalClasses += file.classes.length;
    }
    
    return languages;
  }

  private detectArchitecturalPatterns(files: FileInfo[]): string[] {
    const patterns: string[] = [];
    
    // Detect common patterns based on file structure and naming
    const hasTests = files.some(f => f.path.includes('test') || f.path.includes('spec'));
    const hasComponents = files.some(f => f.path.includes('component'));
    const hasServices = files.some(f => f.path.includes('service'));
    const hasModels = files.some(f => f.path.includes('model'));
    const hasControllers = files.some(f => f.path.includes('controller'));
    const hasUtils = files.some(f => f.path.includes('util'));

    if (hasTests) patterns.push('Testing Framework');
    if (hasComponents) patterns.push('Component-Based Architecture');
    if (hasServices) patterns.push('Service Layer Pattern');
    if (hasModels) patterns.push('Model-Based Architecture');
    if (hasControllers) patterns.push('MVC Pattern');
    if (hasUtils) patterns.push('Utility Functions');

    return patterns;
  }

  private analyzeArchitecture(files: FileInfo[]): any {
    const layers: Record<string, string[]> = {
      'presentation': [],
      'business': [],
      'data': [],
      'infrastructure': [],
    };

    for (const file of files) {
      const path = file.relativePath.toLowerCase();
      
      if (path.includes('component') || path.includes('view') || path.includes('ui')) {
        layers.presentation.push(file.relativePath);
      } else if (path.includes('service') || path.includes('business') || path.includes('logic')) {
        layers.business.push(file.relativePath);
      } else if (path.includes('model') || path.includes('data') || path.includes('repository')) {
        layers.data.push(file.relativePath);
      } else if (path.includes('config') || path.includes('util') || path.includes('helper')) {
        layers.infrastructure.push(file.relativePath);
      }
    }

    return {
      layers,
      complexity: this.calculateArchitectureComplexity(files),
      dependencies: this.analyzeDependencyComplexity(files),
    };
  }

  private calculateProjectComplexity(files: FileInfo[]): any {
    const totalFiles = files.length;
    const totalFunctions = files.reduce((sum, f) => sum + f.functions.length, 0);
    const totalClasses = files.reduce((sum, f) => sum + f.classes.length, 0);
    const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);
    
    return {
      files: totalFiles,
      functions: totalFunctions,
      classes: totalClasses,
      lines: totalLines,
      averageFunctionsPerFile: Math.round((totalFunctions / totalFiles) * 100) / 100,
      averageClassesPerFile: Math.round((totalClasses / totalFiles) * 100) / 100,
      averageLinesPerFile: Math.round((totalLines / totalFiles) * 100) / 100,
    };
  }

  private calculateArchitectureComplexity(files: FileInfo[]): number {
    // Simple complexity metric based on file count and relationships
    const totalFiles = files.length;
    const totalFunctions = files.reduce((sum, f) => sum + f.functions.length, 0);
    const totalClasses = files.reduce((sum, f) => sum + f.classes.length, 0);
    
    return Math.round((totalFunctions + totalClasses * 2) / totalFiles);
  }

  private analyzeDependencyComplexity(files: FileInfo[]): any {
    const importCounts = files.map(f => f.imports.length);
    const avgImports = importCounts.reduce((sum, count) => sum + count, 0) / files.length;
    
    return {
      averageImports: Math.round(avgImports * 100) / 100,
      maxImports: Math.max(...importCounts),
      minImports: Math.min(...importCounts),
      totalImports: importCounts.reduce((sum, count) => sum + count, 0),
    };
  }

  private buildDependencyEdges(files: FileInfo[]): Array<{source: string; target: string; type: string}> {
    const edges: Array<{source: string; target: string; type: string}> = [];
    
    for (const file of files) {
      for (const dep of file.dependencies) {
        const targetFile = this.findFile(dep);
        if (targetFile) {
          edges.push({
            source: file.relativePath,
            target: targetFile.relativePath,
            type: 'import',
          });
        }
      }
    }
    
    return edges;
  }

  private identifyModuleClusters(files: FileInfo[]): Array<{name: string; files: string[]}> {
    const clusters: Array<{name: string; files: string[]}> = [];
    
    // Group files by directory
    const dirGroups: Record<string, string[]> = {};
    
    for (const file of files) {
      const dir = path.dirname(file.relativePath);
      if (!dirGroups[dir]) {
        dirGroups[dir] = [];
      }
      dirGroups[dir].push(file.relativePath);
    }
    
    // Convert to clusters
    for (const [dir, fileList] of Object.entries(dirGroups)) {
      if (fileList.length > 1) {
        clusters.push({
          name: dir === '.' ? 'root' : dir,
          files: fileList,
        });
      }
    }
    
    return clusters;
  }

  private generateProjectSummary(files: FileInfo[]): string {
    const totalFiles = files.length;
    const languages = this.analyzeLanguages(files);
    const primaryLanguage = Object.entries(languages).reduce((a, b) => 
      languages[a[0]].count > languages[b[0]].count ? a : b
    )[0];
    
    const patterns = this.detectArchitecturalPatterns(files);
    const complexity = this.calculateProjectComplexity(files);
    
    return `This project contains ${totalFiles} files primarily written in ${primaryLanguage}. ` +
           `It follows ${patterns.join(', ')} architectural patterns. ` +
           `The codebase has ${complexity.functions} functions and ${complexity.classes} classes ` +
           `across ${complexity.lines} lines of code.`;
  }

  private calculateMetrics(files: FileInfo[]): any {
    return {
      complexity: this.calculateProjectComplexity(files),
      dependencies: this.analyzeDependencyComplexity(files),
      maintainability: this.calculateMaintainabilityScore(files),
      testCoverage: this.estimateTestCoverage(files),
    };
  }

  private calculateMaintainabilityScore(files: FileInfo[]): number {
    // Simple maintainability score based on various factors
    const avgFunctionsPerFile = files.reduce((sum, f) => sum + f.functions.length, 0) / files.length;
    const avgImportsPerFile = files.reduce((sum, f) => sum + f.imports.length, 0) / files.length;
    const hasTests = files.some(f => f.path.includes('test') || f.path.includes('spec'));
    
    let score = 100;
    
    // Penalize for too many functions per file
    if (avgFunctionsPerFile > 20) score -= 20;
    else if (avgFunctionsPerFile > 10) score -= 10;
    
    // Penalize for too many imports per file
    if (avgImportsPerFile > 15) score -= 15;
    else if (avgImportsPerFile > 10) score -= 5;
    
    // Bonus for having tests
    if (hasTests) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private estimateTestCoverage(files: FileInfo[]): number {
    const testFiles = files.filter(f => f.path.includes('test') || f.path.includes('spec'));
    const sourceFiles = files.filter(f => !f.path.includes('test') && !f.path.includes('spec') && 
                                           (f.language === 'typescript' || f.language === 'javascript'));
    
    if (sourceFiles.length === 0) return 0;
    
    // Simple estimation: ratio of test files to source files
    const ratio = testFiles.length / sourceFiles.length;
    return Math.min(100, Math.round(ratio * 100));
  }

  private generateRecommendations(files: FileInfo[]): string[] {
    const recommendations: string[] = [];
    const metrics = this.calculateMetrics(files);
    
    if (metrics.maintainability < 70) {
      recommendations.push('Consider refactoring large files and reducing complexity');
    }
    
    if (metrics.testCoverage < 50) {
      recommendations.push('Increase test coverage for better code reliability');
    }
    
    if (metrics.dependencies.averageImports > 15) {
      recommendations.push('Review dependencies to reduce coupling between modules');
    }
    
    const hasDocumentation = files.some(f => f.path.includes('README') || f.path.includes('doc'));
    if (!hasDocumentation) {
      recommendations.push('Add documentation (README, API docs) for better maintainability');
    }
    
    return recommendations;
  }

  async reindexFiles(changedFiles: string[]): Promise<void> {
    console.error(`Re-indexing ${changedFiles.length} changed files`);
    
    const analysisPromises = changedFiles.map(filePath => this.analyzeFile(filePath));
    await Promise.all(analysisPromises);
    
    console.error('Re-indexing complete');
  }

  async getIndexStats(): Promise<any> {
    const files = Array.from(this.cache.values());
    
    return {
      filesIndexed: files.length,
      functionsFound: files.reduce((sum, f) => sum + f.functions.length, 0),
      classesFound: files.reduce((sum, f) => sum + f.classes.length, 0),
      modulesFound: files.filter(f => f.imports.length > 0 || f.exports.length > 0).length,
      dependenciesMapped: files.reduce((sum, f) => sum + f.imports.length, 0),
      lastIndexed: new Date().toISOString(),
    };
  }

  getFileInfo(filePath: string): FileInfo | undefined {
    return this.cache.get(filePath);
  }

  getAllFiles(): FileInfo[] {
    return Array.from(this.cache.values());
  }

  searchFiles(query: string): FileInfo[] {
    const files = Array.from(this.cache.values());
    const queryLower = query.toLowerCase();
    
    return files.filter(file => 
      file.relativePath.toLowerCase().includes(queryLower) ||
      file.functions.some(fn => fn.name.toLowerCase().includes(queryLower)) ||
      file.classes.some(cls => cls.name.toLowerCase().includes(queryLower))
    );
  }

  findReferences(symbol: string): Array<{file: FileInfo, references: Array<{line: number, type: string}>}> {
    const references: Array<{file: FileInfo, references: Array<{line: number, type: string}>}> = [];
    const files = Array.from(this.cache.values());
    
    for (const file of files) {
      const fileReferences: Array<{line: number, type: string}> = [];
      
      // Check functions
      file.functions.forEach(fn => {
        if (fn.name === symbol) {
          fileReferences.push({line: fn.startLine, type: 'function_definition'});
        }
      });
      
      // Check classes
      file.classes.forEach(cls => {
        if (cls.name === symbol) {
          fileReferences.push({line: cls.startLine, type: 'class_definition'});
        }
      });
      
      // Check imports
      file.imports.forEach(imp => {
        if (imp.imports.includes(symbol)) {
          fileReferences.push({line: 0, type: 'import'});
        }
      });
      
      if (fileReferences.length > 0) {
        references.push({file, references: fileReferences});
      }
    }
    
    return references;
  }
}
