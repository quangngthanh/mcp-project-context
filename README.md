# MCP Project Context - Hướng Dẫn Sử Dụng

MCP Server này được thiết kế đặc biệt để cung cấp **complete context** cho Claude, tập trung vào **completeness thay vì chỉ relevance**.

## 🎯 Mục Tiêu Chính

- **Context Completeness**: Đảm bảo Claude có đầy đủ thông tin để hiểu và reasoning
- **Dependency Aware**: Luôn bao gồm toàn bộ dependency chain
- **Usage Pattern Detection**: Phát hiện cách code được sử dụng thực tế
- **Intelligent Compression**: Nén context thông minh khi vượt quá token limit

## 🚀 Cách Sử Dụng

### 1. Cài Đặt và Chạy

```bash
# Build project
npm run build

# Chạy MCP server
npm start
# hoặc trong development mode
npm run dev
```

### 2. Cấu Hình Claude Desktop

Thêm vào file `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "project-context": {
      "command": "node",
      "args": ["D:/Working/MCP/my-mcp/project-context/dist/index.js"],
      "env": {}
    }
  }
}
```

### 3. Sử Dụng Các Tools

#### 🔍 `get_complete_context`
**Công cụ chính** - Lấy complete context cho Claude

```json
{
  "query": "How does authentication work in this project?",
  "projectRoot": "D:/path/to/your/project",
  "scope": "feature",  // function|class|module|feature|entire_project
  "completeness": "full",  // partial|full|exhaustive
  "maxTokens": 180000
}
```

**Ví dụ sử dụng trong Claude:**
- "Analyze the user authentication system"
- "How does the payment processing work?"
- "Explain the database connection logic"

#### ✅ `validate_context_completeness`
Kiểm tra context có đầy đủ không

```json
{
  "context": "your context string",
  "query": "original query"
}
```

#### 🔗 `get_dependency_graph`
Lấy dependency graph cho một component

```json
{
  "target": "src/auth/AuthService.ts",
  "projectRoot": "D:/path/to/project",
  "includeTests": true
}
```

#### 📊 `index_project`
Index toàn bộ project để tăng tốc

```json
{
  "projectRoot": "D:/path/to/project",
  "watchChanges": true
}
```

## 💡 Ví Dụ Thực Tế

### Scenario 1: Hiểu Authentication System

```
Prompt: "Tôi muốn hiểu hệ thống authentication của project này hoạt động như thế nào"

MCP sẽ:
1. Tìm các file liên quan: AuthService, Login, JWT, middleware...
2. Bao gồm ALL dependencies: crypto, bcrypt, passport...
3. Thêm usage patterns: Các API endpoints sử dụng auth
4. Include test cases để hiểu expected behavior
5. Nén context thông minh để fit trong Claude's limit
```

### Scenario 2: Debug một Bug

```
Prompt: "Tại sao function processPayment() đôi khi bị lỗi?"

MCP sẽ:
1. Lấy complete processPayment() function
2. Tất cả dependencies: payment gateway, database calls
3. Error handling patterns trong codebase
4. Các test cases liên quan đến payment
5. Usage patterns: Tất cả nơi gọi processPayment()
```

### Scenario 3: Refactor Code

```
Prompt: "Tôi muốn refactor UserService class này"

MCP sẽ:
1. Complete UserService class + ALL methods
2. Tất cả classes kế thừa hoặc sử dụng UserService
3. Interface definitions và type contracts
4. All test files testing UserService
5. Usage examples trong toàn bộ codebase
```

## 🔧 Tính Năng Đặc Biệt

### **Context Completeness Priority**
- Không bao giờ bỏ sót dependencies quan trọng
- Luôn bao gồm "full picture" thay vì chỉ relevant snippets
- Auto-expand context để đảm bảo logical completeness

### **Smart Compression**
- Khi context quá lớn, nén thông minh:
  - Giữ lại structure và interfaces
  - Tóm tắt implementation details
  - Maintain tất cả references và relationships

### **Real-time Updates**
- File watching để auto-reindex khi code thay đổi
- Cache thông minh để tăng performance

### **Validation System**
- Tự động check context completeness
- Cảnh báo khi thiếu thông tin quan trọng
- Confidence scoring

## 📋 Best Practices

### **1. Query Design**
```bash
✅ Tốt: "How does user registration work?"
✅ Tốt: "Explain the database migration system"
❌ Tránh: "Show me code" (quá general)
```

### **2. Scope Selection**
- `function`: Cho debugging specific function
- `class`: Hiểu một class và usage
- `feature`: Hiểu một feature complete (RECOMMENDED)
- `entire_project`: Overview toàn project

### **3. Completeness Level**
- `partial`: Nhanh, basic info
- `full`: Complete logical unit (RECOMMENDED)
- `exhaustive`: Everything, including edge cases

## 🎪 Demo Test

Để test MCP:

```bash
# Test với project này
node dist/index.js
```

Sau đó trong Claude:
```
"Analyze the architecture of this MCP project and explain how context building works"
```

## 🔍 Troubleshooting

### Build Errors
```bash
npm run build
# Check for TypeScript errors
```

### Claude Connection Issues
- Kiểm tra đường dẫn trong claude_desktop_config.json
- Restart Claude Desktop sau khi thay đổi config
- Check logs trong Claude Desktop console

### Performance Issues
- Sử dụng `index_project` trước khi query
- Chọn scope phù hợp (không luôn dùng exhaustive)
- Enable file watching cho projects thường xuyên thay đổi

## 📖 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ProjectAnalyzer│    │  ContextBuilder  │    │ContextValidator │
│                 │    │                  │    │                 │
│ • File parsing  │───▶│ • Context assembly│───▶│ • Completeness  │
│ • Dependency    │    │ • Smart compress │    │   validation    │
│   mapping       │    │ • Token optimize │    │ • Confidence    │
│ • Usage patterns│    │                  │    │   scoring       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   FileWatcher   │    │  Claude Desktop  │    │   Final Context │
│                 │    │                  │    │                 │
│ • Real-time     │    │ • MCP Client     │    │ • Complete      │
│   updates       │    │ • Tool calls     │    │ • Compressed    │
│ • Auto reindex  │    │ • Context display│    │ • Validated     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

Giờ bạn có thể sử dụng MCP này để cung cấp complete context cho Claude! 🚀
