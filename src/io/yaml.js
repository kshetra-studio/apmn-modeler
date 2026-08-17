import yaml from 'js-yaml'
import { layoutProcess } from 'bpmn-auto-layout'
import { getTypeInfo, APMN_TASKS, APMN_GATES } from '../apmn-module/types.js'

// ── Export: modeler → APMN YAML ─────────────────────────────────────────────

export function exportToAPMN(modeler) {
  const elementRegistry = modeler.get('elementRegistry')
  const canvas = modeler.get('canvas')
  const rootElement = canvas.getRootElement()

  // ── Collect lane membership from the rendered diagram ─────────────────────
  // In bpmn-js, flow nodes are children of the BPMNPlane, NOT of lane shapes.
  // Lane membership lives on bpmn:Lane.flowNodeRef (array of BO references).
  // We build:
  //   laneOrder    — lanes sorted top→bottom by Y position
  //   nodeLaneName — nodeId → lane name string
  const laneOrder    = []   // [{ id, name, y }]
  const laneSeen     = new Set()
  const nodeLaneName = {}   // nodeId → lane name

  elementRegistry.forEach(element => {
    const bo = element.businessObject
    if (!bo || bo.$type !== 'bpmn:Lane') return
    if (!laneSeen.has(bo.id)) {
      laneSeen.add(bo.id)
      laneOrder.push({ id: bo.id, name: bo.name || bo.id, y: element.y ?? 0 })
    }
    // flowNodeRef contains the actual BO references for nodes in this lane
    for (const nodeRef of (bo.flowNodeRef || [])) {
      nodeLaneName[nodeRef.id] = bo.name || bo.id
    }
  })

  // Sort top → bottom by Y so the YAML lanes block reflects display order
  laneOrder.sort((a, b) => a.y - b.y)

  const hasDiagramLanes = laneOrder.length > 0

  // ── Collect nodes and flows ────────────────────────────────────────────────
  const nodes = []
  const flows = []

  elementRegistry.forEach(element => {
    if (element === rootElement) return
    if (element.type === 'label') return  // bpmn-js registers flow/shape labels separately — skip them
    const bo = element.businessObject
    if (!bo) return
    if (bo.$type === 'bpmn:Lane') return  // lanes are emitted separately

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
    // Round-trip: write lane name if this node is in a lane
    if (nodeLaneName[bo.id]) node.lane = nodeLaneName[bo.id]

    for (const [k, v] of Object.entries(bo.$attrs || {})) {
      if (k !== 'apmn:type') node[k.replace('apmn:', '')] = v
    }

    nodes.push(node)
  })

  const processId = rootElement.businessObject?.id || 'process_1'
  const processName = rootElement.businessObject?.name || 'Unnamed Process'

  const doc = {
    process: { id: processId, name: processName, targets: ['orkes', 'google_adk'] },
  }

  // Write lanes block when diagram has lanes — preserves order for re-import
  if (hasDiagramLanes) {
    doc.lanes = laneOrder.map(l => ({ name: l.name }))
  }

  doc.nodes = nodes
  doc.flows = flows

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
  // Lane diagrams carry explicit DI coordinates — skip bpmn-auto-layout
  // (it only handles flowElements and ignores laneSet entirely).
  const laidOutXml = useLanes ? rawXml : await layoutProcess(rawXml)
  await modeler.importXML(laidOutXml)
  // fit-viewport can throw on certain laid-out bounding boxes; recover with an
  // explicit viewbox that bypasses the fit-viewport computation entirely.
  const canvas = modeler.get('canvas')
  try {
    canvas.zoom('fit-viewport', 'auto')
  } catch (e) {
    console.error('[APMN] fit-viewport failed after import, recovering with an explicit viewbox:', e)
    try { canvas.viewbox({ x: 0, y: 0, width: 1200, height: 800 }) } catch (_) {}
  }
}

// ── Lane resolution ──────────────────────────────────────────────────────────
// Two modes:
//   Explicit  — doc.lanes block and/or node.lane properties present
//   Inferred  — no explicit lanes; derived from APMN node type
//
// Returns { activeLanes, nodeLaneIndex } or null (no lanes, flat diagram).
//   activeLanes   : [{ id, name }, ...]  ordered list of lane definitions
//   nodeLaneIndex : { nodeId: laneArrayIndex, ... }

