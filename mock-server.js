#!/usr/bin/env node

/**
 * Mock Data API server for testing MCP server
 * Simulates the backend Data API endpoints
 */

import express from 'express';

const app = express();
const PORT = 3002; // Use different port to avoid conflicts

// Middleware
app.use(express.json());

// Auth middleware (checks for API key header)
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !apiKey.startsWith('moda_sk_')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  next();
});

// Mock Data API endpoints

app.get('/api/v1/data/overview', (req, res) => {
  const daysBack = parseInt(req.query.days_back) || 7;
  res.json({
    period: { days: daysBack },
    conversations: {
      total: 1011,
      trend_pct: -2.3
    },
    frustrations: {
      total_analyzed: 500,
      frustrated: 20,
      at_risk: 80,
      rate_pct: 4.0
    },
    tool_failures: {
      total: 7800,
      conversations: 553,
      tools: 8
    },
    top_clusters: [
      {
        node_id: 'cluster-1',
        label: 'Video editing requests',
        summary: 'Users requesting edits to video timelines',
        keywords: ['edit', 'timeline', 'trim'],
        segment_count: 150
      }
    ],
    recent_activity: [
      {
        conversation_id: 'conv-123',
        summary: 'User needed help with video editing',
        timestamp: new Date().toISOString()
      }
    ]
  });
});

app.get('/api/v1/data/clusters', (req, res) => {
  const parentId = req.query.parent_id;
  res.json({
    cluster_run: {
      id: 'run-abc',
      num_categories: 5,
      num_clusters: 42,
      num_segments: 1500,
      completed_at: new Date().toISOString()
    },
    breadcrumb: parentId ? [
      { node_id: parentId, label: 'Parent Category' }
    ] : [],
    clusters: [
      {
        node_id: 'cluster-1',
        label: 'Video editing',
        summary: 'Requests to edit video timelines',
        keywords: ['edit', 'trim', 'cut'],
        node_type: 'cluster',
        segment_count: 85,
        has_children: false,
        depth: parentId ? 2 : 1
      },
      {
        node_id: 'cluster-2',
        label: 'Audio mixing',
        summary: 'Audio mixing and mastering requests',
        keywords: ['audio', 'mix', 'master'],
        node_type: 'cluster',
        segment_count: 65,
        has_children: true,
        depth: parentId ? 2 : 1
      }
    ],
    meta: {
      total_clusters: 42,
      total_segments: 1500
    }
  });
});

app.get('/api/v1/data/clusters/:nodeId/conversations', (req, res) => {
  const { nodeId } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  res.json({
    cluster: {
      node_id: nodeId,
      label: 'Video editing',
      summary: 'Requests to edit video timelines',
      segment_count: 85
    },
    conversations: [
      {
        conversation_id: 'conv-1',
        summary: 'User wanted to trim a 30s clip',
        message_count: 12
      },
      {
        conversation_id: 'conv-2',
        summary: 'User needed to add transitions',
        message_count: 8
      }
    ].slice(offset, offset + limit),
    pagination: {
      limit,
      offset,
      total: 85,
      has_more: offset + limit < 85
    }
  });
});

app.get('/api/v1/data/conversations', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  res.json({
    conversations: [
      {
        conversation_id: 'conv-1',
        summary: 'User needed to fix audio sync issues',
        message_count: 16,
        first_timestamp: new Date().toISOString(),
        last_timestamp: new Date().toISOString(),
        cluster_id: 'cluster-1',
        cluster_name: 'Video editing',
        environment: 'production'
      }
    ],
    pagination: {
      limit,
      offset,
      total: 1011,
      has_more: true
    }
  });
});

app.get('/api/v1/data/conversations/:conversationId/context', (req, res) => {
  const { conversationId } = req.params;
  const msgIndex = parseInt(req.query.msg_index) || 5;
  const window = parseInt(req.query.window) || 2;

  res.json({
    conversation_id: conversationId,
    total_messages: 16,
    summary: 'User needed to fix audio sync issues',
    context: {
      center_index: msgIndex,
      from_index: Math.max(0, msgIndex - window),
      to_index: msgIndex + window,
      messages: [
        {
          index: msgIndex - 1,
          role: 'user',
          content: 'The audio is still out of sync',
          tool_calls: [],
          tool_results: [],
          timestamp: new Date().toISOString()
        },
        {
          index: msgIndex,
          role: 'assistant',
          content: 'Let me adjust the offset',
          tool_calls: [
            {
              id: 'tc_1',
              name: 'edit',
              input: '{"action":"adjust_audio","offset":-0.5}'
            }
          ],
          tool_results: [],
          timestamp: new Date().toISOString()
        }
      ]
    }
  });
});

