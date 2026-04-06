# CLAUDE.md - Moda Data API MCP Server

## What This App Does

MCP (Model Context Protocol) server that exposes Moda's conversation analytics as MCP tools. Allows AI assistants (Claude Code, etc.) to query conversation data, clusters, frustrations, and tool failures through the standardized MCP protocol. Wraps the Data API endpoints with proper authentication and validation.

## Tech Stack

- **Protocol:** MCP (Model Context Protocol) v1.0
- **Language:** TypeScript
- **SDK:** `@modelcontextprotocol/sdk` (official MCP SDK)
- **Transport:** stdio (standard input/output)
- **Validation:** Zod for runtime type checking
- **API:** Wraps Moda Data API (`/api/v1/data/*`)

## Key Files

```
src/
└── index.ts                  # MCP server implementation (8 tools)
dist/
└── index.js                  # Compiled output (executable)
package.json                  # Dependencies and scripts
tsconfig.json                 # TypeScript configuration
.env.example                  # Environment variables template
```

## Commands

```bash
# Build TypeScript to dist/
npm run build

# Development (watch mode)
npm run dev

# Run the server (after building)
npm start
# or
node dist/index.js

# Type checking only
npm run typecheck
```

## MCP Tools (8 total)

All tools are read-only queries against the Data API:

1. **moda_get_overview** - Dashboard KPIs, clusters, recent activity
2. **moda_get_clusters** - Browse cluster hierarchy
3. **moda_get_cluster_conversations** - List conversations in a cluster
4. **moda_search_conversations** - Search/filter conversations
5. **moda_get_conversation_context** - Windowed message context (max 5 messages)
6. **moda_get_frustrations** - Frustration detections with inline evidence
7. **moda_get_tool_failures** - Tool failure overview
8. **moda_get_tool_failure_detail** - Per-tool failure breakdown with examples

## Environment Variables

```
MODA_API_KEY=moda_sk_...              # Required - API key for authentication
MODA_BASE_URL=https://modaflows.com    # Optional - defaults to production
```

## Important Patterns

### MCP Server Setup

The server uses the official MCP SDK with stdio transport:

```typescript
const server = new Server(
  { name: 'moda-data-api', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Tool Registration

Tools are registered via `ListToolsRequestSchema`:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'moda_get_overview',
        description: 'Get dashboard overview...',
        inputSchema: { /* JSON Schema */ },
      },
      // ... more tools
    ],
  };
});
```

### Tool Execution

