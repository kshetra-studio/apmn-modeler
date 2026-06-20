import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer'
import { append as svgAppend, create as svgCreate, attr as svgAttr } from 'tiny-svg'
import { getTypeInfo } from './types.js'

const HIGH_PRIORITY = 1500

export default class APMNRenderer extends BaseRenderer {
  static $inject = ['eventBus', 'bpmnRenderer', 'styles']

  constructor(eventBus, bpmnRenderer, styles) {
    super(eventBus, HIGH_PRIORITY)
    this.bpmnRenderer = bpmnRenderer
    this.styles = styles
  }

  canRender(element) {
    const bo = element.businessObject
    if (!bo) return false
    if (bo.$type?.startsWith('apmn:')) return true
    if (bo.$attrs?.['apmn:type']) return true
    // Color start/end events to match APMN palette
    return bo.$type === 'bpmn:StartEvent' || bo.$type === 'bpmn:EndEvent'
  }

  _resolveTypeInfo(element) {
    const bo = element.businessObject
    if (bo.$type?.startsWith('apmn:')) {
      const raw = bo.$type.replace('apmn:', '')
      const key = raw.charAt(0).toLowerCase() + raw.slice(1)
      return getTypeInfo(key)
    }
    const legacyKey = bo.$attrs?.['apmn:type']
    return legacyKey ? getTypeInfo(legacyKey) : null
  }

  drawShape(parentNode, element) {
    const bo = element.businessObject

    // Native BPMN start/end events — draw with APMN green/red coloring
    if (bo.$type === 'bpmn:StartEvent') {
      return this._drawEvent(parentNode, element, { icon: '', color: '#16a34a', type: '_startEvent' })
    }
    if (bo.$type === 'bpmn:EndEvent') {
      return this._drawEvent(parentNode, element, { icon: '', color: '#dc2626', type: '_endEvent' })
    }

    const info = this._resolveTypeInfo(element)
    if (!info) return this.bpmnRenderer.drawShape(parentNode, element)

    // Detect shape class by the BPMN base type of the element, not the info.bpmnType
    const baseType = bo.$type || ''
    const isGate  = baseType.includes('Gateway')
    const isEvent = baseType.includes('Event')

    if (isGate)  return this._drawGate(parentNode, element, info)
    if (isEvent) return this._drawEvent(parentNode, element, info)
    return this._drawTask(parentNode, element, info)
  }

  _drawTask(parentNode, element, info) {
    const { width, height } = element

    // Rounded rect background
    const rect = svgCreate('rect')
    svgAttr(rect, {
      x: 0, y: 0,
      width, height,
      rx: 8, ry: 8,
      fill: info.color,
      stroke: this._darken(info.color),
      strokeWidth: 2,
    })
    svgAppend(parentNode, rect)

    // Top colour strip
    const strip = svgCreate('rect')
    svgAttr(strip, {
      x: 0, y: 0,
      width, height: 6,
      rx: 8, ry: 8,
      fill: this._darken(info.color),
    })
    svgAppend(parentNode, strip)

    // Fix strip corners at bottom
    const stripFix = svgCreate('rect')
    svgAttr(stripFix, { x: 0, y: 3, width, height: 4, fill: this._darken(info.color) })
    svgAppend(parentNode, stripFix)

    // Icon
    const icon = svgCreate('text')
    svgAttr(icon, {
      x: width / 2, y: height / 2 - 6,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fill: 'white',
      fontSize: 20,
      fontFamily: 'system-ui, sans-serif',
    })
    icon.textContent = info.icon
    svgAppend(parentNode, icon)

    // Label
    const label = svgCreate('text')
    svgAttr(label, {
      x: width / 2, y: height / 2 + 16,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fill: 'white',
      fontSize: 10,
      fontWeight: '600',
      fontFamily: 'system-ui, sans-serif',
      letterSpacing: '0.02em',
    })
    label.textContent = info.label.toUpperCase()
    svgAppend(parentNode, label)

    // Element name below label
    const name = element.businessObject.name
    if (name) {
      const nameEl = svgCreate('text')
      svgAttr(nameEl, {
        x: width / 2, y: height - 10,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        fill: 'rgba(255,255,255,0.85)',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
      })
      nameEl.textContent = name.length > 18 ? name.slice(0, 17) + '…' : name
      svgAppend(parentNode, nameEl)
    }

    return rect
  }

  _drawEvent(parentNode, element, info) {
    const { width, height } = element
    const cx = width / 2
    const cy = height / 2
    const r  = Math.min(width, height) / 2 - 2

    const isEnd = info.type === '_endEvent'

    const circle = svgCreate('circle')
    svgAttr(circle, {
      cx, cy, r,
      fill: info.color,
      stroke: this._darken(info.color),
      strokeWidth: isEnd ? 4 : 2,
    })
    svgAppend(parentNode, circle)

    const icon = svgCreate('text')
    svgAttr(icon, {
      x: cx, y: cy + 1,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fill: 'white',
      fontSize: 14,
      fontFamily: 'system-ui, sans-serif',
    })
    icon.textContent = info.icon
    svgAppend(parentNode, icon)

    return circle
  }

  _drawGate(parentNode, element, info) {
    const { width, height } = element
    const cx = width / 2
    const cy = height / 2
    const r = Math.min(width, height) / 2 - 1

    // Diamond shape
    const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
    const diamond = svgCreate('polygon')
    svgAttr(diamond, {
      points: pts,
      fill: info.color,
      stroke: this._darken(info.color),
      strokeWidth: 2,
    })
    svgAppend(parentNode, diamond)

    if (info.icon) {
      // Icon fits inside the diamond's inscribed circle (radius r/√2 ≈ r*0.7)
      // Use fontSize 14 for single glyphs, 11 for two-char
      const fontSize = info.icon.length > 1 ? 11 : 15
      const icon = svgCreate('text')
      svgAttr(icon, {
        x: cx, y: cy + 1,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        fill: 'white',
        fontSize,
        fontWeight: '700',
        fontFamily: 'system-ui, "Segoe UI", sans-serif',
      })
      icon.textContent = info.icon
      svgAppend(parentNode, icon)
    }

    return diamond
  }

  getShapePath(shape) {
    // All bpmn:* types (including StartEvent, EndEvent, ExclusiveGateway, Task) delegate directly
    return this.bpmnRenderer.getShapePath(shape)
  }

  _darken(hex) {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.max(0, (n >> 16) - 40)
    const g = Math.max(0, ((n >> 8) & 0xff) - 40)
    const b = Math.max(0, (n & 0xff) - 40)
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
  }
}
