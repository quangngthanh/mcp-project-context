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
import { ContextBuilder, FolderTreeMode } from "./context-builder.js";
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
              folderTreeMode: {
                type: "string",
                enum: ["directory_only", "full_analysis"],
                description: "Folder tree mode: directory_only (for investigation) or full_analysis (complete view)",
                default: "full_analysis",
              },
            },
            required: ["query", "projectRoot"],
          },
        },
        {
          name: "get_folder_tree",
          description: "Get folder tree with different modes: directory_only (for investigation) or full_analysis (complete view)",
          inputSchema: {
            type: "object",
            properties: {
              projectRoot: {
                type: "string",
                description: "Root directory of the project",
              },
              mode: {
                type: "string",
                enum: ["directory_only", "full_analysis"],
                description: "Tree mode: directory_only (only folders) or full_analysis (folders + files)",
                default: "directory_only",
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
          case "get_folder_tree":
            return await this.handleGetFolderTree(args as any);
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
    folderTreeMode?: string;
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

## Project Folder Structure

${context.folderTree}

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

  private async handleGetFolderTree(args: {
    projectRoot: string;
    mode?: string;
  }) {
    const folderTree = this.contextBuilder.generateFolderTree(args.projectRoot);

    return {
      content: [
        {
          type: "text",
          text: `# Folder Tree\n\nMode: ${args.mode || 'full_analysis'}\nProject Root: ${args.projectRoot}\n\n${folderTree}`,
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
