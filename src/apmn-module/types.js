export const BPMN_STANDARD = [
  { type: '_startEvent',       label: 'Start',        icon: '●', color: '#16a34a', bpmnType: 'bpmn:StartEvent' },
  { type: '_endEvent',         label: 'End',          icon: '◉', color: '#dc2626', bpmnType: 'bpmn:EndEvent' },
  { type: '_serviceTask',      label: 'Service Task', icon: '⚙', color: '#475569', bpmnType: 'bpmn:ServiceTask' },
  { type: '_userTask',         label: 'User Task',    icon: '🙋', color: '#475569', bpmnType: 'bpmn:UserTask' },
  { type: '_manualTask',       label: 'Manual Task',  icon: '✋', color: '#475569', bpmnType: 'bpmn:ManualTask' },
  { type: '_exclusiveGateway', label: 'Decision',     icon: '◇', color: '#64748b', bpmnType: 'bpmn:ExclusiveGateway' },
  { type: '_parallelGateway',  label: 'Parallel',     icon: '⊕', color: '#0891b2', bpmnType: 'bpmn:ParallelGateway' },
  { type: '_timerEvent',       label: 'Timer',        icon: '⏱', color: '#92400e', bpmnType: 'bpmn:IntermediateCatchEvent' },
]

export const APMN_TASKS = [
  { type: 'agentTask',       label: 'Agent Task',        icon: '🤖', color: '#2563EB', bpmnType: 'bpmn:Task' },
  { type: 'ragTask',         label: 'RAG Task',          icon: '📚', color: '#7C3AED', bpmnType: 'bpmn:Task' },
  { type: 'mcpToolTask',     label: 'MCP Tool Task',     icon: '🔌', color: '#0891B2', bpmnType: 'bpmn:Task' },
  { type: 'humanInLoopTask', label: 'Human-in-Loop',     icon: '👤', color: '#EA580C', bpmnType: 'bpmn:Task' },
  { type: 'agentHandoff',    label: 'Agent Handoff',     icon: '↗',  color: '#1D4ED8', bpmnType: 'bpmn:Task' },
  { type: 'memoryTask',      label: 'Memory Task',       icon: '🧠', color: '#16A34A', bpmnType: 'bpmn:Task' },
  { type: 'vectorTask',      label: 'Vector Task',       icon: '⬡',  color: '#BE185D', bpmnType: 'bpmn:Task' },
  { type: 'observeEvent',    label: 'Observe Event',     icon: '📡', color: '#57534E', bpmnType: 'bpmn:Task' },
]

export const APMN_GATES = [
  { type: 'confidenceGate',   label: 'Confidence Gate',    icon: '◆', color: '#D97706', bpmnType: 'bpmn:ExclusiveGateway' },
  { type: 'reasoningGate',    label: 'Reasoning Gate',     icon: '◆', color: '#6D28D9', bpmnType: 'bpmn:ExclusiveGateway' },
  { type: 'modelVersionGate', label: 'Model Version Gate', icon: '◆', color: '#0F766E', bpmnType: 'bpmn:ExclusiveGateway' },
  { type: 'semanticGate',     label: 'Semantic Gate',      icon: '◆', color: '#1E40AF', bpmnType: 'bpmn:ExclusiveGateway' },
  { type: 'mcpGate',          label: 'MCP Gate',           icon: '◆', color: '#C2410C', bpmnType: 'bpmn:ExclusiveGateway' },
  { type: 'escapeGate',       label: 'Escape Gate',        icon: '◆', color: '#991B1B', bpmnType: 'bpmn:ExclusiveGateway' },
]

export const ALL_APMN_TYPES = [...APMN_TASKS, ...APMN_GATES, ...BPMN_STANDARD]

export function getTypeInfo(apmnType) {
  return ALL_APMN_TYPES.find(t => t.type === apmnType) || null
}

// Properties shown per APMN type in the panel
export const APMN_PROPS = {
  agentTask:       ['model', 'system_prompt', 'tools', 'temperature', 'confidence_threshold'],
  ragTask:         ['vector_store', 'top_k', 'similarity_threshold', 'query_from'],
  mcpToolTask:     ['server', 'tool', 'input_schema'],
  humanInLoopTask: ['timeout', 'escalate_to', 'confidence_threshold'],
  agentHandoff:    ['target_agent', 'model', 'context_pass'],
  memoryTask:      ['store', 'operation', 'key', 'value_from'],
  vectorTask:      ['vector_store', 'operation', 'embedding_model'],
  observeEvent:    ['platform', 'trace_name', 'attributes'],
  confidenceGate:  ['source', 'routes'],
  reasoningGate:   ['routes'],
  modelVersionGate:['routes'],
  semanticGate:    ['routes'],
  mcpGate:         ['server', 'tool', 'routes'],
  escapeGate:      ['watches', 'confidence_floor', 'triggers'],
}
