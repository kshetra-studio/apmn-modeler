import yaml from 'js-yaml'
import { layoutProcess } from 'bpmn-auto-layout'
import { getTypeInfo, APMN_TASKS, APMN_GATES } from '../apmn-module/types.js'

// ── Export: modeler → APMN YAML ─────────────────────────────────────────────

export function exportToAPMN(modeler) {
  const elementRegistry = modeler.get('elementRegistry')
  const canvas = modeler.get('canvas')
  const rootElement = canvas.getRootElement()

  const nodes = []
  const flows = []

  elementRegistry.forEach(element => {
    if (element === rootElement) return
    const bo = element.businessObject
    if (!bo) return

    if (bo.$type === 'bpmn:SequenceFlow') {
      const flow = {
        id: bo.id,
        source: bo.sourceRef?.id,
        target: bo.targetRef?.id,
      }
      if (bo.name) flow.name = bo.name
      if (bo.conditionExpression) flow.condition = bo.conditionExpression.body
      flows.push(flow)
      return
    }

    const apmnType = bo.$attrs?.['apmn:type'] || _inferApmnType(bo)
    const node = { id: bo.id, type: apmnType }
    if (bo.name) node.name = bo.name

    for (const [k, v] of Object.entries(bo.$attrs || {})) {
      if (k !== 'apmn:type') node[k.replace('apmn:', '')] = v
    }

    nodes.push(node)
  })

  const processId = rootElement.businessObject?.id || 'process_1'
  const processName = rootElement.businessObject?.name || 'Unnamed Process'

  const doc = {
    process: { id: processId, name: processName, targets: ['orkes', 'google_adk'] },
    nodes,
    flows,
  }

  return `# APMN v0.1 — exported from APMN Modeler\n# spec: https://github.com/kshetra-studio/apmn\n\n` +
    yaml.dump(doc, { lineWidth: 120, sortKeys: false })
}

function _inferApmnType(bo) {
  const t = bo.$type
  if (t === 'bpmn:StartEvent') return 'startEvent'
  if (t === 'bpmn:EndEvent') return 'endEvent'
  if (t === 'bpmn:ParallelGateway') return 'parallelGateway'
  if (t === 'bpmn:ExclusiveGateway') return 'exclusiveGateway'
  if (t === 'bpmn:UserTask') return 'humanInLoopTask'
  if (t === 'bpmn:ManualTask') return 'manualTask'
  if (t === 'bpmn:ServiceTask') return 'agentTask'
  if (t === 'bpmn:ScriptTask') return 'agentTask'
  if (t === 'bpmn:Task') return 'agentTask'
  if (t === 'bpmn:IntermediateCatchEvent') return 'timerEvent'
  return 'agentTask'
}

// ── Import: APMN YAML → modeler ─────────────────────────────────────────────

export async function importFromAPMN(modeler, yamlText) {
  const doc = yaml.load(yamlText)
  const { xml: rawXml, useLanes } = apmnToBpmn(doc)
  // Lane diagrams use custom DI coordinates; flat diagrams use bpmn-auto-layout
  const laidOutXml = useLanes ? rawXml : await layoutProcess(rawXml)
  await modeler.importXML(laidOutXml)
  // fit-viewport can throw on certain laid-out bounding boxes (e.g. several
  // branches converging on one node with no explicit join gateway can yield
  // a degenerate bounding box) — that's a cosmetic auto-fit failure, not a
  // reason to treat the whole import as failed and silently show the wrong
  // diagram. zoom(1) is NOT a safe fallback here: on a fresh import with no
  // viewbox ever established, it still routes through the same buggy
  // fit-viewport computation internally and throws identically. Set an
  // explicit numeric viewbox instead — that bypasses fit-viewport math
  // entirely. The user can still scroll/zoom manually afterwards.
  const canvas = modeler.get('canvas')
  try {
    canvas.zoom('fit-viewport', 'auto')
  } catch (e) {
    console.error('[APMN] fit-viewport failed after import, recovering with an explicit viewbox:', e)
    try { canvas.viewbox({ x: 0, y: 0, width: 1200, height: 800 }) } catch (_) {}
  }
}

// ── Swimlane lane assignment ─────────────────────────────────────────────────
// Auto-infer which visual lane a node belongs to based on its APMN type.
// Lanes are only emitted when at least one non-AI lane is present (i.e. a pure
// AI flow stays flat without any laneSet so it looks cleaner).

