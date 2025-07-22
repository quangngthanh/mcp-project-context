#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { ProjectAnalyzer } from "./analyzer.js";
import { ContextBuilder } from "./context-builder.js";
import { FileWatcher } from "./file-watcher.js";
import { ContextValidator } from "./context-validator.js";

class ProjectContextServer {
  private server: Server;
  private analyzer: ProjectAnalyzer;
  private contextBuilder: ContextBuilder;
  private fileWatcher: FileWatcher;
  private validator: ContextValidator;
  private projectRoot: string = "";

  constructor() {
    this.server = new Server(
      {
        name: "project-context",
        version: "0.1.0",
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.analyzer = new ProjectAnalyzer();
    this.contextBuilder = new ContextBuilder();
    this.validator = new ContextValidator();
    this.fileWatcher = new FileWatcher();
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_complete_context",
          description: "Get complete project context with guaranteed completeness for Claude",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Natural language query about the codebase",
              },
              scope: {
                type: "string",
                enum: ["function", "class", "module", "feature", "entire_project"],
                description: "Scope of context to retrieve",
                default: "feature",
              },
              completeness: {
                type: "string", 
                enum: ["partial", "full", "exhaustive"],
                description: "Level of completeness - prioritizes completeness over relevance",
                default: "full",
              },
              maxTokens: {
                type: "number",
                description: "Maximum tokens to fit Claude's context window",
                default: 180000,
              },
              projectRoot: {
                type: "string",
                description: "Root directory of the project to analyze",
              },
            },
            required: ["query", "projectRoot"],
          },
        },
        {
          name: "validate_context_completeness",
          description: "Validate if provided context is complete for Claude understanding",
          inputSchema: {
            type: "object",
            properties: {
              context: {
                type: "string",
                description: "Context to validate for completeness",
              },
              query: {
                type: "string", 
                description: "Original query to validate context against",
              },
            },
            required: ["context", "query"],
          },
        },
        {
          name: "get_dependency_graph",
          description: "Get complete dependency graph for a code element",
          inputSchema: {
            type: "object",
            properties: {
              target: {
                type: "string",
                description: "Target code element (file path, function name, class name)",
              },
              projectRoot: {
                type: "string",
                description: "Root directory of the project",
              },
              includeTests: {
                type: "boolean",
                description: "Include test files in dependency graph",
                default: true,
              },
            },
            required: ["target", "projectRoot"],
          },
        },
        {
          name: "index_project",
          description: "Index the entire project for faster context retrieval",
          inputSchema: {
            type: "object",
            properties: {
              projectRoot: {
                type: "string",
                description: "Root directory of the project to index",
              },
              watchChanges: {
                type: "boolean",
                description: "Enable real-time file watching for updates",
                default: true,
              },
            },
            required: ["projectRoot"],
          },
        },
      ],
    }));

    // Resources handler  
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "project://structure",
          name: "Project Structure",
          mimeType: "application/json",
          description: "Complete project structure and file organization",
        },
        {
          uri: "project://dependencies",
          name: "Project Dependencies", 
          mimeType: "application/json",
          description: "Complete dependency graph and relationships",
        },
        {
          uri: "project://analysis",
          name: "Project Analysis",
          mimeType: "application/json", 
          description: "Complete project analysis including patterns and architecture",
        },
      ],
    }));

    // Tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_complete_context":
            return await this.handleGetCompleteContext(args as any);
          case "validate_context_completeness":
            return await this.handleValidateContext(args as any);
          case "get_dependency_graph":
            return await this.handleGetDependencyGraph(args as any);
          case "index_project":
            return await this.handleIndexProject(args as any);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    // Resource read handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      try {
        switch (uri) {
          case "project://structure":
            return {
              contents: [
                {
                  type: "text",
                  text: JSON.stringify(await this.analyzer.getProjectStructure(this.projectRoot), null, 2),
                },
              ],
            };
          case "project://dependencies":
            return {
              contents: [
                {
                  type: "text", 
                  text: JSON.stringify(await this.analyzer.getDependencyGraph(this.projectRoot), null, 2),
                },
              ],
            };
          case "project://analysis":
            return {
              contents: [
                {
                  type: "text",
                  text: JSON.stringify(await this.analyzer.getProjectAnalysis(this.projectRoot), null, 2),
                },
              ],
            };
          default:
            throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error reading resource ${uri}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleGetCompleteContext(args: {
    query: string;
    scope?: string;
    completeness?: string;
    maxTokens?: number;
    projectRoot: string;
  }) {
    this.projectRoot = args.projectRoot;

    // Build complete context with guaranteed completeness
    const context = await this.contextBuilder.buildCompleteContext({
      query: args.query,
      projectRoot: args.projectRoot,
      scope: args.scope || "feature",
      completeness: args.completeness || "full",
      maxTokens: args.maxTokens || 180000,
    });

    // Validate completeness
    const validation = await this.validator.validateCompleteness(context, args.query);

    return {
      content: [
        {
          type: "text",
          text: `# Complete Project Context

## Query: ${args.query}

## Context Completeness Score: ${validation.completenessScore}

## Complete Context:

${context.formattedContext}

## Dependency Graph:
${JSON.stringify(context.dependencyGraph, null, 2)}

## Usage Patterns:
${JSON.stringify(context.usagePatterns, null, 2)}

## Validation Results:
- **Is Complete**: ${validation.isComplete}
- **Missing Elements**: ${validation.missingElements.join(', ')}
- **Confidence Score**: ${validation.confidenceScore}
- **Token Count**: ${context.tokenCount}

## Context Metadata:
- **Files Included**: ${context.filesIncluded.length}
- **Total Lines**: ${context.totalLines}
- **Compression Level**: ${context.compressionLevel}
`,
        },
      ],
    };
  }

  private async handleValidateContext(args: {
    context: string;
    query: string;
  }) {
    const validation = await this.validator.validateCompleteness({ formattedContext: args.context }, args.query);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(validation, null, 2),
        },
      ],
    };
  }

  private async handleGetDependencyGraph(args: {
    target: string;
    projectRoot: string;
    includeTests?: boolean;
  }) {
    const graph = await this.analyzer.buildDependencyGraph(
      args.target,
      args.projectRoot,
      args.includeTests || true
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(graph, null, 2),
        },
      ],
    };
  }

  private async handleIndexProject(args: {
    projectRoot: string;
    watchChanges?: boolean;
  }) {
    this.projectRoot = args.projectRoot;
    
    // Index project
    await this.analyzer.indexProject(args.projectRoot);
    
    // Setup file watching if requested
    if (args.watchChanges) {
      await this.fileWatcher.watch(args.projectRoot, (changedFiles) => {
        // Re-index changed files
        this.analyzer.reindexFiles(changedFiles);
      });
    }

    const stats = await this.analyzer.getIndexStats();

    return {
      content: [
        {
          type: "text",
          text: `Project indexed successfully!
          **Stats:**
          - Files indexed: ${stats.filesIndexed}
          - Functions found: ${stats.functionsFound}
          - Classes found: ${stats.classesFound}
          - Modules found: ${stats.modulesFound}
          - Dependencies mapped: ${stats.dependenciesMapped}

          **File watching**: ${args.watchChanges ? 'Enabled' : 'Disabled'}
          `,
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Project Context MCP server running on stdio");
  }
}

export { ProjectContextServer };

const server = new ProjectContextServer();
server.run().catch(console.error);
