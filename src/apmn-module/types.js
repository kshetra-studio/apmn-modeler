export const BPMN_STANDARD = [
  {
    type: '_startEvent', label: 'Start Event', icon: '●', color: '#16a34a',
    bpmnType: 'bpmn:StartEvent',
    description: 'Marks the beginning of a process flow.',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_endEvent', label: 'End Event', icon: '◉', color: '#dc2626',
    bpmnType: 'bpmn:EndEvent',
    description: 'Marks the end of a process flow.',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_serviceTask', label: 'Service Task', icon: '⚙', color: '#475569',
    bpmnType: 'bpmn:ServiceTask',
    description: 'Automated task executed by a system or service.',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_userTask', label: 'User Task', icon: '🙋', color: '#475569',
    bpmnType: 'bpmn:UserTask',
    description: 'Task requiring human input or action.',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_manualTask', label: 'Manual Task', icon: '✋', color: '#475569',
    bpmnType: 'bpmn:ManualTask',
    description: 'Physical task done without system assistance.',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_scriptTask', label: 'Script Task', icon: '📜', color: '#334155',
    bpmnType: 'bpmn:ScriptTask',
    description: 'Task executed by a script or rule engine.',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_businessRuleTask', label: 'Business Rule', icon: '📋', color: '#334155',
    bpmnType: 'bpmn:BusinessRuleTask',
    description: 'Applies a business rule or decision table.',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_exclusiveGateway', label: 'Decision', icon: '◇', color: '#64748b',
    bpmnType: 'bpmn:ExclusiveGateway',
    description: 'Routes flow down exactly one path based on a condition (XOR).',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_parallelGateway', label: 'Parallel', icon: '⊕', color: '#0891b2',
    bpmnType: 'bpmn:ParallelGateway',
    description: 'Splits flow into multiple parallel branches (AND).',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_inclusiveGateway', label: 'Inclusive', icon: '⊙', color: '#0e7490',
    bpmnType: 'bpmn:InclusiveGateway',
    description: 'Routes flow down one or more paths based on conditions (OR).',
    docsUrl: 'https://apmn.kshetra.studio',
  },
  {
    type: '_timerEvent', label: 'Timer', icon: '⏱', color: '#92400e',
    bpmnType: 'bpmn:IntermediateCatchEvent',
    description: 'Pauses flow until a time condition is met.',
    docsUrl: 'https://apmn.kshetra.studio',
  },
]

// Maps camelCase APMN type → apmn: prefixed moddle type (set by moddleExtension)
export const APMN_TYPE_MAP = {
  agentTask:        'apmn:AgentTask',
  ragTask:          'apmn:RagTask',
  mcpToolTask:      'apmn:McpToolTask',
  humanInLoopTask:  'apmn:HumanInLoopTask',
  agentHandoff:     'apmn:AgentHandoff',
  memoryTask:       'apmn:MemoryTask',
  vectorTask:       'apmn:VectorTask',
  observeEvent:     'apmn:ObserveEvent',
  confidenceGate:   'apmn:ConfidenceGate',
  reasoningGate:    'apmn:ReasoningGate',
  modelVersionGate: 'apmn:ModelVersionGate',
  semanticGate:     'apmn:SemanticGate',
  mcpGate:          'apmn:McpGate',
  escapeGate:       'apmn:EscapeGate',
}