const _LANE_KEY = {
  // AI Orchestrator — also receives all gateways and control-flow events
  agentTask: 'ai', ragTask: 'ai', memoryTask: 'ai', vectorTask: 'ai', agentHandoff: 'ai',
  startEvent: 'ai', endEvent: 'ai', _startEvent: 'ai', _endEvent: 'ai',
  timerEvent: 'ai', _timerEvent: 'ai',
  parallelGateway: 'ai', exclusiveGateway: 'ai',
  _exclusiveGateway: 'ai', _parallelGateway: 'ai', _inclusiveGateway: 'ai',
  confidenceGate: 'ai', reasoningGate: 'ai', escapeGate: 'ai',
  modelVersionGate: 'ai', semanticGate: 'ai', mcpGate: 'ai',
  // External Systems (MCP + standard automation tasks)
  mcpToolTask: 'external',
  _serviceTask: 'external', _scriptTask: 'external', _businessRuleTask: 'external',
  // Human
  humanInLoopTask: 'human', _userTask: 'human', _manualTask: 'human',
  // Observability
  observeEvent: 'observe',
}

const _LANE_DEFS = {
  ai:       { id: 'Lane_AI',       name: 'AI Orchestrator' },
  external: { id: 'Lane_External', name: 'External Systems' },
  human:    { id: 'Lane_Human',    name: 'Human Review' },
  observe:  { id: 'Lane_Observe',  name: 'Observability' },
}

function _laneFor(type) { return _LANE_KEY[type] || 'ai' }

