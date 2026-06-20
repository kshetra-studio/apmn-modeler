import APMNRenderer from './APMNRenderer.js'

// Replaces the built-in bpmn-js paletteProvider with a no-op.
// We use our own custom sidebar — bpmn-js palette is hidden and not needed.
class NoOpPaletteProvider {
  static $inject = ['palette']
  constructor(palette) { palette.registerProvider(this) }
  getPaletteEntries() { return {} }
}

export default {
  __init__: ['apmnRenderer', 'paletteProvider'],
  apmnRenderer:   ['type', APMNRenderer],
  paletteProvider: ['type', NoOpPaletteProvider],  // overrides the built-in BpmnPaletteProvider
}