const _LANE_KEY = {
  agentTask: 'ai', ragTask: 'ai', memoryTask: 'ai', vectorTask: 'ai', agentHandoff: 'ai',
  startEvent: 'ai', endEvent: 'ai', _startEvent: 'ai', _endEvent: 'ai',
  timerEvent: 'ai', _timerEvent: 'ai',
  parallelGateway: 'ai', exclusiveGateway: 'ai',
  _exclusiveGateway: 'ai', _parallelGateway: 'ai', _inclusiveGateway: 'ai',
  confidenceGate: 'ai', reasoningGate: 'ai', escapeGate: 'ai',
  modelVersionGate: 'ai', semanticGate: 'ai', mcpGate: 'ai',
  mcpToolTask: 'external',
  _serviceTask: 'external', _scriptTask: 'external', _businessRuleTask: 'external',
  humanInLoopTask: 'human', _userTask: 'human', _manualTask: 'human',
  observeEvent: 'observe',
}

const _LANE_DEFS = {
  ai:       { id: 'Lane_AI',       name: 'AI Orchestrator' },
  external: { id: 'Lane_External', name: 'External Systems' },
  human:    { id: 'Lane_Human',    name: 'Human Review' },
  observe:  { id: 'Lane_Observe',  name: 'Observability' },
}

function _laneFor(type) { return _LANE_KEY[type] || 'ai' }

