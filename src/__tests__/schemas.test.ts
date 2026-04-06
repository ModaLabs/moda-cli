import { describe, it, expect } from 'vitest';
import {
  OverviewSchema,
  ClustersSchema,
  ClusterConversationsSchema,
  ConversationsSchema,
  ContextSchema,
  FrustrationsSchema,
  ToolFailuresSchema,
  ToolFailureDetailSchema,
} from '../schemas.js';

describe('OverviewSchema', () => {
  it('accepts valid days_back', () => {
    expect(OverviewSchema.parse({ days_back: 30 })).toEqual({ days_back: 30 });
  });

  it('accepts empty object with defaults', () => {
    expect(OverviewSchema.parse({})).toEqual({});
  });

  it('rejects days_back > 90', () => {
    expect(() => OverviewSchema.parse({ days_back: 91 })).toThrow();
  });

  it('rejects days_back < 1', () => {
    expect(() => OverviewSchema.parse({ days_back: 0 })).toThrow();
  });
});

describe('ClustersSchema', () => {
  it('accepts all backend time_range values', () => {
    for (const val of ['all', '1h', '3d', '7d', '24h', '30d', '90d']) {
      expect(ClustersSchema.parse({ time_range: val }).time_range).toBe(val);
    }
  });

  it('rejects invalid time_range', () => {
    expect(() => ClustersSchema.parse({ time_range: '2d' })).toThrow();
  });
});

describe('ConversationsSchema', () => {
  it('accepts 3d time_range (previously missing)', () => {
    expect(ConversationsSchema.parse({ time_range: '3d' }).time_range).toBe('3d');
  });

  it('accepts all valid time_range values', () => {
    for (const val of ['all', '1h', '3d', '24h', '7d', '30d', '90d']) {
      expect(ConversationsSchema.parse({ time_range: val }).time_range).toBe(val);
    }
  });
});

describe('FrustrationsSchema', () => {
  it('accepts limit up to 20', () => {
    expect(FrustrationsSchema.parse({ limit: 20 }).limit).toBe(20);
  });

  it('rejects limit > 20 (previously allowed 100)', () => {
    expect(() => FrustrationsSchema.parse({ limit: 21 })).toThrow();
  });
});

describe('ToolFailureDetailSchema', () => {
  it('accepts limit up to 20', () => {
    expect(ToolFailureDetailSchema.parse({ tool_name: 'search', limit: 20 }).limit).toBe(20);
  });

  it('rejects limit > 20 (previously allowed 100)', () => {
    expect(() => ToolFailureDetailSchema.parse({ tool_name: 'search', limit: 21 })).toThrow();
  });

  it('requires tool_name', () => {
    expect(() => ToolFailureDetailSchema.parse({})).toThrow();
  });
});

describe('ClusterConversationsSchema', () => {
  it('requires node_id', () => {
    expect(() => ClusterConversationsSchema.parse({})).toThrow();
  });

  it('accepts valid input', () => {
    const result = ClusterConversationsSchema.parse({ node_id: 'cluster-1', limit: 10, offset: 0 });
    expect(result.node_id).toBe('cluster-1');
  });
});

describe('ContextSchema', () => {
  it('requires conversation_id', () => {
    expect(() => ContextSchema.parse({})).toThrow();
  });

  it('accepts msg_index of 0', () => {
    expect(ContextSchema.parse({ conversation_id: 'conv-1', msg_index: 0 }).msg_index).toBe(0);
  });

  it('rejects window > 5', () => {
    expect(() => ContextSchema.parse({ conversation_id: 'conv-1', window: 6 })).toThrow();
  });
});

describe('ToolFailuresSchema', () => {
  it('accepts valid days_back', () => {
    expect(ToolFailuresSchema.parse({ days_back: 14 }).days_back).toBe(14);
  });
});