export const APMN_TASKS = [
  {
    type: 'agentTask', label: 'Agent Task', icon: '🤖', color: '#2563EB',
    bpmnType: 'apmn:AgentTask',
    description: 'LLM-driven task. Specify model, system prompt, tools and temperature.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#agenttask',
  },
  {
    type: 'ragTask', label: 'RAG Task', icon: '📚', color: '#7C3AED',
    bpmnType: 'apmn:RagTask',
    description: 'Retrieval-augmented generation. Queries a vector store before responding.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#ragtask',
  },
  {
    type: 'mcpToolTask', label: 'MCP Tool Task', icon: '🔌', color: '#0891B2',
    bpmnType: 'apmn:McpToolTask',
    description: 'Invokes a tool on an MCP server. Specify server URL and tool name.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#mcptooltask',
  },
  {
    type: 'humanInLoopTask', label: 'Human-in-Loop', icon: '👤', color: '#EA580C',
    bpmnType: 'apmn:HumanInLoopTask',
    description: 'Agent proposes, human approves. Supports timeout and escalation.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#humaninlooptask',
  },
  {
    type: 'agentHandoff', label: 'Agent Handoff', icon: '↗', color: '#1D4ED8',
    bpmnType: 'apmn:AgentHandoff',
    description: 'Delegates to a specialist sub-agent. Enables multi-agent orchestration.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#agenthandoff',
  },
  {
    type: 'memoryTask', label: 'Memory Task', icon: '🧠', color: '#16A34A',
    bpmnType: 'apmn:MemoryTask',
    description: 'Reads or writes agent memory (session or long-term store).',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#memorytask',
  },
  {
    type: 'vectorTask', label: 'Vector Task', icon: '⬡', color: '#BE185D',
    bpmnType: 'apmn:VectorTask',
    description: 'Embeds content into or queries a vector store directly.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#vectortask',
  },
  {
    type: 'observeEvent', label: 'Observe Event', icon: '📡', color: '#57534E',
    bpmnType: 'apmn:ObserveEvent',
    description: 'Emits a trace or span to an observability platform (LangFuse, OTEL).',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#observeevent',
  },
]

export const APMN_GATES = [
  {
    type: 'confidenceGate', label: 'Confidence Gate', icon: '◎', color: '#D97706',
    bpmnType: 'apmn:ConfidenceGate',
    description: 'Routes on agent confidence score (0–1). Replace binary yes/no with high/medium/low paths.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#confidencegate',
  },
  {
    type: 'reasoningGate', label: 'Reasoning Gate', icon: '?', color: '#6D28D9',
    bpmnType: 'apmn:ReasoningGate',
    description: 'Routes by parsing LLM chain-of-thought output. No hard-coded condition needed.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#reasoninggate',
  },
  {
    type: 'modelVersionGate', label: 'Model Version Gate', icon: '⇄', color: '#0F766E',
    bpmnType: 'apmn:ModelVersionGate',
    description: 'A/B or canary route between model versions. Safe model upgrade pattern.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#modelversiongate',
  },
  {
    type: 'semanticGate', label: 'Semantic Gate', icon: '≈', color: '#1E40AF',
    bpmnType: 'apmn:SemanticGate',
    description: 'Routes by vector similarity — input matched against intent clusters.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#semanticgate',
  },
  {
    type: 'mcpGate', label: 'MCP Gate', icon: '⚡', color: '#C2410C',
    bpmnType: 'apmn:McpGate',
    description: 'Calls an MCP tool and routes on result: pass / fail / review.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#mcpgate',
  },
  {
    type: 'escapeGate', label: 'Escape Gate', icon: '↑', color: '#991B1B',
    bpmnType: 'apmn:EscapeGate',
    description: 'Auto-escalation: if agent fails, times out, or hits confidence floor — route to human.',
    docsUrl: 'https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#escapegate',
  },
]

export const ALL_APMN_TYPES = [...APMN_TASKS, ...APMN_GATES, ...BPMN_STANDARD]

export function getTypeInfo(apmnType) {
  return ALL_APMN_TYPES.find(t => t.type === apmnType) || null
}

export const APMN_PROPS = {
  agentTask:        ['model', 'system_prompt', 'tools', 'temperature', 'confidence_threshold'],
  ragTask:          ['vector_store', 'top_k', 'similarity_threshold', 'query_from'],
  mcpToolTask:      ['server', 'tool', 'input_schema'],
  humanInLoopTask:  ['timeout', 'escalate_to', 'confidence_threshold'],
  agentHandoff:     ['target_agent', 'model', 'context_pass'],
  memoryTask:       ['store', 'operation', 'key', 'value_from'],
  vectorTask:       ['vector_store', 'operation', 'embedding_model'],
  observeEvent:     ['platform', 'trace_name', 'attributes'],
  confidenceGate:   ['source', 'routes'],
  reasoningGate:    ['routes'],
  modelVersionGate: ['routes'],
  semanticGate:     ['routes'],
  mcpGate:          ['server', 'tool', 'routes'],
  escapeGate:       ['watches', 'confidence_floor', 'triggers'],
}