function _resolveLanes(nodes, docLanes) {
  const hasExplicitLanes = nodes.some(n => n.lane) || (docLanes && docLanes.length > 0)

  if (hasExplicitLanes) {
    // ── Explicit mode ──────────────────────────────────────────────────────
    // Lane order: doc.lanes block first (defines structure + order), then any
    // additional lane names found on nodes (in first-appearance order).
    const laneNames = []
    const laneNameSet = new Set()

    for (const l of (docLanes || [])) {
      const name = typeof l === 'string' ? l : (l.name || l.id || String(l))
      if (!laneNameSet.has(name)) { laneNames.push(name); laneNameSet.add(name) }
    }
    for (const n of nodes) {
      if (n.lane && !laneNameSet.has(n.lane)) {
        laneNames.push(n.lane); laneNameSet.add(n.lane)
      }
    }

    if (laneNames.length === 0) return null

    // Safe XML id: replace non-alphanumeric with underscore
    const activeLanes = laneNames.map(name => ({
      id: `Lane_${name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name,
    }))

    const nameToIndex = {}
    laneNames.forEach((name, i) => { nameToIndex[name] = i })

    const nodeLaneIndex = {}
    for (const n of nodes) {
      if (n.lane && nameToIndex[n.lane] !== undefined) {
        nodeLaneIndex[n.id] = nameToIndex[n.lane]
      } else {
        // No explicit lane on this node — type-infer and map to closest
        // explicit lane; if none match, use first lane as default.
        const typeKey = _laneFor(n.type)
        const inferred = _LANE_DEFS[typeKey]?.name
        nodeLaneIndex[n.id] = (inferred && nameToIndex[inferred] !== undefined)
          ? nameToIndex[inferred]
          : 0
      }
    }

    return { activeLanes, nodeLaneIndex }
  }

  // ── Type-inference mode ────────────────────────────────────────────────────
  const typeKeys = new Set(nodes.map(n => _laneFor(n.type)))
  const nonAiPresent = ['external', 'human', 'observe'].some(k => typeKeys.has(k))
  if (!nonAiPresent) return null  // pure AI flow — flat diagram, no lanes

  const orderedKeys = ['ai', 'external', 'human', 'observe'].filter(k => typeKeys.has(k))
  const activeLanes = orderedKeys.map(k => _LANE_DEFS[k])
  const keyToIndex  = {}
  orderedKeys.forEach((k, i) => { keyToIndex[k] = i })

  const nodeLaneIndex = {}
  for (const n of nodes) {
    nodeLaneIndex[n.id] = keyToIndex[_laneFor(n.type)] ?? 0
  }

  return { activeLanes, nodeLaneIndex }
}

// ── APMN doc → BPMN XML ──────────────────────────────────────────────────────

function apmnToBpmn(doc) {
  const proc  = doc.process || {}
  const nodes = doc.nodes   || []
  const flows = doc.flows   || []

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

  const laneResult = _resolveLanes(nodes, doc.lanes)
  const useLanes   = laneResult !== null

  let laneSetXml = ''
  let diagramXml = `  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${_esc(proc.id || 'process_1')}"/>
  </bpmndi:BPMNDiagram>`

  if (useLanes) {
    const { activeLanes, nodeLaneIndex } = laneResult

    // laneSet in the process model (semantic, no coordinates)
    const laneElems = activeLanes.map(lane => {
      const refs = nodes
        .filter(n => nodeLaneIndex[n.id] === activeLanes.indexOf(lane))
        .map(n => `      <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`)
        .join('\n')
      return `    <bpmn:lane id="${lane.id}" name="${_esc(lane.name)}">\n${refs}\n    </bpmn:lane>`
    })
    laneSetXml = `\n    <bpmn:laneSet id="LaneSet_1">\n${laneElems.join('\n')}\n    </bpmn:laneSet>`

    // BPMNDiagram with explicit coordinates (bpmn-auto-layout can't handle lanes)
    diagramXml = _buildLaneDiagram(nodes, flows, activeLanes, nodeLaneIndex, proc.id || 'process_1')
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

// ── Custom lane layout ────────────────────────────────────────────────────────
// bpmn-auto-layout ignores laneSet, so we emit explicit BPMNShape / BPMNEdge
// coordinates. Algorithm: BFS topological rank → X column, lane index → Y row.

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

function _buildLaneDiagram(nodes, flows, activeLanes, nodeLaneIndex, processId) {
  const LANE_LABEL_W = 30   // lane name strip on the left
  const LANE_H       = 160  // height per lane band
  const H_STEP       = 150  // horizontal distance between node centres
  const START_X      = LANE_LABEL_W + 90

  // ── BFS topological rank ──────────────────────────────────────────────────
  const outTargets = {}
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
      const nr = (rank[cur] || 0) + 1
      if (!visited.has(tgt)) {
        rank[tgt] = nr; visited.add(tgt); queue.push(tgt)
      } else if (nr > rank[tgt]) {
        rank[tgt] = nr
      }
    }
  }
  for (const n of nodes) { if (rank[n.id] === undefined) rank[n.id] = 0 }

  // ── Node centre positions ─────────────────────────────────────────────────
  const cx = {}, cy = {}
  for (const n of nodes) {
    cx[n.id] = START_X + (rank[n.id] || 0) * H_STEP
    const li = nodeLaneIndex[n.id] ?? 0
    cy[n.id] = li * LANE_H + LANE_H / 2
  }

  const maxRank = Math.max(0, ...Object.values(rank))
  const totalW  = START_X + maxRank * H_STEP + 100

  // ── BPMNShape: lane bands ─────────────────────────────────────────────────
  const laneShapes = activeLanes.map((lane, i) =>
    `    <bpmndi:BPMNShape id="${lane.id}_di" bpmnElement="${lane.id}" isHorizontal="true">
      <dc:Bounds x="${LANE_LABEL_W}" y="${i * LANE_H}" width="${totalW}" height="${LANE_H}"/>
      <bpmndi:BPMNLabel/>
    </bpmndi:BPMNShape>`
  ).join('\n')

  // ── BPMNShape: nodes ──────────────────────────────────────────────────────
  const nodeShapes = nodes.map(n => {
    const { w, h } = _shapeSize(n.type)
    return `    <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">
      <dc:Bounds x="${Math.round(cx[n.id] - w / 2)}" y="${Math.round(cy[n.id] - h / 2)}" width="${w}" height="${h}"/>
    </bpmndi:BPMNShape>`
  }).join('\n')

  // ── BPMNEdge: flows ───────────────────────────────────────────────────────
  const edgeShapes = flows.map(f => {
    const sType = nodes.find(n => n.id === f.source)?.type || 'agentTask'
    const tType = nodes.find(n => n.id === f.target)?.type || 'agentTask'
    const { w: sw } = _shapeSize(sType)
    const { w: tw } = _shapeSize(tType)
    const x1 = Math.round((cx[f.source] ?? 0) + sw / 2)
    const y1 = Math.round(cy[f.source]  ?? 0)
    const x2 = Math.round((cx[f.target] ?? 0) - tw / 2)
    const y2 = Math.round(cy[f.target]  ?? 0)
    const labelXml = f.name
      ? `\n      <bpmndi:BPMNLabel><dc:Bounds x="${Math.round((x1+x2)/2-20)}" y="${Math.round((y1+y2)/2-10)}" width="40" height="20"/></bpmndi:BPMNLabel>`
      : ''
    return `    <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">${labelXml}
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

  return `<bpmn:task id="${n.id}" name="${name}"${apmnTypeAttr}${apmnAttrs}>${children}</bpmn:task>`
}

function _apmnAttrs(n) {
  // Exclude lane from apmn:* attrs — it's a structural YAML property, not a node attribute
  return Object.entries(n)
    .filter(([k]) => !['id', 'type', 'name', 'lane'].includes(k))
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
