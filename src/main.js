import './styles/app.css'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'
import 'bpmn-js/dist/assets/bpmn-js.css'

import BpmnModeler from 'bpmn-js/lib/Modeler'
import apmnModule from './apmn-module/index.js'
import { exportToAPMN, importFromAPMN } from './io/yaml.js'
import { layoutProcess } from 'bpmn-auto-layout'
import { getTypeInfo, APMN_PROPS } from './apmn-module/types.js'
import { buildSidebar } from './sidebar.js'
import { addLaneToModeler } from './lanes.js'
import { setupPage, fitToPage, expandPage } from './page.js'
import apmnModdle from './apmn-module/apmn-moddle.json'
import { recomputeRisk } from './apmn-module/risk.js'

// Recompute the risk registry and force a re-render of every element so
// risk bubbles stay in sync with `watches`/`escalate_to` after import or edits.
function refreshRisk() {
  const elementRegistry = modeler.get('elementRegistry')
  recomputeRisk(elementRegistry)
  modeler.get('eventBus').fire('elements.changed', { elements: elementRegistry.getAll() })
}

// fit-viewport can throw on certain laid-out bounding boxes (e.g. several
// branches converging on one node with no explicit join gateway). A failed
// fit-viewport call can leave the canvas transform corrupted (zeroed-out
// matrix, effectively invisible) rather than just untouched, and a second
// fit-viewport attempt afterwards re-corrupts it the same way — so on
// failure, recover with an explicit numeric viewbox (bypasses the buggy
// auto-fit math entirely) instead of silently swallowing the error or
// retrying the same call.
function safeFitViewport() {
  const canvas = modeler.get('canvas')
  try {
    canvas.zoom('fit-viewport', 'auto')
  } catch (e) {
    console.error('[APMN] fit-viewport failed, recovering with an explicit viewbox:', e)
    try { canvas.viewbox({ x: 0, y: 0, width: 1200, height: 800 }) } catch (_) {}
  }
}

// ── Init modeler ─────────────────────────────────────────────────────────────

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [apmnModule],
  // moddleExtensions registered separately below after confirming legacy attrs still work
})

