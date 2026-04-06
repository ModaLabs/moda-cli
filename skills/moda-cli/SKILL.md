---
name: moda-cli
description: Install and use the Moda CLI for querying conversation analytics from the terminal or configuring the MCP server for AI assistants. Use when someone asks about moda commands, CLI setup, MCP server configuration, conversation analytics, frustration detection, or tool failure debugging.
---

# Moda CLI

Help the user install, configure, and use the Moda CLI. The CLI provides two interfaces to Moda's conversation analytics:

1. **`moda` command** - Direct terminal access to analytics data
2. **`moda-mcp` command** - MCP server for AI assistants (Claude Code, Cursor, etc.)

## Installation

```bash
npm install -g @moda-ai/cli
```

Or use without installing:

```bash
npx -p @moda-ai/cli moda overview
```

### Environment

```bash
export MODA_API_KEY="moda_sk_..."                    # Required
export MODA_BASE_URL="https://modaflows.com"         # Optional, this is the default
```

## CLI Commands

### Dashboard Overview

```bash
moda overview                    # Last 7 days (default)
moda overview --days-back=30     # Last 30 days
```

Returns: total conversations, trend, frustration rate, tool failure summary, top clusters, recent activity.

### Browse Topic Clusters

```bash
moda clusters                              # Root-level categories
moda clusters --parent-id=node-abc         # Drill into a category
moda clusters --time-range=7d              # Filter by time
```

### List Conversations in a Cluster

```bash
moda cluster-conversations <node_id>
moda cluster-conversations node-abc --limit=20 --offset=10
```

### Search Conversations

```bash
moda conversations --search="error"
moda conversations --user-id=user_123
moda conversations --time-range=24h --environment=production
moda conversations --search="timeout" --limit=5
```

Filters: `--search`, `--cluster-id`, `--user-id`, `--time-range` (all|1h|3d|7d|24h|30d|90d), `--environment` (all|development|staging|production), `--limit`, `--offset`.

### Get Conversation Context

```bash
moda context <conversation_id>                    # Center on middle
moda context <conversation_id> --msg-index=5      # Center on message 5
moda context <conversation_id> --window=3         # 3 messages each side
```

Returns messages centered around the specified index: window messages before + center message + window messages after.

### User Frustrations

```bash
moda frustrations                          # Last 7 days
moda frustrations --days-back=14 --limit=20
```

Returns: summary stats, signal breakdown (exasperation, profanity, anger, sarcasm, giving_up, insult), each frustration with inline conversation context, user quotes, trajectory, and primary cause.

### Tool Failures

```bash
moda tool-failures                         # Overview of all failing tools
moda tool-failures --days-back=30
```

### Tool Failure Detail

```bash
moda tool-failure-detail <tool_name>
moda tool-failure-detail search --subtype=SEARCH_NO_RESULTS --limit=10
```

Returns: error subtype breakdown, example failures with inline conversation context.

## MCP Server Setup

### Claude Code

```bash
claude mcp add moda -- npx -y @moda-ai/cli
```

Or add to `.claude/settings.local.json` or `~/.claude/mcp.json`:

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

Restart Claude Code after adding. 8 tools will appear:

| MCP Tool | CLI Equivalent |
|----------|---------------|
| `moda_get_overview` | `moda overview` |
| `moda_get_clusters` | `moda clusters` |
| `moda_get_cluster_conversations` | `moda cluster-conversations <id>` |
| `moda_search_conversations` | `moda conversations` |
| `moda_get_conversation_context` | `moda context <id>` |
| `moda_get_frustrations` | `moda frustrations` |
| `moda_get_tool_failures` | `moda tool-failures` |
| `moda_get_tool_failure_detail` | `moda tool-failure-detail <name>` |

### Cursor / Other MCP Clients

```json
{
  "command": "npx",
  "args": ["-y", "@moda-ai/cli"],
  "env": {
    "MODA_API_KEY": "moda_sk_your_key_here"
  }
}
```

## Common Workflows

### Daily Health Check

```bash
moda overview --days-back=1
moda frustrations --days-back=1 --limit=5
moda tool-failures --days-back=1
```

### Debugging a Frustrated User

```bash
moda frustrations --days-back=7          # Find frustrated conversations
# Note the conversation_id from results
moda context <conversation_id>           # See what happened
moda context <conversation_id> --msg-index=<key_turn>  # Jump to frustration point
```

### Investigating Tool Failures

```bash
moda tool-failures                       # Which tools are breaking?
moda tool-failure-detail <tool_name>     # What errors? See examples
```

### Exploring User Intents

```bash
moda clusters                            # What are users doing?
moda clusters --parent-id=node-abc       # Drill into a category
moda cluster-conversations node-abc      # See example conversations
```

## Troubleshooting

**"MODA_API_KEY environment variable not set"**
- Set `MODA_API_KEY` in your shell or MCP config env block

**No data returned**
- Check your API key is valid at modaflows.com/settings
- Try `--days-back=30` for a wider time range
- Ensure conversations are being ingested

**Connection errors**
- Default base URL is `https://modaflows.com`
- Override with `MODA_BASE_URL` env var if needed

**CLI not found**
- Install globally: `npm install -g @moda-ai/cli`
- Or use npx: `npx -p @moda-ai/cli moda overview`

## Output Format

All CLI commands output JSON to stdout. Pipe to `jq` for formatting:

```bash
moda overview | jq '.frustrations'
moda frustrations | jq '.frustrations[].primary_cause'
moda tool-failures | jq '.tools[] | {name: .tool_name, failures: .failure_count}'
```