app.get('/api/v1/data/frustrations', (req, res) => {
  const daysBack = parseInt(req.query.days_back) || 7;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  res.json({
    summary: {
      total_analyzed: 500,
      frustrated_count: 20,
      at_risk_count: 80,
      frustration_rate_pct: 4.0
    },
    signal_breakdown: {
      exasperation: 12,
      profanity: 7,
      anger: 6,
      sarcasm: 2,
      giving_up: 2,
      insult: 1
    },
    frustrations: [
      {
        conversation_id: 'conv-123',
        is_frustrated: true,
        frustration_score: 1.0,
        risk_score: 1.0,
        trajectory: 'sustained',
        target: 'bot',
        primary_cause: 'Tool/interface issues with video editor',
        evidence: 'User exhibited exasperation about background not being visible',
        user_quotes: [
          { turn: 5, quote: 'i dont see it', signal: 'exasperation' }
        ],
        expressed_signals: ['exasperation', 'anger'],
        observed_signals: [],
        key_turns: [5, 7, 16],
        message_count: 49,
        detected_at: new Date().toISOString(),
        conversation: {
          conversation_id: 'conv-123',
          total_messages: 49,
          summary: 'User was editing a video...',
          context: {
            center_index: 5,
            from_index: 3,
            to_index: 7,
            messages: []
          }
        }
      }
    ],
    pagination: {
      limit,
      offset,
      total: 100,
      has_more: true
    }
  });
});

app.get('/api/v1/data/tool-failures', (req, res) => {
  const daysBack = parseInt(req.query.days_back) || 7;

  res.json({
    summary: {
      total: 7800,
      conversations: 553,
      tools: 8
    },
    tools: [
      {
        tool_name: 'search',
        failure_count: 3463,
        conversation_count: 268,
        top_error: 'SEARCH_NO_RESULTS: Error: No Sources found',
        last_seen: new Date().toISOString()
      },
      {
        tool_name: 'compose',
        failure_count: 2752,
        conversation_count: 313,
        top_error: 'TRACK_NOT_FOUND: trackId "1rWLAC..."',
        last_seen: new Date().toISOString()
      }
    ]
  });
});

app.get('/api/v1/data/tool-failures/:toolName', (req, res) => {
  const { toolName } = req.params;
  const subtype = req.query.subtype;
  const limit = parseInt(req.query.limit) || 5;
  const offset = parseInt(req.query.offset) || 0;

  res.json({
    tool_name: toolName,
    subtypes: [
      {
        subtype: 'SEARCH_NO_RESULTS',
        count: 2100,
        conversation_count: 180,
        sample_error: 'SEARCH_NO_RESULTS: Error: No Sources found',
        last_seen: new Date().toISOString()
      }
    ],
    examples: [
      {
        failure_id: 'fail-123',
        conversation_id: 'conv-456',
        error_message: 'SEARCH_NO_RESULTS: Error: No Sources found',
        error_subtype: 'SEARCH_NO_RESULTS',
        tool_input: '{"query":"cloned voices","type":"voice"}',
        msg_index: 5,
        detected_at: new Date().toISOString(),
        conversation: {
          conversation_id: 'conv-456',
          total_messages: 17,
          summary: 'User wanted to find cloned voices',
          context: {
            center_index: 5,
            from_index: 3,
            to_index: 7,
            messages: []
          }
        }
      }
    ],
    pagination: {
      limit,
      offset,
      total: 2100,
      has_more: true
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Mock Data API server running on http://localhost:${PORT}`);
  console.log('Test with:');
  console.log(`  curl http://localhost:${PORT}/api/v1/data/overview -H "x-api-key: moda_sk_test"`);
});
