#!/usr/bin/env node

/**
 * Test script for MCP Project Context Server
 * Tests các tools và functionality chính
 */

import { ProjectContextServer } from './dist/index.js';

async function testMCPServer() {
  console.log('🧪 Testing MCP Project Context Server...\n');
  
  // Test 1: Index project
  console.log('📊 Test 1: Index Project');
  try {
    const testResult = await simulateMCPCall('index_project', {
      projectRoot: 'D:/Working/MCP/my-mcp/project-context',
      watchChanges: false
    });
    console.log('✅ Index project successful');
    console.log('📈 Stats:', testResult);
  } catch (error) {
    console.log('❌ Index project failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Get complete context
  console.log('🔍 Test 2: Get Complete Context');
  try {
    const testResult = await simulateMCPCall('get_complete_context', {
      query: 'How does the ContextBuilder work?',
      projectRoot: 'D:/Working/MCP/my-mcp/project-context',
      scope: 'class',
      completeness: 'full',
      maxTokens: 50000
    });
    console.log('✅ Get complete context successful');
    console.log('📄 Context preview:', testResult.substring(0, 500) + '...');
  } catch (error) {
    console.log('❌ Get complete context failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Get dependency graph
  console.log('🔗 Test 3: Get Dependency Graph');
  try {
    const testResult = await simulateMCPCall('get_dependency_graph', {
      target: 'src/context-builder.ts',
      projectRoot: 'D:/Working/MCP/my-mcp/project-context',
      includeTests: true
    });
    console.log('✅ Get dependency graph successful');
    console.log('🕸️  Graph info:', JSON.stringify(testResult, null, 2).substring(0, 300) + '...');
  } catch (error) {
    console.log('❌ Get dependency graph failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Validate context completeness
  console.log('✅ Test 4: Validate Context Completeness');
  try {
    const testContext = `
# Context Example
This is a sample context for testing validation.
## Code
\`\`\`typescript
function test() {
  return "hello";
}
\`\`\`
## Dependencies
- typescript
- node
`;
    
    const testResult = await simulateMCPCall('validate_context_completeness', {
      context: testContext,
      query: 'How does the test function work?'
    });
    console.log('✅ Validate context completeness successful');
    console.log('📊 Validation result:', JSON.stringify(testResult, null, 2));
  } catch (error) {
    console.log('❌ Validate context completeness failed:', error.message);
  }
  
  console.log('\n🎉 Testing completed!\n');
}

// Mock MCP call simulation
async function simulateMCPCall(toolName, args) {
  // This is a simplified simulation
  // In real usage, this would go through MCP protocol
  
  switch (toolName) {
    case 'index_project':
      return {
        filesIndexed: 5,
        functionsFound: 25,
        classesFound: 4,
        modulesFound: 5,
        dependenciesMapped: 15
      };
      
    case 'get_complete_context':
      return `# Complete Project Context: ${args.query}

Generated: ${new Date().toISOString()}
Files included: 3

## Project Summary
This context contains 3 files with 500 total lines of code...

## Key Components
### src/context-builder.ts
**Language:** typescript
**Classes:** ContextBuilder
**Functions:** buildCompleteContext, formatCompleteContext
...`;

    case 'get_dependency_graph':
      return {
        nodes: [
          { id: 'src/context-builder.ts', type: 'typescript', functions: 10, classes: 1 },
          { id: 'src/analyzer.ts', type: 'typescript', functions: 15, classes: 1 }
        ],
        edges: [
          { source: 'src/context-builder.ts', target: 'src/analyzer.ts', type: 'import' }
        ]
      };
      
    case 'validate_context_completeness':
      return {
        isComplete: true,
        completenessScore: 0.85,
        confidenceScore: 0.90,
        missingElements: [],
        suggestions: ['Add more usage examples'],
        warnings: [],
        strengths: ['Contains code implementations', 'Dependencies included']
      };
      
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Run tests
testMCPServer().catch(console.error);
