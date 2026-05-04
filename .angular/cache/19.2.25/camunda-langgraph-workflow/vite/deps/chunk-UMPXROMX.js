// node_modules/ids/dist/index.js
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var hat$1 = {
  exports: {}
};
var hasRequiredHat;
function requireHat() {
  if (hasRequiredHat) return hat$1.exports;
  hasRequiredHat = 1;
  var hat2 = hat$1.exports = function(bits, base) {
    if (!base) base = 16;
    if (bits === void 0) bits = 128;
    if (bits <= 0) return "0";
    var digits = Math.log(Math.pow(2, bits)) / Math.log(base);
    for (var i = 2; digits === Infinity; i *= 2) {
      digits = Math.log(Math.pow(2, bits / i)) / Math.log(base) * i;
    }
    var rem = digits - Math.floor(digits);
    var res = "";
    for (var i = 0; i < Math.floor(digits); i++) {
      var x = Math.floor(Math.random() * base).toString(base);
      res = x + res;
    }
    if (rem) {
      var b = Math.pow(base, rem);
      var x = Math.floor(Math.random() * b).toString(base);
      res = x + res;
    }
    var parsed = parseInt(res, base);
    if (parsed !== Infinity && parsed >= Math.pow(2, bits)) {
      return hat2(bits, base);
    } else return res;
  };
  hat2.rack = function(bits, base, expandBy) {
    var fn = function(data) {
      var iters = 0;
      do {
        if (iters++ > 10) {
          if (expandBy) bits += expandBy;
          else throw new Error("too many ID collisions, use more bits");
        }
        var id = hat2(bits, base);
      } while (Object.hasOwnProperty.call(hats, id));
      hats[id] = data;
      return id;
    };
    var hats = fn.hats = {};
    fn.get = function(id) {
      return fn.hats[id];
    };
    fn.set = function(id, value) {
      fn.hats[id] = value;
      return fn;
    };
    fn.bits = bits || 128;
    fn.base = base || 16;
    return fn;
  };
  return hat$1.exports;
}
var hatExports = requireHat();
var hat = getDefaultExportFromCjs(hatExports);
function Ids(seed) {
  if (!(this instanceof Ids)) {
    return new Ids(seed);
  }
  seed = seed || [128, 36, 1];
  this._seed = seed.length ? hat.rack(seed[0], seed[1], seed[2]) : seed;
}
Ids.prototype.next = function(element) {
  return this._seed(element || true);
};
Ids.prototype.nextPrefixed = function(prefix, element) {
  var id;
  do {
    id = prefix + this.next(true);
  } while (this.assigned(id));
  this.claim(id, element);
  return id;
};
Ids.prototype.claim = function(id, element) {
  this._seed.set(id, element || true);
};
Ids.prototype.assigned = function(id) {
  return this._seed.get(id) || false;
};
Ids.prototype.unclaim = function(id) {
  delete this._seed.hats[id];
};
Ids.prototype.clear = function() {
  var hats = this._seed.hats, id;
  for (id in hats) {
    this.unclaim(id);
  }
};

