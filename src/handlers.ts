// src/handlers.ts
import { z } from 'zod';
import { callDataAPI } from './api-client.js';
import {
  OverviewSchema,
  ClustersSchema,
  ClusterConversationsSchema,
  ConversationsSchema,
  ContextSchema,
  FrustrationsSchema,
  ToolFailuresSchema,
  ToolFailureDetailSchema,
} from './schemas.js';

export async function handleToolCall(name: string, args: unknown) {
  try {
    switch (name) {
      case 'moda_get_overview': {
        const params = OverviewSchema.parse(args);
        const queryString = params.days_back ? `?days_back=${params.days_back}` : '';
        const data = await callDataAPI(`/overview${queryString}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }

      case 'moda_get_clusters': {
        const params = ClustersSchema.parse(args);
        const query = new URLSearchParams();
        if (params.parent_id) query.set('parent_id', params.parent_id);
        if (params.time_range) query.set('time_range', params.time_range);
        const queryString = query.toString() ? `?${query.toString()}` : '';
        const data = await callDataAPI(`/clusters${queryString}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }

      case 'moda_get_cluster_conversations': {
        const params = ClusterConversationsSchema.parse(args);
        const query = new URLSearchParams();
        if (params.limit) query.set('limit', params.limit.toString());
        // FIX: use !== undefined instead of falsy check so offset=0 is included
        if (params.offset !== undefined) query.set('offset', params.offset.toString());
        const queryString = query.toString() ? `?${query.toString()}` : '';
        const data = await callDataAPI(`/clusters/${params.node_id}/conversations${queryString}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }

      case 'moda_search_conversations': {
        const params = ConversationsSchema.parse(args);
        const query = new URLSearchParams();
        if (params.search) query.set('search', params.search);
        if (params.cluster_id) query.set('cluster_id', params.cluster_id);
        if (params.user_id) query.set('user_id', params.user_id);
        if (params.time_range) query.set('time_range', params.time_range);
        if (params.environment) query.set('environment', params.environment);
        if (params.limit) query.set('limit', params.limit.toString());
        // FIX: use !== undefined instead of falsy check
        if (params.offset !== undefined) query.set('offset', params.offset.toString());
        const queryString = query.toString() ? `?${query.toString()}` : '';
        const data = await callDataAPI(`/conversations${queryString}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }

      case 'moda_get_conversation_context': {
        const params = ContextSchema.parse(args);
        const query = new URLSearchParams();
        if (params.msg_index !== undefined) query.set('msg_index', params.msg_index.toString());
        if (params.window) query.set('window', params.window.toString());
        const queryString = query.toString() ? `?${query.toString()}` : '';
        const data = await callDataAPI(`/conversations/${params.conversation_id}/context${queryString}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }

      case 'moda_get_frustrations': {
        const params = FrustrationsSchema.parse(args);
        const query = new URLSearchParams();
        if (params.days_back) query.set('days_back', params.days_back.toString());
        if (params.limit) query.set('limit', params.limit.toString());
        // FIX: use !== undefined instead of falsy check
        if (params.offset !== undefined) query.set('offset', params.offset.toString());
        const queryString = query.toString() ? `?${query.toString()}` : '';
        const data = await callDataAPI(`/frustrations${queryString}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }

      case 'moda_get_tool_failures': {
        const params = ToolFailuresSchema.parse(args);
        const queryString = params.days_back ? `?days_back=${params.days_back}` : '';
        const data = await callDataAPI(`/tool-failures${queryString}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }

      case 'moda_get_tool_failure_detail': {
        const params = ToolFailureDetailSchema.parse(args);
        const query = new URLSearchParams();
        if (params.subtype) query.set('subtype', params.subtype);
        if (params.days_back) query.set('days_back', params.days_back.toString());
        if (params.limit) query.set('limit', params.limit.toString());
        // FIX: use !== undefined instead of falsy check
        if (params.offset !== undefined) query.set('offset', params.offset.toString());
        const queryString = query.toString() ? `?${query.toString()}` : '';
        const data = await callDataAPI(`/tool-failures/${params.tool_name}${queryString}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid arguments: ${JSON.stringify(error.errors)}`);
    }
    throw error;
  }
}