// ── Load from URL param, or fall back to the starter diagram ───────────────
//
// `?yaml=<base64url-encoded APMN YAML>` lets anything that already has YAML
// (an MCP tool, a coding agent, a shared link) open a real, standard-notation
// diagram with zero browser automation — no import-button clicking required.
function decodeYamlParam(param) {
  try {
    const base64 = param.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch (e) {
    console.error('[APMN] failed to decode yaml URL param:', e)
    return null
  }
}

// NOTE: does NOT zoom — importFromAPMN() already fits the viewport itself.
// Calling fit-viewport a second time after a failed first attempt re-corrupts
// the canvas transform the same way (confirmed: not just a no-op retry).
// Only loadStarter() needs to zoom explicitly, since modeler.importXML()
// doesn't fit the viewport on its own.
function finishLoad() {
  setupPage(modeler)
  buildSidebar(modeler)
  refreshRisk()
}

function loadStarter() {
  return fetch('/starter.bpmn')
    .then(r => r.text())
    .then(xml => layoutProcess(xml))
    .then(laidOutXml => modeler.importXML(laidOutXml))
    .then(() => { safeFitViewport(); finishLoad() })
}

async function boot() {
  const yamlParam = new URLSearchParams(location.search).get('yaml')
  if (yamlParam) {
    const yaml = decodeYamlParam(yamlParam)
    if (yaml) {
      try {
        await importFromAPMN(modeler, yaml)
        finishLoad()
        return
      } catch (e) {
        console.error('[APMN] failed to import yaml from URL param, falling back to starter:', e)
      }
    }
  }
  await loadStarter()
}

boot().catch(console.error)

modeler.on('import.done', refreshRisk)
modeler.on('commandStack.changed', refreshRisk)

// ── Embedded mode ─────────────────────────────────────────────────────────────
const isEmbedded = new URLSearchParams(location.search).has('embedded')
if (isEmbedded) document.body.classList.add('embedded')

// Receive messages from parent frame
window.addEventListener('message', async (event) => {
  if (event.data?.type === 'load-yaml') {
    try {
      await importFromAPMN(modeler, event.data.yaml)  // already fits the viewport itself
    } catch (e) {
      console.error('[APMN] postMessage import failed:', e)
    }
  } else if (event.data?.type === 'request-svg') {
    try {
      const { svg } = await modeler.saveSVG()
      window.parent.postMessage({ type: 'svg-exported', svg }, '*')
    } catch (e) {
      console.error('[APMN] SVG export failed:', e)
      window.parent.postMessage({ type: 'svg-exported', svg: null }, '*')
    }
  }
})

// Sync current diagram back to TwinTrack parent
document.getElementById('btn-sync').addEventListener('click', () => {
  try {
    const yaml = exportToAPMN(modeler)
    window.parent.postMessage({ type: 'yaml-updated', yaml }, '*')
    toast('Synced to TwinTrack')
  } catch (e) {
    console.error(e)
    toast('Sync failed: ' + e.message, 'error')
  }
})

// ── Properties panel ─────────────────────────────────────────────────────────

let selectedElement = null

const _propsPanel = document.getElementById('props-panel')
document.getElementById('props-close').addEventListener('click', () => {
  _propsPanel.classList.remove('open')
  modeler.get('selection').select([])
})

modeler.on('selection.changed', ({ newSelection }) => {
  selectedElement = newSelection[0] || null
  if (selectedElement && selectedElement.type !== 'bpmn:Process') {
    renderProps(selectedElement)
    _propsPanel.classList.add('open')
  } else {
    _propsPanel.classList.remove('open')
  }
})

modeler.on('element.changed', ({ element }) => {
  if (element === selectedElement) renderProps(element)
})

function renderProps(element) {
  const content = document.getElementById('props-content')

  if (!element || element.type === 'bpmn:Process') {
    content.innerHTML = ''
    return
  }

  const bo = element.businessObject
  // Prefer typed $type (moddleExtension), fall back to legacy $attrs
  const rawType = bo.$type?.startsWith('apmn:') ? bo.$type.replace('apmn:', '') : null
  const typeKey = rawType ? rawType.charAt(0).toLowerCase() + rawType.slice(1) : bo?.$attrs?.['apmn:type']
  const info = typeKey ? getTypeInfo(typeKey) : null
  const propKeys = (typeKey && APMN_PROPS[typeKey]) || []

  let html = ''

  // Node header chip
  if (info) {
    html += `<div class="props-node-header" style="background:${info.color}22; border:1px solid ${info.color}44">
      <div class="props-node-icon" style="background:${info.color}">${info.icon}</div>
      <div class="props-node-info">
        <div class="type-label" style="color:${info.color}">${info.label}</div>
        <div class="node-id">${bo.id}</div>
      </div>
    </div>`
  } else {
    html += `<div class="prop-section-title">Element</div>`
    html += `<div style="font-size:11px;color:#64748b;margin-bottom:12px;font-family:monospace">${bo.$type} · ${bo.id}</div>`
  }

  // Name field (all elements)
  html += field('name', 'Name', bo.name || '', 'input', 'Name this node…')

  // APMN-specific fields
  if (propKeys.length) {
    html += `<div class="prop-section-title">APMN Properties</div>`
    for (const key of propKeys) {
      const val = bo[key] ?? bo.$attrs?.[`apmn:${key}`] ?? ''
      const isLong = ['system_prompt', 'input_schema', 'attributes', 'routes', 'triggers', 'watches'].includes(key)
      html += field(key, key.replace(/_/g, ' '), val, isLong ? 'textarea' : 'input')
    }
  }

  content.innerHTML = html

  // Wire up inputs
  content.querySelectorAll('[data-prop]').forEach(input => {
    input.addEventListener('change', e => {
      const prop = input.dataset.prop
      const value = e.target.value
      const modeling = modeler.get('modeling')

      if (prop === 'name') {
        modeling.updateLabel(element, value)
      } else if (bo.$type?.startsWith('apmn:')) {
        modeling.updateProperties(element, { [prop]: value })
      } else {
        const attrs = { ...(bo.$attrs || {}) }
        attrs[`apmn:${prop}`] = value
        modeling.updateProperties(element, { $attrs: attrs })
      }
    })
  })
}

function field(key, label, value, type = 'input', placeholder = '') {
  const tag = type === 'textarea' ? 'textarea' : 'input'
  const attrs = type === 'textarea'
    ? `class="prop-input mono" rows="3"`
    : `type="text" class="prop-input ${['server','tool','vector_store','model'].includes(key) ? 'mono' : ''}"`
  const content = type === 'textarea' ? _esc(value) : ''
  const valAttr = type === 'textarea' ? '' : `value="${_esc(value)}"`
  const ph = placeholder ? `placeholder="${placeholder}"` : ''

  return `<div class="prop-field">
    <div class="prop-label">${label}</div>
    <${tag} data-prop="${key}" ${attrs} ${valAttr} ${ph}>${content}</${tag}>
  </div>`
}

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── Export YAML ──────────────────────────────────────────────────────────────

document.getElementById('btn-export-yaml').addEventListener('click', () => {
  try {
    const yamlText = exportToAPMN(modeler)
    document.getElementById('yaml-output').textContent = yamlText
    document.getElementById('yaml-modal').classList.add('open')
  } catch (e) {
    console.error(e)
    toast('Export failed: ' + e.message, 'error')
  }
})

document.getElementById('btn-copy-yaml').addEventListener('click', () => {
  const text = document.getElementById('yaml-output').textContent
  navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'))
})

document.getElementById('btn-download-yaml').addEventListener('click', () => {
  const text = document.getElementById('yaml-output').textContent
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }))
  a.download = 'workflow.apmn.yaml'
  a.click()
  toast('Downloaded workflow.apmn.yaml')
})