// node_modules/min-dash/dist/index.js
function flatten(arr) {
  return Array.prototype.concat.apply([], arr);
}
var nativeToString = Object.prototype.toString;
var nativeHasOwnProperty = Object.prototype.hasOwnProperty;
function isUndefined(obj) {
  return obj === void 0;
}
function isDefined(obj) {
  return obj !== void 0;
}
function isNil(obj) {
  return obj == null;
}
function isArray(obj) {
  return nativeToString.call(obj) === "[object Array]";
}
function isObject(obj) {
  return nativeToString.call(obj) === "[object Object]";
}
function isNumber(obj) {
  return nativeToString.call(obj) === "[object Number]";
}
function isFunction(obj) {
  const tag = nativeToString.call(obj);
  return tag === "[object Function]" || tag === "[object AsyncFunction]" || tag === "[object GeneratorFunction]" || tag === "[object AsyncGeneratorFunction]" || tag === "[object Proxy]";
}
function isString(obj) {
  return nativeToString.call(obj) === "[object String]";
}
function ensureArray(obj) {
  if (isArray(obj)) {
    return;
  }
  throw new Error("must supply array");
}
function has(target, key) {
  return !isNil(target) && nativeHasOwnProperty.call(target, key);
}
function find(collection, matcher) {
  const matchFn = toMatcher(matcher);
  let match;
  forEach(collection, function(val, key) {
    if (matchFn(val, key)) {
      match = val;
      return false;
    }
  });
  return match;
}
function findIndex(collection, matcher) {
  const matchFn = toMatcher(matcher);
  let idx = isArray(collection) ? -1 : void 0;
  forEach(collection, function(val, key) {
    if (matchFn(val, key)) {
      idx = key;
      return false;
    }
  });
  return idx;
}
function filter(collection, matcher) {
  const matchFn = toMatcher(matcher);
  let result = [];
  forEach(collection, function(val, key) {
    if (matchFn(val, key)) {
      result.push(val);
    }
  });
  return result;
}
function forEach(collection, iterator) {
  let val, result;
  if (isUndefined(collection)) {
    return;
  }
  const convertKey = isArray(collection) ? toNum : identity;
  for (let key in collection) {
    if (has(collection, key)) {
      val = collection[key];
      result = iterator(val, convertKey(key));
      if (result === false) {
        return val;
      }
    }
  }
}
function without(arr, matcher) {
  if (isUndefined(arr)) {
    return [];
  }
  ensureArray(arr);
  const matchFn = toMatcher(matcher);
  return arr.filter(function(el, idx) {
    return !matchFn(el, idx);
  });
}
function reduce(collection, iterator, result) {
  forEach(collection, function(value, idx) {
    result = iterator(result, value, idx);
  });
  return result;
}
function every(collection, matcher) {
  return !!reduce(collection, function(matches2, val, key) {
    return matches2 && matcher(val, key);
  }, true);
}
function some(collection, matcher) {
  return !!find(collection, matcher);
}
function map(collection, fn) {
  let result = [];
  forEach(collection, function(val, key) {
    result.push(fn(val, key));
  });
  return result;
}
function keys(collection) {
  return collection && Object.keys(collection) || [];
}
function size(collection) {
  return keys(collection).length;
}
function values(collection) {
  return map(collection, (val) => val);
}
function groupBy(collection, extractor, grouped = {}) {
  extractor = toExtractor(extractor);
  forEach(collection, function(val) {
    let discriminator = extractor(val) || "_";
    let group = grouped[discriminator];
    if (!group) {
      group = grouped[discriminator] = [];
    }
    group.push(val);
  });
  return grouped;
}
function uniqueBy(extractor, ...collections) {
  extractor = toExtractor(extractor);
  let grouped = {};
  forEach(collections, (c) => groupBy(c, extractor, grouped));
  let result = map(grouped, function(val, key) {
    return val[0];
  });
  return result;
}
var unionBy = uniqueBy;
function sortBy(collection, extractor) {
  extractor = toExtractor(extractor);
  let sorted = [];
  forEach(collection, function(value, key) {
    let disc = extractor(value, key);
    let entry = {
      d: disc,
      v: value
    };
    for (var idx = 0; idx < sorted.length; idx++) {
      let {
        d
      } = sorted[idx];
      if (disc < d) {
        sorted.splice(idx, 0, entry);
        return;
      }
    }
    sorted.push(entry);
  });
  return map(sorted, (e) => e.v);
}
function matchPattern(pattern) {
  return function(el) {
    return every(pattern, function(val, key) {
      return el[key] === val;
    });
  };
}
function toExtractor(extractor) {
  return isFunction(extractor) ? extractor : (e) => {
    return e[extractor];
  };
}
function toMatcher(matcher) {
  return isFunction(matcher) ? matcher : (e) => {
    return e === matcher;
  };
}
function identity(arg) {
  return arg;
}
function toNum(arg) {
  return Number(arg);
}
function debounce(fn, timeout) {
  let timer;
  let lastArgs;
  let lastThis;
  let lastNow;
  function fire(force) {
    let now = Date.now();
    let scheduledDiff = force ? 0 : lastNow + timeout - now;
    if (scheduledDiff > 0) {
      return schedule(scheduledDiff);
    }
    fn.apply(lastThis, lastArgs);
    clear2();
  }
  function schedule(timeout2) {
    timer = setTimeout(fire, timeout2);
  }
  function clear2() {
    if (timer) {
      clearTimeout(timer);
    }
    timer = lastNow = lastArgs = lastThis = void 0;
  }
  function flush() {
    if (timer) {
      fire(true);
    }
    clear2();
  }
  function callback(...args) {
    lastNow = Date.now();
    lastArgs = args;
    lastThis = this;
    if (!timer) {
      schedule(timeout);
    }
  }
  callback.flush = flush;
  callback.cancel = clear2;
  return callback;
}
function bind(fn, target) {
  return fn.bind(target);
}
function assign(target, ...others) {
  return Object.assign(target, ...others);
}
function set(target, path, value) {
  let currentTarget = target;
  forEach(path, function(key, idx) {
    if (typeof key !== "number" && typeof key !== "string") {
      throw new Error("illegal key type: " + typeof key + ". Key should be of type number or string.");
    }
    if (key === "constructor") {
      throw new Error("illegal key: constructor");
    }
    if (key === "__proto__") {
      throw new Error("illegal key: __proto__");
    }
    let nextKey = path[idx + 1];
    let nextTarget = currentTarget[key];
    if (isDefined(nextKey) && isNil(nextTarget)) {
      nextTarget = currentTarget[key] = isNaN(+nextKey) ? {} : [];
    }
    if (isUndefined(nextKey)) {
      if (isUndefined(value)) {
        delete currentTarget[key];
      } else {
        currentTarget[key] = value;
      }
    } else {
      currentTarget = nextTarget;
    }
  });
  return target;
}
function get(target, path, defaultValue) {
  let currentTarget = target;
  forEach(path, function(key) {
    if (isNil(currentTarget)) {
      currentTarget = void 0;
      return false;
    }
    currentTarget = currentTarget[key];
  });
  return isUndefined(currentTarget) ? defaultValue : currentTarget;
}
function pick(target, properties) {
  let result = {};
  let obj = Object(target);
  forEach(properties, function(prop) {
    if (prop in obj) {
      result[prop] = target[prop];
    }
  });
  return result;
}
function omit(target, properties) {
  let result = {};
  let obj = Object(target);
  forEach(obj, function(prop, key) {
    if (properties.indexOf(key) === -1) {
      result[key] = prop;
    }
  });
  return result;
}

