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
import { setupPage, fitToPage, expandPage } from './page.js'
import apmnModdle from './apmn-module/apmn-moddle.json'

// ── Init modeler ─────────────────────────────────────────────────────────────

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [apmnModule],
  // moddleExtensions registered separately below after confirming legacy attrs still work
})

// Load starter diagram and build sidebar after modeler is ready
fetch('/starter.bpmn')
  .then(r => r.text())
  .then(xml => layoutProcess(xml))
  .then(laidOutXml => modeler.importXML(laidOutXml))
  .then(() => {
    setupPage(modeler)
    buildSidebar(modeler)
    try { modeler.get('canvas').zoom('fit-viewport', 'auto') } catch (_) {}
  })
  .catch(console.error)

// ── Embedded mode ─────────────────────────────────────────────────────────────
const isEmbedded = new URLSearchParams(location.search).has('embedded')
if (isEmbedded) document.body.classList.add('embedded')

// Receive converted APMN from parent frame
window.addEventListener('message', async (event) => {
  if (event.data?.type !== 'load-yaml') return
  try {
    await importFromAPMN(modeler, event.data.yaml)
    try { modeler.get('canvas').zoom('fit-viewport', 'auto') } catch (_) {}
  } catch (e) {
    console.error('[APMN] postMessage import failed:', e)
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
      modeler.get('canvas').zoom('fit-viewport', 'auto')
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