Tool calls are handled via `CallToolRequestSchema`:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Validate with Zod
  const params = OverviewSchema.parse(args);

  // Call Data API
  const data = await callDataAPI(`/overview?days_back=${params.days_back}`);

  // Return MCP response
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
});
```

### API Authentication

All Data API calls include the API key header:

```typescript
const response = await fetch(`${MODA_BASE_URL}/api/v1/data${endpoint}`, {
  headers: {
    'x-api-key': MODA_API_KEY,
    'Content-Type': 'application/json',
  },
});
```

### Error Handling

- Zod validation errors are caught and formatted
- API errors are propagated with status codes
- Fatal errors exit the process
- Non-fatal errors are logged to stderr

### Response Format

All tool responses return JSON-formatted text:

```typescript
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify(data, null, 2),
    },
  ],
};
```

## Integration with Claude Code

Add to your MCP configuration (`.claude/settings.local.json` or `~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "moda-data-api": {
      "command": "node",
      "args": ["/absolute/path/to/apps/moda-data-api-mcp/dist/index.js"],
      "env": {
        "MODA_API_KEY": "moda_sk_...",
        "MODA_BASE_URL": "https://modaflows.com"
      }
    }
  }
}
```

Restart Claude Code to load the server. Tools will appear in the MCP tools list.

## Usage Patterns

### Pattern 1: Overview First

Always start with `moda_get_overview` to understand the current state:

```
User: "How are my conversations doing?"
Claude: [Calls moda_get_overview with days_back: 7]
```

### Pattern 2: Drill-Down

Follow the drill-down pattern: overview → specifics → context:

```
1. moda_get_overview
2. moda_get_frustrations (if frustration rate is high)
3. moda_get_conversation_context (for specific frustrated conversation)
```

### Pattern 3: Tool Debugging

Investigate tool failures systematically:

```
1. moda_get_tool_failures (overview)
2. moda_get_tool_failure_detail (for specific tool)
3. moda_get_conversation_context (see failure in context)
```

### Pattern 4: Cluster Exploration

Navigate cluster hierarchy step by step:

```
1. moda_get_clusters (root level)
2. moda_get_clusters (parent_id: "node-abc")
3. moda_get_cluster_conversations (node_id: "node-abc")
```

## Development Workflow

1. **Make changes to `src/index.ts`**
2. **Build**: `npm run build`
3. **Test locally**: Update MCP config to point to local dist/index.js
4. **Restart Claude Code** to reload the MCP server
5. **Test tool calls** in Claude Code

## Troubleshooting

### Server Not Starting

Check that:
- `MODA_API_KEY` is set
- `dist/index.js` exists (run `npm run build`)
- Node.js version >= 18.0.0

### Tools Not Appearing

Check that:
- MCP config path is absolute
- MCP config is valid JSON
- Claude Code was restarted after config change
- Server logs don't show errors (stderr)

### API Errors

Check that:
- API key is valid (test with curl)
- `MODA_BASE_URL` is correct
- Backend is running and accessible
- Network connectivity is working

### Validation Errors

Tool arguments are validated with Zod. Check:
- Parameter types match schema (number vs string)
- Required parameters are provided
- Enum values are correct (e.g., time_range: "7d" not "7 days")

## Comparison with Direct Data API

| Aspect | Data API (curl) | MCP Server |
|--------|----------------|------------|
| **Transport** | HTTP REST | MCP stdio |
| **Authentication** | Manual headers | Configured once |
| **Integration** | Manual curl/fetch | Claude Code native |
| **Type Safety** | Manual validation | Zod schemas |
| **Discovery** | Read docs | Tool list in UI |
| **Context** | Stateless | Stateful session |

## Related Projects

- **Data API**: `apps/moda-backend/src/data-api/` - Backend REST API
- **Claude Skill**: `.claude/skills/moda-data-api/` - Usage guide for Claude
- **Original MCP Server**: `apps/moda-mcp-server/` - Direct ClickHouse queries (deprecated in favor of this)

## Future Enhancements

Potential improvements:

1. **Caching**: Cache cluster hierarchies (they don't change often)
2. **Streaming**: Stream large result sets progressively
3. **Resources**: Expose common queries as MCP resources (not just tools)
4. **Batching**: Batch multiple tool calls into one API request
5. **Offline Mode**: Cache recent data for offline queries

## Security Considerations

- API key is passed via environment variable (not exposed in tool responses)
- All API calls are authenticated with the key
- No data modification tools (read-only)
- Tenant isolation handled by backend (API key → tenant ID)

## Testing

To test the server manually:

```bash
# Build first
npm run build

# Run with test env vars
MODA_API_KEY=moda_sk_test MODA_BASE_URL=http://localhost:3000 node dist/index.js
```

The server expects MCP protocol messages on stdin. For interactive testing, use Claude Code or another MCP client.

## Distribution

The compiled `dist/` directory is the distribution artifact:

1. Commit `dist/` to repo for easy consumption
2. Users can run without building: `node dist/index.js`
3. For development, run `npm run build` to regenerate

## Performance

- Tool calls are async and non-blocking
- API calls use native fetch (no extra dependencies)
- Zod validation is fast (<1ms per tool call)
- Total latency: ~API response time + 5-10ms overhead

## Monitoring

Server logs to stderr:

- Startup message: "Moda Data API MCP server running on stdio"
- Fatal errors are logged before exit
- API errors include status codes and response bodies
- MCP protocol errors are handled by the SDK