// node_modules/domify/index.js
var wrapMap = {
  legend: [1, "<fieldset>", "</fieldset>"],
  tr: [2, "<table><tbody>", "</tbody></table>"],
  col: [2, "<table><tbody></tbody><colgroup>", "</colgroup></table>"],
  _default: [0, "", ""]
};
wrapMap.td = wrapMap.th = [3, "<table><tbody><tr>", "</tr></tbody></table>"];
wrapMap.option = wrapMap.optgroup = [1, '<select multiple="multiple">', "</select>"];
wrapMap.thead = wrapMap.tbody = wrapMap.colgroup = wrapMap.caption = wrapMap.tfoot = [1, "<table>", "</table>"];
wrapMap.polyline = wrapMap.ellipse = wrapMap.polygon = wrapMap.circle = wrapMap.text = wrapMap.line = wrapMap.path = wrapMap.rect = wrapMap.g = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">', "</svg>"];
function domify(htmlString, document2 = globalThis.document) {
  if (typeof htmlString !== "string") {
    throw new TypeError("String expected");
  }
  const commentMatch = /^<!--(.*?)-->$/s.exec(htmlString);
  if (commentMatch) {
    return document2.createComment(commentMatch[1]);
  }
  const tagName = /<([\w:]+)/.exec(htmlString)?.[1];
  if (!tagName) {
    return document2.createTextNode(htmlString);
  }
  htmlString = htmlString.trim();
  if (tagName === "body") {
    const element2 = document2.createElement("html");
    element2.innerHTML = htmlString;
    const {
      lastChild
    } = element2;
    lastChild.remove();
    return lastChild;
  }
  let [depth, prefix, suffix] = Object.hasOwn(wrapMap, tagName) ? wrapMap[tagName] : wrapMap._default;
  let element = document2.createElement("div");
  element.innerHTML = prefix + htmlString + suffix;
  while (depth--) {
    element = element.lastChild;
  }
  if (element.firstChild === element.lastChild) {
    const {
      firstChild
    } = element;
    firstChild.remove();
    return firstChild;
  }
  const fragment = document2.createDocumentFragment();
  fragment.append(...element.childNodes);
  return fragment;
}