function apmnToBpmn(doc) {
  const proc = doc.process || {}
  const nodes = doc.nodes || []
  const flows = doc.flows || []

  // Pre-compute incoming/outgoing per node — required by bpmn-auto-layout
  const incoming = {}
  const outgoing = {}
  for (const n of nodes) { incoming[n.id] = []; outgoing[n.id] = [] }
  for (const f of flows) {
    if (outgoing[f.source]) outgoing[f.source].push(f.id)
    if (incoming[f.target]) incoming[f.target].push(f.id)
  }

  const shapes = nodes.map(n => _nodeToXml(n, incoming[n.id] || [], outgoing[n.id] || []))
  const edges  = flows.map(f => _flowToXml(f))

  // ── Swimlanes: activate when at least one non-AI lane type is present
  const presentLaneKeys = new Set(nodes.map(n => _laneFor(n.type)))
  const nonAiPresent = ['external', 'human', 'observe'].some(k => presentLaneKeys.has(k))
  const useLanes = nonAiPresent

  // Build laneSet XML (process model, no DI)
  let laneSetXml = ''
  let diagramXml = `  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${_esc(proc.id || 'process_1')}"/>
  </bpmndi:BPMNDiagram>`

  if (useLanes) {
    const activeLanes = ['ai', 'external', 'human', 'observe'].filter(k => presentLaneKeys.has(k))

    // Build laneSet for process model
    const laneElems = activeLanes.map(key => {
      const def = _LANE_DEFS[key]
      const refs = nodes
        .filter(n => _laneFor(n.type) === key)
        .map(n => `      <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`)
        .join('\n')
      return `    <bpmn:lane id="${def.id}" name="${_esc(def.name)}">\n${refs}\n    </bpmn:lane>`
    })
    laneSetXml = `\n    <bpmn:laneSet id="LaneSet_1">\n${laneElems.join('\n')}\n    </bpmn:laneSet>`

    // Build custom DI layout so bpmn-js can render lanes + nodes
    diagramXml = _buildLaneDiagram(nodes, flows, activeLanes, proc.id || 'process_1')
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:apmn="http://apmn.kshetra.studio/ns/1.0"
  id="Definitions_1" targetNamespace="http://apmn.kshetra.studio/process">
  <bpmn:process id="${_esc(proc.id || 'process_1')}" name="${_esc(proc.name || '')}" isExecutable="false">${laneSetXml}
    ${shapes.join('\n    ')}
    ${edges.join('\n    ')}
  </bpmn:process>
${diagramXml}
</bpmn:definitions>`

  return { xml, useLanes }
}

// ── Custom layout for swimlane diagrams ──────────────────────────────────────
// bpmn-auto-layout doesn't handle lanes, so we build explicit DI coordinates.
// Algorithm: topological BFS rank → column (X), lane category → row (Y).

const _SHAPE_SIZE = {
  task:    { w: 100, h: 80 },
  gateway: { w: 50,  h: 50 },
  event:   { w: 36,  h: 36 },
}

function _shapeSize(type) {
  const bpmnType = _bpmnTypeFor(type)
  if (bpmnType.includes('Gateway')) return _SHAPE_SIZE.gateway
  if (bpmnType.includes('Event'))   return _SHAPE_SIZE.event
  return _SHAPE_SIZE.task
}

function _buildLaneDiagram(nodes, flows, activeLanes, processId) {
  const LANE_LABEL_W = 30   // width of the lane name label strip
  const LANE_H       = 160  // height of each lane band
  const H_STEP       = 150  // horizontal step between node centres
  const START_X      = LANE_LABEL_W + 90  // first node centre X
  const MARGIN_Y     = 0

  // ── Topological rank via BFS from start events ────────────────────────────
  const outTargets = {}  // nodeId → [targetId, ...]
  for (const n of nodes) outTargets[n.id] = []
  for (const f of flows) {
    if (outTargets[f.source]) outTargets[f.source].push(f.target)
  }

  const rank = {}
  const queue = nodes
    .filter(n => n.type === 'startEvent' || n.type === '_startEvent')
    .map(n => n.id)
  for (const id of queue) rank[id] = 0
  const visited = new Set(queue)
  let qi = 0
  while (qi < queue.length) {
    const cur = queue[qi++]
    for (const tgt of (outTargets[cur] || [])) {
      const newRank = (rank[cur] || 0) + 1
      if (!visited.has(tgt)) {
        rank[tgt] = newRank
        visited.add(tgt)
        queue.push(tgt)
      } else if (newRank > rank[tgt]) {
        rank[tgt] = newRank  // push later in flow if multiple paths converge
      }
    }
  }
  // Any unreachable node gets rank 0
  for (const n of nodes) { if (rank[n.id] === undefined) rank[n.id] = 0 }

  const laneIndex = {}
  activeLanes.forEach((k, i) => { laneIndex[k] = i })

  // ── Node centre positions ─────────────────────────────────────────────────
  const cx = {}  // nodeId → centre x
  const cy = {}  // nodeId → centre y
  for (const n of nodes) {
    cx[n.id] = START_X + (rank[n.id] || 0) * H_STEP
    const li = laneIndex[_laneFor(n.type)] ?? 0
    cy[n.id] = MARGIN_Y + li * LANE_H + LANE_H / 2
  }

  const maxRank = Math.max(0, ...Object.values(rank))
  const totalW  = START_X + maxRank * H_STEP + 100
  const totalH  = MARGIN_Y + activeLanes.length * LANE_H

  // ── BPMNShape for lanes ───────────────────────────────────────────────────
  const laneShapes = activeLanes.map((key, i) => {
    const def = _LANE_DEFS[key]
    const y = MARGIN_Y + i * LANE_H
    return `    <bpmndi:BPMNShape id="${def.id}_di" bpmnElement="${def.id}" isHorizontal="true">
      <dc:Bounds x="${LANE_LABEL_W}" y="${y}" width="${totalW}" height="${LANE_H}"/>
      <bpmndi:BPMNLabel/>
    </bpmndi:BPMNShape>`
  }).join('\n')

  // ── BPMNShape for nodes ───────────────────────────────────────────────────
  const nodeShapes = nodes.map(n => {
    const { w, h } = _shapeSize(n.type)
    const x = cx[n.id] - w / 2
    const y = cy[n.id] - h / 2
    const label = n.name ? `\n      <bpmndi:BPMNLabel/>` : ''
    return `    <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">${label}
      <dc:Bounds x="${Math.round(x)}" y="${Math.round(y)}" width="${w}" height="${h}"/>
    </bpmndi:BPMNShape>`
  }).join('\n')

  // ── BPMNEdge for flows (straight line: source centre → target centre) ─────
  const edgeShapes = flows.map(f => {
    const sx = cx[f.source] ?? 0, sy = cy[f.source] ?? 0
    const tx = cx[f.target] ?? 0, ty = cy[f.target] ?? 0
    // Offset to shape edge rather than centre
    const { w: sw, h: sh } = _shapeSize(nodes.find(n => n.id === f.source)?.type || 'agentTask')
    const { w: tw }        = _shapeSize(nodes.find(n => n.id === f.target)?.type || 'agentTask')
    const x1 = Math.round(sx + sw / 2), y1 = Math.round(sy)
    const x2 = Math.round(tx - tw / 2), y2 = Math.round(ty)
    const label = f.name
      ? `\n      <bpmndi:BPMNLabel><dc:Bounds x="${Math.round((x1+x2)/2 - 20)}" y="${Math.round((y1+y2)/2 - 10)}" width="40" height="20"/></bpmndi:BPMNLabel>`
      : ''
    return `    <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">${label}
      <di:waypoint x="${x1}" y="${y1}"/>
      <di:waypoint x="${x2}" y="${y2}"/>
    </bpmndi:BPMNEdge>`
  }).join('\n')

  return `  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${_esc(processId)}">
${laneShapes}
${nodeShapes}
${edgeShapes}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>`
}

function _refs(ids, tag) {
  return ids.map(id => `<${tag}>${id}</${tag}>`).join('')
}

function _nodeToXml(n, inIds = [], outIds = []) {
  const type = n.type
  const bpmnType = _bpmnTypeFor(type)
  const name = _esc(n.name || '')
  const apmnAttrs = _apmnAttrs(n)
  const apmnTypeAttr = !type.startsWith('_') ? ` apmn:type="${type}"` : ''
  const children = _refs(inIds, 'bpmn:incoming') + _refs(outIds, 'bpmn:outgoing')

  if (bpmnType === 'bpmn:StartEvent')
    return `<bpmn:startEvent id="${n.id}" name="${name}">${children}</bpmn:startEvent>`
  if (bpmnType === 'bpmn:EndEvent')
    return `<bpmn:endEvent id="${n.id}" name="${name}">${children}</bpmn:endEvent>`
  if (bpmnType === 'bpmn:ExclusiveGateway')
    return `<bpmn:exclusiveGateway id="${n.id}" name="${name}"${apmnTypeAttr}${apmnAttrs}>${children}</bpmn:exclusiveGateway>`
  if (bpmnType === 'bpmn:ParallelGateway')
    return `<bpmn:parallelGateway id="${n.id}" name="${name}">${children}</bpmn:parallelGateway>`
  if (bpmnType === 'bpmn:IntermediateCatchEvent')
    return `<bpmn:intermediateCatchEvent id="${n.id}" name="${name}">${children}<bpmn:timerEventDefinition/></bpmn:intermediateCatchEvent>`
  if (bpmnType === 'bpmn:UserTask')
    return `<bpmn:userTask id="${n.id}" name="${name}"${apmnTypeAttr}${apmnAttrs}>${children}</bpmn:userTask>`
  if (bpmnType === 'bpmn:ManualTask')
    return `<bpmn:manualTask id="${n.id}" name="${name}">${children}</bpmn:manualTask>`
  if (bpmnType === 'bpmn:ServiceTask')
    return `<bpmn:serviceTask id="${n.id}" name="${name}">${children}</bpmn:serviceTask>`

  // Default: task with APMN attrs
  return `<bpmn:task id="${n.id}" name="${name}"${apmnTypeAttr}${apmnAttrs}>${children}</bpmn:task>`
}

function _apmnAttrs(n) {
  return Object.entries(n)
    .filter(([k]) => !['id', 'type', 'name'].includes(k))
    .map(([k, v]) => ` apmn:${k}="${_esc(String(v))}"`)
    .join('')
}

function _flowToXml(f) {
  const name = f.name ? ` name="${_esc(f.name)}"` : ''
  const cond = f.condition
    ? `<bpmn:conditionExpression>${_esc(f.condition)}</bpmn:conditionExpression>`
    : ''
  return `<bpmn:sequenceFlow id="${f.id}"${name} sourceRef="${f.source}" targetRef="${f.target}">${cond}</bpmn:sequenceFlow>`
}

function _bpmnTypeFor(type) {
  const map = {
    startEvent: 'bpmn:StartEvent',
    endEvent: 'bpmn:EndEvent',
    parallelGateway: 'bpmn:ParallelGateway',
    exclusiveGateway: 'bpmn:ExclusiveGateway',
    confidenceGate: 'bpmn:ExclusiveGateway',
    reasoningGate: 'bpmn:ExclusiveGateway',
    modelVersionGate: 'bpmn:ExclusiveGateway',
    semanticGate: 'bpmn:ExclusiveGateway',
    mcpGate: 'bpmn:ExclusiveGateway',
    escapeGate: 'bpmn:ExclusiveGateway',
    humanInLoopTask: 'bpmn:UserTask',
    manualTask: 'bpmn:ManualTask',
    timerEvent: 'bpmn:IntermediateCatchEvent',
    _startEvent: 'bpmn:StartEvent',
    _endEvent: 'bpmn:EndEvent',
    _serviceTask: 'bpmn:ServiceTask',
    _userTask: 'bpmn:UserTask',
    _manualTask: 'bpmn:ManualTask',
    _exclusiveGateway: 'bpmn:ExclusiveGateway',
    _parallelGateway: 'bpmn:ParallelGateway',
    _timerEvent: 'bpmn:IntermediateCatchEvent',
  }
  return map[type] || 'bpmn:Task'
}

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
