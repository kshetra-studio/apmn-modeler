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
  const rawXml = apmnToBpmn(doc)
  // Let bpmn-auto-layout place all shapes and route all connections
  const laidOutXml = await layoutProcess(rawXml)
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

function apmnToBpmn(doc) {
  const proc = doc.process || {}
  const rawNodes = doc.nodes || []
  const flows = doc.flows || []

  const nodes = rawNodes

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

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:apmn="http://apmn.kshetra.studio/ns/1.0"
  id="Definitions_1" targetNamespace="http://apmn.kshetra.studio/process">
  <bpmn:process id="${_esc(proc.id || 'process_1')}" name="${_esc(proc.name || '')}" isExecutable="false">
    ${shapes.join('\n    ')}
    ${edges.join('\n    ')}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${_esc(proc.id || 'process_1')}"/>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
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