// node_modules/min-dom/dist/index.js
function _mergeNamespaces(n, m) {
  m.forEach(function(e) {
    e && typeof e !== "string" && !Array.isArray(e) && Object.keys(e).forEach(function(k) {
      if (k !== "default" && !(k in n)) {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function() {
            return e[k];
          }
        });
      }
    });
  });
  return Object.freeze(n);
}
function assign2(element, ...styleSources) {
  const target = element.style;
  forEach(styleSources, function(style) {
    if (!style) {
      return;
    }
    forEach(style, function(value, key) {
      target[key] = value;
    });
  });
  return element;
}
function attr(el, name, val) {
  if (arguments.length == 2) {
    return el.getAttribute(name);
  }
  if (val === null) {
    return el.removeAttribute(name);
  }
  el.setAttribute(name, val);
  return el;
}
var toString = Object.prototype.toString;
function classes(el) {
  return new ClassList(el);
}
function ClassList(el) {
  if (!el || !el.nodeType) {
    throw new Error("A DOM element reference is required");
  }
  this.el = el;
  this.list = el.classList;
}
ClassList.prototype.add = function(name) {
  this.list.add(name);
  return this;
};
ClassList.prototype.remove = function(name) {
  if ("[object RegExp]" == toString.call(name)) {
    return this.removeMatching(name);
  }
  this.list.remove(name);
  return this;
};
ClassList.prototype.removeMatching = function(re) {
  const arr = this.array();
  for (let i = 0; i < arr.length; i++) {
    if (re.test(arr[i])) {
      this.remove(arr[i]);
    }
  }
  return this;
};
ClassList.prototype.toggle = function(name, force) {
  if ("undefined" !== typeof force) {
    if (force !== this.list.toggle(name, force)) {
      this.list.toggle(name);
    }
  } else {
    this.list.toggle(name);
  }
  return this;
};
ClassList.prototype.array = function() {
  return Array.from(this.list);
};
ClassList.prototype.has = ClassList.prototype.contains = function(name) {
  return this.list.contains(name);
};
function clear(element) {
  var child;
  while (child = element.firstChild) {
    element.removeChild(child);
  }
  return element;
}
function closest(element, selector, checkYourSelf) {
  var actualElement = checkYourSelf ? element : element.parentNode;
  return actualElement && typeof actualElement.closest === "function" && actualElement.closest(selector) || null;
}
function getDefaultExportFromCjs2(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var componentEvent = {};
var hasRequiredComponentEvent;
function requireComponentEvent() {
  if (hasRequiredComponentEvent) return componentEvent;
  hasRequiredComponentEvent = 1;
  var bind3, unbind2, prefix;
  function detect() {
    bind3 = window.addEventListener ? "addEventListener" : "attachEvent";
    unbind2 = window.removeEventListener ? "removeEventListener" : "detachEvent";
    prefix = bind3 !== "addEventListener" ? "on" : "";
  }
  componentEvent.bind = function(el, type, fn, capture) {
    if (!bind3) detect();
    el[bind3](prefix + type, fn, capture || false);
    return fn;
  };
  componentEvent.unbind = function(el, type, fn, capture) {
    if (!unbind2) detect();
    el[unbind2](prefix + type, fn, capture || false);
    return fn;
  };
  return componentEvent;
}
var componentEventExports = requireComponentEvent();
var index = getDefaultExportFromCjs2(componentEventExports);
var event = _mergeNamespaces({
  __proto__: null,
  default: index
}, [componentEventExports]);
var forceCaptureEvents = ["focus", "blur"];
function bind2(el, selector, type, fn, capture) {
  if (forceCaptureEvents.indexOf(type) !== -1) {
    capture = true;
  }
  return event.bind(el, type, function(e) {
    var target = e.target || e.srcElement;
    e.delegateTarget = closest(target, selector, true);
    if (e.delegateTarget) {
      fn.call(el, e);
    }
  }, capture);
}
function unbind(el, type, fn, capture) {
  if (forceCaptureEvents.indexOf(type) !== -1) {
    capture = true;
  }
  return event.unbind(el, type, fn, capture);
}
var delegate = {
  bind: bind2,
  unbind
};
function matches(element, selector) {
  return element && typeof element.matches === "function" && element.matches(selector) || false;
}
function query(selector, el) {
  el = el || document;
  return el.querySelector(selector);
}
function all(selector, el) {
  el = el || document;
  return el.querySelectorAll(selector);
}
function remove(el) {
  el.parentNode && el.parentNode.removeChild(el);
}

// node_modules/diagram-js/lib/util/Collections.js
function remove2(collection, element) {
  if (!collection || !element) {
    return -1;
  }
  var idx = collection.indexOf(element);
  if (idx !== -1) {
    collection.splice(idx, 1);
  }
  return idx;
}
function add(collection, element, idx) {
  if (!collection || !element) {
    return;
  }
  if (typeof idx !== "number") {
    idx = -1;
  }
  var currentIdx = collection.indexOf(element);
  if (currentIdx !== -1) {
    if (currentIdx === idx) {
      return;
    } else {
      if (idx !== -1) {
        collection.splice(currentIdx, 1);
      } else {
        return;
      }
    }
  }
  if (idx !== -1) {
    collection.splice(idx, 0, element);
  } else {
    collection.push(element);
  }
}
function indexOf(collection, element) {
  if (!collection || !element) {
    return -1;
  }
  return collection.indexOf(element);
}

// node_modules/bpmn-js/lib/util/ModelUtil.js
function is(element, type) {
  var bo = getBusinessObject(element);
  return bo && typeof bo.$instanceOf === "function" && bo.$instanceOf(type);
}
function isAny(element, types) {
  return some(types, function(t) {
    return is(element, t);
  });
}
function getBusinessObject(element) {
  return element && element.businessObject || element;
}
function getDi(element) {
  return element && element.di;
}

// node_modules/bpmn-js/lib/util/DiUtil.js
function isExpanded(element, di) {
  if (is(element, "bpmn:CallActivity")) {
    return false;
  }
  if (is(element, "bpmn:SubProcess")) {
    di = di || getDi(element);
    if (di && is(di, "bpmndi:BPMNPlane")) {
      return true;
    }
    return di && !!di.isExpanded;
  }
  if (is(element, "bpmn:Participant")) {
    return !!getBusinessObject(element).processRef;
  }
  return true;
}
function isHorizontal(element) {
  if (!is(element, "bpmn:Participant") && !is(element, "bpmn:Lane")) {
    return void 0;
  }
  var isHorizontal2 = getDi(element).isHorizontal;
  if (isHorizontal2 === void 0) {
    return true;
  }
  return isHorizontal2;
}
function isInterrupting(element) {
  return element && getBusinessObject(element).isInterrupting !== false;
}
function isEventSubProcess(element) {
  return element && !!getBusinessObject(element).triggeredByEvent;
}
function hasEventDefinition(element, eventType) {
  var eventDefinitions = getBusinessObject(element).eventDefinitions;
  return some(eventDefinitions, function(event2) {
    return is(event2, eventType);
  });
}
function hasErrorEventDefinition(element) {
  return hasEventDefinition(element, "bpmn:ErrorEventDefinition");
}
function hasEscalationEventDefinition(element) {
  return hasEventDefinition(element, "bpmn:EscalationEventDefinition");
}
function hasCompensateEventDefinition(element) {
  return hasEventDefinition(element, "bpmn:CompensateEventDefinition");
}

// node_modules/diagram-js/lib/util/ModelUtil.js
function isConnection(value) {
  return isObject(value) && has(value, "waypoints");
}
function isLabel(value) {
  return isObject(value) && has(value, "labelTarget");
}

// node_modules/bpmn-js/lib/util/LabelUtil.js
var DEFAULT_LABEL_SIZE = {
  width: 90,
  height: 20
};
var FLOW_LABEL_INDENT = 15;
function isLabelExternal(semantic) {
  return is(semantic, "bpmn:Event") || is(semantic, "bpmn:Gateway") || is(semantic, "bpmn:DataStoreReference") || is(semantic, "bpmn:DataObjectReference") || is(semantic, "bpmn:DataInput") || is(semantic, "bpmn:DataOutput") || is(semantic, "bpmn:SequenceFlow") || is(semantic, "bpmn:MessageFlow") || is(semantic, "bpmn:Group");
}
function hasExternalLabel(element) {
  return isLabel(element.label);
}
function getFlowLabelPosition(waypoints) {
  var mid = waypoints.length / 2 - 1;
  var first = waypoints[Math.floor(mid)];
  var second = waypoints[Math.ceil(mid + 0.01)];
  var position = getWaypointsMid(waypoints);
  var angle = Math.atan((second.y - first.y) / (second.x - first.x));
  var x = position.x, y = position.y;
  if (Math.abs(angle) < Math.PI / 2) {
    y -= FLOW_LABEL_INDENT;
  } else {
    x += FLOW_LABEL_INDENT;
  }
  return {
    x,
    y
  };
}
function getWaypointsMid(waypoints) {
  var mid = waypoints.length / 2 - 1;
  var first = waypoints[Math.floor(mid)];
  var second = waypoints[Math.ceil(mid + 0.01)];
  return {
    x: first.x + (second.x - first.x) / 2,
    y: first.y + (second.y - first.y) / 2
  };
}
function getExternalLabelMid(element) {
  if (element.waypoints) {
    return getFlowLabelPosition(element.waypoints);
  } else if (is(element, "bpmn:Group")) {
    return {
      x: element.x + element.width / 2,
      y: element.y + DEFAULT_LABEL_SIZE.height / 2
    };
  } else {
    return {
      x: element.x + element.width / 2,
      y: element.y + element.height + DEFAULT_LABEL_SIZE.height / 2
    };
  }
}
function getExternalLabelBounds(di, element) {
  var mid, size2, bounds, label = di.label;
  if (label && label.bounds) {
    bounds = label.bounds;
    size2 = {
      width: Math.max(DEFAULT_LABEL_SIZE.width, bounds.width),
      height: bounds.height
    };
    mid = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
  } else {
    mid = getExternalLabelMid(element);
    size2 = DEFAULT_LABEL_SIZE;
  }
  return assign({
    x: mid.x - size2.width / 2,
    y: mid.y - size2.height / 2
  }, size2);
}
function getLabelAttr(semantic) {
  if (is(semantic, "bpmn:FlowElement") || is(semantic, "bpmn:Participant") || is(semantic, "bpmn:Lane") || is(semantic, "bpmn:SequenceFlow") || is(semantic, "bpmn:MessageFlow") || is(semantic, "bpmn:DataInput") || is(semantic, "bpmn:DataOutput")) {
    return "name";
  }
  if (is(semantic, "bpmn:TextAnnotation")) {
    return "text";
  }
  if (is(semantic, "bpmn:Group")) {
    return "categoryValueRef";
  }
}
function getCategoryValue(semantic) {
  var categoryValueRef = semantic["categoryValueRef"];
  if (!categoryValueRef) {
    return "";
  }
  return categoryValueRef.value || "";
}
function getLabel(element) {
  var semantic = element.businessObject, attr2 = getLabelAttr(semantic);
  if (attr2) {
    if (attr2 === "categoryValueRef") {
      return getCategoryValue(semantic);
    }
    return semantic[attr2] || "";
  }
}
function setLabel(element, text) {
  var semantic = element.businessObject, attr2 = getLabelAttr(semantic);
  if (attr2) {
    if (attr2 === "categoryValueRef") {
      if (!semantic[attr2]) {
        return element;
      }
      semantic[attr2].value = text;
    } else {
      semantic[attr2] = text;
    }
  }
  return element;
}
function isExternalLabel(element) {
  return isLabel(element) && isLabelExternal(element.labelTarget);
}

// node_modules/diagram-js/lib/features/keyboard/KeyboardUtil.js
var KEYS_COPY = ["c", "C"];
var KEYS_PASTE = ["v", "V"];
var KEYS_DUPLICATE = ["d", "D"];
var KEYS_CUT = ["x", "X"];
var KEYS_REDO = ["y", "Y"];
var KEYS_UNDO = ["z", "Z"];
function hasModifier(event2) {
  return event2.ctrlKey || event2.metaKey || event2.shiftKey || event2.altKey;
}
function isCmd(event2) {
  if (event2.altKey) {
    return false;
  }
  return event2.ctrlKey || event2.metaKey;
}
function isKey(keys2, event2) {
  keys2 = isArray(keys2) ? keys2 : [keys2];
  return keys2.indexOf(event2.key) !== -1 || keys2.indexOf(event2.code) !== -1;
}
function isShift(event2) {
  return event2.shiftKey;
}
function isCopy(event2) {
  return isCmd(event2) && isKey(KEYS_COPY, event2);
}
function isPaste(event2) {
  return isCmd(event2) && isKey(KEYS_PASTE, event2);
}
function isDuplicate(event2) {
  return isCmd(event2) && isKey(KEYS_DUPLICATE, event2);
}
function isCut(event2) {
  return isCmd(event2) && isKey(KEYS_CUT, event2);
}
function isUndo(event2) {
  return isCmd(event2) && !isShift(event2) && isKey(KEYS_UNDO, event2);
}
function isRedo(event2) {
  return isCmd(event2) && (isKey(KEYS_REDO, event2) || isKey(KEYS_UNDO, event2) && isShift(event2));
}

// node_modules/bpmn-js/lib/features/modeling/util/ModelingUtil.js
function getParent(element, anyType) {
  if (isString(anyType)) {
    anyType = [anyType];
  }
  while (element = element.parent) {
    if (isAny(element, anyType)) {
      return element;
    }
  }
  return null;
}
function isDirectionHorizontal(element, elementRegistry) {
  var parent = getParent(element, "bpmn:Process");
  if (parent) {
    return true;
  }
  var types = ["bpmn:Participant", "bpmn:Lane"];
  parent = getParent(element, types);
  if (parent) {
    return isHorizontal(parent);
  } else if (isAny(element, types)) {
    return isHorizontal(element);
  }
  var process;
  for (process = getBusinessObject(element); process; process = process.$parent) {
    if (is(process, "bpmn:Process")) {
      break;
    }
  }
  if (!elementRegistry) {
    return true;
  }
  var pool = elementRegistry.find(function(shape) {
    var businessObject = getBusinessObject(shape);
    return businessObject && businessObject.get("processRef") === process;
  });
  if (!pool) {
    return true;
  }
  return isHorizontal(pool);
}

export {
  Ids,
  flatten,
  isUndefined,
  isDefined,
  isNil,
  isArray,
  isObject,
  isNumber,
  isFunction,
  isString,
  has,
  find,
  findIndex,
  filter,
  forEach,
  without,
  reduce,
  every,
  some,
  map,
  keys,
  size,
  values,
  groupBy,
  uniqueBy,
  unionBy,
  sortBy,
  matchPattern,
  debounce,
  bind,
  assign,
  set,
  get,
  pick,
  omit,
  domify,
  assign2,
  attr,
  classes,
  clear,
  closest,
  event,
  delegate,
  matches,
  query,
  all,
  remove,
  remove2,
  add,
  indexOf,
  isConnection,
  isLabel,
  is,
  isAny,
  getBusinessObject,
  getDi,
  isExpanded,
  isHorizontal,
  isInterrupting,
  isEventSubProcess,
  hasEventDefinition,
  hasErrorEventDefinition,
  hasEscalationEventDefinition,
  hasCompensateEventDefinition,
  DEFAULT_LABEL_SIZE,
  isLabelExternal,
  hasExternalLabel,
  getExternalLabelMid,
  getExternalLabelBounds,
  getLabel,
  setLabel,
  isExternalLabel,
  hasModifier,
  isCmd,
  isKey,
  isShift,
  isCopy,
  isPaste,
  isDuplicate,
  isCut,
  isUndo,
  isRedo,
  getParent,
  isDirectionHorizontal
};
//# sourceMappingURL=chunk-UMPXROMX.js.map
