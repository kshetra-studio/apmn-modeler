import { APMN_TASKS, APMN_GATES, BPMN_STANDARD, getTypeInfo } from './apmn-module/types.js'

let _modeler = null

export function buildSidebar(modeler) {
  _modeler = modeler
  const sidebar = document.getElementById('apmn-sidebar')
  if (!sidebar) return

  const sections = [
    { title: 'AI Tasks', items: APMN_TASKS },
    { title: 'AI Gates', items: APMN_GATES },
    { title: 'BPMN Standard', items: BPMN_STANDARD },
  ]

  for (const section of sections) {
    const heading = document.createElement('div')
    heading.className = 'sidebar-section-title'
    heading.textContent = section.title
    sidebar.appendChild(heading)
    for (const item of section.items) {
      sidebar.appendChild(makeEntry(item))
    }
  }

  // Wire canvas drop target
  const canvasEl = document.getElementById('canvas')
  canvasEl.addEventListener('dragover', e => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  })
  canvasEl.addEventListener('drop', e => {
    e.preventDefault()
    const apmnType = e.dataTransfer.getData('apmn-type')
    if (!apmnType || !_modeler) return
    const point = _clientToCanvas(e)
    _createAt(apmnType, point)
  })
}

function makeEntry(item) {
  const el = document.createElement('div')
  el.className = 'sidebar-entry'
  el.title = item.label
  el.draggable = true
  el.innerHTML = `
    <div class="sidebar-chip" style="background:${item.color}">
      <span class="sidebar-icon">${item.icon}</span>
    </div>
    <span class="sidebar-label">${item.label}</span>
  `

  el.addEventListener('dragstart', e => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('apmn-type', item.type)
    // Transparent drag image so bpmn-js ghost shows instead
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-9999px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  })

  return el
}

function _clientToCanvas(event) {
  const canvas = _modeler.get('canvas')
  const container = document.getElementById('canvas')
  const rect = container.getBoundingClientRect()
  const vb = canvas.viewbox()
  return {
    x: vb.x + (event.clientX - rect.left) / vb.scale,
    y: vb.y + (event.clientY - rect.top) / vb.scale,
  }
}

function _createAt(apmnType, point) {
  const info = getTypeInfo(apmnType)
  const isBpmnStandard = apmnType.startsWith('_')

  const bpmnType = info?.bpmnType || 'bpmn:Task'
  const isGate = bpmnType.includes('Gateway')
  const isEvent = bpmnType.includes('Event')
  const w = (isGate || isEvent) ? 50 : 120
  const h = (isGate || isEvent) ? 50 : 80

  const elementFactory = _modeler.get('elementFactory')
  const modeling = _modeler.get('modeling')
  const canvas = _modeler.get('canvas')

  const shape = elementFactory.createShape({ type: bpmnType, width: w, height: h })

  if (!isBpmnStandard && info) {
    shape.businessObject.$attrs = shape.businessObject.$attrs || {}
    shape.businessObject.$attrs['apmn:type'] = apmnType
  }

  modeling.createShape(shape, point, canvas.getRootElement())
}