document.getElementById('btn-close-yaml').addEventListener('click', () => {
  document.getElementById('yaml-modal').classList.remove('open')
})

// ── Import YAML ──────────────────────────────────────────────────────────────

document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-modal').classList.add('open')
})

document.getElementById('btn-import-file').addEventListener('click', () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.yaml,.yml'
  input.onchange = async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    document.getElementById('import-textarea').value = text
  }
  input.click()
})

document.getElementById('btn-import-confirm').addEventListener('click', async () => {
  const text = document.getElementById('import-textarea').value.trim()
  if (!text) return
  try {
    await importFromAPMN(modeler, text)
    document.getElementById('import-modal').classList.remove('open')
    document.getElementById('import-textarea').value = ''
    toast('Imported successfully')
  } catch (e) {
    console.error(e)
    toast('Import failed: ' + e.message, 'error')
  }
})

document.getElementById('btn-close-import').addEventListener('click', () => {
  document.getElementById('import-modal').classList.remove('open')
})

// ── Import BPMN XML ──────────────────────────────────────────────────────────

document.getElementById('btn-import-bpmn').addEventListener('click', () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.bpmn,.xml'
  input.onchange = async e => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const xml = await file.text()
      await modeler.importXML(xml)
      setupPage(modeler)
      safeFitViewport()
      toast('Imported ' + file.name)
    } catch (err) {
      console.error(err)
      toast('Import failed: ' + err.message, 'error')
    }
  }
  input.click()
})

// ── Export BPMN XML ──────────────────────────────────────────────────────────

document.getElementById('btn-export-bpmn').addEventListener('click', async () => {
  const { xml } = await modeler.saveXML({ format: true })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }))
  a.download = 'workflow.bpmn'
  a.click()
  toast('Downloaded workflow.bpmn')
})

