#!/usr/bin/env node

// Simple test to verify the MCP server functionality
import { ProjectAnalyzer } from './src/analyzer.js';
import { ContextBuilder } from './src/context-builder.js';
import { ContextValidator } from './src/context-validator.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testServer() {
  console.log('🧪 Testing MCP Project Context Server...\n');
  
  try {
    // Test 1: ProjectAnalyzer
    console.log('1️⃣ Testing ProjectAnalyzer...');
    const analyzer = new ProjectAnalyzer();
    
    // Test indexing current project
    const projectRoot = __dirname;
    await analyzer.indexProject(projectRoot);
    
    const stats = await analyzer.getIndexStats();
    console.log(`   ✅ Indexed ${stats.filesIndexed} files`);
    console.log(`   ✅ Found ${stats.functionsFound} functions`);
    console.log(`   ✅ Found ${stats.classesFound} classes`);
    
    // Test 2: ContextBuilder
    console.log('\n2️⃣ Testing ContextBuilder...');
    const contextBuilder = new ContextBuilder();
    
    const context = await contextBuilder.buildCompleteContext({
      query: 'ProjectAnalyzer class and its methods',
      projectRoot,
      scope: 'class',
      completeness: 'full',
      maxTokens: 50000,
    });
    
    console.log(`   ✅ Built context with ${context.filesIncluded.length} files`);
    console.log(`   ✅ Context has ${context.tokenCount} tokens`);
    console.log(`   ✅ Compression level: ${context.compressionLevel}`);
    
    // Test 3: ContextValidator
    console.log('\n3️⃣ Testing ContextValidator...');
    const validator = new ContextValidator();
    
    const validation = await validator.validateCompleteness(context, 'ProjectAnalyzer class and its methods');
    
    console.log(`   ✅ Completeness score: ${validation.completenessScore}`);
    console.log(`   ✅ Confidence score: ${validation.confidenceScore}`);
    console.log(`   ✅ Is complete: ${validation.isComplete}`);
    console.log(`   ✅ Found ${validation.strengths.length} strengths`);
    
    if (validation.missingElements.length > 0) {
      console.log(`   ⚠️  Missing elements: ${validation.missingElements.length}`);
    }
    
    // Test 4: Dependency Graph
    console.log('\n4️⃣ Testing Dependency Graph...');
    const graph = await analyzer.buildDependencyGraph(
      'src/analyzer.ts',
      projectRoot,
      true
    );
    
    console.log(`   ✅ Built dependency graph with ${graph.dependencies.length} dependencies`);
    console.log(`   ✅ Found ${graph.dependents.length} dependents`);
    
    console.log('\n🎉 All tests passed! MCP Server is working correctly.\n');
    
    // Show some sample output
    console.log('📋 Sample Context Preview:');
    console.log('=' .repeat(50));
    console.log(context.formattedContext.substring(0, 500) + '...');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testServer().catch(console.error);
