import { APMN_TASKS, APMN_GATES, BPMN_STANDARD } from './apmn-module/types.js'
import { iconToSvg } from './apmn-module/icons.js'

let _modeler = null
let _activePopover = null

export function buildSidebar(modeler) {
  _modeler = modeler
  const sidebar = document.getElementById('apmn-sidebar')
  if (!sidebar) return

  const sections = [
    { title: 'AI Tasks',      items: APMN_TASKS },
    { title: 'AI Gates',      items: APMN_GATES },
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

  // Scroll-to-bottom fade indicator
  const hint = document.getElementById('sidebar-scroll-hint')
  function updateScrollFade() {
    const atBottom = sidebar.scrollTop + sidebar.clientHeight >= sidebar.scrollHeight - 4
    hint.classList.toggle('hidden', atBottom)
  }
  sidebar.addEventListener('scroll', updateScrollFade)
  setTimeout(updateScrollFade, 100)

  // Close popover on outside click
  document.addEventListener('click', () => closePopover())
}

function makeEntry(item) {
  const el = document.createElement('div')
  el.className = 'sidebar-entry'
  el.title = ''  // suppress native tooltip — we have our own
  el.innerHTML = `
    <div class="sidebar-chip" style="background:${item.color}">
      ${item.svgIcon ? iconToSvg(item.svgIcon, 16) : `<span class="sidebar-icon">${item.icon}</span>`}
    </div>
    <span class="sidebar-label">${item.label}</span>
    <button class="sidebar-info-btn" title="About this node">ⓘ</button>
  `

  const chip = el.querySelector('.sidebar-chip')
  const infoBtn = el.querySelector('.sidebar-info-btn')

  // Click chip → place shape at centre of current canvas viewport
  chip.addEventListener('click', () => {
    console.log('[APMN] chip clicked', item.type)
    if (!_modeler) { console.warn('[APMN] modeler not ready'); return }
    try {
      const canvas   = _modeler.get('canvas')
      const modeling = _modeler.get('modeling')
      const vbox     = canvas.viewbox()
      console.log('[APMN] viewbox', vbox)
      const x = Math.round(vbox.x + vbox.width  / 2 + (Math.random() - 0.5) * 80)
      const y = Math.round(vbox.y + vbox.height / 2 + (Math.random() - 0.5) * 60)
      console.log('[APMN] placing at', x, y)
      const shape = _makeShape(item)
      const root  = canvas.getRootElement()
      console.log('[APMN] root', root)
      modeling.createShape(shape, { x, y }, root)
      console.log('[APMN] shape created ok')
    } catch (err) {
      console.error('[APMN] createShape failed', err)
    }
  })

  // ── Hover tooltip ─────────────────────────────────────────────────────────
  el.addEventListener('mouseenter', () => {
    showTooltip(el, `Click to add · ${item.description}`)
  })
  el.addEventListener('mouseleave', () => {
    hideTooltip()
  })

  // ── ⓘ popover ─────────────────────────────────────────────────────────────
  infoBtn.addEventListener('click', e => {
    e.stopPropagation()
    togglePopover(infoBtn, item)
  })

  return el
}

function _makeShape(item) {
  // Map APMN bpmnType (apmn:AgentTask) → BPMN base type for elementFactory
  const isApmnItem = !item.type.startsWith('_')
  let elementType = item.bpmnType || 'bpmn:Task'
  if (isApmnItem) {
    // Derive BPMN base from the apmn: moddle superClass
    if (elementType.includes('Gate')) elementType = 'bpmn:ExclusiveGateway'
    else if (elementType.includes('Event')) elementType = 'bpmn:IntermediateCatchEvent'
    else elementType = 'bpmn:Task'
  }

  const isGate  = elementType.includes('Gateway')
  const isEvent = elementType.includes('Event')
  const w = (isGate || isEvent) ? 50 : 120
  const h = (isGate || isEvent) ? 50 : 80

  const shape = _modeler.get('elementFactory').createShape({ type: elementType, width: w, height: h })

  // Tag APMN items so the renderer applies custom colour/icon
  if (isApmnItem) {
    shape.businessObject.$attrs['apmn:type'] = item.type
  }
  return shape
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

let _tooltip = null

function showTooltip(anchor, text) {
  if (!text) return
  hideTooltip()
  _tooltip = document.createElement('div')
  _tooltip.className = 'sidebar-tooltip'
  _tooltip.textContent = text
  document.body.appendChild(_tooltip)

  const rect = anchor.getBoundingClientRect()
  _tooltip.style.top  = `${rect.top + window.scrollY + rect.height / 2 - _tooltip.offsetHeight / 2}px`
  _tooltip.style.left = `${rect.right + 8}px`
}

function hideTooltip() {
  if (_tooltip) { _tooltip.remove(); _tooltip = null }
}

// ── Popover ───────────────────────────────────────────────────────────────────

function togglePopover(anchor, item) {
  if (_activePopover) {
    closePopover()
    return
  }

  const pop = document.createElement('div')
  pop.className = 'sidebar-popover'
  pop.innerHTML = `
    <div class="pop-type" style="color:${item.color}">${item.icon} ${item.label}</div>
    <div class="pop-desc">${item.description}</div>
    ${item.docsUrl ? `<a class="pop-link" href="${item.docsUrl}" target="_blank">View documentation ↗</a>` : ''}
  `
  document.body.appendChild(pop)
  _activePopover = pop

  const rect = anchor.getBoundingClientRect()
  const popH = 140
  pop.style.left = `${rect.right + 8}px`
  pop.style.top  = `${Math.min(rect.top, window.innerHeight - popH - 8)}px`

  pop.addEventListener('click', e => e.stopPropagation())
}

function closePopover() {
  if (_activePopover) { _activePopover.remove(); _activePopover = null }
}
