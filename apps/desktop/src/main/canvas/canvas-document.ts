/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas
 * @description Canvas Document
 */

export const CANVAS_DOCUMENT_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-forms";

/** Generated blocks share this opaque-origin document, never the privileged renderer. */
const runtime = String.raw`(() => {
  const realWindow = window, realDocument = document;
  const world = document.getElementById('world');
  const versions = new Map(), blocks = new Map(), pending = new Map();
  let port, executing, pan;
  const activation = navigator.userActivation;
  const activationGetter = activation && Object.getOwnPropertyDescriptor(Object.getPrototypeOf(activation), 'isActive')?.get;
  const isUserActive = activationGetter ? activationGetter.bind(activation) : () => false;
  const send = message => port?.postMessage(message);
  const error = record => {
    if (!record.disposed && !record.failed) {
      record.failed = true;
      for(const [id, clear] of record.timers) clear(id);
      for(const cleanup of record.listeners) cleanup();
      const badge = realDocument.createElement('div');
      badge.setAttribute('role','status'); badge.textContent = 'Block script failed';
      badge.style.cssText = 'position:absolute;bottom:0;left:0;padding:4px 8px;background:#fff0ed;color:#a12920;font:12px system-ui;z-index:2147483647';
      record.root.append(badge);
      send({type:'error', token:record.token, error:'SCRIPT_ERROR'});
    }
  };
  const guard = (record, fn) => function(...args) {
    if(record.disposed || record.failed) return;
    try {
      const value = fn.apply(this, args);
      if(value && typeof value.then === 'function') value.catch(() => error(record));
      return value;
    } catch { error(record); }
  };
  const dispose = record => {
    if(!record || record.disposed) return;
    record.disposed = true;
    for(const [id, clear] of record.timers) clear(id);
    for(const cleanup of record.listeners) cleanup();
    for(const [id, item] of pending) {
      if(item.token === record.token) {
        clearTimeout(item.timer); pending.delete(id);
        item.reject(new Error('Block version was replaced.'));
      }
    }
    record.callbacks.clear(); record.host.remove(); versions.delete(record.token);
  };
  const request = (record, type, payload) => new Promise((resolve,reject) => {
    if(record.disposed || record.failed || !record.snapshot) return reject(new Error('Block is not connected.'));
    if(type === 'action' && !isUserActive()) return reject(new Error('Actions require a user interaction.'));
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Block request timed out.')); },15000);
    pending.set(requestId,{resolve,reject,timer,token:record.token});
    send({type,token:record.token,requestId,...payload});
  });
  const scopedEvents = (record, target) => {
    const registrations = [];
    return {
      addEventListener(type, listener, options) {
        const callback = guard(record, typeof listener === 'function' ? listener : event => listener.handleEvent(event));
        target.addEventListener(type, callback, options);
        const cleanup = () => target.removeEventListener(type,callback,options);
        registrations.push({type,listener,options,cleanup}); record.listeners.push(cleanup);
      },
      removeEventListener(type, listener, options) {
        const capture = value => typeof value === 'boolean' ? value : !!value?.capture;
        for(const item of registrations) {
          if(item.type === type && item.listener === listener && capture(item.options) === capture(options)) item.cleanup();
        }
      }
    };
  };
  const update = (record, snapshot) => {
    if(!record || record.disposed || record.failed) return;
    record.snapshot = snapshot;
    for(const fn of record.callbacks) guard(record,fn)(structuredClone(snapshot));
  };
  const position = (record, bounds) => {
    Object.assign(record.host.style,{transform:'translate('+bounds.x+'px,'+bounds.y+'px)',width:bounds.width+'px',height:bounds.height+'px'});
  };
  const create = message => {
    const previous = blocks.get(message.id);
    if(previous?.candidate) dispose(previous.candidate);
    previous?.errorHost?.remove();
    const host = realDocument.createElement('div');
    host.className = 'block'; host.dataset.blockId = message.id; host.style.visibility = 'hidden';
    world.append(host);
    const root = host.attachShadow({mode:'closed'});
    const record = {token:message.token,id:message.id,host,root,snapshot:message.snapshot,callbacks:new Set(),timers:new Map(),listeners:[],disposed:false,failed:false};
    versions.set(record.token,record);
    const slot = {displayed:previous?.displayed,candidate:record};
    blocks.set(message.id,slot);
    position(record,message.bounds);
    const base = realDocument.createElement('style');
    base.textContent = ':host{color:#253c34;font:16px system-ui;color-scheme:light dark}*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%}@media(prefers-color-scheme:dark){:host{color:#e7efeb}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}';
    const style = realDocument.createElement('style'); style.textContent = message.source.css;
    const html = realDocument.createElement('html');
    const body = realDocument.createElement('body');
    body.innerHTML = message.source.html;
    html.append(body); root.append(base,style,html);
    const events = scopedEvents(record,root), windowEvents = scopedEvents(record,realWindow);
    const localDocument = new Proxy(realDocument, {get(target,key) {
      if(key === 'body') return body;
      if(key === 'documentElement') return html;
      if(key === 'head') return root;
      if(key === 'querySelector') return selector => selector === 'body' || selector === 'html' ? body : root.querySelector(selector);
      if(key === 'querySelectorAll') return selector => root.querySelectorAll(selector);
      if(key === 'getElementById') return id => root.getElementById(id);
      if(key in events) return events[key];
      const value = Reflect.get(target,key,target);
      return typeof value === 'function' ? value.bind(target) : value;
    }});
    const timeout = (fn, delay, ...args) => {
      const id = realWindow.setTimeout(() => { record.timers.delete(id); guard(record,fn)(...args); },delay);
      record.timers.set(id,realWindow.clearTimeout.bind(realWindow)); return id;
    };
    const interval = (fn, delay, ...args) => {
      const id = realWindow.setInterval(guard(record,() => fn(...args)),delay);
      record.timers.set(id,realWindow.clearInterval.bind(realWindow)); return id;
    };
    const animation = fn => {
      const id = realWindow.requestAnimationFrame(time => { record.timers.delete('animation:'+id); guard(record,fn)(time); });
      record.timers.set('animation:'+id,() => realWindow.cancelAnimationFrame(id)); return id;
    };
    const clear = id => { realWindow.clearTimeout(id); realWindow.clearInterval(id); record.timers.delete(id); };
    const cancelAnimation = id => { realWindow.cancelAnimationFrame(id); record.timers.delete('animation:'+id); };
    const bridge = Object.freeze({
      onData(fn) { record.callbacks.add(fn); if(record.snapshot) guard(record,fn)(structuredClone(record.snapshot)); return () => record.callbacks.delete(fn); },
      getSnapshot() { return record.snapshot ? structuredClone(record.snapshot) : undefined; },
      action(actionId,input={}) { return request(record,'action',{actionId,input,expectedDataRevision:record.snapshot?.dataRevision,...(record.snapshot?.question ? {expectedQuestionRevision:record.snapshot.question.revision} : {})}); },
      saveState(state) { return request(record,'state',{state,expectedStateRevision:record.snapshot?.stateRevision}); }
    });
    const overrides = {document:localDocument,avesBlock:bridge,setTimeout:timeout,setInterval:interval,clearTimeout:clear,clearInterval:clear,requestAnimationFrame:animation,cancelAnimationFrame:cancelAnimation,...windowEvents};
    const localWindow = new Proxy(realWindow,{get(target,key) {
      if(key === 'window' || key === 'self' || key === 'globalThis') return localWindow;
      if(key in overrides) return overrides[key];
      const value = Reflect.get(target,key,target);
      return typeof value === 'function' && !/^[A-Z]/.test(String(key)) ? value.bind(target) : value;
    }});
    const entry = '__aves_'+crypto.randomUUID().replaceAll('-','');
    realWindow[entry] = fn => guard(record,fn)(localWindow,localDocument,bridge,timeout,interval,clear,clear,animation,cancelAnimation,windowEvents.addEventListener,windowEvents.removeEventListener,localWindow,localWindow);
    const script = realDocument.createElement('script');
    script.textContent = 'globalThis['+JSON.stringify(entry)+'](function(window,document,avesBlock,setTimeout,setInterval,clearTimeout,clearInterval,requestAnimationFrame,cancelAnimationFrame,addEventListener,removeEventListener,self,globalThis){"use strict";\n'+message.source.js+'\n});\n//# sourceURL=aves-block-code://'+record.token;
    executing = record;
    try { root.append(script); } catch { error(record); }
    finally { executing = undefined; delete realWindow[entry]; script.remove(); }
    if(record.failed) {
      dispose(record); slot.candidate = undefined;
      if(!slot.displayed) { host.style.visibility = ''; root.replaceChildren(); const note=realDocument.createElement('div'); note.setAttribute('role','status'); note.textContent='Block could not be displayed'; root.append(note); world.append(host); slot.errorHost = host; }
      return;
    }
    slot.errorHost?.remove();
    dispose(slot.displayed); slot.displayed = record; slot.candidate = undefined;
    host.style.visibility = '';
    send({type:'ready',token:record.token});
  };
  const failedSource = location => {
    if(typeof location !== 'string') return;
    for(const record of versions.values()) {
      if(location.includes('aves-block-code://'+record.token)) return record;
    }
  };
  realWindow.addEventListener('error',event => {
    const record = executing || failedSource(event.filename) || failedSource(event.error?.stack);
    if(record) { error(record); event.preventDefault(); }
  });
  realWindow.addEventListener('unhandledrejection',event => {
    const record = failedSource(event.reason?.stack);
    if(record) { error(record); event.preventDefault(); }
  });
  realWindow.addEventListener('message',event => {
    if(event.source !== parent || event.data?.type !== 'aves:canvas:connect' || !event.ports[0] || port) return;
    port = event.ports[0];
    port.onmessage = ({data:message}) => {
      if(message.type === 'upsert') create(message);
      else if(message.type === 'snapshot') update(versions.get(message.token),message.snapshot);
      else if(message.type === 'layout') {
        const slot = blocks.get(message.id);
        if(slot?.displayed) position(slot.displayed,message.bounds);
        if(slot?.candidate) position(slot.candidate,message.bounds);
      } else if(message.type === 'remove') {
        const slot = blocks.get(message.id); dispose(slot?.candidate); dispose(slot?.displayed); slot?.errorHost?.remove(); blocks.delete(message.id);
      } else if(message.type === 'viewport') {
        world.style.transform = 'translate('+message.x+'px,'+message.y+'px) scale('+message.zoom+')';
      } else if(message.type === 'result') {
        const item = pending.get(message.requestId);
        if(!item || item.token !== message.token) return;
        pending.delete(message.requestId); clearTimeout(item.timer);
        if(message.ok) item.resolve(message.result); else item.reject(new Error(message.error || 'Block request failed.'));
      }
    };
    port.start(); send({type:'connected'});
  });
  const interaction = value => send({type:'interaction',...value});
  realDocument.addEventListener('wheel', event => {
    event.preventDefault();
    interaction({kind:'wheel',x:event.clientX,y:event.clientY,delta:event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1)});
  },{passive:false});
  realDocument.addEventListener('contextmenu',event => { event.preventDefault(); interaction({kind:'menu',x:event.clientX,y:event.clientY}); });
  realDocument.addEventListener('pointerdown',event => {
    if(event.button !== 0 || event.composedPath().some(node => node instanceof HTMLElement && node.classList.contains('block'))) return;
    pan = {x:event.clientX,y:event.clientY}; realDocument.documentElement.setPointerCapture(event.pointerId);
  });
  realDocument.addEventListener('pointermove',event => {
    if(!pan) return;
    interaction({kind:'pan',dx:event.clientX-pan.x,dy:event.clientY-pan.y}); pan = {x:event.clientX,y:event.clientY};
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']) realDocument.addEventListener(type,() => { pan = undefined; });
  realDocument.addEventListener('keydown',event => {
    let command;
    if((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') command = 'controller';
    else if((event.metaKey || event.ctrlKey) && event.key === '0') command = 'reset';
    else if(event.key === 'Escape') command = 'escape';
    if(command) { event.preventDefault(); interaction({kind:'key',command}); }
    else if(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); interaction({kind:'menu',x:160,y:120}); }
  });
})();`;

export function canvasDocument(): string {

    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:clip;background:transparent}body{cursor:grab;touch-action:none}body:active{cursor:grabbing}#world{position:absolute;inset:0;pointer-events:none;transform-origin:0 0}.block{position:absolute;left:0;top:0;pointer-events:auto;cursor:auto;isolation:isolate;contain:layout style;overflow:clip}</style></head><body><div id="world"></div><script>${runtime}</script></body></html>`;
}
