# Third-Party Licenses

APMN Modeler is original Kshetra Studio code (MIT, see `LICENSE`) layered on
top of the following upstream open-source projects. None of these upstream
projects are modified at the source — we depend on their published packages
and add our own modules (`src/apmn-module/*`, `src/io/*`, palette, sidebar,
renderer, YAML import/export) on top, the same way a fork like Cursor adds
its own layer on top of unmodified VS Code OSS.

| Package | License | Notes |
|---|---|---|
| [bpmn-js](https://github.com/bpmn-io/bpmn-js) | [bpmn.io License](http://bpmn.io/license) (MIT-style) | **Binding condition:** the "Powered by bpmn.io" watermark must remain visible and unobscured in the rendered canvas. We do not remove or override it. |
| [diagram-js](https://github.com/bpmn-io/diagram-js) | MIT | |
| [bpmn-auto-layout](https://github.com/bpmn-io/bpmn-auto-layout) | MIT | |
| [tiny-svg](https://github.com/bpmn-io/tiny-svg) | MIT | |
| [js-yaml](https://github.com/nodeca/js-yaml) | MIT | |

No GPL/AGPL or other copyleft dependencies are used. Nothing in this project
requires us to upstream changes to bpmn.io's own repositories — we are not
modifying their source, only building on their public API surface, so there
is no PR obligation back to bpmn-js/diagram-js/bpmn-auto-layout itself.
