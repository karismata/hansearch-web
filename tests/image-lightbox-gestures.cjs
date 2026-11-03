const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript');
const { JSDOM } = require(process.env.JSDOM_MODULE || 'jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://hansearch-web.pages.dev' });
global.window = dom.window; global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement; global.IS_REACT_ACT_ENVIRONMENT = true;
let coarse = true, frameId = 0;
window.matchMedia = () => ({ matches: coarse });
const frames = new Map();
window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
window.cancelAnimationFrame = id => frames.delete(id);
const captures = new Set();
window.HTMLElement.prototype.setPointerCapture = id => captures.add(id);
window.HTMLElement.prototype.hasPointerCapture = id => captures.has(id);
window.HTMLElement.prototype.releasePointerCapture = id => captures.delete(id);
class Pointer extends window.MouseEvent {
  constructor(type, data) { super(type, { bubbles: true, cancelable: true, ...data }); Object.defineProperties(this, {
    pointerId: { value: data.pointerId }, pointerType: { value: data.pointerType || 'touch' },
  }); }
}
const React = require('react'), { act } = React, { createRoot } = require('react-dom/client');
function load(file, mocks = {}) {
  const name = path.resolve(file), m = new Module(name, module);
  m.filename = name; m.paths = Module._nodeModulePaths(process.cwd());
  const original = m.require.bind(m); m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  m._compile(ts.transpileModule(fs.readFileSync(name, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } }).outputText, name);
  return m.exports;
}
const hook = load('src/hooks/useImageGestures.ts');
const { ImageLightbox } = load('src/components/ImageLightbox.tsx', { '../hooks/useImageGestures': hook });
const images = ['https://example.test/a.png', 'https://example.test/b.png'];
let closes = 0, commits = 0, layoutReads = 0;
const onClose = () => closes++;
const view = (open = true) => React.createElement(React.Profiler, { id: 'viewer', onRender: () => commits++ },
  React.createElement(ImageLightbox, { images, isOpen: open, onClose }));
const fire = async (target, type, id, x, y, pointerType = 'touch') => {
  await act(async () => target.dispatchEvent(new Pointer(type, { pointerId: id, clientX: x, clientY: y, pointerType, button: 0 })));
};
function flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(0)); }
function value(image) {
  const match = image.style.transform.match(/translate3d\(([-\d.e]+)px, ([-\d.e]+)px, 0\) scale\(([-\d.e]+)\)/);
  assert(match, image.style.transform); return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
}
function measure(viewport) {
  viewport.getBoundingClientRect = () => { layoutReads++; return { left: 0, top: 0, width: 400, height: 800 }; };
}
(async () => {
  const container = document.getElementById('root');
  let root = createRoot(container);
  await act(async () => root.render(view()));
  let image = container.querySelector('img'), viewport = image.parentElement;
  measure(viewport);
  assert.equal(image.style.transition, 'none'); assert.equal(image.style.willChange, 'transform');
  assert(!container.firstElementChild.className.includes('backdrop-blur'));
  assert.equal(document.body.style.overflow, 'hidden');
  await fire(viewport, 'pointerdown', 1, 100, 400);
  await fire(viewport, 'pointerdown', 2, 200, 400);
  const startCommits = commits, startReads = layoutReads;
  for (let i = 1; i <= 20; i++) {
    await fire(viewport, 'pointermove', 1, 100 - i * 5, 400);
    await fire(viewport, 'pointermove', 2, 200 + i * 5, 400);
  }
  assert.equal(commits, startCommits, 'Pointer moves must not trigger React commits');
  assert.equal(layoutReads, startReads, 'Pinch moves must not force viewport layout reads');
  assert.equal(frames.size, 1, 'A burst of moves schedules only one paint');
  flush(); assert.deepEqual(value(image), { x: 100, y: 0, zoom: 3 });
  await act(async () => root.render(view()));
  assert.equal(value(image).zoom, 3, 'Parent renders must not overwrite an active zoom');
  await fire(viewport, 'pointerup', 1, 0, 400);
  await fire(viewport, 'pointermove', 2, 320, 410); flush();
  assert.deepEqual(value(image), { x: 120, y: 10, zoom: 3 });
  await fire(viewport, 'pointerdown', 3, 220, 410); flush();
  assert.equal(value(image).zoom, 3, 'Adding the second finger again must not jump');
  await fire(viewport, 'pointermove', 2, 340, 410);
  await fire(viewport, 'pointermove', 3, 200, 410); flush();
  assert(Math.abs(value(image).zoom - 4.2) < 1e-10);
  await fire(viewport, 'pointermove', 2, 400, 410);
  await fire(viewport, 'pointermove', 3, 100, 410); flush(); assert.equal(value(image).zoom, 5);
  await fire(viewport, 'pointermove', 2, 280, 410);
  await fire(viewport, 'pointermove', 3, 260, 410); flush();
  assert.deepEqual(value(image), { x: 0, y: 0, zoom: 1 });
  await fire(viewport, 'pointerup', 3, 260, 410);
  await fire(viewport, 'pointermove', 2, 10, 410);
  await fire(viewport, 'pointerup', 2, 10, 410); flush();
  assert.equal(container.querySelector('img').getAttribute('src'), images[0], 'Remaining finger after pinch must not swipe');
  await fire(viewport, 'pointerdown', 4, 300, 400);
  await fire(viewport, 'pointermove', 4, 80, 405);
  await fire(viewport, 'pointerup', 4, 80, 405); flush();
  image = container.querySelector('img'); assert.equal(image.getAttribute('src'), images[1]);
  assert.equal(value(image).zoom, 1); assert.equal(closes, 0);
  await fire(viewport, 'pointerdown', 5, 100, 400);
  await fire(viewport, 'pointerdown', 6, 200, 400);
  await fire(viewport, 'pointermove', 6, 250, 400);
  await fire(viewport, 'pointercancel', 6, 250, 400);
  await act(async () => root.render(view(false)));
  assert.equal(frames.size, 0, 'Closing cancels pending transform work');
  assert.equal(document.body.style.overflow, '');
  await act(async () => root.unmount());

  coarse = false; root = createRoot(container);
  await act(async () => root.render(view()));
  image = container.querySelector('img'); viewport = image.parentElement; measure(viewport);
  const overlay = container.firstElementChild;
  for (let i = 0; i < 2; i++) {
    const wheel = new window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 200, clientY: 400 });
    await act(async () => overlay.dispatchEvent(wheel)); assert(wheel.defaultPrevented);
  }
  flush(); assert(Math.abs(value(image).zoom - Math.exp(0.16)) < 1e-10, 'Wheel deltas accumulate before painting');
  await fire(viewport, 'pointerdown', 10, 200, 400, 'mouse');
  await fire(viewport, 'pointermove', 10, 230, 410, 'mouse'); flush();
  assert.equal(value(image).x, 30); assert.equal(value(image).y, 10);
  await fire(viewport, 'pointerup', 10, 230, 410, 'mouse');
  await act(async () => viewport.click()); assert.equal(closes, 0);
  await act(async () => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' })));
  assert.equal(container.querySelector('img').getAttribute('src'), images[1]);
  assert.equal(value(container.querySelector('img')).zoom, 1);
  await act(async () => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(closes, 1);
  await act(async () => root.unmount()); assert.equal(frames.size, 0);
  dom.window.close();
  console.log('PASS: frame-coalesced pinch without React renders/layout reads, anchored zoom, regrip/pan continuity, limits, swipe, cancellation, desktop wheel/drag and cleanup');
})().catch(error => { console.error(error); process.exit(1); });

