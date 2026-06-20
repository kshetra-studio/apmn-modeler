// Page artboard — finite canvas with a defined print boundary

// A4 landscape at 96 DPI: 297mm × 210mm
export const PAGE_W = 1123
export const PAGE_H = 794

let _pageRect = null
let _modeler  = null

export function setupPage(modeler) {
  _modeler = modeler

  const canvas   = modeler.get('canvas')
  const svg      = canvas._svg
  // _viewport is the <g> that carries the pan/zoom transform — everything must go inside it
  const viewport = canvas._viewport

  // Drop-shadow filter stays in SVG <defs> (outside the transform group — that's correct for filters)
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }
  if (!defs.querySelector('#page-shadow')) {
    defs.insertAdjacentHTML('beforeend', `
      <filter id="page-shadow" x="-6%" y="-6%" width="112%" height="112%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#00000033"/>
      </filter>
    `)
  }

  // Background group — INSIDE viewport so it pans/zooms with the diagram
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  bg.setAttribute('class', 'apmn-page-bg')
  // prepend so it sits behind all diagram layers
  viewport.insertBefore(bg, viewport.firstChild)

  // Outer shadow rect (slightly larger, for soft shadow)
  _pageRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  setPageSize(_pageRect, PAGE_W, PAGE_H)
  bg.appendChild(_pageRect)

  // Page border label (top-left corner, outside the page)
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  label.setAttribute('x', '0')
  label.setAttribute('y', '-8')
  label.setAttribute('fill', '#94a3b8')
  label.setAttribute('font-size', '11')
  label.setAttribute('font-family', 'system-ui, sans-serif')
  label.setAttribute('font-weight', '500')
  label.textContent = 'APMN Canvas'
  label.setAttribute('class', 'apmn-page-label')
  bg.appendChild(label)

  // Fit viewport to page on load
  fitToPage(canvas)
}

export function expandPage(direction = 'down') {
  if (!_pageRect || !_modeler) return
  const canvas = _modeler.get('canvas')
  const w = parseInt(_pageRect.getAttribute('width'))
  const h = parseInt(_pageRect.getAttribute('height'))
  if (direction === 'down')  setPageSize(_pageRect, w, h + 600)
  if (direction === 'right') setPageSize(_pageRect, w + 800, h)
  fitToPage(canvas)
}

export function fitToPage(canvas) {
  const w = _pageRect ? parseInt(_pageRect.getAttribute('width'))  : PAGE_W
  const h = _pageRect ? parseInt(_pageRect.getAttribute('height')) : PAGE_H
  canvas.viewbox({ x: -60, y: -60, width: w + 120, height: h + 120 })
}

function setPageSize(rect, w, h) {
  rect.setAttribute('x', '0')
  rect.setAttribute('y', '0')
  rect.setAttribute('width',  String(w))
  rect.setAttribute('height', String(h))
  rect.setAttribute('rx', '4')
  rect.setAttribute('ry', '4')
  rect.setAttribute('fill', '#ffffff')
  rect.setAttribute('stroke', '#b0bec5')
  rect.setAttribute('stroke-width', '1.5')
  rect.setAttribute('filter', 'url(#page-shadow)')
}
