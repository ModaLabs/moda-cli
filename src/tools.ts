// src/tools.ts

export function getToolDefinitions() {
  return [
    {
      name: 'moda_get_overview',
      description: 'Get dashboard overview with KPIs, top clusters, and recent activity. Start here to understand the current state of your conversations.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          days_back: {
            type: 'number',
            description: 'Number of days to look back (1-90)',
            default: 7,
          },
        },
      },
    },
    {
      name: 'moda_get_clusters',
      description: 'Browse the topic cluster hierarchy. Omit parent_id to get root-level categories, or provide it to drill down.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          parent_id: {
            type: 'string',
            description: 'Parent node ID to list children of (omit for root)',
          },
          time_range: {
            type: 'string',
            // FIX: expanded enum to match backend
            enum: ['all', '1h', '3d', '7d', '24h', '30d', '90d'],
            description: 'Time range filter',
            default: 'all',
          },
        },
      },
    },
    {
      name: 'moda_get_cluster_conversations',
      description: 'List conversations belonging to a specific cluster. Use node_id from cluster listing.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          node_id: { type: 'string', description: 'Cluster node ID' },
          limit: { type: 'number', description: 'Max results per page (1-100)', default: 10 },
          offset: { type: 'number', description: 'Pagination offset', default: 0 },
        },
        required: ['node_id'],
      },
    },
    {
      name: 'moda_search_conversations',
      // FIX: note that cluster_id filtering is not yet implemented in backend
      description: 'Search and filter conversations. Supports full-text search, filtering by user, time range, and environment.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          search: { type: 'string', description: 'Full-text search in summaries' },
          cluster_id: { type: 'string', description: 'Filter by cluster node ID (not yet implemented)' },
          user_id: { type: 'string', description: 'Filter by user ID' },
          time_range: {
            type: 'string',
            // FIX: add '3d' to match backend
            enum: ['all', '1h', '3d', '24h', '7d', '30d', '90d'],
            description: 'Time range filter',
            default: 'all',
          },
          environment: {
            type: 'string',
            enum: ['all', 'development', 'staging', 'production'],
            description: 'Environment filter',
            default: 'all',
          },
          limit: { type: 'number', description: 'Max results per page (1-100)', default: 20 },
          offset: { type: 'number', description: 'Pagination offset', default: 0 },
        },
      },
    },
    {
      name: 'moda_get_conversation_context',
      description: 'Get windowed conversation context (max 5 messages). Returns summary and messages around a center point.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          conversation_id: { type: 'string', description: 'Conversation ID' },
          msg_index: { type: 'number', description: 'Message index to center on (0-indexed, omit for middle)' },
          window: { type: 'number', description: 'Messages before and after center (1-5)', default: 2 },
        },
        required: ['conversation_id'],
      },
    },
    {
      name: 'moda_get_frustrations',
      description: 'Get user frustration detections with inline conversation evidence, signal breakdown, and user quotes. Returns frustrated + at-risk conversations.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          days_back: { type: 'number', description: 'Number of days to look back (1-90)', default: 7 },
          // FIX: corrected max from 100 to 20
          limit: { type: 'number', description: 'Max results per page (1-20)', default: 10 },
          offset: { type: 'number', description: 'Pagination offset', default: 0 },
        },
      },
    },
    {
      name: 'moda_get_tool_failures',
      description: 'Get tool failure overview showing which tools are failing and how much. Start here before drilling into specific tools.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          days_back: { type: 'number', description: 'Number of days to look back (1-90)', default: 7 },
        },
      },
    },
    {
      name: 'moda_get_tool_failure_detail',
      description: 'Get per-tool failure detail with subtype breakdown and examples with inline conversation context. Use tool_name from overview.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tool_name: { type: 'string', description: 'Name of the tool to inspect' },
          subtype: { type: 'string', description: 'Filter by error subtype (optional)' },
          days_back: { type: 'number', description: 'Number of days to look back (1-90)', default: 7 },
          // FIX: corrected max from 100 to 20
          limit: { type: 'number', description: 'Max examples to return (1-20)', default: 5 },
          offset: { type: 'number', description: 'Pagination offset', default: 0 },
        },
        required: ['tool_name'],
      },
    },
  ];
}
