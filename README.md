# moda-cli

CLI and MCP server for [Moda](https://modaflows.com) -- AI agent analytics and observability.

Query your conversation analytics from the terminal or connect AI assistants (Claude Code, Cursor, etc.) to your Moda data via the Model Context Protocol.

## Install

```bash
npm install -g @moda-ai/cli
```

Or use without installing:

```bash
npx -p @moda-ai/cli moda overview
```

## Setup

Get your API key from [modaflows.com/settings](https://modaflows.com/settings), then:

```bash
export MODA_API_KEY="moda_sk_..."
```

## CLI Usage

```bash
moda overview                                    # Dashboard overview
moda overview --days-back=30                     # Last 30 days

moda clusters                                    # Browse topic clusters
moda clusters --parent-id=node-abc               # Drill into a category

moda cluster-conversations <node_id>             # Conversations in a cluster

moda conversations --search="error"              # Search conversations
moda conversations --time-range=24h              # Filter by time
moda conversations --environment=production      # Filter by environment

moda context <conversation_id>                   # Get conversation context
moda context <conversation_id> --msg-index=5     # Center on message 5

moda frustrations                                # User frustration detections
moda frustrations --days-back=14 --limit=20

moda tool-failures                               # Tool failure overview
moda tool-failure-detail <tool_name>             # Per-tool failure detail
```

All commands output JSON. Pipe to `jq` for filtering:

```bash
moda overview | jq '.frustrations'
moda frustrations | jq '.frustrations[].primary_cause'
```

## MCP Server

### Claude Code

```bash
claude mcp add moda -- npx -y @moda-ai/cli
```

Or add manually to your MCP config:

```json
{
  "mcpServers": {
    "moda": {
      "command": "npx",
      "args": ["-y", "@moda-ai/cli"],
      "env": {
        "MODA_API_KEY": "moda_sk_your_key_here"
      }
    }
  }
}
```

### Other MCP Clients (Cursor, etc.)

```json
{
  "command": "npx",
  "args": ["-y", "@moda-ai/cli"],
  "env": {
    "MODA_API_KEY": "moda_sk_your_key_here"
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `moda_get_overview` | Dashboard overview with KPIs, top clusters, recent activity |
| `moda_get_clusters` | Browse topic cluster hierarchy |
| `moda_get_cluster_conversations` | List conversations in a specific cluster |
| `moda_search_conversations` | Search and filter conversations |
| `moda_get_conversation_context` | Get windowed conversation context (max 5 messages) |
| `moda_get_frustrations` | User frustration detections with evidence |
| `moda_get_tool_failures` | Tool failure overview |
| `moda_get_tool_failure_detail` | Per-tool failure detail with examples |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MODA_API_KEY` | Yes | -- | Your Moda API key (`moda_sk_...`) |
| `MODA_BASE_URL` | No | `https://modaflows.com` | Base URL for the Data API |

## Documentation

- [CLI Reference](https://docs.modaflows.com/data-api/cli)
- [MCP Server Setup](https://docs.modaflows.com/data-api/mcp)
- [Data API Overview](https://docs.modaflows.com/data-api/overview)
- [Quickstart](https://docs.modaflows.com/quickstart)

## License

MIT