// ── Zoom controls ────────────────────────────────────────────────────────────

function zoomIn()  { modeler.get('zoomScroll').stepZoom(1) }
function zoomOut() { modeler.get('zoomScroll').stepZoom(-1) }
function zoomFit() { fitToPage(modeler.get('canvas')) }

document.getElementById('btn-zoom-in').addEventListener('click', zoomIn)
document.getElementById('btn-zoom-out').addEventListener('click', zoomOut)
document.getElementById('btn-zoom-fit').addEventListener('click', zoomFit)
document.getElementById('zoom-in-float').addEventListener('click', zoomIn)
document.getElementById('zoom-out-float').addEventListener('click', zoomOut)
document.getElementById('zoom-fit-float').addEventListener('click', zoomFit)
document.getElementById('btn-expand-down').addEventListener('click',  () => expandPage('down'))
document.getElementById('btn-expand-right').addEventListener('click', () => expandPage('right'))

// ── Toast ────────────────────────────────────────────────────────────────────

function toast(msg, type = 'success') {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.style.background = type === 'error' ? '#dc2626' : '#22c55e'
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2500)
}

// ── Add Lane ─────────────────────────────────────────────────────────────────

document.getElementById('btn-add-lane').addEventListener('click', () => {
  showLaneDialog()
})

function showLaneDialog() {
  // Reuse import-modal pattern: small floating prompt
  const overlay = document.createElement('div')
  overlay.id = 'lane-dialog-overlay'
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;
    display:flex;align-items:center;justify-content:center;
  `
  overlay.innerHTML = `
    <div style="
      background:#1e293b;border:1px solid #334155;border-radius:12px;
      padding:20px 24px;width:320px;box-shadow:0 8px 32px rgba(0,0,0,.5)
    ">
      <div style="font-size:13px;font-weight:700;color:#f1f5f9;margin-bottom:12px">Add Swimlane</div>
      <input id="lane-name-input" type="text" placeholder="Lane name (e.g. Risk Team)"
        style="
          width:100%;padding:8px 10px;background:#0f172a;border:1px solid #475569;
          border-radius:6px;color:#f1f5f9;font-size:13px;outline:none;
          box-sizing:border-box;margin-bottom:14px;
        " autofocus/>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="lane-cancel" style="
          padding:6px 14px;border-radius:6px;border:1px solid #475569;
          background:#1e293b;color:#94a3b8;font-size:12px;cursor:pointer;
        ">Cancel</button>
        <button id="lane-confirm" style="
          padding:6px 14px;border-radius:6px;border:1px solid #3b82f6;
          background:#2563eb;color:white;font-size:12px;cursor:pointer;font-weight:600;
        ">Add Lane →</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const input = overlay.querySelector('#lane-name-input')
  input.focus()

  const close = () => overlay.remove()

  overlay.querySelector('#lane-cancel').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  const confirm = async () => {
    const name = input.value.trim()
    if (!name) { input.style.borderColor = '#ef4444'; return }
    close()
    try {
      await addLaneToModeler(modeler, name)
      toast(`Lane "${name}" added — drag nodes into it`)
    } catch (e) {
      console.error('[APMN] addLane failed:', e)
      toast('Add lane failed: ' + e.message, 'error')
    }
  }

  overlay.querySelector('#lane-confirm').addEventListener('click', confirm)
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirm()
    if (e.key === 'Escape') close()
  })
}

// Close modals on backdrop click
for (const id of ['yaml-modal', 'import-modal']) {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target.id === id) e.target.classList.remove('open')
  })
}

// APMN badge toggle
const badge = document.getElementById('apmn-badge')
const badgePopup = document.getElementById('apmn-badge-popup')
badge.addEventListener('click', e => {
  e.stopPropagation()
  badgePopup.classList.toggle('open')
})
document.addEventListener('click', () => badgePopup.classList.remove('open'))
