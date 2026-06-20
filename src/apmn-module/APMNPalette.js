import { APMN_TASKS, APMN_GATES } from './types.js'

export default class APMNPalette {
  static $inject = ['palette', 'create', 'elementFactory']

  constructor(palette, create, elementFactory) {
    this._create = create
    this._elementFactory = elementFactory
    palette.registerProvider(this)
  }

  getPaletteEntries() {
    const create = this._create
    const elementFactory = this._elementFactory

    const makeEntry = ({ type, label, icon, color, bpmnType }) => ({
      group: bpmnType === 'bpmn:ExclusiveGateway' ? 'apmn-gates' : 'apmn-tasks',
      title: label,
      html: this._makeIcon(icon, color, label),
      action: {
        dragstart: (event) => this._createShape(event, type, bpmnType, create, elementFactory),
        click:     (event) => this._createShape(event, type, bpmnType, create, elementFactory),
      },
    })

    const entries = {}
    for (const t of APMN_TASKS) entries[`create.apmn.${t.type}`] = makeEntry(t)
    entries['apmn-gate-separator'] = { group: 'apmn-gates', separator: true, title: '' }
    for (const g of APMN_GATES) entries[`create.apmn.${g.type}`] = makeEntry(g)

    return entries
  }

  _createShape(event, apmnType, bpmnType, create, elementFactory) {
    const isGate = bpmnType === 'bpmn:ExclusiveGateway'
    const shape = elementFactory.createShape({
      type: bpmnType,
      width: isGate ? 50 : 120,
      height: isGate ? 50 : 80,
    })
    shape.businessObject.$attrs = shape.businessObject.$attrs || {}
    shape.businessObject.$attrs['apmn:type'] = apmnType
    create.start(event, shape)
  }

  _makeIcon(icon, color, label) {
    const el = document.createElement('div')
    el.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:2px;
      padding:4px 2px; cursor:grab;
    `
    const chip = document.createElement('div')
    chip.style.cssText = `
      width:36px; height:36px; border-radius:8px;
      background:${color}; display:flex; align-items:center;
      justify-content:center; font-size:18px; box-shadow:0 1px 3px rgba(0,0,0,.25);
    `
    chip.textContent = icon

    const txt = document.createElement('span')
    txt.style.cssText = `font-size:9px; color:#555; text-align:center; line-height:1.1; max-width:46px;`
    txt.textContent = label

    el.appendChild(chip)
    el.appendChild(txt)
    return el
  }
}
