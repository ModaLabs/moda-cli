// src/schemas.ts
import { z } from 'zod';

export const OverviewSchema = z.object({
  days_back: z.number().min(1).max(90).default(7).optional(),
});

// FIX: Add '1h', '24h', '90d' to match backend ClustersQueryDto
export const ClustersSchema = z.object({
  parent_id: z.string().optional(),
  time_range: z.enum(['all', '1h', '3d', '7d', '24h', '30d', '90d']).default('all').optional(),
});

export const ClusterConversationsSchema = z.object({
  node_id: z.string(),
  limit: z.number().min(1).max(100).default(10).optional(),
  offset: z.number().min(0).default(0).optional(),
});

// FIX: Add '3d' to match backend ConversationsQueryDto
export const ConversationsSchema = z.object({
  search: z.string().optional(),
  cluster_id: z.string().optional(),
  user_id: z.string().optional(),
  time_range: z.enum(['all', '1h', '3d', '24h', '7d', '30d', '90d']).default('all').optional(),
  environment: z.enum(['all', 'development', 'staging', 'production']).default('all').optional(),
  limit: z.number().min(1).max(100).default(20).optional(),
  offset: z.number().min(0).default(0).optional(),
});

export const ContextSchema = z.object({
  conversation_id: z.string(),
  msg_index: z.number().min(0).optional(),
  window: z.number().min(1).max(5).default(2).optional(),
});

// FIX: Change limit max from 100 to 20 to match backend clamp
export const FrustrationsSchema = z.object({
  days_back: z.number().min(1).max(90).default(7).optional(),
  limit: z.number().min(1).max(20).default(10).optional(),
  offset: z.number().min(0).default(0).optional(),
});

export const ToolFailuresSchema = z.object({
  days_back: z.number().min(1).max(90).default(7).optional(),
});

// FIX: Change limit max from 100 to 20 to match backend clamp
export const ToolFailureDetailSchema = z.object({
  tool_name: z.string(),
  subtype: z.string().optional(),
  days_back: z.number().min(1).max(90).default(7).optional(),
  limit: z.number().min(1).max(20).default(5).optional(),
  offset: z.number().min(0).default(0).optional(),
});
