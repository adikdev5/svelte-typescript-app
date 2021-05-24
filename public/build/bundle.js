
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/App.svelte generated by Svelte v3.38.2 */

    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let p;
    	let t4;
    	let a;
    	let t6;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text("Hello ");
    			t1 = text(/*name*/ ctx[0]);
    			t2 = text("!");
    			t3 = space();
    			p = element("p");
    			t4 = text("Visit the ");
    			a = element("a");
    			a.textContent = "Svelte tutorial";
    			t6 = text(" to learn how to build Svelte apps.");
    			attr_dev(h1, "class", "svelte-1tky8bj");
    			add_location(h1, file, 4, 1, 54);
    			attr_dev(a, "href", "https://svelte.dev/tutorial");
    			add_location(a, file, 5, 14, 91);
    			add_location(p, file, 5, 1, 78);
    			attr_dev(main, "class", "svelte-1tky8bj");
    			add_location(main, file, 3, 0, 46);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			append_dev(main, t3);
    			append_dev(main, p);
    			append_dev(p, t4);
    			append_dev(p, a);
    			append_dev(p, t6);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let { name } = $$props;
    	const writable_props = ["name"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({ name });

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !("name" in props)) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /*
     * Copyright 2017-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
     * the License. A copy of the License is located at
     *
     *     http://aws.amazon.com/apache2.0/
     *
     * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
     * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
     * and limitations under the License.
     */
    var __read$f = (undefined && undefined.__read) || function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };
    var __spread$a = (undefined && undefined.__spread) || function () {
        for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read$f(arguments[i]));
        return ar;
    };
    var LOG_LEVELS = {
        VERBOSE: 1,
        DEBUG: 2,
        INFO: 3,
        WARN: 4,
        ERROR: 5,
    };
    /**
     * Write logs
     * @class Logger
     */
    var ConsoleLogger = /** @class */ (function () {
        /**
         * @constructor
         * @param {string} name - Name of the logger
         */
        function ConsoleLogger(name, level) {
            if (level === void 0) { level = 'WARN'; }
            this.name = name;
            this.level = level;
        }
        ConsoleLogger.prototype._padding = function (n) {
            return n < 10 ? '0' + n : '' + n;
        };
        ConsoleLogger.prototype._ts = function () {
            var dt = new Date();
            return ([this._padding(dt.getMinutes()), this._padding(dt.getSeconds())].join(':') +
                '.' +
                dt.getMilliseconds());
        };
        /**
         * Write log
         * @method
         * @memeberof Logger
         * @param {string} type - log type, default INFO
         * @param {string|object} msg - Logging message or object
         */
        ConsoleLogger.prototype._log = function (type) {
            var msg = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                msg[_i - 1] = arguments[_i];
            }
            var logger_level_name = this.level;
            if (ConsoleLogger.LOG_LEVEL) {
                logger_level_name = ConsoleLogger.LOG_LEVEL;
            }
            if (typeof window !== 'undefined' && window.LOG_LEVEL) {
                logger_level_name = window.LOG_LEVEL;
            }
            var logger_level = LOG_LEVELS[logger_level_name];
            var type_level = LOG_LEVELS[type];
            if (!(type_level >= logger_level)) {
                // Do nothing if type is not greater than or equal to logger level (handle undefined)
                return;
            }
            var log = console.log.bind(console);
            if (type === 'ERROR' && console.error) {
                log = console.error.bind(console);
            }
            if (type === 'WARN' && console.warn) {
                log = console.warn.bind(console);
            }
            var prefix = "[" + type + "] " + this._ts() + " " + this.name;
            if (msg.length === 1 && typeof msg[0] === 'string') {
                log(prefix + " - " + msg[0]);
            }
            else if (msg.length === 1) {
                log(prefix, msg[0]);
            }
            else if (typeof msg[0] === 'string') {
                var obj = msg.slice(1);
                if (obj.length === 1) {
                    obj = obj[0];
                }
                log(prefix + " - " + msg[0], obj);
            }
            else {
                log(prefix, msg);
            }
        };
        /**
         * Write General log. Default to INFO
         * @method
         * @memeberof Logger
         * @param {string|object} msg - Logging message or object
         */
        ConsoleLogger.prototype.log = function () {
            var msg = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                msg[_i] = arguments[_i];
            }
            this._log.apply(this, __spread$a(['INFO'], msg));
        };
        /**
         * Write INFO log
         * @method
         * @memeberof Logger
         * @param {string|object} msg - Logging message or object
         */
        ConsoleLogger.prototype.info = function () {
            var msg = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                msg[_i] = arguments[_i];
            }
            this._log.apply(this, __spread$a(['INFO'], msg));
        };
        /**
         * Write WARN log
         * @method
         * @memeberof Logger
         * @param {string|object} msg - Logging message or object
         */
        ConsoleLogger.prototype.warn = function () {
            var msg = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                msg[_i] = arguments[_i];
            }
            this._log.apply(this, __spread$a(['WARN'], msg));
        };
        /**
         * Write ERROR log
         * @method
         * @memeberof Logger
         * @param {string|object} msg - Logging message or object
         */
        ConsoleLogger.prototype.error = function () {
            var msg = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                msg[_i] = arguments[_i];
            }
            this._log.apply(this, __spread$a(['ERROR'], msg));
        };
        /**
         * Write DEBUG log
         * @method
         * @memeberof Logger
         * @param {string|object} msg - Logging message or object
         */
        ConsoleLogger.prototype.debug = function () {
            var msg = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                msg[_i] = arguments[_i];
            }
            this._log.apply(this, __spread$a(['DEBUG'], msg));
        };
        /**
         * Write VERBOSE log
         * @method
         * @memeberof Logger
         * @param {string|object} msg - Logging message or object
         */
        ConsoleLogger.prototype.verbose = function () {
            var msg = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                msg[_i] = arguments[_i];
            }
            this._log.apply(this, __spread$a(['VERBOSE'], msg));
        };
        ConsoleLogger.LOG_LEVEL = null;
        return ConsoleLogger;
    }());

    var __read$e = (undefined && undefined.__read) || function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };
    var logger$6 = new ConsoleLogger('Amplify');
    var AmplifyClass = /** @class */ (function () {
        function AmplifyClass() {
            // Everything that is `register`ed is tracked here
            this._components = [];
            this._config = {};
            // All modules (with `getModuleName()`) are stored here for dependency injection
            this._modules = {};
            // for backward compatibility to avoid breaking change
            // if someone is using like Amplify.Auth
            this.Auth = null;
            this.Analytics = null;
            this.API = null;
            this.Credentials = null;
            this.Storage = null;
            this.I18n = null;
            this.Cache = null;
            this.PubSub = null;
            this.Interactions = null;
            this.Pushnotification = null;
            this.UI = null;
            this.XR = null;
            this.Predictions = null;
            this.DataStore = null;
            this.Logger = ConsoleLogger;
            this.ServiceWorker = null;
        }
        AmplifyClass.prototype.register = function (comp) {
            logger$6.debug('component registered in amplify', comp);
            this._components.push(comp);
            if (typeof comp.getModuleName === 'function') {
                this._modules[comp.getModuleName()] = comp;
                this[comp.getModuleName()] = comp;
            }
            else {
                logger$6.debug('no getModuleName method for component', comp);
            }
            // Finally configure this new component(category) loaded
            // With the new modularization changes in Amplify V3, all the Amplify
            // component are not loaded/registered right away but when they are
            // imported (and hence instantiated) in the client's app. This ensures
            // that all new components imported get correctly configured with the
            // configuration that Amplify.configure() was called with.
            comp.configure(this._config);
        };
        AmplifyClass.prototype.configure = function (config) {
            var _this = this;
            if (!config)
                return this._config;
            this._config = Object.assign(this._config, config);
            logger$6.debug('amplify config', this._config);
            // Dependency Injection via property-setting.
            // This avoids introducing a public method/interface/setter that's difficult to remove later.
            // Plus, it reduces `if` statements within the `constructor` and `configure` of each module
            Object.entries(this._modules).forEach(function (_a) {
                var _b = __read$e(_a, 2); _b[0]; var comp = _b[1];
                // e.g. Auth.*
                Object.keys(comp).forEach(function (property) {
                    // e.g. Auth["Credentials"] = this._modules["Credentials"] when set
                    if (_this._modules[property]) {
                        comp[property] = _this._modules[property];
                    }
                });
            });
            this._components.map(function (comp) {
                comp.configure(_this._config);
            });
            return this._config;
        };
        AmplifyClass.prototype.addPluggable = function (pluggable) {
            if (pluggable &&
                pluggable['getCategory'] &&
                typeof pluggable['getCategory'] === 'function') {
                this._components.map(function (comp) {
                    if (comp['addPluggable'] &&
                        typeof comp['addPluggable'] === 'function') {
                        comp.addPluggable(pluggable);
                    }
                });
            }
        };
        return AmplifyClass;
    }());
    var Amplify = new AmplifyClass();

    // generated by genversion
    var version$1 = '4.0.1';

    /*
     * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
     * the License. A copy of the License is located at
     *
     *     http://aws.amazon.com/apache2.0/
     *
     * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
     * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
     * and limitations under the License.
     */
    var BASE_USER_AGENT = "aws-amplify/" + version$1;
    var Platform = {
        userAgent: BASE_USER_AGENT + " js",
        product: '',
        navigator: null,
        isReactNative: false,
    };
    if (typeof navigator !== 'undefined' && navigator.product) {
        Platform.product = navigator.product || '';
        Platform.navigator = navigator || null;
        switch (navigator.product) {
            case 'ReactNative':
                Platform.userAgent = BASE_USER_AGENT + " react-native";
                Platform.isReactNative = true;
                break;
            default:
                Platform.userAgent = BASE_USER_AGENT + " js";
                Platform.isReactNative = false;
                break;
        }
    }
    var getAmplifyUserAgent = function () {
        return Platform.userAgent;
    };

    /*
     * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
     * the License. A copy of the License is located at
     *
     *     http://aws.amazon.com/apache2.0/
     *
     * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
     * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
     * and limitations under the License.
     */
    var logger$5 = new ConsoleLogger('I18n');
    /**
     * Language transition class
     */
    var I18n$1 = /** @class */ (function () {
        /**
         * @constructor
         * Initialize with configurations
         * @param {Object} options
         */
        function I18n(options) {
            /**
             * @private
             */
            this._options = null;
            /**
             * @private
             */
            this._lang = null;
            /**
             * @private
             */
            this._dict = {};
            this._options = Object.assign({}, options);
            this._lang = this._options.language;
            if (!this._lang &&
                typeof window !== 'undefined' &&
                window &&
                window.navigator) {
                this._lang = window.navigator.language;
            }
            logger$5.debug(this._lang);
        }
        /**
         * @method
         * Explicitly setting language
         * @param {String} lang
         */
        I18n.prototype.setLanguage = function (lang) {
            this._lang = lang;
        };
        /**
         * @method
         * Get value
         * @param {String} key
         * @param {String} defVal - Default value
         */
        I18n.prototype.get = function (key, defVal) {
            if (defVal === void 0) { defVal = undefined; }
            if (!this._lang) {
                return typeof defVal !== 'undefined' ? defVal : key;
            }
            var lang = this._lang;
            var val = this.getByLanguage(key, lang);
            if (val) {
                return val;
            }
            if (lang.indexOf('-') > 0) {
                val = this.getByLanguage(key, lang.split('-')[0]);
            }
            if (val) {
                return val;
            }
            return typeof defVal !== 'undefined' ? defVal : key;
        };
        /**
         * @method
         * Get value according to specified language
         * @param {String} key
         * @param {String} language - Specified langurage to be used
         * @param {String} defVal - Default value
         */
        I18n.prototype.getByLanguage = function (key, language, defVal) {
            if (defVal === void 0) { defVal = null; }
            if (!language) {
                return defVal;
            }
            var lang_dict = this._dict[language];
            if (!lang_dict) {
                return defVal;
            }
            return lang_dict[key];
        };
        /**
         * @method
         * Add vocabularies for one language
         * @param {String} language - Language of the dictionary
         * @param {Object} vocabularies - Object that has key-value as dictionary entry
         */
        I18n.prototype.putVocabulariesForLanguage = function (language, vocabularies) {
            var lang_dict = this._dict[language];
            if (!lang_dict) {
                lang_dict = this._dict[language] = {};
            }
            Object.assign(lang_dict, vocabularies);
        };
        /**
         * @method
         * Add vocabularies for one language
         * @param {Object} vocabularies - Object that has language as key,
         *                                vocabularies of each language as value
         */
        I18n.prototype.putVocabularies = function (vocabularies) {
            var _this = this;
            Object.keys(vocabularies).map(function (key) {
                _this.putVocabulariesForLanguage(key, vocabularies[key]);
            });
        };
        return I18n;
    }());

    /*
     * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
     * the License. A copy of the License is located at
     *
     *     http://aws.amazon.com/apache2.0/
     *
     * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
     * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
     * and limitations under the License.
     */
    var logger$4 = new ConsoleLogger('I18n');
    var _config = null;
    var _i18n = null;
    /**
     * Export I18n APIs
     */
    var I18n = /** @class */ (function () {
        function I18n() {
        }
        /**
         * @static
         * @method
         * Configure I18n part
         * @param {Object} config - Configuration of the I18n
         */
        I18n.configure = function (config) {
            logger$4.debug('configure I18n');
            if (!config) {
                return _config;
            }
            _config = Object.assign({}, _config, config.I18n || config);
            I18n.createInstance();
            return _config;
        };
        I18n.getModuleName = function () {
            return 'I18n';
        };
        /**
         * @static
         * @method
         * Create an instance of I18n for the library
         */
        I18n.createInstance = function () {
            logger$4.debug('create I18n instance');
            if (_i18n) {
                return;
            }
            _i18n = new I18n$1(_config);
        };
        /**
         * @static @method
         * Explicitly setting language
         * @param {String} lang
         */
        I18n.setLanguage = function (lang) {
            I18n.checkConfig();
            return _i18n.setLanguage(lang);
        };
        /**
         * @static @method
         * Get value
         * @param {String} key
         * @param {String} defVal - Default value
         */
        I18n.get = function (key, defVal) {
            if (!I18n.checkConfig()) {
                return typeof defVal === 'undefined' ? key : defVal;
            }
            return _i18n.get(key, defVal);
        };
        /**
         * @static
         * @method
         * Add vocabularies for one language
         * @param {String} langurage - Language of the dictionary
         * @param {Object} vocabularies - Object that has key-value as dictionary entry
         */
        I18n.putVocabulariesForLanguage = function (language, vocabularies) {
            I18n.checkConfig();
            return _i18n.putVocabulariesForLanguage(language, vocabularies);
        };
        /**
         * @static
         * @method
         * Add vocabularies for one language
         * @param {Object} vocabularies - Object that has language as key,
         *                                vocabularies of each language as value
         */
        I18n.putVocabularies = function (vocabularies) {
            I18n.checkConfig();
            return _i18n.putVocabularies(vocabularies);
        };
        I18n.checkConfig = function () {
            if (!_i18n) {
                _i18n = new I18n$1(_config);
            }
            return true;
        };
        return I18n;
    }());
    Amplify.register(I18n);

    /*
     * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
     * the License. A copy of the License is located at
     *
     *     http://aws.amazon.com/apache2.0/
     *
     * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
     * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
     * and limitations under the License.
     */
    var makeQuerablePromise = function (promise) {
        if (promise.isResolved)
            return promise;
        var isPending = true;
        var isRejected = false;
        var isFullfilled = false;
        var result = promise.then(function (data) {
            isFullfilled = true;
            isPending = false;
            return data;
        }, function (e) {
            isRejected = true;
            isPending = false;
            throw e;
        });
        result.isFullfilled = function () { return isFullfilled; };
        result.isPending = function () { return isPending; };
        result.isRejected = function () { return isRejected; };
        return result;
    };
    var browserOrNode = function () {
        var isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
        var isNode = typeof process !== 'undefined' &&
            process.versions != null &&
            process.versions.node != null;
        return {
            isBrowser: isBrowser,
            isNode: isNode,
        };
    };

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function getAugmentedNamespace(n) {
    	if (n.__esModule) return n;
    	var a = Object.defineProperty({}, '__esModule', {value: true});
    	Object.keys(n).forEach(function (k) {
    		var d = Object.getOwnPropertyDescriptor(n, k);
    		Object.defineProperty(a, k, d.get ? d : {
    			enumerable: true,
    			get: function () {
    				return n[k];
    			}
    		});
    	});
    	return a;
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    var SHORT_TO_HEX = {};
    var HEX_TO_SHORT = {};
    for (var i$2 = 0; i$2 < 256; i$2++) {
        var encodedByte = i$2.toString(16).toLowerCase();
        if (encodedByte.length === 1) {
            encodedByte = "0" + encodedByte;
        }
        SHORT_TO_HEX[i$2] = encodedByte;
        HEX_TO_SHORT[encodedByte] = i$2;
    }
    /**
     * Converts a Uint8Array of binary data to a hexadecimal encoded string.
     *
     * @param bytes The binary data to encode
     */
    function toHex(bytes) {
        var out = "";
        for (var i = 0; i < bytes.byteLength; i++) {
            out += SHORT_TO_HEX[bytes[i]];
        }
        return out;
    }

    var __extends$6 = (undefined && undefined.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var __awaiter$j = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var __generator$j = (undefined && undefined.__generator) || function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };
    var __read$d = (undefined && undefined.__read) || function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };
    var __spread$9 = (undefined && undefined.__spread) || function () {
        for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read$d(arguments[i]));
        return ar;
    };
    var logger$3 = new ConsoleLogger('Util');
    var NonRetryableError = /** @class */ (function (_super) {
        __extends$6(NonRetryableError, _super);
        function NonRetryableError(message) {
            var _this = _super.call(this, message) || this;
            _this.nonRetryable = true;
            return _this;
        }
        return NonRetryableError;
    }(Error));
    var isNonRetryableError = function (obj) {
        var key = 'nonRetryable';
        return obj && obj[key];
    };
    /**
     * @private
     * Internal use of Amplify only
     */
    function retry(functionToRetry, args, delayFn, attempt) {
        if (attempt === void 0) { attempt = 1; }
        return __awaiter$j(this, void 0, void 0, function () {
            var err_1, retryIn_1;
            return __generator$j(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (typeof functionToRetry !== 'function') {
                            throw Error('functionToRetry must be a function');
                        }
                        logger$3.debug(functionToRetry.name + " attempt #" + attempt + " with this vars: " + JSON.stringify(args));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 8]);
                        return [4 /*yield*/, functionToRetry.apply(void 0, __spread$9(args))];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        err_1 = _a.sent();
                        logger$3.debug("error on " + functionToRetry.name, err_1);
                        if (isNonRetryableError(err_1)) {
                            logger$3.debug(functionToRetry.name + " non retryable error", err_1);
                            throw err_1;
                        }
                        retryIn_1 = delayFn(attempt, args, err_1);
                        logger$3.debug(functionToRetry.name + " retrying in " + retryIn_1 + " ms");
                        if (!(retryIn_1 !== false)) return [3 /*break*/, 6];
                        return [4 /*yield*/, new Promise(function (res) { return setTimeout(res, retryIn_1); })];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, retry(functionToRetry, args, delayFn, attempt + 1)];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6: throw err_1;
                    case 7: return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
    var MAX_DELAY_MS = 5 * 60 * 1000;
    function jitteredBackoff(maxDelayMs) {
        var BASE_TIME_MS = 100;
        var JITTER_FACTOR = 100;
        return function (attempt) {
            var delay = Math.pow(2, attempt) * BASE_TIME_MS + JITTER_FACTOR * Math.random();
            return delay > maxDelayMs ? false : delay;
        };
    }
    /**
     * @private
     * Internal use of Amplify only
     */
    var jitteredExponentialRetry = function (functionToRetry, args, maxDelayMs) {
        if (maxDelayMs === void 0) { maxDelayMs = MAX_DELAY_MS; }
        return retry(functionToRetry, args, jitteredBackoff(maxDelayMs));
    };

    var __awaiter$i = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var __generator$i = (undefined && undefined.__generator) || function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };
    var logger$2 = new ConsoleLogger('CognitoCredentials');
    var waitForInit$1 = new Promise(function (res, rej) {
        if (!browserOrNode().isBrowser) {
            logger$2.debug('not in the browser, directly resolved');
            return res();
        }
        var ga = window['gapi'] && window['gapi'].auth2 ? window['gapi'].auth2 : null;
        if (ga) {
            logger$2.debug('google api already loaded');
            return res();
        }
        else {
            setTimeout(function () {
                return res();
            }, 2000);
        }
    });
    var GoogleOAuth$1 = /** @class */ (function () {
        function GoogleOAuth() {
            this.initialized = false;
            this.refreshGoogleToken = this.refreshGoogleToken.bind(this);
            this._refreshGoogleTokenImpl = this._refreshGoogleTokenImpl.bind(this);
        }
        GoogleOAuth.prototype.refreshGoogleToken = function () {
            return __awaiter$i(this, void 0, void 0, function () {
                return __generator$i(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!this.initialized) return [3 /*break*/, 2];
                            logger$2.debug('need to wait for the Google SDK loaded');
                            return [4 /*yield*/, waitForInit$1];
                        case 1:
                            _a.sent();
                            this.initialized = true;
                            logger$2.debug('finish waiting');
                            _a.label = 2;
                        case 2: return [2 /*return*/, this._refreshGoogleTokenImpl()];
                    }
                });
            });
        };
        GoogleOAuth.prototype._refreshGoogleTokenImpl = function () {
            var ga = null;
            if (browserOrNode().isBrowser)
                ga = window['gapi'] && window['gapi'].auth2 ? window['gapi'].auth2 : null;
            if (!ga) {
                logger$2.debug('no gapi auth2 available');
                return Promise.reject('no gapi auth2 available');
            }
            return new Promise(function (res, rej) {
                ga.getAuthInstance()
                    .then(function (googleAuth) {
                    if (!googleAuth) {
                        logger$2.debug('google Auth undefined');
                        rej(new NonRetryableError('google Auth undefined'));
                    }
                    var googleUser = googleAuth.currentUser.get();
                    // refresh the token
                    if (googleUser.isSignedIn()) {
                        logger$2.debug('refreshing the google access token');
                        googleUser
                            .reloadAuthResponse()
                            .then(function (authResponse) {
                            var id_token = authResponse.id_token, expires_at = authResponse.expires_at;
                            res({ token: id_token, expires_at: expires_at });
                        })
                            .catch(function (err) {
                            if (err && err.error === 'network_error') {
                                // Not using NonRetryableError so handler will be retried
                                rej('Network error reloading google auth response');
                            }
                            else {
                                rej(new NonRetryableError('Failed to reload google auth response'));
                            }
                        });
                    }
                    else {
                        rej(new NonRetryableError('User is not signed in with Google'));
                    }
                })
                    .catch(function (err) {
                    logger$2.debug('Failed to refresh google token', err);
                    rej(new NonRetryableError('Failed to refresh google token'));
                });
            });
        };
        return GoogleOAuth;
    }());

    var __awaiter$h = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var __generator$h = (undefined && undefined.__generator) || function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };
    var logger$1 = new ConsoleLogger('CognitoCredentials');
    var waitForInit = new Promise(function (res, rej) {
        if (!browserOrNode().isBrowser) {
            logger$1.debug('not in the browser, directly resolved');
            return res();
        }
        var fb = window['FB'];
        if (fb) {
            logger$1.debug('FB SDK already loaded');
            return res();
        }
        else {
            setTimeout(function () {
                return res();
            }, 2000);
        }
    });
    var FacebookOAuth$1 = /** @class */ (function () {
        function FacebookOAuth() {
            this.initialized = false;
            this.refreshFacebookToken = this.refreshFacebookToken.bind(this);
            this._refreshFacebookTokenImpl = this._refreshFacebookTokenImpl.bind(this);
        }
        FacebookOAuth.prototype.refreshFacebookToken = function () {
            return __awaiter$h(this, void 0, void 0, function () {
                return __generator$h(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!this.initialized) return [3 /*break*/, 2];
                            logger$1.debug('need to wait for the Facebook SDK loaded');
                            return [4 /*yield*/, waitForInit];
                        case 1:
                            _a.sent();
                            this.initialized = true;
                            logger$1.debug('finish waiting');
                            _a.label = 2;
                        case 2: return [2 /*return*/, this._refreshFacebookTokenImpl()];
                    }
                });
            });
        };
        FacebookOAuth.prototype._refreshFacebookTokenImpl = function () {
            var fb = null;
            if (browserOrNode().isBrowser)
                fb = window['FB'];
            if (!fb) {
                var errorMessage = 'no fb sdk available';
                logger$1.debug(errorMessage);
                return Promise.reject(new NonRetryableError(errorMessage));
            }
            return new Promise(function (res, rej) {
                fb.getLoginStatus(function (fbResponse) {
                    if (!fbResponse || !fbResponse.authResponse) {
                        var errorMessage = 'no response from facebook when refreshing the jwt token';
                        logger$1.debug(errorMessage);
                        // There is no definitive indication for a network error in
                        // fbResponse, so we are treating it as an invalid token.
                        rej(new NonRetryableError(errorMessage));
                    }
                    else {
                        var response = fbResponse.authResponse;
                        var accessToken = response.accessToken, expiresIn = response.expiresIn;
                        var date = new Date();
                        var expires_at = expiresIn * 1000 + date.getTime();
                        if (!accessToken) {
                            var errorMessage = 'the jwtToken is undefined';
                            logger$1.debug(errorMessage);
                            rej(new NonRetryableError(errorMessage));
                        }
                        res({
                            token: accessToken,
                            expires_at: expires_at,
                        });
                    }
                }, { scope: 'public_profile,email' });
            });
        };
        return FacebookOAuth;
    }());

    /*
     * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
     * the License. A copy of the License is located at
     *
     *     http://aws.amazon.com/apache2.0/
     *
     * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
     * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
     * and limitations under the License.
     */
    var GoogleOAuth = new GoogleOAuth$1();
    var FacebookOAuth = new FacebookOAuth$1();

    /*
     * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
     * the License. A copy of the License is located at
     *
     *     http://aws.amazon.com/apache2.0/
     *
     * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
     * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
     * and limitations under the License.
     */
    var dataMemory = {};
    /** @class */
    var MemoryStorage = /** @class */ (function () {
        function MemoryStorage() {
        }
        /**
         * This is used to set a specific item in storage
         * @param {string} key - the key for the item
         * @param {object} value - the value
         * @returns {string} value that was set
         */
        MemoryStorage.setItem = function (key, value) {
            dataMemory[key] = value;
            return dataMemory[key];
        };
        /**
         * This is used to get a specific key from storage
         * @param {string} key - the key for the item
         * This is used to clear the storage
         * @returns {string} the data item
         */
        MemoryStorage.getItem = function (key) {
            return Object.prototype.hasOwnProperty.call(dataMemory, key)
                ? dataMemory[key]
                : undefined;
        };
        /**
         * This is used to remove an item from storage
         * @param {string} key - the key being set
         * @returns {string} value - value that was deleted
         */
        MemoryStorage.removeItem = function (key) {
            return delete dataMemory[key];
        };
        /**
         * This is used to clear the storage
         * @returns {string} nothing
         */
        MemoryStorage.clear = function () {
            dataMemory = {};
            return dataMemory;
        };
        return MemoryStorage;
    }());
    var StorageHelper = /** @class */ (function () {
        /**
         * This is used to get a storage object
         * @returns {object} the storage
         */
        function StorageHelper() {
            try {
                this.storageWindow = window.localStorage;
                this.storageWindow.setItem('aws.amplify.test-ls', 1);
                this.storageWindow.removeItem('aws.amplify.test-ls');
            }
            catch (exception) {
                this.storageWindow = MemoryStorage;
            }
        }
        /**
         * This is used to return the storage
         * @returns {object} the storage
         */
        StorageHelper.prototype.getStorage = function () {
            return this.storageWindow;
        };
        return StorageHelper;
    }());

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter$g(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$g(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __read$c(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$5 = function(d, b) {
        extendStatics$5 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics$5(d, b);
    };

    function __extends$5(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics$5(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$d = function() {
        __assign$d = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$d.apply(this, arguments);
    };

    function __awaiter$f(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$f(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __read$b(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    var name = "@aws-sdk/client-cognito-identity";
    var description = "AWS SDK for JavaScript Cognito Identity Client for Node.js, Browser and React Native";
    var version = "3.6.1";
    var scripts = {
    	clean: "yarn remove-definitions && yarn remove-dist && yarn remove-documentation",
    	"build-documentation": "yarn remove-documentation && typedoc ./",
    	prepublishOnly: "yarn build",
    	pretest: "yarn build:cjs",
    	"remove-definitions": "rimraf ./types",
    	"remove-dist": "rimraf ./dist",
    	"remove-documentation": "rimraf ./docs",
    	"test:unit": "mocha **/cjs/**/*.spec.js",
    	"test:e2e": "mocha **/cjs/**/*.ispec.js && karma start karma.conf.js",
    	test: "yarn test:unit",
    	"build:cjs": "tsc -p tsconfig.json",
    	"build:es": "tsc -p tsconfig.es.json",
    	build: "yarn build:cjs && yarn build:es",
    	postbuild: "downlevel-dts types types/ts3.4"
    };
    var main = "./dist/cjs/index.js";
    var types = "./types/index.d.ts";
    var module = "./dist/es/index.js";
    var browser = {
    	"./runtimeConfig": "./runtimeConfig.browser"
    };
    var sideEffects = false;
    var dependencies = {
    	"@aws-crypto/sha256-browser": "^1.0.0",
    	"@aws-crypto/sha256-js": "^1.0.0",
    	"@aws-sdk/config-resolver": "3.6.1",
    	"@aws-sdk/credential-provider-node": "3.6.1",
    	"@aws-sdk/fetch-http-handler": "3.6.1",
    	"@aws-sdk/hash-node": "3.6.1",
    	"@aws-sdk/invalid-dependency": "3.6.1",
    	"@aws-sdk/middleware-content-length": "3.6.1",
    	"@aws-sdk/middleware-host-header": "3.6.1",
    	"@aws-sdk/middleware-logger": "3.6.1",
    	"@aws-sdk/middleware-retry": "3.6.1",
    	"@aws-sdk/middleware-serde": "3.6.1",
    	"@aws-sdk/middleware-signing": "3.6.1",
    	"@aws-sdk/middleware-stack": "3.6.1",
    	"@aws-sdk/middleware-user-agent": "3.6.1",
    	"@aws-sdk/node-config-provider": "3.6.1",
    	"@aws-sdk/node-http-handler": "3.6.1",
    	"@aws-sdk/protocol-http": "3.6.1",
    	"@aws-sdk/smithy-client": "3.6.1",
    	"@aws-sdk/types": "3.6.1",
    	"@aws-sdk/url-parser": "3.6.1",
    	"@aws-sdk/url-parser-native": "3.6.1",
    	"@aws-sdk/util-base64-browser": "3.6.1",
    	"@aws-sdk/util-base64-node": "3.6.1",
    	"@aws-sdk/util-body-length-browser": "3.6.1",
    	"@aws-sdk/util-body-length-node": "3.6.1",
    	"@aws-sdk/util-user-agent-browser": "3.6.1",
    	"@aws-sdk/util-user-agent-node": "3.6.1",
    	"@aws-sdk/util-utf8-browser": "3.6.1",
    	"@aws-sdk/util-utf8-node": "3.6.1",
    	tslib: "^2.0.0"
    };
    var devDependencies = {
    	"@aws-sdk/client-documentation-generator": "3.6.1",
    	"@aws-sdk/client-iam": "3.6.1",
    	"@types/chai": "^4.2.11",
    	"@types/mocha": "^8.0.4",
    	"@types/node": "^12.7.5",
    	"downlevel-dts": "0.7.0",
    	jest: "^26.1.0",
    	rimraf: "^3.0.0",
    	typedoc: "^0.19.2",
    	typescript: "~4.1.2"
    };
    var engines = {
    	node: ">=10.0.0"
    };
    var typesVersions = {
    	"<4.0": {
    		"types/*": [
    			"types/ts3.4/*"
    		]
    	}
    };
    var author = {
    	name: "AWS SDK for JavaScript Team",
    	url: "https://aws.amazon.com/javascript/"
    };
    var license = "Apache-2.0";
    var homepage = "https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-cognito-identity";
    var repository = {
    	type: "git",
    	url: "https://github.com/aws/aws-sdk-js-v3.git",
    	directory: "clients/client-cognito-identity"
    };
    var packageInfo = {
    	name: name,
    	description: description,
    	version: version,
    	scripts: scripts,
    	main: main,
    	types: types,
    	module: module,
    	browser: browser,
    	"react-native": {
    	"./runtimeConfig": "./runtimeConfig.native"
    },
    	sideEffects: sideEffects,
    	dependencies: dependencies,
    	devDependencies: devDependencies,
    	engines: engines,
    	typesVersions: typesVersions,
    	author: author,
    	license: license,
    	homepage: homepage,
    	repository: repository
    };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$4 = function(d, b) {
        extendStatics$4 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics$4(d, b);
    };

    function __extends$4(d, b) {
        extendStatics$4(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$c = function() {
        __assign$c = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$c.apply(this, arguments);
    };

    function __rest$4(s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }

    function __decorate$2(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    function __param$2(paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); }
    }

    function __metadata$2(metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
    }

    function __awaiter$e(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$e(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __createBinding$2(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }

    function __exportStar$2(m, exports) {
        for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) exports[p] = m[p];
    }

    function __values$7(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read$a(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread$8() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read$a(arguments[i]));
        return ar;
    }

    function __spreadArrays$2() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    }
    function __await$2(v) {
        return this instanceof __await$2 ? (this.v = v, this) : new __await$2(v);
    }

    function __asyncGenerator$2(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await$2 ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    }

    function __asyncDelegator$2(o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await$2(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    }

    function __asyncValues$2(o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values$7 === "function" ? __values$7(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    }

    function __makeTemplateObject$2(cooked, raw) {
        if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
        return cooked;
    }
    function __importStar$2(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result.default = mod;
        return result;
    }

    function __importDefault$2(mod) {
        return (mod && mod.__esModule) ? mod : { default: mod };
    }

    function __classPrivateFieldGet$2(receiver, privateMap) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to get private field on non-instance");
        }
        return privateMap.get(receiver);
    }

    function __classPrivateFieldSet$2(receiver, privateMap, value) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to set private field on non-instance");
        }
        privateMap.set(receiver, value);
        return value;
    }

    var tslib_es6$2 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        __extends: __extends$4,
        get __assign () { return __assign$c; },
        __rest: __rest$4,
        __decorate: __decorate$2,
        __param: __param$2,
        __metadata: __metadata$2,
        __awaiter: __awaiter$e,
        __generator: __generator$e,
        __createBinding: __createBinding$2,
        __exportStar: __exportStar$2,
        __values: __values$7,
        __read: __read$a,
        __spread: __spread$8,
        __spreadArrays: __spreadArrays$2,
        __await: __await$2,
        __asyncGenerator: __asyncGenerator$2,
        __asyncDelegator: __asyncDelegator$2,
        __asyncValues: __asyncValues$2,
        __makeTemplateObject: __makeTemplateObject$2,
        __importStar: __importStar$2,
        __importDefault: __importDefault$2,
        __classPrivateFieldGet: __classPrivateFieldGet$2,
        __classPrivateFieldSet: __classPrivateFieldSet$2
    });

    var isEmptyData_1 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isEmptyData = void 0;
    function isEmptyData(data) {
        if (typeof data === "string") {
            return data.length === 0;
        }
        return data.byteLength === 0;
    }
    exports.isEmptyData = isEmptyData;
    //# sourceMappingURL=isEmptyData.js.map
    });

    var constants$1 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EMPTY_DATA_SHA_256 = exports.SHA_256_HMAC_ALGO = exports.SHA_256_HASH = void 0;
    exports.SHA_256_HASH = { name: "SHA-256" };
    exports.SHA_256_HMAC_ALGO = {
        name: "HMAC",
        hash: exports.SHA_256_HASH
    };
    exports.EMPTY_DATA_SHA_256 = new Uint8Array([
        227,
        176,
        196,
        66,
        152,
        252,
        28,
        20,
        154,
        251,
        244,
        200,
        153,
        111,
        185,
        36,
        39,
        174,
        65,
        228,
        100,
        155,
        147,
        76,
        164,
        149,
        153,
        27,
        120,
        82,
        184,
        85
    ]);
    //# sourceMappingURL=constants.js.map
    });

    /**
     * Converts a JS string from its native UCS-2/UTF-16 representation into a
     * Uint8Array of the bytes used to represent the equivalent characters in UTF-8.
     *
     * Cribbed from the `goog.crypt.stringToUtf8ByteArray` function in the Google
     * Closure library, though updated to use typed arrays.
     */
    var fromUtf8$2 = function (input) {
        var bytes = [];
        for (var i = 0, len = input.length; i < len; i++) {
            var value = input.charCodeAt(i);
            if (value < 0x80) {
                bytes.push(value);
            }
            else if (value < 0x800) {
                bytes.push((value >> 6) | 192, (value & 63) | 128);
            }
            else if (i + 1 < input.length && (value & 0xfc00) === 0xd800 && (input.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
                var surrogatePair = 0x10000 + ((value & 1023) << 10) + (input.charCodeAt(++i) & 1023);
                bytes.push((surrogatePair >> 18) | 240, ((surrogatePair >> 12) & 63) | 128, ((surrogatePair >> 6) & 63) | 128, (surrogatePair & 63) | 128);
            }
            else {
                bytes.push((value >> 12) | 224, ((value >> 6) & 63) | 128, (value & 63) | 128);
            }
        }
        return Uint8Array.from(bytes);
    };
    /**
     * Converts a typed array of bytes containing UTF-8 data into a native JS
     * string.
     *
     * Partly cribbed from the `goog.crypt.utf8ByteArrayToString` function in the
     * Google Closure library, though updated to use typed arrays and to better
     * handle astral plane code points.
     */
    var toUtf8$2 = function (input) {
        var decoded = "";
        for (var i = 0, len = input.length; i < len; i++) {
            var byte = input[i];
            if (byte < 0x80) {
                decoded += String.fromCharCode(byte);
            }
            else if (192 <= byte && byte < 224) {
                var nextByte = input[++i];
                decoded += String.fromCharCode(((byte & 31) << 6) | (nextByte & 63));
            }
            else if (240 <= byte && byte < 365) {
                var surrogatePair = [byte, input[++i], input[++i], input[++i]];
                var encoded = "%" + surrogatePair.map(function (byteValue) { return byteValue.toString(16); }).join("%");
                decoded += decodeURIComponent(encoded);
            }
            else {
                decoded += String.fromCharCode(((byte & 15) << 12) | ((input[++i] & 63) << 6) | (input[++i] & 63));
            }
        }
        return decoded;
    };

    function fromUtf8$1(input) {
        return new TextEncoder().encode(input);
    }
    function toUtf8$1(input) {
        return new TextDecoder("utf-8").decode(input);
    }

    var fromUtf8 = function (input) {
        return typeof TextEncoder === "function" ? fromUtf8$1(input) : fromUtf8$2(input);
    };
    var toUtf8 = function (input) {
        return typeof TextDecoder === "function" ? toUtf8$1(input) : toUtf8$2(input);
    };

    var es$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        fromUtf8: fromUtf8,
        toUtf8: toUtf8
    });

    var fallbackWindow = {};
    /**
     * Locates the global scope for a browser or browser-like environment. If
     * neither `window` nor `self` is defined by the environment, the same object
     * will be returned on each invocation.
     */
    function locateWindow() {
        if (typeof window !== "undefined") {
            return window;
        }
        else if (typeof self !== "undefined") {
            return self;
        }
        return fallbackWindow;
    }

    var es = /*#__PURE__*/Object.freeze({
        __proto__: null,
        locateWindow: locateWindow
    });

    var util_utf8_browser_1 = /*@__PURE__*/getAugmentedNamespace(es$1);

    var util_locate_window_1 = /*@__PURE__*/getAugmentedNamespace(es);

    var ie11Sha256 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Sha256 = void 0;




    var Sha256 = /** @class */ (function () {
        function Sha256(secret) {
            if (secret) {
                this.operation = getKeyPromise(secret).then(function (keyData) {
                    return util_locate_window_1.locateWindow().msCrypto.subtle.sign(constants$1.SHA_256_HMAC_ALGO, keyData);
                });
                this.operation.catch(function () { });
            }
            else {
                this.operation = Promise.resolve(util_locate_window_1.locateWindow().msCrypto.subtle.digest("SHA-256"));
            }
        }
        Sha256.prototype.update = function (toHash) {
            var _this = this;
            if (isEmptyData_1.isEmptyData(toHash)) {
                return;
            }
            this.operation = this.operation.then(function (operation) {
                operation.onerror = function () {
                    _this.operation = Promise.reject(new Error("Error encountered updating hash"));
                };
                operation.process(toArrayBufferView(toHash));
                return operation;
            });
            this.operation.catch(function () { });
        };
        Sha256.prototype.digest = function () {
            return this.operation.then(function (operation) {
                return new Promise(function (resolve, reject) {
                    operation.onerror = function () {
                        reject("Error encountered finalizing hash");
                    };
                    operation.oncomplete = function () {
                        if (operation.result) {
                            resolve(new Uint8Array(operation.result));
                        }
                        reject("Error encountered finalizing hash");
                    };
                    operation.finish();
                });
            });
        };
        return Sha256;
    }());
    exports.Sha256 = Sha256;
    function getKeyPromise(secret) {
        return new Promise(function (resolve, reject) {
            var keyOperation = util_locate_window_1.locateWindow().msCrypto.subtle.importKey("raw", toArrayBufferView(secret), constants$1.SHA_256_HMAC_ALGO, false, ["sign"]);
            keyOperation.oncomplete = function () {
                if (keyOperation.result) {
                    resolve(keyOperation.result);
                }
                reject("ImportKey completed without importing key.");
            };
            keyOperation.onerror = function () {
                reject("ImportKey failed to import key.");
            };
        });
    }
    function toArrayBufferView(data) {
        if (typeof data === "string") {
            return util_utf8_browser_1.fromUtf8(data);
        }
        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
        }
        return new Uint8Array(data);
    }
    //# sourceMappingURL=ie11Sha256.js.map
    });

    var webCryptoSha256 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Sha256 = void 0;




    var Sha256 = /** @class */ (function () {
        function Sha256(secret) {
            this.toHash = new Uint8Array(0);
            if (secret !== void 0) {
                this.key = new Promise(function (resolve, reject) {
                    util_locate_window_1.locateWindow()
                        .crypto.subtle.importKey("raw", convertToBuffer(secret), constants$1.SHA_256_HMAC_ALGO, false, ["sign"])
                        .then(resolve, reject);
                });
                this.key.catch(function () { });
            }
        }
        Sha256.prototype.update = function (data) {
            if (isEmptyData_1.isEmptyData(data)) {
                return;
            }
            var update = convertToBuffer(data);
            var typedArray = new Uint8Array(this.toHash.byteLength + update.byteLength);
            typedArray.set(this.toHash, 0);
            typedArray.set(update, this.toHash.byteLength);
            this.toHash = typedArray;
        };
        Sha256.prototype.digest = function () {
            var _this = this;
            if (this.key) {
                return this.key.then(function (key) {
                    return util_locate_window_1.locateWindow()
                        .crypto.subtle.sign(constants$1.SHA_256_HMAC_ALGO, key, _this.toHash)
                        .then(function (data) { return new Uint8Array(data); });
                });
            }
            if (isEmptyData_1.isEmptyData(this.toHash)) {
                return Promise.resolve(constants$1.EMPTY_DATA_SHA_256);
            }
            return Promise.resolve()
                .then(function () {
                return util_locate_window_1.locateWindow().crypto.subtle.digest(constants$1.SHA_256_HASH, _this.toHash);
            })
                .then(function (data) { return Promise.resolve(new Uint8Array(data)); });
        };
        return Sha256;
    }());
    exports.Sha256 = Sha256;
    function convertToBuffer(data) {
        if (typeof data === "string") {
            return util_utf8_browser_1.fromUtf8(data);
        }
        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
        }
        return new Uint8Array(data);
    }
    //# sourceMappingURL=webCryptoSha256.js.map
    });

    var constants = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MAX_HASHABLE_LENGTH = exports.INIT = exports.KEY = exports.DIGEST_LENGTH = exports.BLOCK_SIZE = void 0;
    /**
     * @internal
     */
    exports.BLOCK_SIZE = 64;
    /**
     * @internal
     */
    exports.DIGEST_LENGTH = 32;
    /**
     * @internal
     */
    exports.KEY = new Uint32Array([
        0x428a2f98,
        0x71374491,
        0xb5c0fbcf,
        0xe9b5dba5,
        0x3956c25b,
        0x59f111f1,
        0x923f82a4,
        0xab1c5ed5,
        0xd807aa98,
        0x12835b01,
        0x243185be,
        0x550c7dc3,
        0x72be5d74,
        0x80deb1fe,
        0x9bdc06a7,
        0xc19bf174,
        0xe49b69c1,
        0xefbe4786,
        0x0fc19dc6,
        0x240ca1cc,
        0x2de92c6f,
        0x4a7484aa,
        0x5cb0a9dc,
        0x76f988da,
        0x983e5152,
        0xa831c66d,
        0xb00327c8,
        0xbf597fc7,
        0xc6e00bf3,
        0xd5a79147,
        0x06ca6351,
        0x14292967,
        0x27b70a85,
        0x2e1b2138,
        0x4d2c6dfc,
        0x53380d13,
        0x650a7354,
        0x766a0abb,
        0x81c2c92e,
        0x92722c85,
        0xa2bfe8a1,
        0xa81a664b,
        0xc24b8b70,
        0xc76c51a3,
        0xd192e819,
        0xd6990624,
        0xf40e3585,
        0x106aa070,
        0x19a4c116,
        0x1e376c08,
        0x2748774c,
        0x34b0bcb5,
        0x391c0cb3,
        0x4ed8aa4a,
        0x5b9cca4f,
        0x682e6ff3,
        0x748f82ee,
        0x78a5636f,
        0x84c87814,
        0x8cc70208,
        0x90befffa,
        0xa4506ceb,
        0xbef9a3f7,
        0xc67178f2
    ]);
    /**
     * @internal
     */
    exports.INIT = [
        0x6a09e667,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19
    ];
    /**
     * @internal
     */
    exports.MAX_HASHABLE_LENGTH = Math.pow(2, 53) - 1;
    //# sourceMappingURL=constants.js.map
    });

    var RawSha256_1 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RawSha256 = void 0;

    /**
     * @internal
     */
    var RawSha256 = /** @class */ (function () {
        function RawSha256() {
            this.state = Int32Array.from(constants.INIT);
            this.temp = new Int32Array(64);
            this.buffer = new Uint8Array(64);
            this.bufferLength = 0;
            this.bytesHashed = 0;
            /**
             * @internal
             */
            this.finished = false;
        }
        RawSha256.prototype.update = function (data) {
            if (this.finished) {
                throw new Error("Attempted to update an already finished hash.");
            }
            var position = 0;
            var byteLength = data.byteLength;
            this.bytesHashed += byteLength;
            if (this.bytesHashed * 8 > constants.MAX_HASHABLE_LENGTH) {
                throw new Error("Cannot hash more than 2^53 - 1 bits");
            }
            while (byteLength > 0) {
                this.buffer[this.bufferLength++] = data[position++];
                byteLength--;
                if (this.bufferLength === constants.BLOCK_SIZE) {
                    this.hashBuffer();
                    this.bufferLength = 0;
                }
            }
        };
        RawSha256.prototype.digest = function () {
            if (!this.finished) {
                var bitsHashed = this.bytesHashed * 8;
                var bufferView = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
                var undecoratedLength = this.bufferLength;
                bufferView.setUint8(this.bufferLength++, 0x80);
                // Ensure the final block has enough room for the hashed length
                if (undecoratedLength % constants.BLOCK_SIZE >= constants.BLOCK_SIZE - 8) {
                    for (var i = this.bufferLength; i < constants.BLOCK_SIZE; i++) {
                        bufferView.setUint8(i, 0);
                    }
                    this.hashBuffer();
                    this.bufferLength = 0;
                }
                for (var i = this.bufferLength; i < constants.BLOCK_SIZE - 8; i++) {
                    bufferView.setUint8(i, 0);
                }
                bufferView.setUint32(constants.BLOCK_SIZE - 8, Math.floor(bitsHashed / 0x100000000), true);
                bufferView.setUint32(constants.BLOCK_SIZE - 4, bitsHashed);
                this.hashBuffer();
                this.finished = true;
            }
            // The value in state is little-endian rather than big-endian, so flip
            // each word into a new Uint8Array
            var out = new Uint8Array(constants.DIGEST_LENGTH);
            for (var i = 0; i < 8; i++) {
                out[i * 4] = (this.state[i] >>> 24) & 0xff;
                out[i * 4 + 1] = (this.state[i] >>> 16) & 0xff;
                out[i * 4 + 2] = (this.state[i] >>> 8) & 0xff;
                out[i * 4 + 3] = (this.state[i] >>> 0) & 0xff;
            }
            return out;
        };
        RawSha256.prototype.hashBuffer = function () {
            var _a = this, buffer = _a.buffer, state = _a.state;
            var state0 = state[0], state1 = state[1], state2 = state[2], state3 = state[3], state4 = state[4], state5 = state[5], state6 = state[6], state7 = state[7];
            for (var i = 0; i < constants.BLOCK_SIZE; i++) {
                if (i < 16) {
                    this.temp[i] =
                        ((buffer[i * 4] & 0xff) << 24) |
                            ((buffer[i * 4 + 1] & 0xff) << 16) |
                            ((buffer[i * 4 + 2] & 0xff) << 8) |
                            (buffer[i * 4 + 3] & 0xff);
                }
                else {
                    var u = this.temp[i - 2];
                    var t1_1 = ((u >>> 17) | (u << 15)) ^ ((u >>> 19) | (u << 13)) ^ (u >>> 10);
                    u = this.temp[i - 15];
                    var t2_1 = ((u >>> 7) | (u << 25)) ^ ((u >>> 18) | (u << 14)) ^ (u >>> 3);
                    this.temp[i] =
                        ((t1_1 + this.temp[i - 7]) | 0) + ((t2_1 + this.temp[i - 16]) | 0);
                }
                var t1 = ((((((state4 >>> 6) | (state4 << 26)) ^
                    ((state4 >>> 11) | (state4 << 21)) ^
                    ((state4 >>> 25) | (state4 << 7))) +
                    ((state4 & state5) ^ (~state4 & state6))) |
                    0) +
                    ((state7 + ((constants.KEY[i] + this.temp[i]) | 0)) | 0)) |
                    0;
                var t2 = ((((state0 >>> 2) | (state0 << 30)) ^
                    ((state0 >>> 13) | (state0 << 19)) ^
                    ((state0 >>> 22) | (state0 << 10))) +
                    ((state0 & state1) ^ (state0 & state2) ^ (state1 & state2))) |
                    0;
                state7 = state6;
                state6 = state5;
                state5 = state4;
                state4 = (state3 + t1) | 0;
                state3 = state2;
                state2 = state1;
                state1 = state0;
                state0 = (t1 + t2) | 0;
            }
            state[0] += state0;
            state[1] += state1;
            state[2] += state2;
            state[3] += state3;
            state[4] += state4;
            state[5] += state5;
            state[6] += state6;
            state[7] += state7;
        };
        return RawSha256;
    }());
    exports.RawSha256 = RawSha256;
    //# sourceMappingURL=RawSha256.js.map
    });

    var tslib_1$2 = /*@__PURE__*/getAugmentedNamespace(tslib_es6$2);

    var jsSha256 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Sha256 = void 0;




    var Sha256 = /** @class */ (function () {
        function Sha256(secret) {
            this.hash = new RawSha256_1.RawSha256();
            if (secret) {
                this.outer = new RawSha256_1.RawSha256();
                var inner = bufferFromSecret(secret);
                var outer = new Uint8Array(constants.BLOCK_SIZE);
                outer.set(inner);
                for (var i = 0; i < constants.BLOCK_SIZE; i++) {
                    inner[i] ^= 0x36;
                    outer[i] ^= 0x5c;
                }
                this.hash.update(inner);
                this.outer.update(outer);
                // overwrite the copied key in memory
                for (var i = 0; i < inner.byteLength; i++) {
                    inner[i] = 0;
                }
            }
        }
        Sha256.prototype.update = function (toHash) {
            if (isEmptyData(toHash) || this.error) {
                return;
            }
            try {
                this.hash.update(convertToBuffer(toHash));
            }
            catch (e) {
                this.error = e;
            }
        };
        /* This synchronous method keeps compatibility
         * with the v2 aws-sdk.
         */
        Sha256.prototype.digestSync = function () {
            if (this.error) {
                throw this.error;
            }
            if (this.outer) {
                if (!this.outer.finished) {
                    this.outer.update(this.hash.digest());
                }
                return this.outer.digest();
            }
            return this.hash.digest();
        };
        /* The underlying digest method here is synchronous.
         * To keep the same interface with the other hash functions
         * the default is to expose this as an async method.
         * However, it can sometimes be useful to have a sync method.
         */
        Sha256.prototype.digest = function () {
            return tslib_1$2.__awaiter(this, void 0, void 0, function () {
                return tslib_1$2.__generator(this, function (_a) {
                    return [2 /*return*/, this.digestSync()];
                });
            });
        };
        return Sha256;
    }());
    exports.Sha256 = Sha256;
    function bufferFromSecret(secret) {
        var input = convertToBuffer(secret);
        if (input.byteLength > constants.BLOCK_SIZE) {
            var bufferHash = new RawSha256_1.RawSha256();
            bufferHash.update(input);
            input = bufferHash.digest();
        }
        var buffer = new Uint8Array(constants.BLOCK_SIZE);
        buffer.set(input);
        return buffer;
    }
    function isEmptyData(data) {
        if (typeof data === "string") {
            return data.length === 0;
        }
        return data.byteLength === 0;
    }
    function convertToBuffer(data) {
        if (typeof data === "string") {
            return util_utf8_browser_1.fromUtf8(data);
        }
        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
        }
        return new Uint8Array(data);
    }
    //# sourceMappingURL=jsSha256.js.map
    });

    var build$3 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    tslib_1$2.__exportStar(jsSha256, exports);
    //# sourceMappingURL=index.js.map
    });

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$3 = function(d, b) {
        extendStatics$3 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics$3(d, b);
    };

    function __extends$3(d, b) {
        extendStatics$3(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$b = function() {
        __assign$b = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$b.apply(this, arguments);
    };

    function __rest$3(s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }

    function __decorate$1(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    function __param$1(paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); }
    }

    function __metadata$1(metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
    }

    function __awaiter$d(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$d(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __createBinding$1(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }

    function __exportStar$1(m, exports) {
        for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) exports[p] = m[p];
    }

    function __values$6(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read$9(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread$7() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read$9(arguments[i]));
        return ar;
    }

    function __spreadArrays$1() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    }
    function __await$1(v) {
        return this instanceof __await$1 ? (this.v = v, this) : new __await$1(v);
    }

    function __asyncGenerator$1(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await$1 ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    }

    function __asyncDelegator$1(o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await$1(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    }

    function __asyncValues$1(o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values$6 === "function" ? __values$6(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    }

    function __makeTemplateObject$1(cooked, raw) {
        if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
        return cooked;
    }
    function __importStar$1(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result.default = mod;
        return result;
    }

    function __importDefault$1(mod) {
        return (mod && mod.__esModule) ? mod : { default: mod };
    }

    function __classPrivateFieldGet$1(receiver, privateMap) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to get private field on non-instance");
        }
        return privateMap.get(receiver);
    }

    function __classPrivateFieldSet$1(receiver, privateMap, value) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to set private field on non-instance");
        }
        privateMap.set(receiver, value);
        return value;
    }

    var tslib_es6$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        __extends: __extends$3,
        get __assign () { return __assign$b; },
        __rest: __rest$3,
        __decorate: __decorate$1,
        __param: __param$1,
        __metadata: __metadata$1,
        __awaiter: __awaiter$d,
        __generator: __generator$d,
        __createBinding: __createBinding$1,
        __exportStar: __exportStar$1,
        __values: __values$6,
        __read: __read$9,
        __spread: __spread$7,
        __spreadArrays: __spreadArrays$1,
        __await: __await$1,
        __asyncGenerator: __asyncGenerator$1,
        __asyncDelegator: __asyncDelegator$1,
        __asyncValues: __asyncValues$1,
        __makeTemplateObject: __makeTemplateObject$1,
        __importStar: __importStar$1,
        __importDefault: __importDefault$1,
        __classPrivateFieldGet: __classPrivateFieldGet$1,
        __classPrivateFieldSet: __classPrivateFieldSet$1
    });

    var tslib_1$1 = /*@__PURE__*/getAugmentedNamespace(tslib_es6$1);

    var supportsWebCrypto_1 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.supportsZeroByteGCM = exports.supportsSubtleCrypto = exports.supportsSecureRandom = exports.supportsWebCrypto = void 0;

    var subtleCryptoMethods = [
        "decrypt",
        "digest",
        "encrypt",
        "exportKey",
        "generateKey",
        "importKey",
        "sign",
        "verify"
    ];
    function supportsWebCrypto(window) {
        if (supportsSecureRandom(window) &&
            typeof window.crypto.subtle === "object") {
            var subtle = window.crypto.subtle;
            return supportsSubtleCrypto(subtle);
        }
        return false;
    }
    exports.supportsWebCrypto = supportsWebCrypto;
    function supportsSecureRandom(window) {
        if (typeof window === "object" && typeof window.crypto === "object") {
            var getRandomValues = window.crypto.getRandomValues;
            return typeof getRandomValues === "function";
        }
        return false;
    }
    exports.supportsSecureRandom = supportsSecureRandom;
    function supportsSubtleCrypto(subtle) {
        return (subtle &&
            subtleCryptoMethods.every(function (methodName) { return typeof subtle[methodName] === "function"; }));
    }
    exports.supportsSubtleCrypto = supportsSubtleCrypto;
    function supportsZeroByteGCM(subtle) {
        return tslib_1$1.__awaiter(this, void 0, void 0, function () {
            var key, zeroByteAuthTag;
            return tslib_1$1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!supportsSubtleCrypto(subtle))
                            return [2 /*return*/, false];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, subtle.generateKey({ name: "AES-GCM", length: 128 }, false, ["encrypt"])];
                    case 2:
                        key = _b.sent();
                        return [4 /*yield*/, subtle.encrypt({
                                name: "AES-GCM",
                                iv: new Uint8Array(Array(12)),
                                additionalData: new Uint8Array(Array(16)),
                                tagLength: 128
                            }, key, new Uint8Array(0))];
                    case 3:
                        zeroByteAuthTag = _b.sent();
                        return [2 /*return*/, zeroByteAuthTag.byteLength === 16];
                    case 4:
                        _b.sent();
                        return [2 /*return*/, false];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    exports.supportsZeroByteGCM = supportsZeroByteGCM;
    //# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VwcG9ydHNXZWJDcnlwdG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvc3VwcG9ydHNXZWJDcnlwdG8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQVVBLElBQU0sbUJBQW1CLEdBQThCO0lBQ3JELFNBQVM7SUFDVCxRQUFRO0lBQ1IsU0FBUztJQUNULFdBQVc7SUFDWCxhQUFhO0lBQ2IsV0FBVztJQUNYLE1BQU07SUFDTixRQUFRO0NBQ1QsQ0FBQztBQUVGLFNBQWdCLGlCQUFpQixDQUFDLE1BQWM7SUFDOUMsSUFDRSxvQkFBb0IsQ0FBQyxNQUFNLENBQUM7UUFDNUIsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxRQUFRLEVBQ3hDO1FBQ1EsSUFBQSxNQUFNLEdBQUssTUFBTSxDQUFDLE1BQU0sT0FBbEIsQ0FBbUI7UUFFakMsT0FBTyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNyQztJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQVhELDhDQVdDO0FBRUQsU0FBZ0Isb0JBQW9CLENBQUMsTUFBYztJQUNqRCxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsSUFBSSxPQUFPLE1BQU0sQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFO1FBQzNELElBQUEsZUFBZSxHQUFLLE1BQU0sQ0FBQyxNQUFNLGdCQUFsQixDQUFtQjtRQUUxQyxPQUFPLE9BQU8sZUFBZSxLQUFLLFVBQVUsQ0FBQztLQUM5QztJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQVJELG9EQVFDO0FBRUQsU0FBZ0Isb0JBQW9CLENBQUMsTUFBb0I7SUFDdkQsT0FBTyxDQUNMLE1BQU07UUFDTixtQkFBbUIsQ0FBQyxLQUFLLENBQ3ZCLFVBQUEsVUFBVSxJQUFJLE9BQUEsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDLEtBQUssVUFBVSxFQUF4QyxDQUF3QyxDQUN2RCxDQUNGLENBQUM7QUFDSixDQUFDO0FBUEQsb0RBT0M7QUFFRCxTQUFzQixtQkFBbUIsQ0FBQyxNQUFvQjs7Ozs7O29CQUM1RCxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDO3dCQUFFLHNCQUFPLEtBQUssRUFBQzs7OztvQkFFbEMscUJBQU0sTUFBTSxDQUFDLFdBQVcsQ0FDbEMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsRUFDaEMsS0FBSyxFQUNMLENBQUMsU0FBUyxDQUFDLENBQ1osRUFBQTs7b0JBSkssR0FBRyxHQUFHLFNBSVg7b0JBQ3VCLHFCQUFNLE1BQU0sQ0FBQyxPQUFPLENBQzFDOzRCQUNFLElBQUksRUFBRSxTQUFTOzRCQUNmLEVBQUUsRUFBRSxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7NEJBQzdCLGNBQWMsRUFBRSxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7NEJBQ3pDLFNBQVMsRUFBRSxHQUFHO3lCQUNmLEVBQ0QsR0FBRyxFQUNILElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUNsQixFQUFBOztvQkFUSyxlQUFlLEdBQUcsU0FTdkI7b0JBQ0Qsc0JBQU8sZUFBZSxDQUFDLFVBQVUsS0FBSyxFQUFFLEVBQUM7OztvQkFFekMsc0JBQU8sS0FBSyxFQUFDOzs7OztDQUVoQjtBQXRCRCxrREFzQkMiLCJzb3VyY2VzQ29udGVudCI6WyJ0eXBlIFN1YnRsZUNyeXB0b01ldGhvZCA9XG4gIHwgXCJkZWNyeXB0XCJcbiAgfCBcImRpZ2VzdFwiXG4gIHwgXCJlbmNyeXB0XCJcbiAgfCBcImV4cG9ydEtleVwiXG4gIHwgXCJnZW5lcmF0ZUtleVwiXG4gIHwgXCJpbXBvcnRLZXlcIlxuICB8IFwic2lnblwiXG4gIHwgXCJ2ZXJpZnlcIjtcblxuY29uc3Qgc3VidGxlQ3J5cHRvTWV0aG9kczogQXJyYXk8U3VidGxlQ3J5cHRvTWV0aG9kPiA9IFtcbiAgXCJkZWNyeXB0XCIsXG4gIFwiZGlnZXN0XCIsXG4gIFwiZW5jcnlwdFwiLFxuICBcImV4cG9ydEtleVwiLFxuICBcImdlbmVyYXRlS2V5XCIsXG4gIFwiaW1wb3J0S2V5XCIsXG4gIFwic2lnblwiLFxuICBcInZlcmlmeVwiXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gc3VwcG9ydHNXZWJDcnlwdG8od2luZG93OiBXaW5kb3cpOiBib29sZWFuIHtcbiAgaWYgKFxuICAgIHN1cHBvcnRzU2VjdXJlUmFuZG9tKHdpbmRvdykgJiZcbiAgICB0eXBlb2Ygd2luZG93LmNyeXB0by5zdWJ0bGUgPT09IFwib2JqZWN0XCJcbiAgKSB7XG4gICAgY29uc3QgeyBzdWJ0bGUgfSA9IHdpbmRvdy5jcnlwdG87XG5cbiAgICByZXR1cm4gc3VwcG9ydHNTdWJ0bGVDcnlwdG8oc3VidGxlKTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN1cHBvcnRzU2VjdXJlUmFuZG9tKHdpbmRvdzogV2luZG93KTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiB3aW5kb3cuY3J5cHRvID09PSBcIm9iamVjdFwiKSB7XG4gICAgY29uc3QgeyBnZXRSYW5kb21WYWx1ZXMgfSA9IHdpbmRvdy5jcnlwdG87XG5cbiAgICByZXR1cm4gdHlwZW9mIGdldFJhbmRvbVZhbHVlcyA9PT0gXCJmdW5jdGlvblwiO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3VwcG9ydHNTdWJ0bGVDcnlwdG8oc3VidGxlOiBTdWJ0bGVDcnlwdG8pIHtcbiAgcmV0dXJuIChcbiAgICBzdWJ0bGUgJiZcbiAgICBzdWJ0bGVDcnlwdG9NZXRob2RzLmV2ZXJ5KFxuICAgICAgbWV0aG9kTmFtZSA9PiB0eXBlb2Ygc3VidGxlW21ldGhvZE5hbWVdID09PSBcImZ1bmN0aW9uXCJcbiAgICApXG4gICk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdXBwb3J0c1plcm9CeXRlR0NNKHN1YnRsZTogU3VidGxlQ3J5cHRvKSB7XG4gIGlmICghc3VwcG9ydHNTdWJ0bGVDcnlwdG8oc3VidGxlKSkgcmV0dXJuIGZhbHNlO1xuICB0cnkge1xuICAgIGNvbnN0IGtleSA9IGF3YWl0IHN1YnRsZS5nZW5lcmF0ZUtleShcbiAgICAgIHsgbmFtZTogXCJBRVMtR0NNXCIsIGxlbmd0aDogMTI4IH0sXG4gICAgICBmYWxzZSxcbiAgICAgIFtcImVuY3J5cHRcIl1cbiAgICApO1xuICAgIGNvbnN0IHplcm9CeXRlQXV0aFRhZyA9IGF3YWl0IHN1YnRsZS5lbmNyeXB0KFxuICAgICAge1xuICAgICAgICBuYW1lOiBcIkFFUy1HQ01cIixcbiAgICAgICAgaXY6IG5ldyBVaW50OEFycmF5KEFycmF5KDEyKSksXG4gICAgICAgIGFkZGl0aW9uYWxEYXRhOiBuZXcgVWludDhBcnJheShBcnJheSgxNikpLFxuICAgICAgICB0YWdMZW5ndGg6IDEyOFxuICAgICAgfSxcbiAgICAgIGtleSxcbiAgICAgIG5ldyBVaW50OEFycmF5KDApXG4gICAgKTtcbiAgICByZXR1cm4gemVyb0J5dGVBdXRoVGFnLmJ5dGVMZW5ndGggPT09IDE2O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdfQ==
    });

    var build$2 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    tslib_1$1.__exportStar(supportsWebCrypto_1, exports);
    //# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsOERBQW9DIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0ICogZnJvbSBcIi4vc3VwcG9ydHNXZWJDcnlwdG9cIjtcbiJdfQ==
    });

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$2 = function(d, b) {
        extendStatics$2 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics$2(d, b);
    };

    function __extends$2(d, b) {
        extendStatics$2(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign$a = function() {
        __assign$a = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$a.apply(this, arguments);
    };

    function __rest$2(s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }

    function __decorate(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    function __param(paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); }
    }

    function __metadata(metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
    }

    function __awaiter$c(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$c(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __createBinding(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }

    function __exportStar(m, exports) {
        for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) exports[p] = m[p];
    }

    function __values$5(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read$8(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread$6() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read$8(arguments[i]));
        return ar;
    }

    function __spreadArrays() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    }
    function __await(v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    }

    function __asyncGenerator(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    }

    function __asyncDelegator(o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    }

    function __asyncValues(o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values$5 === "function" ? __values$5(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    }

    function __makeTemplateObject(cooked, raw) {
        if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
        return cooked;
    }
    function __importStar(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result.default = mod;
        return result;
    }

    function __importDefault(mod) {
        return (mod && mod.__esModule) ? mod : { default: mod };
    }

    function __classPrivateFieldGet(receiver, privateMap) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to get private field on non-instance");
        }
        return privateMap.get(receiver);
    }

    function __classPrivateFieldSet(receiver, privateMap, value) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to set private field on non-instance");
        }
        privateMap.set(receiver, value);
        return value;
    }

    var tslib_es6 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        __extends: __extends$2,
        get __assign () { return __assign$a; },
        __rest: __rest$2,
        __decorate: __decorate,
        __param: __param,
        __metadata: __metadata,
        __awaiter: __awaiter$c,
        __generator: __generator$c,
        __createBinding: __createBinding,
        __exportStar: __exportStar,
        __values: __values$5,
        __read: __read$8,
        __spread: __spread$6,
        __spreadArrays: __spreadArrays,
        __await: __await,
        __asyncGenerator: __asyncGenerator,
        __asyncDelegator: __asyncDelegator,
        __asyncValues: __asyncValues,
        __makeTemplateObject: __makeTemplateObject,
        __importStar: __importStar,
        __importDefault: __importDefault,
        __classPrivateFieldGet: __classPrivateFieldGet,
        __classPrivateFieldSet: __classPrivateFieldSet
    });

    Object.defineProperty(exports, "__esModule", { value: true });

    var CryptoOperation = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    Object.defineProperty(exports, "__esModule", { value: true });

    var Key = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    Object.defineProperty(exports, "__esModule", { value: true });

    var KeyOperation = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    Object.defineProperty(exports, "__esModule", { value: true });

    var MsSubtleCrypto = /*#__PURE__*/Object.freeze({
        __proto__: null
    });

    var MsWindow = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isMsWindow = void 0;
    var msSubtleCryptoMethods = [
        "decrypt",
        "digest",
        "encrypt",
        "exportKey",
        "generateKey",
        "importKey",
        "sign",
        "verify"
    ];
    function quacksLikeAnMsWindow(window) {
        return "MSInputMethodContext" in window && "msCrypto" in window;
    }
    /**
     * Determines if the provided window is (or is like) the window object one would
     * expect to encounter in Internet Explorer 11.
     */
    function isMsWindow(window) {
        if (quacksLikeAnMsWindow(window) && window.msCrypto.subtle !== undefined) {
            var _a = window.msCrypto, getRandomValues = _a.getRandomValues, subtle_1 = _a.subtle;
            return msSubtleCryptoMethods
                .map(function (methodName) { return subtle_1[methodName]; })
                .concat(getRandomValues)
                .every(function (method) { return typeof method === "function"; });
        }
        return false;
    }
    exports.isMsWindow = isMsWindow;
    //# sourceMappingURL=MsWindow.js.map
    });

    var tslib_1 = /*@__PURE__*/getAugmentedNamespace(tslib_es6);

    var require$$0 = /*@__PURE__*/getAugmentedNamespace(CryptoOperation);

    var require$$1 = /*@__PURE__*/getAugmentedNamespace(Key);

    var require$$2 = /*@__PURE__*/getAugmentedNamespace(KeyOperation);

    var require$$3 = /*@__PURE__*/getAugmentedNamespace(MsSubtleCrypto);

    var build$1 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    tslib_1.__exportStar(require$$0, exports);
    tslib_1.__exportStar(require$$1, exports);
    tslib_1.__exportStar(require$$2, exports);
    tslib_1.__exportStar(require$$3, exports);
    tslib_1.__exportStar(MsWindow, exports);
    //# sourceMappingURL=index.js.map
    });

    var crossPlatformSha256 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Sha256 = void 0;






    var Sha256 = /** @class */ (function () {
        function Sha256(secret) {
            if (build$2.supportsWebCrypto(util_locate_window_1.locateWindow())) {
                this.hash = new webCryptoSha256.Sha256(secret);
            }
            else if (build$1.isMsWindow(util_locate_window_1.locateWindow())) {
                this.hash = new ie11Sha256.Sha256(secret);
            }
            else {
                this.hash = new build$3.Sha256(secret);
            }
        }
        Sha256.prototype.update = function (data, encoding) {
            this.hash.update(data, encoding);
        };
        Sha256.prototype.digest = function () {
            return this.hash.digest();
        };
        return Sha256;
    }());
    exports.Sha256 = Sha256;
    //# sourceMappingURL=crossPlatformSha256.js.map
    });

    var build = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebCryptoSha256 = exports.Ie11Sha256 = void 0;

    tslib_1$2.__exportStar(crossPlatformSha256, exports);

    Object.defineProperty(exports, "Ie11Sha256", { enumerable: true, get: function () { return ie11Sha256.Sha256; } });

    Object.defineProperty(exports, "WebCryptoSha256", { enumerable: true, get: function () { return webCryptoSha256.Sha256; } });
    //# sourceMappingURL=index.js.map
    });

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter$b(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$b(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __values$4(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    var HttpResponse = /** @class */ (function () {
        function HttpResponse(options) {
            this.statusCode = options.statusCode;
            this.headers = options.headers || {};
            this.body = options.body;
        }
        HttpResponse.isInstance = function (response) {
            //determine if response is a valid HttpResponse
            if (!response)
                return false;
            var resp = response;
            return typeof resp.statusCode === "number" && typeof resp.headers === "object";
        };
        return HttpResponse;
    }());

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$9 = function() {
        __assign$9 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$9.apply(this, arguments);
    };

    function __read$7(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread$5() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read$7(arguments[i]));
        return ar;
    }

    var HttpRequest = /** @class */ (function () {
        function HttpRequest(options) {
            this.method = options.method || "GET";
            this.hostname = options.hostname || "localhost";
            this.port = options.port;
            this.query = options.query || {};
            this.headers = options.headers || {};
            this.body = options.body;
            this.protocol = options.protocol
                ? options.protocol.substr(-1) !== ":"
                    ? options.protocol + ":"
                    : options.protocol
                : "https:";
            this.path = options.path ? (options.path.charAt(0) !== "/" ? "/" + options.path : options.path) : "/";
        }
        HttpRequest.isInstance = function (request) {
            //determine if request is a valid httpRequest
            if (!request)
                return false;
            var req = request;
            return ("method" in req &&
                "protocol" in req &&
                "hostname" in req &&
                "path" in req &&
                typeof req["query"] === "object" &&
                typeof req["headers"] === "object");
        };
        HttpRequest.prototype.clone = function () {
            var cloned = new HttpRequest(__assign$9(__assign$9({}, this), { headers: __assign$9({}, this.headers) }));
            if (cloned.query)
                cloned.query = cloneQuery$1(cloned.query);
            return cloned;
        };
        return HttpRequest;
    }());
    function cloneQuery$1(query) {
        return Object.keys(query).reduce(function (carry, paramName) {
            var _a;
            var param = query[paramName];
            return __assign$9(__assign$9({}, carry), (_a = {}, _a[paramName] = Array.isArray(param) ? __spread$5(param) : param, _a));
        }, {});
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __values$3(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    var escapeUri = function (uri) {
        // AWS percent-encodes some extra non-standard characters in a URI
        return encodeURIComponent(uri).replace(/[!'()*]/g, hexEncode);
    };
    var hexEncode = function (c) { return "%" + c.charCodeAt(0).toString(16).toUpperCase(); };

    function buildQueryString(query) {
        var e_1, _a;
        var parts = [];
        try {
            for (var _b = __values$3(Object.keys(query).sort()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                var value = query[key];
                key = escapeUri(key);
                if (Array.isArray(value)) {
                    for (var i = 0, iLen = value.length; i < iLen; i++) {
                        parts.push(key + "=" + escapeUri(value[i]));
                    }
                }
                else {
                    var qsEntry = key;
                    if (value || typeof value === "string") {
                        qsEntry += "=" + escapeUri(value);
                    }
                    parts.push(qsEntry);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return parts.join("&");
    }

    function requestTimeout(timeoutInMs) {
        if (timeoutInMs === void 0) { timeoutInMs = 0; }
        return new Promise(function (resolve, reject) {
            if (timeoutInMs) {
                setTimeout(function () {
                    var timeoutError = new Error("Request did not complete within " + timeoutInMs + " ms");
                    timeoutError.name = "TimeoutError";
                    reject(timeoutError);
                }, timeoutInMs);
            }
        });
    }

    var FetchHttpHandler = /** @class */ (function () {
        function FetchHttpHandler(_a) {
            var _b = _a === void 0 ? {} : _a, requestTimeout = _b.requestTimeout;
            this.requestTimeout = requestTimeout;
        }
        FetchHttpHandler.prototype.destroy = function () {
            // Do nothing. TLS and HTTP/2 connection pooling is handled by the browser.
        };
        FetchHttpHandler.prototype.handle = function (request, _a) {
            var _b = _a === void 0 ? {} : _a, abortSignal = _b.abortSignal;
            var requestTimeoutInMs = this.requestTimeout;
            // if the request was already aborted, prevent doing extra work
            if (abortSignal === null || abortSignal === void 0 ? void 0 : abortSignal.aborted) {
                var abortError = new Error("Request aborted");
                abortError.name = "AbortError";
                return Promise.reject(abortError);
            }
            var path = request.path;
            if (request.query) {
                var queryString = buildQueryString(request.query);
                if (queryString) {
                    path += "?" + queryString;
                }
            }
            var port = request.port, method = request.method;
            var url = request.protocol + "//" + request.hostname + (port ? ":" + port : "") + path;
            // Request constructor doesn't allow GET/HEAD request with body
            // ref: https://github.com/whatwg/fetch/issues/551
            var body = method === "GET" || method === "HEAD" ? undefined : request.body;
            var requestOptions = {
                body: body,
                headers: new Headers(request.headers),
                method: method,
            };
            // some browsers support abort signal
            if (typeof AbortController !== "undefined") {
                requestOptions["signal"] = abortSignal;
            }
            var fetchRequest = new Request(url, requestOptions);
            var raceOfPromises = [
                fetch(fetchRequest).then(function (response) {
                    var e_1, _a;
                    var fetchHeaders = response.headers;
                    var transformedHeaders = {};
                    try {
                        for (var _b = __values$4(fetchHeaders.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var pair = _c.value;
                            transformedHeaders[pair[0]] = pair[1];
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    var hasReadableStream = response.body !== undefined;
                    // Return the response with buffered body
                    if (!hasReadableStream) {
                        return response.blob().then(function (body) { return ({
                            response: new HttpResponse({
                                headers: transformedHeaders,
                                statusCode: response.status,
                                body: body,
                            }),
                        }); });
                    }
                    // Return the response with streaming body
                    return {
                        response: new HttpResponse({
                            headers: transformedHeaders,
                            statusCode: response.status,
                            body: response.body,
                        }),
                    };
                }),
                requestTimeout(requestTimeoutInMs),
            ];
            if (abortSignal) {
                raceOfPromises.push(new Promise(function (resolve, reject) {
                    abortSignal.onabort = function () {
                        var abortError = new Error("Request aborted");
                        abortError.name = "AbortError";
                        reject(abortError);
                    };
                }));
            }
            return Promise.race(raceOfPromises);
        };
        return FetchHttpHandler;
    }());

    var alphabetByEncoding = {};
    var alphabetByValue = new Array(64);
    for (var i$1 = 0, start = "A".charCodeAt(0), limit = "Z".charCodeAt(0); i$1 + start <= limit; i$1++) {
        var char = String.fromCharCode(i$1 + start);
        alphabetByEncoding[char] = i$1;
        alphabetByValue[i$1] = char;
    }
    for (var i$1 = 0, start = "a".charCodeAt(0), limit = "z".charCodeAt(0); i$1 + start <= limit; i$1++) {
        var char = String.fromCharCode(i$1 + start);
        var index = i$1 + 26;
        alphabetByEncoding[char] = index;
        alphabetByValue[index] = char;
    }
    for (var i$1 = 0; i$1 < 10; i$1++) {
        alphabetByEncoding[i$1.toString(10)] = i$1 + 52;
        var char = i$1.toString(10);
        var index = i$1 + 52;
        alphabetByEncoding[char] = index;
        alphabetByValue[index] = char;
    }
    alphabetByEncoding["+"] = 62;
    alphabetByValue[62] = "+";
    alphabetByEncoding["/"] = 63;
    alphabetByValue[63] = "/";
    var bitsPerLetter = 6;
    var bitsPerByte = 8;
    var maxLetterValue = 63;
    /**
     * Converts a base-64 encoded string to a Uint8Array of bytes.
     *
     * @param input The base-64 encoded string
     *
     * @see https://tools.ietf.org/html/rfc4648#section-4
     */
    function fromBase64(input) {
        var totalByteLength = (input.length / 4) * 3;
        if (input.substr(-2) === "==") {
            totalByteLength -= 2;
        }
        else if (input.substr(-1) === "=") {
            totalByteLength--;
        }
        var out = new ArrayBuffer(totalByteLength);
        var dataView = new DataView(out);
        for (var i = 0; i < input.length; i += 4) {
            var bits = 0;
            var bitLength = 0;
            for (var j = i, limit = i + 3; j <= limit; j++) {
                if (input[j] !== "=") {
                    bits |= alphabetByEncoding[input[j]] << ((limit - j) * bitsPerLetter);
                    bitLength += bitsPerLetter;
                }
                else {
                    bits >>= bitsPerLetter;
                }
            }
            var chunkOffset = (i / 4) * 3;
            bits >>= bitLength % bitsPerByte;
            var byteLength = Math.floor(bitLength / bitsPerByte);
            for (var k = 0; k < byteLength; k++) {
                var offset = (byteLength - k - 1) * bitsPerByte;
                dataView.setUint8(chunkOffset + k, (bits & (255 << offset)) >> offset);
            }
        }
        return new Uint8Array(out);
    }
    /**
     * Converts a Uint8Array of binary data to a base-64 encoded string.
     *
     * @param input The binary data to encode
     *
     * @see https://tools.ietf.org/html/rfc4648#section-4
     */
    function toBase64(input) {
        var str = "";
        for (var i = 0; i < input.length; i += 3) {
            var bits = 0;
            var bitLength = 0;
            for (var j = i, limit = Math.min(i + 3, input.length); j < limit; j++) {
                bits |= input[j] << ((limit - j - 1) * bitsPerByte);
                bitLength += bitsPerByte;
            }
            var bitClusterCount = Math.ceil(bitLength / bitsPerLetter);
            bits <<= bitClusterCount * bitsPerLetter - bitLength;
            for (var k = 1; k <= bitClusterCount; k++) {
                var offset = (bitClusterCount - k) * bitsPerLetter;
                str += alphabetByValue[(bits & (maxLetterValue << offset)) >> offset];
            }
            str += "==".slice(0, 4 - bitClusterCount);
        }
        return str;
    }

    //reference: https://snack.expo.io/r1JCSWRGU
    var streamCollector = function (stream) {
        if (typeof Blob === "function" && stream instanceof Blob) {
            return collectBlob(stream);
        }
        return collectStream(stream);
    };
    function collectBlob(blob) {
        return __awaiter$b(this, void 0, void 0, function () {
            var base64, arrayBuffer;
            return __generator$b(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, readToBase64(blob)];
                    case 1:
                        base64 = _a.sent();
                        arrayBuffer = fromBase64(base64);
                        return [2 /*return*/, new Uint8Array(arrayBuffer)];
                }
            });
        });
    }
    function collectStream(stream) {
        return __awaiter$b(this, void 0, void 0, function () {
            var res, reader, isDone, _a, done, value, prior;
            return __generator$b(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        res = new Uint8Array(0);
                        reader = stream.getReader();
                        isDone = false;
                        _b.label = 1;
                    case 1:
                        if (!!isDone) return [3 /*break*/, 3];
                        return [4 /*yield*/, reader.read()];
                    case 2:
                        _a = _b.sent(), done = _a.done, value = _a.value;
                        if (value) {
                            prior = res;
                            res = new Uint8Array(prior.length + value.length);
                            res.set(prior);
                            res.set(value, prior.length);
                        }
                        isDone = done;
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, res];
                }
            });
        });
    }
    function readToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function () {
                var _a;
                // reference: https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL
                // response from readAsDataURL is always prepended with "data:*/*;base64,"
                if (reader.readyState !== 2) {
                    return reject(new Error("Reader aborted too early"));
                }
                var result = ((_a = reader.result) !== null && _a !== void 0 ? _a : "");
                // Response can include only 'data:' for empty blob, return empty string in this case.
                // Otherwise, return the string after ','
                var commaIndex = result.indexOf(",");
                var dataOffset = commaIndex > -1 ? commaIndex + 1 : result.length;
                resolve(result.substring(dataOffset));
            };
            reader.onabort = function () { return reject(new Error("Read aborted")); };
            reader.onerror = function () { return reject(reader.error); };
            // reader.readAsArrayBuffer is not always available
            reader.readAsDataURL(blob);
        });
    }

    var invalidProvider = function (message) { return function () { return Promise.reject(message); }; };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$8 = function() {
        __assign$8 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$8.apply(this, arguments);
    };

    function __awaiter$a(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$a(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __read$6(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread$4() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read$6(arguments[i]));
        return ar;
    }

    var retryMiddleware = function (options) { return function (next, context) { return function (args) { return __awaiter$a(void 0, void 0, void 0, function () {
        var _a;
        return __generator$a(this, function (_b) {
            if ((_a = options === null || options === void 0 ? void 0 : options.retryStrategy) === null || _a === void 0 ? void 0 : _a.mode)
                context.userAgent = __spread$4((context.userAgent || []), [["cfg/retry-mode", options.retryStrategy.mode]]);
            return [2 /*return*/, options.retryStrategy.retry(next, args)];
        });
    }); }; }; };
    var retryMiddlewareOptions = {
        name: "retryMiddleware",
        tags: ["RETRY"],
        step: "finalizeRequest",
        priority: "high",
        override: true,
    };
    var getRetryPlugin = function (options) { return ({
        applyToStack: function (clientStack) {
            clientStack.add(retryMiddleware(options), retryMiddlewareOptions);
        },
    }); };

    /**
     * The base number of milliseconds to use in calculating a suitable cool-down
     * time when a retryable error is encountered.
     */
    var DEFAULT_RETRY_DELAY_BASE = 100;
    /**
     * The maximum amount of time (in milliseconds) that will be used as a delay
     * between retry attempts.
     */
    var MAXIMUM_RETRY_DELAY = 20 * 1000;
    /**
     * The retry delay base (in milliseconds) to use when a throttling error is
     * encountered.
     */
    var THROTTLING_RETRY_DELAY_BASE = 500;
    /**
     * Initial number of retry tokens in Retry Quota
     */
    var INITIAL_RETRY_TOKENS = 500;
    /**
     * The total amount of retry tokens to be decremented from retry token balance.
     */
    var RETRY_COST = 5;
    /**
     * The total amount of retry tokens to be decremented from retry token balance
     * when a throttling error is encountered.
     */
    var TIMEOUT_RETRY_COST = 10;
    /**
     * The total amount of retry token to be incremented from retry token balance
     * if an SDK operation invocation succeeds without requiring a retry request.
     */
    var NO_RETRY_INCREMENT = 1;
    /**
     * Header name for SDK invocation ID
     */
    var INVOCATION_ID_HEADER = "amz-sdk-invocation-id";
    /**
     * Header name for request retry information.
     */
    var REQUEST_HEADER = "amz-sdk-request";

    /**
     * Errors encountered when the client clock and server clock cannot agree on the
     * current time.
     *
     * These errors are retryable, assuming the SDK has enabled clock skew
     * correction.
     */
    var CLOCK_SKEW_ERROR_CODES = [
        "AuthFailure",
        "InvalidSignatureException",
        "RequestExpired",
        "RequestInTheFuture",
        "RequestTimeTooSkewed",
        "SignatureDoesNotMatch",
    ];
    /**
     * Errors that indicate the SDK is being throttled.
     *
     * These errors are always retryable.
     */
    var THROTTLING_ERROR_CODES = [
        "BandwidthLimitExceeded",
        "EC2ThrottledException",
        "LimitExceededException",
        "PriorRequestNotComplete",
        "ProvisionedThroughputExceededException",
        "RequestLimitExceeded",
        "RequestThrottled",
        "RequestThrottledException",
        "SlowDown",
        "ThrottledException",
        "Throttling",
        "ThrottlingException",
        "TooManyRequestsException",
        "TransactionInProgressException",
    ];
    /**
     * Error codes that indicate transient issues
     */
    var TRANSIENT_ERROR_CODES = ["AbortError", "TimeoutError", "RequestTimeout", "RequestTimeoutException"];
    /**
     * Error codes that indicate transient issues
     */
    var TRANSIENT_ERROR_STATUS_CODES = [500, 502, 503, 504];

    var isRetryableByTrait = function (error) { return error.$retryable !== undefined; };
    var isClockSkewError = function (error) { return CLOCK_SKEW_ERROR_CODES.includes(error.name); };
    var isThrottlingError = function (error) {
        var _a, _b;
        return ((_a = error.$metadata) === null || _a === void 0 ? void 0 : _a.httpStatusCode) === 429 ||
            THROTTLING_ERROR_CODES.includes(error.name) ||
            ((_b = error.$retryable) === null || _b === void 0 ? void 0 : _b.throttling) == true;
    };
    var isTransientError = function (error) {
        var _a;
        return TRANSIENT_ERROR_CODES.includes(error.name) ||
            TRANSIENT_ERROR_STATUS_CODES.includes(((_a = error.$metadata) === null || _a === void 0 ? void 0 : _a.httpStatusCode) || 0);
    };

    var rngBrowser = createCommonjsModule(function (module) {
    // Unique ID creation requires a high quality random # generator.  In the
    // browser this is a little complicated due to unknown quality of Math.random()
    // and inconsistent support for the `crypto` API.  We do the best we can via
    // feature-detection

    // getRandomValues needs to be invoked in a context where "this" is a Crypto
    // implementation. Also, find the complete implementation of crypto on IE11.
    var getRandomValues = (typeof(crypto) != 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto)) ||
                          (typeof(msCrypto) != 'undefined' && typeof window.msCrypto.getRandomValues == 'function' && msCrypto.getRandomValues.bind(msCrypto));

    if (getRandomValues) {
      // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
      var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef

      module.exports = function whatwgRNG() {
        getRandomValues(rnds8);
        return rnds8;
      };
    } else {
      // Math.random()-based (RNG)
      //
      // If all else fails, use Math.random().  It's fast, but is of unspecified
      // quality.
      var rnds = new Array(16);

      module.exports = function mathRNG() {
        for (var i = 0, r; i < 16; i++) {
          if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
          rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
        }

        return rnds;
      };
    }
    });

    /**
     * Convert array of 16 byte values to UUID string format of the form:
     * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
     */
    var byteToHex = [];
    for (var i = 0; i < 256; ++i) {
      byteToHex[i] = (i + 0x100).toString(16).substr(1);
    }

    function bytesToUuid(buf, offset) {
      var i = offset || 0;
      var bth = byteToHex;
      // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
      return ([
        bth[buf[i++]], bth[buf[i++]],
        bth[buf[i++]], bth[buf[i++]], '-',
        bth[buf[i++]], bth[buf[i++]], '-',
        bth[buf[i++]], bth[buf[i++]], '-',
        bth[buf[i++]], bth[buf[i++]], '-',
        bth[buf[i++]], bth[buf[i++]],
        bth[buf[i++]], bth[buf[i++]],
        bth[buf[i++]], bth[buf[i++]]
      ]).join('');
    }

    var bytesToUuid_1 = bytesToUuid;

    // **`v1()` - Generate time-based UUID**
    //
    // Inspired by https://github.com/LiosK/UUID.js
    // and http://docs.python.org/library/uuid.html

    var _nodeId;
    var _clockseq;

    // Previous uuid creation time
    var _lastMSecs = 0;
    var _lastNSecs = 0;

    // See https://github.com/uuidjs/uuid for API details
    function v1(options, buf, offset) {
      var i = buf && offset || 0;
      var b = buf || [];

      options = options || {};
      var node = options.node || _nodeId;
      var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

      // node and clockseq need to be initialized to random values if they're not
      // specified.  We do this lazily to minimize issues related to insufficient
      // system entropy.  See #189
      if (node == null || clockseq == null) {
        var seedBytes = rngBrowser();
        if (node == null) {
          // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
          node = _nodeId = [
            seedBytes[0] | 0x01,
            seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]
          ];
        }
        if (clockseq == null) {
          // Per 4.2.2, randomize (14 bit) clockseq
          clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
        }
      }

      // UUID timestamps are 100 nano-second units since the Gregorian epoch,
      // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
      // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
      // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
      var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

      // Per 4.2.1.2, use count of uuid's generated during the current clock
      // cycle to simulate higher resolution clock
      var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

      // Time since last uuid creation (in msecs)
      var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

      // Per 4.2.1.2, Bump clockseq on clock regression
      if (dt < 0 && options.clockseq === undefined) {
        clockseq = clockseq + 1 & 0x3fff;
      }

      // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
      // time interval
      if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
        nsecs = 0;
      }

      // Per 4.2.1.2 Throw error if too many uuids are requested
      if (nsecs >= 10000) {
        throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
      }

      _lastMSecs = msecs;
      _lastNSecs = nsecs;
      _clockseq = clockseq;

      // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
      msecs += 12219292800000;

      // `time_low`
      var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
      b[i++] = tl >>> 24 & 0xff;
      b[i++] = tl >>> 16 & 0xff;
      b[i++] = tl >>> 8 & 0xff;
      b[i++] = tl & 0xff;

      // `time_mid`
      var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
      b[i++] = tmh >>> 8 & 0xff;
      b[i++] = tmh & 0xff;

      // `time_high_and_version`
      b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
      b[i++] = tmh >>> 16 & 0xff;

      // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
      b[i++] = clockseq >>> 8 | 0x80;

      // `clock_seq_low`
      b[i++] = clockseq & 0xff;

      // `node`
      for (var n = 0; n < 6; ++n) {
        b[i + n] = node[n];
      }

      return buf ? buf : bytesToUuid_1(b);
    }

    var v1_1 = v1;

    function v4(options, buf, offset) {
      var i = buf && offset || 0;

      if (typeof(options) == 'string') {
        buf = options === 'binary' ? new Array(16) : null;
        options = null;
      }
      options = options || {};

      var rnds = options.random || (options.rng || rngBrowser)();

      // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
      rnds[6] = (rnds[6] & 0x0f) | 0x40;
      rnds[8] = (rnds[8] & 0x3f) | 0x80;

      // Copy bytes to buffer, if provided
      if (buf) {
        for (var ii = 0; ii < 16; ++ii) {
          buf[i + ii] = rnds[ii];
        }
      }

      return buf || bytesToUuid_1(rnds);
    }

    var v4_1 = v4;

    var uuid = v4_1;
    uuid.v1 = v1_1;
    uuid.v4 = v4_1;

    var uuid_1 = uuid;

    var getDefaultRetryQuota = function (initialRetryTokens) {
        var MAX_CAPACITY = initialRetryTokens;
        var availableCapacity = initialRetryTokens;
        var getCapacityAmount = function (error) { return (error.name === "TimeoutError" ? TIMEOUT_RETRY_COST : RETRY_COST); };
        var hasRetryTokens = function (error) { return getCapacityAmount(error) <= availableCapacity; };
        var retrieveRetryTokens = function (error) {
            if (!hasRetryTokens(error)) {
                // retryStrategy should stop retrying, and return last error
                throw new Error("No retry token available");
            }
            var capacityAmount = getCapacityAmount(error);
            availableCapacity -= capacityAmount;
            return capacityAmount;
        };
        var releaseRetryTokens = function (capacityReleaseAmount) {
            availableCapacity += capacityReleaseAmount !== null && capacityReleaseAmount !== void 0 ? capacityReleaseAmount : NO_RETRY_INCREMENT;
            availableCapacity = Math.min(availableCapacity, MAX_CAPACITY);
        };
        return Object.freeze({
            hasRetryTokens: hasRetryTokens,
            retrieveRetryTokens: retrieveRetryTokens,
            releaseRetryTokens: releaseRetryTokens,
        });
    };

    /**
     * Calculate a capped, fully-jittered exponential backoff time.
     */
    var defaultDelayDecider = function (delayBase, attempts) {
        return Math.floor(Math.min(MAXIMUM_RETRY_DELAY, Math.random() * Math.pow(2, attempts) * delayBase));
    };

    var defaultRetryDecider = function (error) {
        if (!error) {
            return false;
        }
        return isRetryableByTrait(error) || isClockSkewError(error) || isThrottlingError(error) || isTransientError(error);
    };

    /**
     * The default value for how many HTTP requests an SDK should make for a
     * single SDK operation invocation before giving up
     */
    var DEFAULT_MAX_ATTEMPTS = 3;
    /**
     * The default retry algorithm to use.
     */
    var DEFAULT_RETRY_MODE = "standard";
    var StandardRetryStrategy = /** @class */ (function () {
        function StandardRetryStrategy(maxAttemptsProvider, options) {
            var _a, _b, _c;
            this.maxAttemptsProvider = maxAttemptsProvider;
            this.mode = DEFAULT_RETRY_MODE;
            this.retryDecider = (_a = options === null || options === void 0 ? void 0 : options.retryDecider) !== null && _a !== void 0 ? _a : defaultRetryDecider;
            this.delayDecider = (_b = options === null || options === void 0 ? void 0 : options.delayDecider) !== null && _b !== void 0 ? _b : defaultDelayDecider;
            this.retryQuota = (_c = options === null || options === void 0 ? void 0 : options.retryQuota) !== null && _c !== void 0 ? _c : getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        }
        StandardRetryStrategy.prototype.shouldRetry = function (error, attempts, maxAttempts) {
            return attempts < maxAttempts && this.retryDecider(error) && this.retryQuota.hasRetryTokens(error);
        };
        StandardRetryStrategy.prototype.getMaxAttempts = function () {
            return __awaiter$a(this, void 0, void 0, function () {
                var maxAttempts;
                return __generator$a(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.maxAttemptsProvider()];
                        case 1:
                            maxAttempts = _a.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            _a.sent();
                            maxAttempts = DEFAULT_MAX_ATTEMPTS;
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/, maxAttempts];
                    }
                });
            });
        };
        StandardRetryStrategy.prototype.retry = function (next, args) {
            return __awaiter$a(this, void 0, void 0, function () {
                var retryTokenAmount, attempts, totalDelay, maxAttempts, request, _loop_1, this_1, state_1;
                return __generator$a(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            attempts = 0;
                            totalDelay = 0;
                            return [4 /*yield*/, this.getMaxAttempts()];
                        case 1:
                            maxAttempts = _a.sent();
                            request = args.request;
                            if (HttpRequest.isInstance(request)) {
                                request.headers[INVOCATION_ID_HEADER] = uuid_1.v4();
                            }
                            _loop_1 = function () {
                                var _a, response, output, err_1, delay_1;
                                return __generator$a(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _b.trys.push([0, 2, , 5]);
                                            if (HttpRequest.isInstance(request)) {
                                                request.headers[REQUEST_HEADER] = "attempt=" + (attempts + 1) + "; max=" + maxAttempts;
                                            }
                                            return [4 /*yield*/, next(args)];
                                        case 1:
                                            _a = _b.sent(), response = _a.response, output = _a.output;
                                            this_1.retryQuota.releaseRetryTokens(retryTokenAmount);
                                            output.$metadata.attempts = attempts + 1;
                                            output.$metadata.totalRetryDelay = totalDelay;
                                            return [2 /*return*/, { value: { response: response, output: output } }];
                                        case 2:
                                            err_1 = _b.sent();
                                            attempts++;
                                            if (!this_1.shouldRetry(err_1, attempts, maxAttempts)) return [3 /*break*/, 4];
                                            retryTokenAmount = this_1.retryQuota.retrieveRetryTokens(err_1);
                                            delay_1 = this_1.delayDecider(isThrottlingError(err_1) ? THROTTLING_RETRY_DELAY_BASE : DEFAULT_RETRY_DELAY_BASE, attempts);
                                            totalDelay += delay_1;
                                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_1); })];
                                        case 3:
                                            _b.sent();
                                            return [2 /*return*/, "continue"];
                                        case 4:
                                            if (!err_1.$metadata) {
                                                err_1.$metadata = {};
                                            }
                                            err_1.$metadata.attempts = attempts;
                                            err_1.$metadata.totalRetryDelay = totalDelay;
                                            throw err_1;
                                        case 5: return [2 /*return*/];
                                    }
                                });
                            };
                            this_1 = this;
                            _a.label = 2;
                        case 2:
                            return [5 /*yield**/, _loop_1()];
                        case 3:
                            state_1 = _a.sent();
                            if (typeof state_1 === "object")
                                return [2 /*return*/, state_1.value];
                            return [3 /*break*/, 2];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        return StandardRetryStrategy;
    }());

    var resolveRetryConfig = function (input) {
        var maxAttempts = normalizeMaxAttempts(input.maxAttempts);
        return __assign$8(__assign$8({}, input), { maxAttempts: maxAttempts, retryStrategy: input.retryStrategy || new StandardRetryStrategy(maxAttempts) });
    };
    var normalizeMaxAttempts = function (maxAttempts) {
        if (maxAttempts === void 0) { maxAttempts = DEFAULT_MAX_ATTEMPTS; }
        if (typeof maxAttempts === "number") {
            var promisified_1 = Promise.resolve(maxAttempts);
            return function () { return promisified_1; };
        }
        return maxAttempts;
    };

    function calculateBodyLength(body) {
        if (typeof body === "string") {
            var len = body.length;
            for (var i = len - 1; i >= 0; i--) {
                var code = body.charCodeAt(i);
                if (code > 0x7f && code <= 0x7ff)
                    len++;
                else if (code > 0x7ff && code <= 0xffff)
                    len += 2;
            }
            return len;
        }
        else if (typeof body.byteLength === "number") {
            // handles Uint8Array, ArrayBuffer, Buffer, and ArrayBufferView
            return body.byteLength;
        }
        else if (typeof body.size === "number") {
            // handles browser File object
            return body.size;
        }
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter$9(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$9(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    var es5 = createCommonjsModule(function (module, exports) {
    !function(e,t){module.exports=t();}(commonjsGlobal,(function(){return function(e){var t={};function r(n){if(t[n])return t[n].exports;var i=t[n]={i:n,l:!1,exports:{}};return e[n].call(i.exports,i,i.exports,r),i.l=!0,i.exports}return r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n});},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0});},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var i in e)r.d(n,i,function(t){return e[t]}.bind(null,i));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=90)}({17:function(e,t,r){t.__esModule=!0,t.default=void 0;var n=r(18),i=function(){function e(){}return e.getFirstMatch=function(e,t){var r=t.match(e);return r&&r.length>0&&r[1]||""},e.getSecondMatch=function(e,t){var r=t.match(e);return r&&r.length>1&&r[2]||""},e.matchAndReturnConst=function(e,t,r){if(e.test(t))return r},e.getWindowsVersionName=function(e){switch(e){case"NT":return "NT";case"XP":return "XP";case"NT 5.0":return "2000";case"NT 5.1":return "XP";case"NT 5.2":return "2003";case"NT 6.0":return "Vista";case"NT 6.1":return "7";case"NT 6.2":return "8";case"NT 6.3":return "8.1";case"NT 10.0":return "10";default:return}},e.getMacOSVersionName=function(e){var t=e.split(".").splice(0,2).map((function(e){return parseInt(e,10)||0}));if(t.push(0),10===t[0])switch(t[1]){case 5:return "Leopard";case 6:return "Snow Leopard";case 7:return "Lion";case 8:return "Mountain Lion";case 9:return "Mavericks";case 10:return "Yosemite";case 11:return "El Capitan";case 12:return "Sierra";case 13:return "High Sierra";case 14:return "Mojave";case 15:return "Catalina";default:return}},e.getAndroidVersionName=function(e){var t=e.split(".").splice(0,2).map((function(e){return parseInt(e,10)||0}));if(t.push(0),!(1===t[0]&&t[1]<5))return 1===t[0]&&t[1]<6?"Cupcake":1===t[0]&&t[1]>=6?"Donut":2===t[0]&&t[1]<2?"Eclair":2===t[0]&&2===t[1]?"Froyo":2===t[0]&&t[1]>2?"Gingerbread":3===t[0]?"Honeycomb":4===t[0]&&t[1]<1?"Ice Cream Sandwich":4===t[0]&&t[1]<4?"Jelly Bean":4===t[0]&&t[1]>=4?"KitKat":5===t[0]?"Lollipop":6===t[0]?"Marshmallow":7===t[0]?"Nougat":8===t[0]?"Oreo":9===t[0]?"Pie":void 0},e.getVersionPrecision=function(e){return e.split(".").length},e.compareVersions=function(t,r,n){void 0===n&&(n=!1);var i=e.getVersionPrecision(t),s=e.getVersionPrecision(r),a=Math.max(i,s),o=0,u=e.map([t,r],(function(t){var r=a-e.getVersionPrecision(t),n=t+new Array(r+1).join(".0");return e.map(n.split("."),(function(e){return new Array(20-e.length).join("0")+e})).reverse()}));for(n&&(o=a-Math.min(i,s)),a-=1;a>=o;){if(u[0][a]>u[1][a])return 1;if(u[0][a]===u[1][a]){if(a===o)return 0;a-=1;}else if(u[0][a]<u[1][a])return -1}},e.map=function(e,t){var r,n=[];if(Array.prototype.map)return Array.prototype.map.call(e,t);for(r=0;r<e.length;r+=1)n.push(t(e[r]));return n},e.find=function(e,t){var r,n;if(Array.prototype.find)return Array.prototype.find.call(e,t);for(r=0,n=e.length;r<n;r+=1){var i=e[r];if(t(i,r))return i}},e.assign=function(e){for(var t,r,n=e,i=arguments.length,s=new Array(i>1?i-1:0),a=1;a<i;a++)s[a-1]=arguments[a];if(Object.assign)return Object.assign.apply(Object,[e].concat(s));var o=function(){var e=s[t];"object"==typeof e&&null!==e&&Object.keys(e).forEach((function(t){n[t]=e[t];}));};for(t=0,r=s.length;t<r;t+=1)o();return e},e.getBrowserAlias=function(e){return n.BROWSER_ALIASES_MAP[e]},e.getBrowserTypeByAlias=function(e){return n.BROWSER_MAP[e]||""},e}();t.default=i,e.exports=t.default;},18:function(e,t,r){t.__esModule=!0,t.ENGINE_MAP=t.OS_MAP=t.PLATFORMS_MAP=t.BROWSER_MAP=t.BROWSER_ALIASES_MAP=void 0;t.BROWSER_ALIASES_MAP={"Amazon Silk":"amazon_silk","Android Browser":"android",Bada:"bada",BlackBerry:"blackberry",Chrome:"chrome",Chromium:"chromium",Electron:"electron",Epiphany:"epiphany",Firefox:"firefox",Focus:"focus",Generic:"generic","Google Search":"google_search",Googlebot:"googlebot","Internet Explorer":"ie","K-Meleon":"k_meleon",Maxthon:"maxthon","Microsoft Edge":"edge","MZ Browser":"mz","NAVER Whale Browser":"naver",Opera:"opera","Opera Coast":"opera_coast",PhantomJS:"phantomjs",Puffin:"puffin",QupZilla:"qupzilla",QQ:"qq",QQLite:"qqlite",Safari:"safari",Sailfish:"sailfish","Samsung Internet for Android":"samsung_internet",SeaMonkey:"seamonkey",Sleipnir:"sleipnir",Swing:"swing",Tizen:"tizen","UC Browser":"uc",Vivaldi:"vivaldi","WebOS Browser":"webos",WeChat:"wechat","Yandex Browser":"yandex",Roku:"roku"};t.BROWSER_MAP={amazon_silk:"Amazon Silk",android:"Android Browser",bada:"Bada",blackberry:"BlackBerry",chrome:"Chrome",chromium:"Chromium",electron:"Electron",epiphany:"Epiphany",firefox:"Firefox",focus:"Focus",generic:"Generic",googlebot:"Googlebot",google_search:"Google Search",ie:"Internet Explorer",k_meleon:"K-Meleon",maxthon:"Maxthon",edge:"Microsoft Edge",mz:"MZ Browser",naver:"NAVER Whale Browser",opera:"Opera",opera_coast:"Opera Coast",phantomjs:"PhantomJS",puffin:"Puffin",qupzilla:"QupZilla",qq:"QQ Browser",qqlite:"QQ Browser Lite",safari:"Safari",sailfish:"Sailfish",samsung_internet:"Samsung Internet for Android",seamonkey:"SeaMonkey",sleipnir:"Sleipnir",swing:"Swing",tizen:"Tizen",uc:"UC Browser",vivaldi:"Vivaldi",webos:"WebOS Browser",wechat:"WeChat",yandex:"Yandex Browser"};t.PLATFORMS_MAP={tablet:"tablet",mobile:"mobile",desktop:"desktop",tv:"tv"};t.OS_MAP={WindowsPhone:"Windows Phone",Windows:"Windows",MacOS:"macOS",iOS:"iOS",Android:"Android",WebOS:"WebOS",BlackBerry:"BlackBerry",Bada:"Bada",Tizen:"Tizen",Linux:"Linux",ChromeOS:"Chrome OS",PlayStation4:"PlayStation 4",Roku:"Roku"};t.ENGINE_MAP={EdgeHTML:"EdgeHTML",Blink:"Blink",Trident:"Trident",Presto:"Presto",Gecko:"Gecko",WebKit:"WebKit"};},90:function(e,t,r){t.__esModule=!0,t.default=void 0;var n,i=(n=r(91))&&n.__esModule?n:{default:n},s=r(18);function a(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n);}}var o=function(){function e(){}var t,r,n;return e.getParser=function(e,t){if(void 0===t&&(t=!1),"string"!=typeof e)throw new Error("UserAgent should be a string");return new i.default(e,t)},e.parse=function(e){return new i.default(e).getResult()},t=e,n=[{key:"BROWSER_MAP",get:function(){return s.BROWSER_MAP}},{key:"ENGINE_MAP",get:function(){return s.ENGINE_MAP}},{key:"OS_MAP",get:function(){return s.OS_MAP}},{key:"PLATFORMS_MAP",get:function(){return s.PLATFORMS_MAP}}],(r=null)&&a(t.prototype,r),n&&a(t,n),e}();t.default=o,e.exports=t.default;},91:function(e,t,r){t.__esModule=!0,t.default=void 0;var n=u(r(92)),i=u(r(93)),s=u(r(94)),a=u(r(95)),o=u(r(17));function u(e){return e&&e.__esModule?e:{default:e}}var d=function(){function e(e,t){if(void 0===t&&(t=!1),null==e||""===e)throw new Error("UserAgent parameter can't be empty");this._ua=e,this.parsedResult={},!0!==t&&this.parse();}var t=e.prototype;return t.getUA=function(){return this._ua},t.test=function(e){return e.test(this._ua)},t.parseBrowser=function(){var e=this;this.parsedResult.browser={};var t=o.default.find(n.default,(function(t){if("function"==typeof t.test)return t.test(e);if(t.test instanceof Array)return t.test.some((function(t){return e.test(t)}));throw new Error("Browser's test function is not valid")}));return t&&(this.parsedResult.browser=t.describe(this.getUA())),this.parsedResult.browser},t.getBrowser=function(){return this.parsedResult.browser?this.parsedResult.browser:this.parseBrowser()},t.getBrowserName=function(e){return e?String(this.getBrowser().name).toLowerCase()||"":this.getBrowser().name||""},t.getBrowserVersion=function(){return this.getBrowser().version},t.getOS=function(){return this.parsedResult.os?this.parsedResult.os:this.parseOS()},t.parseOS=function(){var e=this;this.parsedResult.os={};var t=o.default.find(i.default,(function(t){if("function"==typeof t.test)return t.test(e);if(t.test instanceof Array)return t.test.some((function(t){return e.test(t)}));throw new Error("Browser's test function is not valid")}));return t&&(this.parsedResult.os=t.describe(this.getUA())),this.parsedResult.os},t.getOSName=function(e){var t=this.getOS().name;return e?String(t).toLowerCase()||"":t||""},t.getOSVersion=function(){return this.getOS().version},t.getPlatform=function(){return this.parsedResult.platform?this.parsedResult.platform:this.parsePlatform()},t.getPlatformType=function(e){void 0===e&&(e=!1);var t=this.getPlatform().type;return e?String(t).toLowerCase()||"":t||""},t.parsePlatform=function(){var e=this;this.parsedResult.platform={};var t=o.default.find(s.default,(function(t){if("function"==typeof t.test)return t.test(e);if(t.test instanceof Array)return t.test.some((function(t){return e.test(t)}));throw new Error("Browser's test function is not valid")}));return t&&(this.parsedResult.platform=t.describe(this.getUA())),this.parsedResult.platform},t.getEngine=function(){return this.parsedResult.engine?this.parsedResult.engine:this.parseEngine()},t.getEngineName=function(e){return e?String(this.getEngine().name).toLowerCase()||"":this.getEngine().name||""},t.parseEngine=function(){var e=this;this.parsedResult.engine={};var t=o.default.find(a.default,(function(t){if("function"==typeof t.test)return t.test(e);if(t.test instanceof Array)return t.test.some((function(t){return e.test(t)}));throw new Error("Browser's test function is not valid")}));return t&&(this.parsedResult.engine=t.describe(this.getUA())),this.parsedResult.engine},t.parse=function(){return this.parseBrowser(),this.parseOS(),this.parsePlatform(),this.parseEngine(),this},t.getResult=function(){return o.default.assign({},this.parsedResult)},t.satisfies=function(e){var t=this,r={},n=0,i={},s=0;if(Object.keys(e).forEach((function(t){var a=e[t];"string"==typeof a?(i[t]=a,s+=1):"object"==typeof a&&(r[t]=a,n+=1);})),n>0){var a=Object.keys(r),u=o.default.find(a,(function(e){return t.isOS(e)}));if(u){var d=this.satisfies(r[u]);if(void 0!==d)return d}var c=o.default.find(a,(function(e){return t.isPlatform(e)}));if(c){var f=this.satisfies(r[c]);if(void 0!==f)return f}}if(s>0){var l=Object.keys(i),h=o.default.find(l,(function(e){return t.isBrowser(e,!0)}));if(void 0!==h)return this.compareVersion(i[h])}},t.isBrowser=function(e,t){void 0===t&&(t=!1);var r=this.getBrowserName().toLowerCase(),n=e.toLowerCase(),i=o.default.getBrowserTypeByAlias(n);return t&&i&&(n=i.toLowerCase()),n===r},t.compareVersion=function(e){var t=[0],r=e,n=!1,i=this.getBrowserVersion();if("string"==typeof i)return ">"===e[0]||"<"===e[0]?(r=e.substr(1),"="===e[1]?(n=!0,r=e.substr(2)):t=[],">"===e[0]?t.push(1):t.push(-1)):"="===e[0]?r=e.substr(1):"~"===e[0]&&(n=!0,r=e.substr(1)),t.indexOf(o.default.compareVersions(i,r,n))>-1},t.isOS=function(e){return this.getOSName(!0)===String(e).toLowerCase()},t.isPlatform=function(e){return this.getPlatformType(!0)===String(e).toLowerCase()},t.isEngine=function(e){return this.getEngineName(!0)===String(e).toLowerCase()},t.is=function(e,t){return void 0===t&&(t=!1),this.isBrowser(e,t)||this.isOS(e)||this.isPlatform(e)},t.some=function(e){var t=this;return void 0===e&&(e=[]),e.some((function(e){return t.is(e)}))},e}();t.default=d,e.exports=t.default;},92:function(e,t,r){t.__esModule=!0,t.default=void 0;var n,i=(n=r(17))&&n.__esModule?n:{default:n};var s=/version\/(\d+(\.?_?\d+)+)/i,a=[{test:[/googlebot/i],describe:function(e){var t={name:"Googlebot"},r=i.default.getFirstMatch(/googlebot\/(\d+(\.\d+))/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/opera/i],describe:function(e){var t={name:"Opera"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/opr\/|opios/i],describe:function(e){var t={name:"Opera"},r=i.default.getFirstMatch(/(?:opr|opios)[\s/](\S+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/SamsungBrowser/i],describe:function(e){var t={name:"Samsung Internet for Android"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:SamsungBrowser)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/Whale/i],describe:function(e){var t={name:"NAVER Whale Browser"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:whale)[\s/](\d+(?:\.\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/MZBrowser/i],describe:function(e){var t={name:"MZ Browser"},r=i.default.getFirstMatch(/(?:MZBrowser)[\s/](\d+(?:\.\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/focus/i],describe:function(e){var t={name:"Focus"},r=i.default.getFirstMatch(/(?:focus)[\s/](\d+(?:\.\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/swing/i],describe:function(e){var t={name:"Swing"},r=i.default.getFirstMatch(/(?:swing)[\s/](\d+(?:\.\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/coast/i],describe:function(e){var t={name:"Opera Coast"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:coast)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/opt\/\d+(?:.?_?\d+)+/i],describe:function(e){var t={name:"Opera Touch"},r=i.default.getFirstMatch(/(?:opt)[\s/](\d+(\.?_?\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/yabrowser/i],describe:function(e){var t={name:"Yandex Browser"},r=i.default.getFirstMatch(/(?:yabrowser)[\s/](\d+(\.?_?\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/ucbrowser/i],describe:function(e){var t={name:"UC Browser"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:ucbrowser)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/Maxthon|mxios/i],describe:function(e){var t={name:"Maxthon"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:Maxthon|mxios)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/epiphany/i],describe:function(e){var t={name:"Epiphany"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:epiphany)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/puffin/i],describe:function(e){var t={name:"Puffin"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:puffin)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/sleipnir/i],describe:function(e){var t={name:"Sleipnir"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:sleipnir)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/k-meleon/i],describe:function(e){var t={name:"K-Meleon"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/(?:k-meleon)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/micromessenger/i],describe:function(e){var t={name:"WeChat"},r=i.default.getFirstMatch(/(?:micromessenger)[\s/](\d+(\.?_?\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/qqbrowser/i],describe:function(e){var t={name:/qqbrowserlite/i.test(e)?"QQ Browser Lite":"QQ Browser"},r=i.default.getFirstMatch(/(?:qqbrowserlite|qqbrowser)[/](\d+(\.?_?\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/msie|trident/i],describe:function(e){var t={name:"Internet Explorer"},r=i.default.getFirstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/\sedg\//i],describe:function(e){var t={name:"Microsoft Edge"},r=i.default.getFirstMatch(/\sedg\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/edg([ea]|ios)/i],describe:function(e){var t={name:"Microsoft Edge"},r=i.default.getSecondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/vivaldi/i],describe:function(e){var t={name:"Vivaldi"},r=i.default.getFirstMatch(/vivaldi\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/seamonkey/i],describe:function(e){var t={name:"SeaMonkey"},r=i.default.getFirstMatch(/seamonkey\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/sailfish/i],describe:function(e){var t={name:"Sailfish"},r=i.default.getFirstMatch(/sailfish\s?browser\/(\d+(\.\d+)?)/i,e);return r&&(t.version=r),t}},{test:[/silk/i],describe:function(e){var t={name:"Amazon Silk"},r=i.default.getFirstMatch(/silk\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/phantom/i],describe:function(e){var t={name:"PhantomJS"},r=i.default.getFirstMatch(/phantomjs\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/slimerjs/i],describe:function(e){var t={name:"SlimerJS"},r=i.default.getFirstMatch(/slimerjs\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/blackberry|\bbb\d+/i,/rim\stablet/i],describe:function(e){var t={name:"BlackBerry"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/blackberry[\d]+\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/(web|hpw)[o0]s/i],describe:function(e){var t={name:"WebOS Browser"},r=i.default.getFirstMatch(s,e)||i.default.getFirstMatch(/w(?:eb)?[o0]sbrowser\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/bada/i],describe:function(e){var t={name:"Bada"},r=i.default.getFirstMatch(/dolfin\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/tizen/i],describe:function(e){var t={name:"Tizen"},r=i.default.getFirstMatch(/(?:tizen\s?)?browser\/(\d+(\.?_?\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/qupzilla/i],describe:function(e){var t={name:"QupZilla"},r=i.default.getFirstMatch(/(?:qupzilla)[\s/](\d+(\.?_?\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/firefox|iceweasel|fxios/i],describe:function(e){var t={name:"Firefox"},r=i.default.getFirstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/electron/i],describe:function(e){var t={name:"Electron"},r=i.default.getFirstMatch(/(?:electron)\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/MiuiBrowser/i],describe:function(e){var t={name:"Miui"},r=i.default.getFirstMatch(/(?:MiuiBrowser)[\s/](\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/chromium/i],describe:function(e){var t={name:"Chromium"},r=i.default.getFirstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i,e)||i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/chrome|crios|crmo/i],describe:function(e){var t={name:"Chrome"},r=i.default.getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/GSA/i],describe:function(e){var t={name:"Google Search"},r=i.default.getFirstMatch(/(?:GSA)\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:function(e){var t=!e.test(/like android/i),r=e.test(/android/i);return t&&r},describe:function(e){var t={name:"Android Browser"},r=i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/playstation 4/i],describe:function(e){var t={name:"PlayStation 4"},r=i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/safari|applewebkit/i],describe:function(e){var t={name:"Safari"},r=i.default.getFirstMatch(s,e);return r&&(t.version=r),t}},{test:[/.*/i],describe:function(e){var t=-1!==e.search("\\(")?/^(.*)\/(.*)[ \t]\((.*)/:/^(.*)\/(.*) /;return {name:i.default.getFirstMatch(t,e),version:i.default.getSecondMatch(t,e)}}}];t.default=a,e.exports=t.default;},93:function(e,t,r){t.__esModule=!0,t.default=void 0;var n,i=(n=r(17))&&n.__esModule?n:{default:n},s=r(18);var a=[{test:[/Roku\/DVP/],describe:function(e){var t=i.default.getFirstMatch(/Roku\/DVP-(\d+\.\d+)/i,e);return {name:s.OS_MAP.Roku,version:t}}},{test:[/windows phone/i],describe:function(e){var t=i.default.getFirstMatch(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i,e);return {name:s.OS_MAP.WindowsPhone,version:t}}},{test:[/windows /i],describe:function(e){var t=i.default.getFirstMatch(/Windows ((NT|XP)( \d\d?.\d)?)/i,e),r=i.default.getWindowsVersionName(t);return {name:s.OS_MAP.Windows,version:t,versionName:r}}},{test:[/Macintosh(.*?) FxiOS(.*?)\//],describe:function(e){var t={name:s.OS_MAP.iOS},r=i.default.getSecondMatch(/(Version\/)(\d[\d.]+)/,e);return r&&(t.version=r),t}},{test:[/macintosh/i],describe:function(e){var t=i.default.getFirstMatch(/mac os x (\d+(\.?_?\d+)+)/i,e).replace(/[_\s]/g,"."),r=i.default.getMacOSVersionName(t),n={name:s.OS_MAP.MacOS,version:t};return r&&(n.versionName=r),n}},{test:[/(ipod|iphone|ipad)/i],describe:function(e){var t=i.default.getFirstMatch(/os (\d+([_\s]\d+)*) like mac os x/i,e).replace(/[_\s]/g,".");return {name:s.OS_MAP.iOS,version:t}}},{test:function(e){var t=!e.test(/like android/i),r=e.test(/android/i);return t&&r},describe:function(e){var t=i.default.getFirstMatch(/android[\s/-](\d+(\.\d+)*)/i,e),r=i.default.getAndroidVersionName(t),n={name:s.OS_MAP.Android,version:t};return r&&(n.versionName=r),n}},{test:[/(web|hpw)[o0]s/i],describe:function(e){var t=i.default.getFirstMatch(/(?:web|hpw)[o0]s\/(\d+(\.\d+)*)/i,e),r={name:s.OS_MAP.WebOS};return t&&t.length&&(r.version=t),r}},{test:[/blackberry|\bbb\d+/i,/rim\stablet/i],describe:function(e){var t=i.default.getFirstMatch(/rim\stablet\sos\s(\d+(\.\d+)*)/i,e)||i.default.getFirstMatch(/blackberry\d+\/(\d+([_\s]\d+)*)/i,e)||i.default.getFirstMatch(/\bbb(\d+)/i,e);return {name:s.OS_MAP.BlackBerry,version:t}}},{test:[/bada/i],describe:function(e){var t=i.default.getFirstMatch(/bada\/(\d+(\.\d+)*)/i,e);return {name:s.OS_MAP.Bada,version:t}}},{test:[/tizen/i],describe:function(e){var t=i.default.getFirstMatch(/tizen[/\s](\d+(\.\d+)*)/i,e);return {name:s.OS_MAP.Tizen,version:t}}},{test:[/linux/i],describe:function(){return {name:s.OS_MAP.Linux}}},{test:[/CrOS/],describe:function(){return {name:s.OS_MAP.ChromeOS}}},{test:[/PlayStation 4/],describe:function(e){var t=i.default.getFirstMatch(/PlayStation 4[/\s](\d+(\.\d+)*)/i,e);return {name:s.OS_MAP.PlayStation4,version:t}}}];t.default=a,e.exports=t.default;},94:function(e,t,r){t.__esModule=!0,t.default=void 0;var n,i=(n=r(17))&&n.__esModule?n:{default:n},s=r(18);var a=[{test:[/googlebot/i],describe:function(){return {type:"bot",vendor:"Google"}}},{test:[/huawei/i],describe:function(e){var t=i.default.getFirstMatch(/(can-l01)/i,e)&&"Nova",r={type:s.PLATFORMS_MAP.mobile,vendor:"Huawei"};return t&&(r.model=t),r}},{test:[/nexus\s*(?:7|8|9|10).*/i],describe:function(){return {type:s.PLATFORMS_MAP.tablet,vendor:"Nexus"}}},{test:[/ipad/i],describe:function(){return {type:s.PLATFORMS_MAP.tablet,vendor:"Apple",model:"iPad"}}},{test:[/Macintosh(.*?) FxiOS(.*?)\//],describe:function(){return {type:s.PLATFORMS_MAP.tablet,vendor:"Apple",model:"iPad"}}},{test:[/kftt build/i],describe:function(){return {type:s.PLATFORMS_MAP.tablet,vendor:"Amazon",model:"Kindle Fire HD 7"}}},{test:[/silk/i],describe:function(){return {type:s.PLATFORMS_MAP.tablet,vendor:"Amazon"}}},{test:[/tablet(?! pc)/i],describe:function(){return {type:s.PLATFORMS_MAP.tablet}}},{test:function(e){var t=e.test(/ipod|iphone/i),r=e.test(/like (ipod|iphone)/i);return t&&!r},describe:function(e){var t=i.default.getFirstMatch(/(ipod|iphone)/i,e);return {type:s.PLATFORMS_MAP.mobile,vendor:"Apple",model:t}}},{test:[/nexus\s*[0-6].*/i,/galaxy nexus/i],describe:function(){return {type:s.PLATFORMS_MAP.mobile,vendor:"Nexus"}}},{test:[/[^-]mobi/i],describe:function(){return {type:s.PLATFORMS_MAP.mobile}}},{test:function(e){return "blackberry"===e.getBrowserName(!0)},describe:function(){return {type:s.PLATFORMS_MAP.mobile,vendor:"BlackBerry"}}},{test:function(e){return "bada"===e.getBrowserName(!0)},describe:function(){return {type:s.PLATFORMS_MAP.mobile}}},{test:function(e){return "windows phone"===e.getBrowserName()},describe:function(){return {type:s.PLATFORMS_MAP.mobile,vendor:"Microsoft"}}},{test:function(e){var t=Number(String(e.getOSVersion()).split(".")[0]);return "android"===e.getOSName(!0)&&t>=3},describe:function(){return {type:s.PLATFORMS_MAP.tablet}}},{test:function(e){return "android"===e.getOSName(!0)},describe:function(){return {type:s.PLATFORMS_MAP.mobile}}},{test:function(e){return "macos"===e.getOSName(!0)},describe:function(){return {type:s.PLATFORMS_MAP.desktop,vendor:"Apple"}}},{test:function(e){return "windows"===e.getOSName(!0)},describe:function(){return {type:s.PLATFORMS_MAP.desktop}}},{test:function(e){return "linux"===e.getOSName(!0)},describe:function(){return {type:s.PLATFORMS_MAP.desktop}}},{test:function(e){return "playstation 4"===e.getOSName(!0)},describe:function(){return {type:s.PLATFORMS_MAP.tv}}},{test:function(e){return "roku"===e.getOSName(!0)},describe:function(){return {type:s.PLATFORMS_MAP.tv}}}];t.default=a,e.exports=t.default;},95:function(e,t,r){t.__esModule=!0,t.default=void 0;var n,i=(n=r(17))&&n.__esModule?n:{default:n},s=r(18);var a=[{test:function(e){return "microsoft edge"===e.getBrowserName(!0)},describe:function(e){if(/\sedg\//i.test(e))return {name:s.ENGINE_MAP.Blink};var t=i.default.getFirstMatch(/edge\/(\d+(\.?_?\d+)+)/i,e);return {name:s.ENGINE_MAP.EdgeHTML,version:t}}},{test:[/trident/i],describe:function(e){var t={name:s.ENGINE_MAP.Trident},r=i.default.getFirstMatch(/trident\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:function(e){return e.test(/presto/i)},describe:function(e){var t={name:s.ENGINE_MAP.Presto},r=i.default.getFirstMatch(/presto\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:function(e){var t=e.test(/gecko/i),r=e.test(/like gecko/i);return t&&!r},describe:function(e){var t={name:s.ENGINE_MAP.Gecko},r=i.default.getFirstMatch(/gecko\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}},{test:[/(apple)?webkit\/537\.36/i],describe:function(){return {name:s.ENGINE_MAP.Blink}}},{test:[/(apple)?webkit/i],describe:function(e){var t={name:s.ENGINE_MAP.WebKit},r=i.default.getFirstMatch(/webkit\/(\d+(\.?_?\d+)+)/i,e);return r&&(t.version=r),t}}];t.default=a,e.exports=t.default;}})}));
    });

    var bowser = /*@__PURE__*/getDefaultExportFromCjs(es5);

    /**
     * Default provider to the user agent in browsers. It's a best effort to infer
     * the device information. It uses bowser library to detect the browser and virsion
     */
    var defaultUserAgent = function (_a) {
        var serviceId = _a.serviceId, clientVersion = _a.clientVersion;
        return function () { return __awaiter$9(void 0, void 0, void 0, function () {
            var parsedUA, sections;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator$9(this, function (_h) {
                parsedUA = ((_a = window === null || window === void 0 ? void 0 : window.navigator) === null || _a === void 0 ? void 0 : _a.userAgent) ? bowser.parse(window.navigator.userAgent) : undefined;
                sections = [
                    // sdk-metadata
                    ["aws-sdk-js", clientVersion],
                    // os-metadata
                    ["os/" + (((_b = parsedUA === null || parsedUA === void 0 ? void 0 : parsedUA.os) === null || _b === void 0 ? void 0 : _b.name) || "other"), (_c = parsedUA === null || parsedUA === void 0 ? void 0 : parsedUA.os) === null || _c === void 0 ? void 0 : _c.version],
                    // language-metadata
                    // ECMAScript edition doesn't matter in JS.
                    ["lang/js"],
                    // browser vendor and version.
                    ["md/browser", ((_e = (_d = parsedUA === null || parsedUA === void 0 ? void 0 : parsedUA.browser) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : "unknown") + "_" + ((_g = (_f = parsedUA === null || parsedUA === void 0 ? void 0 : parsedUA.browser) === null || _f === void 0 ? void 0 : _f.version) !== null && _g !== void 0 ? _g : "unknown")],
                ];
                if (serviceId) {
                    // api-metadata
                    // service Id may not appear in non-AWS clients
                    sections.push(["api/" + serviceId, clientVersion]);
                }
                return [2 /*return*/, sections];
            });
        }); };
    };

    // Partition default templates
    var AWS_TEMPLATE = "cognito-identity.{region}.amazonaws.com";
    var AWS_CN_TEMPLATE = "cognito-identity.{region}.amazonaws.com.cn";
    var AWS_ISO_TEMPLATE = "cognito-identity.{region}.c2s.ic.gov";
    var AWS_ISO_B_TEMPLATE = "cognito-identity.{region}.sc2s.sgov.gov";
    var AWS_US_GOV_TEMPLATE = "cognito-identity.{region}.amazonaws.com";
    // Partition regions
    var AWS_REGIONS = new Set([
        "af-south-1",
        "ap-east-1",
        "ap-northeast-1",
        "ap-northeast-2",
        "ap-south-1",
        "ap-southeast-1",
        "ap-southeast-2",
        "ca-central-1",
        "eu-central-1",
        "eu-north-1",
        "eu-south-1",
        "eu-west-1",
        "eu-west-2",
        "eu-west-3",
        "me-south-1",
        "sa-east-1",
        "us-east-1",
        "us-east-2",
        "us-west-1",
        "us-west-2",
    ]);
    var AWS_CN_REGIONS = new Set(["cn-north-1", "cn-northwest-1"]);
    var AWS_ISO_REGIONS = new Set(["us-iso-east-1"]);
    var AWS_ISO_B_REGIONS = new Set(["us-isob-east-1"]);
    var AWS_US_GOV_REGIONS = new Set(["us-gov-east-1", "us-gov-west-1"]);
    var defaultRegionInfoProvider = function (region, options) {
        var regionInfo = undefined;
        switch (region) {
            // First, try to match exact region names.
            case "ap-northeast-1":
                regionInfo = {
                    hostname: "cognito-identity.ap-northeast-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "ap-northeast-2":
                regionInfo = {
                    hostname: "cognito-identity.ap-northeast-2.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "ap-south-1":
                regionInfo = {
                    hostname: "cognito-identity.ap-south-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "ap-southeast-1":
                regionInfo = {
                    hostname: "cognito-identity.ap-southeast-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "ap-southeast-2":
                regionInfo = {
                    hostname: "cognito-identity.ap-southeast-2.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "ca-central-1":
                regionInfo = {
                    hostname: "cognito-identity.ca-central-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "cn-north-1":
                regionInfo = {
                    hostname: "cognito-identity.cn-north-1.amazonaws.com.cn",
                    partition: "aws-cn",
                };
                break;
            case "eu-central-1":
                regionInfo = {
                    hostname: "cognito-identity.eu-central-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "eu-north-1":
                regionInfo = {
                    hostname: "cognito-identity.eu-north-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "eu-west-1":
                regionInfo = {
                    hostname: "cognito-identity.eu-west-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "eu-west-2":
                regionInfo = {
                    hostname: "cognito-identity.eu-west-2.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "eu-west-3":
                regionInfo = {
                    hostname: "cognito-identity.eu-west-3.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "fips-us-east-1":
                regionInfo = {
                    hostname: "cognito-identity-fips.us-east-1.amazonaws.com",
                    partition: "aws",
                    signingRegion: "us-east-1",
                };
                break;
            case "fips-us-east-2":
                regionInfo = {
                    hostname: "cognito-identity-fips.us-east-2.amazonaws.com",
                    partition: "aws",
                    signingRegion: "us-east-2",
                };
                break;
            case "fips-us-gov-west-1":
                regionInfo = {
                    hostname: "cognito-identity-fips.us-gov-west-1.amazonaws.com",
                    partition: "aws-us-gov",
                    signingRegion: "us-gov-west-1",
                };
                break;
            case "fips-us-west-2":
                regionInfo = {
                    hostname: "cognito-identity-fips.us-west-2.amazonaws.com",
                    partition: "aws",
                    signingRegion: "us-west-2",
                };
                break;
            case "sa-east-1":
                regionInfo = {
                    hostname: "cognito-identity.sa-east-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "us-east-1":
                regionInfo = {
                    hostname: "cognito-identity.us-east-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "us-east-2":
                regionInfo = {
                    hostname: "cognito-identity.us-east-2.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "us-gov-west-1":
                regionInfo = {
                    hostname: "cognito-identity.us-gov-west-1.amazonaws.com",
                    partition: "aws-us-gov",
                };
                break;
            case "us-west-1":
                regionInfo = {
                    hostname: "cognito-identity.us-west-1.amazonaws.com",
                    partition: "aws",
                };
                break;
            case "us-west-2":
                regionInfo = {
                    hostname: "cognito-identity.us-west-2.amazonaws.com",
                    partition: "aws",
                };
                break;
            // Next, try to match partition endpoints.
            default:
                if (AWS_REGIONS.has(region)) {
                    regionInfo = {
                        hostname: AWS_TEMPLATE.replace("{region}", region),
                        partition: "aws",
                    };
                }
                if (AWS_CN_REGIONS.has(region)) {
                    regionInfo = {
                        hostname: AWS_CN_TEMPLATE.replace("{region}", region),
                        partition: "aws-cn",
                    };
                }
                if (AWS_ISO_REGIONS.has(region)) {
                    regionInfo = {
                        hostname: AWS_ISO_TEMPLATE.replace("{region}", region),
                        partition: "aws-iso",
                    };
                }
                if (AWS_ISO_B_REGIONS.has(region)) {
                    regionInfo = {
                        hostname: AWS_ISO_B_TEMPLATE.replace("{region}", region),
                        partition: "aws-iso-b",
                    };
                }
                if (AWS_US_GOV_REGIONS.has(region)) {
                    regionInfo = {
                        hostname: AWS_US_GOV_TEMPLATE.replace("{region}", region),
                        partition: "aws-us-gov",
                    };
                }
                // Finally, assume it's an AWS partition endpoint.
                if (regionInfo === undefined) {
                    regionInfo = {
                        hostname: AWS_TEMPLATE.replace("{region}", region),
                        partition: "aws",
                    };
                }
        }
        return Promise.resolve(__assign$d({ signingService: "cognito-identity" }, regionInfo));
    };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __values$2(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read$5(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function parseQueryString(querystring) {
        var e_1, _a;
        var query = {};
        querystring = querystring.replace(/^\?/, "");
        if (querystring) {
            try {
                for (var _b = __values$2(querystring.split("&")), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var pair = _c.value;
                    var _d = __read$5(pair.split("="), 2), key = _d[0], _e = _d[1], value = _e === void 0 ? null : _e;
                    key = decodeURIComponent(key);
                    if (value) {
                        value = decodeURIComponent(value);
                    }
                    if (!(key in query)) {
                        query[key] = value;
                    }
                    else if (Array.isArray(query[key])) {
                        query[key].push(value);
                    }
                    else {
                        query[key] = [query[key], value];
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        return query;
    }

    var parseUrl = function (url) {
        var _a = new URL(url), hostname = _a.hostname, pathname = _a.pathname, port = _a.port, protocol = _a.protocol, search = _a.search;
        var query;
        if (search) {
            query = parseQueryString(search);
        }
        return {
            hostname: hostname,
            port: port ? parseInt(port) : undefined,
            protocol: protocol,
            path: pathname,
            query: query,
        };
    };

    /**
     * @internal
     */
    var ClientSharedValues = {
        apiVersion: "2014-06-30",
        disableHostPrefix: false,
        logger: {},
        regionInfoProvider: defaultRegionInfoProvider,
        serviceId: "Cognito Identity",
        urlParser: parseUrl,
    };

    /**
     * @internal
     */
    var ClientDefaultValues = __assign$d(__assign$d({}, ClientSharedValues), { runtime: "browser", base64Decoder: fromBase64, base64Encoder: toBase64, bodyLengthChecker: calculateBodyLength, credentialDefaultProvider: function (_) { return function () { return Promise.reject(new Error("Credential is missing")); }; }, defaultUserAgentProvider: defaultUserAgent({
            serviceId: ClientSharedValues.serviceId,
            clientVersion: packageInfo.version,
        }), maxAttempts: DEFAULT_MAX_ATTEMPTS, region: invalidProvider("Region is missing"), requestHandler: new FetchHttpHandler(), sha256: build.Sha256, streamCollector: streamCollector, utf8Decoder: fromUtf8, utf8Encoder: toUtf8 });

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$7 = function() {
        __assign$7 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$7.apply(this, arguments);
    };

    function __awaiter$8(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$8(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    var resolveEndpointsConfig = function (input) {
        var _a;
        return (__assign$7(__assign$7({}, input), { tls: (_a = input.tls) !== null && _a !== void 0 ? _a : true, endpoint: input.endpoint ? normalizeEndpoint(input) : function () { return getEndPointFromRegion(input); }, isCustomEndpoint: input.endpoint ? true : false }));
    };
    var normalizeEndpoint = function (input) {
        var endpoint = input.endpoint, urlParser = input.urlParser;
        if (typeof endpoint === "string") {
            var promisified_1 = Promise.resolve(urlParser(endpoint));
            return function () { return promisified_1; };
        }
        else if (typeof endpoint === "object") {
            var promisified_2 = Promise.resolve(endpoint);
            return function () { return promisified_2; };
        }
        return endpoint;
    };
    var getEndPointFromRegion = function (input) { return __awaiter$8(void 0, void 0, void 0, function () {
        var _a, tls, region, dnsHostRegex, hostname;
        var _b;
        return __generator$8(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = input.tls, tls = _a === void 0 ? true : _a;
                    return [4 /*yield*/, input.region()];
                case 1:
                    region = _c.sent();
                    dnsHostRegex = new RegExp(/^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])$/);
                    if (!dnsHostRegex.test(region)) {
                        throw new Error("Invalid region in client config");
                    }
                    return [4 /*yield*/, input.regionInfoProvider(region)];
                case 2:
                    hostname = ((_b = (_c.sent())) !== null && _b !== void 0 ? _b : {}).hostname;
                    if (!hostname) {
                        throw new Error("Cannot resolve hostname from client config");
                    }
                    return [2 /*return*/, input.urlParser((tls ? "https:" : "http:") + "//" + hostname)];
            }
        });
    }); };

    var resolveRegionConfig = function (input) {
        if (!input.region) {
            throw new Error("Region is missing");
        }
        return __assign$7(__assign$7({}, input), { region: normalizeRegion(input.region) });
    };
    var normalizeRegion = function (region) {
        if (typeof region === "string") {
            var promisified_1 = Promise.resolve(region);
            return function () { return promisified_1; };
        }
        return region;
    };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$6 = function() {
        __assign$6 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$6.apply(this, arguments);
    };

    function __awaiter$7(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$7(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    var CONTENT_LENGTH_HEADER = "content-length";
    function contentLengthMiddleware(bodyLengthChecker) {
        var _this = this;
        return function (next) { return function (args) { return __awaiter$7(_this, void 0, void 0, function () {
            var request, body, headers, length;
            var _a;
            return __generator$7(this, function (_b) {
                request = args.request;
                if (HttpRequest.isInstance(request)) {
                    body = request.body, headers = request.headers;
                    if (body &&
                        Object.keys(headers)
                            .map(function (str) { return str.toLowerCase(); })
                            .indexOf(CONTENT_LENGTH_HEADER) === -1) {
                        length = bodyLengthChecker(body);
                        if (length !== undefined) {
                            request.headers = __assign$6(__assign$6({}, request.headers), (_a = {}, _a[CONTENT_LENGTH_HEADER] = String(length), _a));
                        }
                    }
                }
                return [2 /*return*/, next(__assign$6(__assign$6({}, args), { request: request }))];
            });
        }); }; };
    }
    var contentLengthMiddlewareOptions = {
        step: "build",
        tags: ["SET_CONTENT_LENGTH", "CONTENT_LENGTH"],
        name: "contentLengthMiddleware",
        override: true,
    };
    var getContentLengthPlugin = function (options) { return ({
        applyToStack: function (clientStack) {
            clientStack.add(contentLengthMiddleware(options.bodyLengthChecker), contentLengthMiddlewareOptions);
        },
    }); };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter$6(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$6(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function resolveHostHeaderConfig(input) {
        return input;
    }
    var hostHeaderMiddleware = function (options) { return function (next) { return function (args) { return __awaiter$6(void 0, void 0, void 0, function () {
        var request, _a, handlerProtocol;
        return __generator$6(this, function (_b) {
            if (!HttpRequest.isInstance(args.request))
                return [2 /*return*/, next(args)];
            request = args.request;
            _a = (options.requestHandler.metadata || {}).handlerProtocol, handlerProtocol = _a === void 0 ? "" : _a;
            //For H2 request, remove 'host' header and use ':authority' header instead
            //reference: https://nodejs.org/dist/latest-v13.x/docs/api/errors.html#ERR_HTTP2_INVALID_CONNECTION_HEADERS
            if (handlerProtocol.indexOf("h2") >= 0 && !request.headers[":authority"]) {
                delete request.headers["host"];
                request.headers[":authority"] = "";
                //non-H2 request and 'host' header is not set, set the 'host' header to request's hostname.
            }
            else if (!request.headers["host"]) {
                request.headers["host"] = request.hostname;
            }
            return [2 /*return*/, next(args)];
        });
    }); }; }; };
    var hostHeaderMiddlewareOptions = {
        name: "hostHeaderMiddleware",
        step: "build",
        priority: "low",
        tags: ["HOST"],
        override: true,
    };
    var getHostHeaderPlugin = function (options) { return ({
        applyToStack: function (clientStack) {
            clientStack.add(hostHeaderMiddleware(options), hostHeaderMiddlewareOptions);
        },
    }); };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __rest$1(s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }

    function __awaiter$5(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$5(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    var loggerMiddleware = function () { return function (next, context) { return function (args) { return __awaiter$5(void 0, void 0, void 0, function () {
        var clientName, commandName, inputFilterSensitiveLog, logger, outputFilterSensitiveLog, response, _a, $metadata, outputWithoutMetadata;
        return __generator$5(this, function (_b) {
            switch (_b.label) {
                case 0:
                    clientName = context.clientName, commandName = context.commandName, inputFilterSensitiveLog = context.inputFilterSensitiveLog, logger = context.logger, outputFilterSensitiveLog = context.outputFilterSensitiveLog;
                    return [4 /*yield*/, next(args)];
                case 1:
                    response = _b.sent();
                    if (!logger) {
                        return [2 /*return*/, response];
                    }
                    if (typeof logger.info === "function") {
                        _a = response.output, $metadata = _a.$metadata, outputWithoutMetadata = __rest$1(_a, ["$metadata"]);
                        logger.info({
                            clientName: clientName,
                            commandName: commandName,
                            input: inputFilterSensitiveLog(args.input),
                            output: outputFilterSensitiveLog(outputWithoutMetadata),
                            metadata: $metadata,
                        });
                    }
                    return [2 /*return*/, response];
            }
        });
    }); }; }; };
    var loggerMiddlewareOptions = {
        name: "loggerMiddleware",
        tags: ["LOGGER"],
        step: "initialize",
        override: true,
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    var getLoggerPlugin = function (options) { return ({
        applyToStack: function (clientStack) {
            clientStack.add(loggerMiddleware(), loggerMiddlewareOptions);
        },
    }); };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$5 = function() {
        __assign$5 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$5.apply(this, arguments);
    };

    function __awaiter$4(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$4(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __read$4(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$4 = function() {
        __assign$4 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$4.apply(this, arguments);
    };

    function __rest(s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }

    function __awaiter$3(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$3(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __values$1(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read$3(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread$3() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read$3(arguments[i]));
        return ar;
    }

    var ALGORITHM_QUERY_PARAM = "X-Amz-Algorithm";
    var CREDENTIAL_QUERY_PARAM = "X-Amz-Credential";
    var AMZ_DATE_QUERY_PARAM = "X-Amz-Date";
    var SIGNED_HEADERS_QUERY_PARAM = "X-Amz-SignedHeaders";
    var EXPIRES_QUERY_PARAM = "X-Amz-Expires";
    var SIGNATURE_QUERY_PARAM = "X-Amz-Signature";
    var TOKEN_QUERY_PARAM = "X-Amz-Security-Token";
    var AUTH_HEADER = "authorization";
    var AMZ_DATE_HEADER = AMZ_DATE_QUERY_PARAM.toLowerCase();
    var DATE_HEADER = "date";
    var GENERATED_HEADERS = [AUTH_HEADER, AMZ_DATE_HEADER, DATE_HEADER];
    var SIGNATURE_HEADER = SIGNATURE_QUERY_PARAM.toLowerCase();
    var SHA256_HEADER = "x-amz-content-sha256";
    var TOKEN_HEADER = TOKEN_QUERY_PARAM.toLowerCase();
    var ALWAYS_UNSIGNABLE_HEADERS = {
        authorization: true,
        "cache-control": true,
        connection: true,
        expect: true,
        from: true,
        "keep-alive": true,
        "max-forwards": true,
        pragma: true,
        referer: true,
        te: true,
        trailer: true,
        "transfer-encoding": true,
        upgrade: true,
        "user-agent": true,
        "x-amzn-trace-id": true,
    };
    var PROXY_HEADER_PATTERN = /^proxy-/;
    var SEC_HEADER_PATTERN = /^sec-/;
    var ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256";
    var EVENT_ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256-PAYLOAD";
    var UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
    var MAX_CACHE_SIZE = 50;
    var KEY_TYPE_IDENTIFIER = "aws4_request";
    var MAX_PRESIGNED_TTL = 60 * 60 * 24 * 7;

    var signingKeyCache = {};
    var cacheQueue = [];
    /**
     * Create a string describing the scope of credentials used to sign a request.
     *
     * @param shortDate The current calendar date in the form YYYYMMDD.
     * @param region    The AWS region in which the service resides.
     * @param service   The service to which the signed request is being sent.
     */
    function createScope(shortDate, region, service) {
        return shortDate + "/" + region + "/" + service + "/" + KEY_TYPE_IDENTIFIER;
    }
    /**
     * Derive a signing key from its composite parts
     *
     * @param sha256Constructor A constructor function that can instantiate SHA-256
     *                          hash objects.
     * @param credentials       The credentials with which the request will be
     *                          signed.
     * @param shortDate         The current calendar date in the form YYYYMMDD.
     * @param region            The AWS region in which the service resides.
     * @param service           The service to which the signed request is being
     *                          sent.
     */
    var getSigningKey = function (sha256Constructor, credentials, shortDate, region, service) { return __awaiter$3(void 0, void 0, void 0, function () {
        var credsHash, cacheKey, key, _a, _b, signable, e_1_1;
        var e_1, _c;
        return __generator$3(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, hmac(sha256Constructor, credentials.secretAccessKey, credentials.accessKeyId)];
                case 1:
                    credsHash = _d.sent();
                    cacheKey = shortDate + ":" + region + ":" + service + ":" + toHex(credsHash) + ":" + credentials.sessionToken;
                    if (cacheKey in signingKeyCache) {
                        return [2 /*return*/, signingKeyCache[cacheKey]];
                    }
                    cacheQueue.push(cacheKey);
                    while (cacheQueue.length > MAX_CACHE_SIZE) {
                        delete signingKeyCache[cacheQueue.shift()];
                    }
                    key = "AWS4" + credentials.secretAccessKey;
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 7, 8, 9]);
                    _a = __values$1([shortDate, region, service, KEY_TYPE_IDENTIFIER]), _b = _a.next();
                    _d.label = 3;
                case 3:
                    if (!!_b.done) return [3 /*break*/, 6];
                    signable = _b.value;
                    return [4 /*yield*/, hmac(sha256Constructor, key, signable)];
                case 4:
                    key = _d.sent();
                    _d.label = 5;
                case 5:
                    _b = _a.next();
                    return [3 /*break*/, 3];
                case 6: return [3 /*break*/, 9];
                case 7:
                    e_1_1 = _d.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 9];
                case 8:
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/, (signingKeyCache[cacheKey] = key)];
            }
        });
    }); };
    function hmac(ctor, secret, data) {
        var hash = new ctor(secret);
        hash.update(data);
        return hash.digest();
    }

    /**
     * @internal
     */
    function getCanonicalHeaders(_a, unsignableHeaders, signableHeaders) {
        var e_1, _b;
        var headers = _a.headers;
        var canonical = {};
        try {
            for (var _c = __values$1(Object.keys(headers).sort()), _d = _c.next(); !_d.done; _d = _c.next()) {
                var headerName = _d.value;
                var canonicalHeaderName = headerName.toLowerCase();
                if (canonicalHeaderName in ALWAYS_UNSIGNABLE_HEADERS || (unsignableHeaders === null || unsignableHeaders === void 0 ? void 0 : unsignableHeaders.has(canonicalHeaderName)) ||
                    PROXY_HEADER_PATTERN.test(canonicalHeaderName) ||
                    SEC_HEADER_PATTERN.test(canonicalHeaderName)) {
                    if (!signableHeaders || (signableHeaders && !signableHeaders.has(canonicalHeaderName))) {
                        continue;
                    }
                }
                canonical[canonicalHeaderName] = headers[headerName].trim().replace(/\s+/g, " ");
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return canonical;
    }

    /**
     * @internal
     */
    function getCanonicalQuery(_a) {
        var e_1, _b;
        var _c = _a.query, query = _c === void 0 ? {} : _c;
        var keys = [];
        var serialized = {};
        var _loop_1 = function (key) {
            if (key.toLowerCase() === SIGNATURE_HEADER) {
                return "continue";
            }
            keys.push(key);
            var value = query[key];
            if (typeof value === "string") {
                serialized[key] = escapeUri(key) + "=" + escapeUri(value);
            }
            else if (Array.isArray(value)) {
                serialized[key] = value
                    .slice(0)
                    .sort()
                    .reduce(function (encoded, value) { return encoded.concat([escapeUri(key) + "=" + escapeUri(value)]); }, [])
                    .join("&");
            }
        };
        try {
            for (var _d = __values$1(Object.keys(query).sort()), _e = _d.next(); !_e.done; _e = _d.next()) {
                var key = _e.value;
                _loop_1(key);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return keys
            .map(function (key) { return serialized[key]; })
            .filter(function (serialized) { return serialized; }) // omit any falsy values
            .join("&");
    }

    var isArrayBuffer = function (arg) {
        return (typeof ArrayBuffer === "function" && arg instanceof ArrayBuffer) ||
            Object.prototype.toString.call(arg) === "[object ArrayBuffer]";
    };

    /**
     * @internal
     */
    function getPayloadHash(_a, hashConstructor) {
        var headers = _a.headers, body = _a.body;
        return __awaiter$3(this, void 0, void 0, function () {
            var _b, _c, headerName, hashCtor, _d;
            var e_1, _e;
            return __generator$3(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        try {
                            for (_b = __values$1(Object.keys(headers)), _c = _b.next(); !_c.done; _c = _b.next()) {
                                headerName = _c.value;
                                if (headerName.toLowerCase() === SHA256_HEADER) {
                                    return [2 /*return*/, headers[headerName]];
                                }
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (_c && !_c.done && (_e = _b.return)) _e.call(_b);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                        if (!(body == undefined)) return [3 /*break*/, 1];
                        return [2 /*return*/, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"];
                    case 1:
                        if (!(typeof body === "string" || ArrayBuffer.isView(body) || isArrayBuffer(body))) return [3 /*break*/, 3];
                        hashCtor = new hashConstructor();
                        hashCtor.update(body);
                        _d = toHex;
                        return [4 /*yield*/, hashCtor.digest()];
                    case 2: return [2 /*return*/, _d.apply(void 0, [_f.sent()])];
                    case 3: 
                    // As any defined body that is not a string or binary data is a stream, this
                    // body is unsignable. Attempt to send the request with an unsigned payload,
                    // which may or may not be accepted by the service.
                    return [2 /*return*/, UNSIGNED_PAYLOAD];
                }
            });
        });
    }

    function hasHeader(soughtHeader, headers) {
        var e_1, _a;
        soughtHeader = soughtHeader.toLowerCase();
        try {
            for (var _b = __values$1(Object.keys(headers)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var headerName = _c.value;
                if (soughtHeader === headerName.toLowerCase()) {
                    return true;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return false;
    }

    /**
     * @internal
     */
    function cloneRequest(_a) {
        var headers = _a.headers, query = _a.query, rest = __rest(_a, ["headers", "query"]);
        return __assign$4(__assign$4({}, rest), { headers: __assign$4({}, headers), query: query ? cloneQuery(query) : undefined });
    }
    function cloneQuery(query) {
        return Object.keys(query).reduce(function (carry, paramName) {
            var _a;
            var param = query[paramName];
            return __assign$4(__assign$4({}, carry), (_a = {}, _a[paramName] = Array.isArray(param) ? __spread$3(param) : param, _a));
        }, {});
    }

    /**
     * @internal
     */
    function moveHeadersToQuery(request, options) {
        var e_1, _a;
        var _b;
        if (options === void 0) { options = {}; }
        var _c = typeof request.clone === "function" ? request.clone() : cloneRequest(request), headers = _c.headers, _d = _c.query, query = _d === void 0 ? {} : _d;
        try {
            for (var _e = __values$1(Object.keys(headers)), _f = _e.next(); !_f.done; _f = _e.next()) {
                var name = _f.value;
                var lname = name.toLowerCase();
                if (lname.substr(0, 6) === "x-amz-" && !((_b = options.unhoistableHeaders) === null || _b === void 0 ? void 0 : _b.has(lname))) {
                    query[name] = headers[name];
                    delete headers[name];
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return __assign$4(__assign$4({}, request), { headers: headers,
            query: query });
    }

    /**
     * @internal
     */
    function prepareRequest(request) {
        var e_1, _a;
        // Create a clone of the request object that does not clone the body
        request = typeof request.clone === "function" ? request.clone() : cloneRequest(request);
        try {
            for (var _b = __values$1(Object.keys(request.headers)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var headerName = _c.value;
                if (GENERATED_HEADERS.indexOf(headerName.toLowerCase()) > -1) {
                    delete request.headers[headerName];
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return request;
    }

    function iso8601(time) {
        return toDate(time)
            .toISOString()
            .replace(/\.\d{3}Z$/, "Z");
    }
    function toDate(time) {
        if (typeof time === "number") {
            return new Date(time * 1000);
        }
        if (typeof time === "string") {
            if (Number(time)) {
                return new Date(Number(time) * 1000);
            }
            return new Date(time);
        }
        return time;
    }

    var SignatureV4 = /** @class */ (function () {
        function SignatureV4(_a) {
            var applyChecksum = _a.applyChecksum, credentials = _a.credentials, region = _a.region, service = _a.service, sha256 = _a.sha256, _b = _a.uriEscapePath, uriEscapePath = _b === void 0 ? true : _b;
            this.service = service;
            this.sha256 = sha256;
            this.uriEscapePath = uriEscapePath;
            // default to true if applyChecksum isn't set
            this.applyChecksum = typeof applyChecksum === "boolean" ? applyChecksum : true;
            this.regionProvider = normalizeRegionProvider(region);
            this.credentialProvider = normalizeCredentialsProvider(credentials);
        }
        SignatureV4.prototype.presign = function (originalRequest, options) {
            if (options === void 0) { options = {}; }
            return __awaiter$3(this, void 0, void 0, function () {
                var _a, signingDate, _b, expiresIn, unsignableHeaders, unhoistableHeaders, signableHeaders, signingRegion, signingService, credentials, region, _c, _d, longDate, shortDate, scope, request, canonicalHeaders, _e, _f, _g, _h, _j, _k;
                return __generator$3(this, function (_l) {
                    switch (_l.label) {
                        case 0:
                            _a = options.signingDate, signingDate = _a === void 0 ? new Date() : _a, _b = options.expiresIn, expiresIn = _b === void 0 ? 3600 : _b, unsignableHeaders = options.unsignableHeaders, unhoistableHeaders = options.unhoistableHeaders, signableHeaders = options.signableHeaders, signingRegion = options.signingRegion, signingService = options.signingService;
                            return [4 /*yield*/, this.credentialProvider()];
                        case 1:
                            credentials = _l.sent();
                            if (!(signingRegion !== null && signingRegion !== void 0)) return [3 /*break*/, 2];
                            _c = signingRegion;
                            return [3 /*break*/, 4];
                        case 2: return [4 /*yield*/, this.regionProvider()];
                        case 3:
                            _c = (_l.sent());
                            _l.label = 4;
                        case 4:
                            region = _c;
                            _d = formatDate(signingDate), longDate = _d.longDate, shortDate = _d.shortDate;
                            if (expiresIn > MAX_PRESIGNED_TTL) {
                                return [2 /*return*/, Promise.reject("Signature version 4 presigned URLs" + " must have an expiration date less than one week in" + " the future")];
                            }
                            scope = createScope(shortDate, region, signingService !== null && signingService !== void 0 ? signingService : this.service);
                            request = moveHeadersToQuery(prepareRequest(originalRequest), { unhoistableHeaders: unhoistableHeaders });
                            if (credentials.sessionToken) {
                                request.query[TOKEN_QUERY_PARAM] = credentials.sessionToken;
                            }
                            request.query[ALGORITHM_QUERY_PARAM] = ALGORITHM_IDENTIFIER;
                            request.query[CREDENTIAL_QUERY_PARAM] = credentials.accessKeyId + "/" + scope;
                            request.query[AMZ_DATE_QUERY_PARAM] = longDate;
                            request.query[EXPIRES_QUERY_PARAM] = expiresIn.toString(10);
                            canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
                            request.query[SIGNED_HEADERS_QUERY_PARAM] = getCanonicalHeaderList(canonicalHeaders);
                            _e = request.query;
                            _f = SIGNATURE_QUERY_PARAM;
                            _g = this.getSignature;
                            _h = [longDate,
                                scope,
                                this.getSigningKey(credentials, region, shortDate, signingService)];
                            _j = this.createCanonicalRequest;
                            _k = [request, canonicalHeaders];
                            return [4 /*yield*/, getPayloadHash(originalRequest, this.sha256)];
                        case 5: return [4 /*yield*/, _g.apply(this, _h.concat([_j.apply(this, _k.concat([_l.sent()]))]))];
                        case 6:
                            _e[_f] = _l.sent();
                            return [2 /*return*/, request];
                    }
                });
            });
        };
        SignatureV4.prototype.sign = function (toSign, options) {
            return __awaiter$3(this, void 0, void 0, function () {
                return __generator$3(this, function (_a) {
                    if (typeof toSign === "string") {
                        return [2 /*return*/, this.signString(toSign, options)];
                    }
                    else if (toSign.headers && toSign.payload) {
                        return [2 /*return*/, this.signEvent(toSign, options)];
                    }
                    else {
                        return [2 /*return*/, this.signRequest(toSign, options)];
                    }
                });
            });
        };
        SignatureV4.prototype.signEvent = function (_a, _b) {
            var headers = _a.headers, payload = _a.payload;
            var _c = _b.signingDate, signingDate = _c === void 0 ? new Date() : _c, priorSignature = _b.priorSignature, signingRegion = _b.signingRegion, signingService = _b.signingService;
            return __awaiter$3(this, void 0, void 0, function () {
                var region, _d, _e, shortDate, longDate, scope, hashedPayload, hash, hashedHeaders, _f, stringToSign;
                return __generator$3(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            if (!(signingRegion !== null && signingRegion !== void 0)) return [3 /*break*/, 1];
                            _d = signingRegion;
                            return [3 /*break*/, 3];
                        case 1: return [4 /*yield*/, this.regionProvider()];
                        case 2:
                            _d = (_g.sent());
                            _g.label = 3;
                        case 3:
                            region = _d;
                            _e = formatDate(signingDate), shortDate = _e.shortDate, longDate = _e.longDate;
                            scope = createScope(shortDate, region, signingService !== null && signingService !== void 0 ? signingService : this.service);
                            return [4 /*yield*/, getPayloadHash({ headers: {}, body: payload }, this.sha256)];
                        case 4:
                            hashedPayload = _g.sent();
                            hash = new this.sha256();
                            hash.update(headers);
                            _f = toHex;
                            return [4 /*yield*/, hash.digest()];
                        case 5:
                            hashedHeaders = _f.apply(void 0, [_g.sent()]);
                            stringToSign = [
                                EVENT_ALGORITHM_IDENTIFIER,
                                longDate,
                                scope,
                                priorSignature,
                                hashedHeaders,
                                hashedPayload,
                            ].join("\n");
                            return [2 /*return*/, this.signString(stringToSign, { signingDate: signingDate, signingRegion: region, signingService: signingService })];
                    }
                });
            });
        };
        SignatureV4.prototype.signString = function (stringToSign, _a) {
            var _b = _a === void 0 ? {} : _a, _c = _b.signingDate, signingDate = _c === void 0 ? new Date() : _c, signingRegion = _b.signingRegion, signingService = _b.signingService;
            return __awaiter$3(this, void 0, void 0, function () {
                var credentials, region, _d, shortDate, hash, _e, _f, _g;
                return __generator$3(this, function (_h) {
                    switch (_h.label) {
                        case 0: return [4 /*yield*/, this.credentialProvider()];
                        case 1:
                            credentials = _h.sent();
                            if (!(signingRegion !== null && signingRegion !== void 0)) return [3 /*break*/, 2];
                            _d = signingRegion;
                            return [3 /*break*/, 4];
                        case 2: return [4 /*yield*/, this.regionProvider()];
                        case 3:
                            _d = (_h.sent());
                            _h.label = 4;
                        case 4:
                            region = _d;
                            shortDate = formatDate(signingDate).shortDate;
                            _f = (_e = this.sha256).bind;
                            return [4 /*yield*/, this.getSigningKey(credentials, region, shortDate, signingService)];
                        case 5:
                            hash = new (_f.apply(_e, [void 0, _h.sent()]))();
                            hash.update(stringToSign);
                            _g = toHex;
                            return [4 /*yield*/, hash.digest()];
                        case 6: return [2 /*return*/, _g.apply(void 0, [_h.sent()])];
                    }
                });
            });
        };
        SignatureV4.prototype.signRequest = function (requestToSign, _a) {
            var _b = _a === void 0 ? {} : _a, _c = _b.signingDate, signingDate = _c === void 0 ? new Date() : _c, signableHeaders = _b.signableHeaders, unsignableHeaders = _b.unsignableHeaders, signingRegion = _b.signingRegion, signingService = _b.signingService;
            return __awaiter$3(this, void 0, void 0, function () {
                var credentials, region, _d, request, _e, longDate, shortDate, scope, payloadHash, canonicalHeaders, signature;
                return __generator$3(this, function (_f) {
                    switch (_f.label) {
                        case 0: return [4 /*yield*/, this.credentialProvider()];
                        case 1:
                            credentials = _f.sent();
                            if (!(signingRegion !== null && signingRegion !== void 0)) return [3 /*break*/, 2];
                            _d = signingRegion;
                            return [3 /*break*/, 4];
                        case 2: return [4 /*yield*/, this.regionProvider()];
                        case 3:
                            _d = (_f.sent());
                            _f.label = 4;
                        case 4:
                            region = _d;
                            request = prepareRequest(requestToSign);
                            _e = formatDate(signingDate), longDate = _e.longDate, shortDate = _e.shortDate;
                            scope = createScope(shortDate, region, signingService !== null && signingService !== void 0 ? signingService : this.service);
                            request.headers[AMZ_DATE_HEADER] = longDate;
                            if (credentials.sessionToken) {
                                request.headers[TOKEN_HEADER] = credentials.sessionToken;
                            }
                            return [4 /*yield*/, getPayloadHash(request, this.sha256)];
                        case 5:
                            payloadHash = _f.sent();
                            if (!hasHeader(SHA256_HEADER, request.headers) && this.applyChecksum) {
                                request.headers[SHA256_HEADER] = payloadHash;
                            }
                            canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
                            return [4 /*yield*/, this.getSignature(longDate, scope, this.getSigningKey(credentials, region, shortDate, signingService), this.createCanonicalRequest(request, canonicalHeaders, payloadHash))];
                        case 6:
                            signature = _f.sent();
                            request.headers[AUTH_HEADER] =
                                ALGORITHM_IDENTIFIER + " " +
                                    ("Credential=" + credentials.accessKeyId + "/" + scope + ", ") +
                                    ("SignedHeaders=" + getCanonicalHeaderList(canonicalHeaders) + ", ") +
                                    ("Signature=" + signature);
                            return [2 /*return*/, request];
                    }
                });
            });
        };
        SignatureV4.prototype.createCanonicalRequest = function (request, canonicalHeaders, payloadHash) {
            var sortedHeaders = Object.keys(canonicalHeaders).sort();
            return request.method + "\n" + this.getCanonicalPath(request) + "\n" + getCanonicalQuery(request) + "\n" + sortedHeaders.map(function (name) { return name + ":" + canonicalHeaders[name]; }).join("\n") + "\n\n" + sortedHeaders.join(";") + "\n" + payloadHash;
        };
        SignatureV4.prototype.createStringToSign = function (longDate, credentialScope, canonicalRequest) {
            return __awaiter$3(this, void 0, void 0, function () {
                var hash, hashedRequest;
                return __generator$3(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            hash = new this.sha256();
                            hash.update(canonicalRequest);
                            return [4 /*yield*/, hash.digest()];
                        case 1:
                            hashedRequest = _a.sent();
                            return [2 /*return*/, ALGORITHM_IDENTIFIER + "\n" + longDate + "\n" + credentialScope + "\n" + toHex(hashedRequest)];
                    }
                });
            });
        };
        SignatureV4.prototype.getCanonicalPath = function (_a) {
            var path = _a.path;
            if (this.uriEscapePath) {
                var doubleEncoded = encodeURIComponent(path.replace(/^\//, ""));
                return "/" + doubleEncoded.replace(/%2F/g, "/");
            }
            return path;
        };
        SignatureV4.prototype.getSignature = function (longDate, credentialScope, keyPromise, canonicalRequest) {
            return __awaiter$3(this, void 0, void 0, function () {
                var stringToSign, hash, _a, _b, _c;
                return __generator$3(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, this.createStringToSign(longDate, credentialScope, canonicalRequest)];
                        case 1:
                            stringToSign = _d.sent();
                            _b = (_a = this.sha256).bind;
                            return [4 /*yield*/, keyPromise];
                        case 2:
                            hash = new (_b.apply(_a, [void 0, _d.sent()]))();
                            hash.update(stringToSign);
                            _c = toHex;
                            return [4 /*yield*/, hash.digest()];
                        case 3: return [2 /*return*/, _c.apply(void 0, [_d.sent()])];
                    }
                });
            });
        };
        SignatureV4.prototype.getSigningKey = function (credentials, region, shortDate, service) {
            return getSigningKey(this.sha256, credentials, shortDate, region, service || this.service);
        };
        return SignatureV4;
    }());
    var formatDate = function (now) {
        var longDate = iso8601(now).replace(/[\-:]/g, "");
        return {
            longDate: longDate,
            shortDate: longDate.substr(0, 8),
        };
    };
    var getCanonicalHeaderList = function (headers) { return Object.keys(headers).sort().join(";"); };
    var normalizeRegionProvider = function (region) {
        if (typeof region === "string") {
            var promisified_1 = Promise.resolve(region);
            return function () { return promisified_1; };
        }
        else {
            return region;
        }
    };
    var normalizeCredentialsProvider = function (credentials) {
        if (typeof credentials === "object") {
            var promisified_2 = Promise.resolve(credentials);
            return function () { return promisified_2; };
        }
        else {
            return credentials;
        }
    };

    function resolveAwsAuthConfig(input) {
        var _this = this;
        var credentials = input.credentials || input.credentialDefaultProvider(input);
        var normalizedCreds = normalizeProvider(credentials);
        var _a = input.signingEscapePath, signingEscapePath = _a === void 0 ? true : _a, _b = input.systemClockOffset, systemClockOffset = _b === void 0 ? input.systemClockOffset || 0 : _b, sha256 = input.sha256;
        var signer;
        if (input.signer) {
            //if signer is supplied by user, normalize it to a function returning a promise for signer.
            signer = normalizeProvider(input.signer);
        }
        else {
            //construct a provider inferring signing from region.
            signer = function () {
                return normalizeProvider(input.region)()
                    .then(function (region) { return __awaiter$4(_this, void 0, void 0, function () { return __generator$4(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, input.regionInfoProvider(region)];
                        case 1: return [2 /*return*/, [(_a.sent()) || {}, region]];
                    }
                }); }); })
                    .then(function (_a) {
                    var _b = __read$4(_a, 2), regionInfo = _b[0], region = _b[1];
                    var signingRegion = regionInfo.signingRegion, signingService = regionInfo.signingService;
                    //update client's singing region and signing service config if they are resolved.
                    //signing region resolving order: user supplied signingRegion -> endpoints.json inferred region -> client region
                    input.signingRegion = input.signingRegion || signingRegion || region;
                    //signing name resolving order:
                    //user supplied signingName -> endpoints.json inferred (credential scope -> model arnNamespace) -> model service id
                    input.signingName = input.signingName || signingService || input.serviceId;
                    return new SignatureV4({
                        credentials: normalizedCreds,
                        region: input.signingRegion,
                        service: input.signingName,
                        sha256: sha256,
                        uriEscapePath: signingEscapePath,
                    });
                });
            };
        }
        return __assign$5(__assign$5({}, input), { systemClockOffset: systemClockOffset,
            signingEscapePath: signingEscapePath, credentials: normalizedCreds, signer: signer });
    }
    function normalizeProvider(input) {
        if (typeof input === "object") {
            var promisified_1 = Promise.resolve(input);
            return function () { return promisified_1; };
        }
        return input;
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$3 = function() {
        __assign$3 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$3.apply(this, arguments);
    };

    function __awaiter$2(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$2(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __read$2(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread$2() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read$2(arguments[i]));
        return ar;
    }

    function resolveUserAgentConfig(input) {
        return __assign$3(__assign$3({}, input), { customUserAgent: typeof input.customUserAgent === "string" ? [[input.customUserAgent]] : input.customUserAgent });
    }

    var USER_AGENT = "user-agent";
    var X_AMZ_USER_AGENT = "x-amz-user-agent";
    var SPACE = " ";
    var UA_ESCAPE_REGEX = /[^\!\#\$\%\&\'\*\+\-\.\^\_\`\|\~\d\w]/g;

    /**
     * Build user agent header sections from:
     * 1. runtime-specific default user agent provider;
     * 2. custom user agent from `customUserAgent` client config;
     * 3. handler execution context set by internal SDK components;
     * The built user agent will be set to `x-amz-user-agent` header for ALL the
     * runtimes.
     * Please note that any override to the `user-agent` or `x-amz-user-agent` header
     * in the HTTP request is discouraged. Please use `customUserAgent` client
     * config or middleware setting the `userAgent` context to generate desired user
     * agent.
     */
    var userAgentMiddleware = function (options) { return function (next, context) { return function (args) { return __awaiter$2(void 0, void 0, void 0, function () {
        var request, headers, userAgent, defaultUserAgent, customUserAgent, normalUAValue;
        var _a, _b;
        return __generator$2(this, function (_c) {
            switch (_c.label) {
                case 0:
                    request = args.request;
                    if (!HttpRequest.isInstance(request))
                        return [2 /*return*/, next(args)];
                    headers = request.headers;
                    userAgent = ((_a = context === null || context === void 0 ? void 0 : context.userAgent) === null || _a === void 0 ? void 0 : _a.map(escapeUserAgent)) || [];
                    return [4 /*yield*/, options.defaultUserAgentProvider()];
                case 1:
                    defaultUserAgent = (_c.sent()).map(escapeUserAgent);
                    customUserAgent = ((_b = options === null || options === void 0 ? void 0 : options.customUserAgent) === null || _b === void 0 ? void 0 : _b.map(escapeUserAgent)) || [];
                    // Set value to AWS-specific user agent header
                    headers[X_AMZ_USER_AGENT] = __spread$2(defaultUserAgent, userAgent, customUserAgent).join(SPACE);
                    normalUAValue = __spread$2(defaultUserAgent.filter(function (section) { return section.startsWith("aws-sdk-"); }), customUserAgent).join(SPACE);
                    if (options.runtime !== "browser" && normalUAValue) {
                        headers[USER_AGENT] = headers[USER_AGENT] ? headers[USER_AGENT] + " " + normalUAValue : normalUAValue;
                    }
                    return [2 /*return*/, next(__assign$3(__assign$3({}, args), { request: request }))];
            }
        });
    }); }; }; };
    /**
     * Escape the each pair according to https://tools.ietf.org/html/rfc5234 and join the pair with pattern `name/version`.
     * User agent name may include prefix like `md/`, `api/`, `os/` etc., we should not escape the `/` after the prefix.
     * @private
     */
    var escapeUserAgent = function (_a) {
        var _b = __read$2(_a, 2), name = _b[0], version = _b[1];
        var prefixSeparatorIndex = name.indexOf("/");
        var prefix = name.substring(0, prefixSeparatorIndex); // If no prefix, prefix is just ""
        var uaName = name.substring(prefixSeparatorIndex + 1);
        if (prefix === "api") {
            uaName = uaName.toLowerCase();
        }
        return [prefix, uaName, version]
            .filter(function (item) { return item && item.length > 0; })
            .map(function (item) { return item === null || item === void 0 ? void 0 : item.replace(UA_ESCAPE_REGEX, "_"); })
            .join("/");
    };
    var getUserAgentMiddlewareOptions = {
        name: "getUserAgentMiddleware",
        step: "build",
        priority: "low",
        tags: ["SET_USER_AGENT", "USER_AGENT"],
        override: true,
    };
    var getUserAgentPlugin = function (config) { return ({
        applyToStack: function (clientStack) {
            clientStack.add(userAgentMiddleware(config), getUserAgentMiddlewareOptions);
        },
    }); };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$2 = function() {
        __assign$2 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$2.apply(this, arguments);
    };

    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read$1(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread$1() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read$1(arguments[i]));
        return ar;
    }

    var constructStack = function () {
        var absoluteEntries = [];
        var relativeEntries = [];
        var entriesNameSet = new Set();
        var sort = function (entries) {
            return entries.sort(function (a, b) {
                return stepWeights[b.step] - stepWeights[a.step] ||
                    priorityWeights[b.priority || "normal"] - priorityWeights[a.priority || "normal"];
            });
        };
        var removeByName = function (toRemove) {
            var isRemoved = false;
            var filterCb = function (entry) {
                if (entry.name && entry.name === toRemove) {
                    isRemoved = true;
                    entriesNameSet.delete(toRemove);
                    return false;
                }
                return true;
            };
            absoluteEntries = absoluteEntries.filter(filterCb);
            relativeEntries = relativeEntries.filter(filterCb);
            return isRemoved;
        };
        var removeByReference = function (toRemove) {
            var isRemoved = false;
            var filterCb = function (entry) {
                if (entry.middleware === toRemove) {
                    isRemoved = true;
                    if (entry.name)
                        entriesNameSet.delete(entry.name);
                    return false;
                }
                return true;
            };
            absoluteEntries = absoluteEntries.filter(filterCb);
            relativeEntries = relativeEntries.filter(filterCb);
            return isRemoved;
        };
        var cloneTo = function (toStack) {
            absoluteEntries.forEach(function (entry) {
                //@ts-ignore
                toStack.add(entry.middleware, __assign$2({}, entry));
            });
            relativeEntries.forEach(function (entry) {
                //@ts-ignore
                toStack.addRelativeTo(entry.middleware, __assign$2({}, entry));
            });
            return toStack;
        };
        var expandRelativeMiddlewareList = function (from) {
            var expandedMiddlewareList = [];
            from.before.forEach(function (entry) {
                if (entry.before.length === 0 && entry.after.length === 0) {
                    expandedMiddlewareList.push(entry);
                }
                else {
                    expandedMiddlewareList.push.apply(expandedMiddlewareList, __spread$1(expandRelativeMiddlewareList(entry)));
                }
            });
            expandedMiddlewareList.push(from);
            from.after.reverse().forEach(function (entry) {
                if (entry.before.length === 0 && entry.after.length === 0) {
                    expandedMiddlewareList.push(entry);
                }
                else {
                    expandedMiddlewareList.push.apply(expandedMiddlewareList, __spread$1(expandRelativeMiddlewareList(entry)));
                }
            });
            return expandedMiddlewareList;
        };
        /**
         * Get a final list of middleware in the order of being executed in the resolved handler.
         */
        var getMiddlewareList = function () {
            var normalizedAbsoluteEntries = [];
            var normalizedRelativeEntries = [];
            var normalizedEntriesNameMap = {};
            absoluteEntries.forEach(function (entry) {
                var normalizedEntry = __assign$2(__assign$2({}, entry), { before: [], after: [] });
                if (normalizedEntry.name)
                    normalizedEntriesNameMap[normalizedEntry.name] = normalizedEntry;
                normalizedAbsoluteEntries.push(normalizedEntry);
            });
            relativeEntries.forEach(function (entry) {
                var normalizedEntry = __assign$2(__assign$2({}, entry), { before: [], after: [] });
                if (normalizedEntry.name)
                    normalizedEntriesNameMap[normalizedEntry.name] = normalizedEntry;
                normalizedRelativeEntries.push(normalizedEntry);
            });
            normalizedRelativeEntries.forEach(function (entry) {
                if (entry.toMiddleware) {
                    var toMiddleware = normalizedEntriesNameMap[entry.toMiddleware];
                    if (toMiddleware === undefined) {
                        throw new Error(entry.toMiddleware + " is not found when adding " + (entry.name || "anonymous") + " middleware " + entry.relation + " " + entry.toMiddleware);
                    }
                    if (entry.relation === "after") {
                        toMiddleware.after.push(entry);
                    }
                    if (entry.relation === "before") {
                        toMiddleware.before.push(entry);
                    }
                }
            });
            var mainChain = sort(normalizedAbsoluteEntries)
                .map(expandRelativeMiddlewareList)
                .reduce(function (wholeList, expendedMiddlewareList) {
                // TODO: Replace it with Array.flat();
                wholeList.push.apply(wholeList, __spread$1(expendedMiddlewareList));
                return wholeList;
            }, []);
            return mainChain.map(function (entry) { return entry.middleware; });
        };
        var stack = {
            add: function (middleware, options) {
                if (options === void 0) { options = {}; }
                var name = options.name, override = options.override;
                var entry = __assign$2({ step: "initialize", priority: "normal", middleware: middleware }, options);
                if (name) {
                    if (entriesNameSet.has(name)) {
                        if (!override)
                            throw new Error("Duplicate middleware name '" + name + "'");
                        var toOverrideIndex = absoluteEntries.findIndex(function (entry) { return entry.name === name; });
                        var toOverride = absoluteEntries[toOverrideIndex];
                        if (toOverride.step !== entry.step || toOverride.priority !== entry.priority) {
                            throw new Error("\"" + name + "\" middleware with " + toOverride.priority + " priority in " + toOverride.step + " step cannot be " +
                                ("overridden by same-name middleware with " + entry.priority + " priority in " + entry.step + " step."));
                        }
                        absoluteEntries.splice(toOverrideIndex, 1);
                    }
                    entriesNameSet.add(name);
                }
                absoluteEntries.push(entry);
            },
            addRelativeTo: function (middleware, options) {
                var name = options.name, override = options.override;
                var entry = __assign$2({ middleware: middleware }, options);
                if (name) {
                    if (entriesNameSet.has(name)) {
                        if (!override)
                            throw new Error("Duplicate middleware name '" + name + "'");
                        var toOverrideIndex = relativeEntries.findIndex(function (entry) { return entry.name === name; });
                        var toOverride = relativeEntries[toOverrideIndex];
                        if (toOverride.toMiddleware !== entry.toMiddleware || toOverride.relation !== entry.relation) {
                            throw new Error("\"" + name + "\" middleware " + toOverride.relation + " \"" + toOverride.toMiddleware + "\" middleware cannot be overridden " +
                                ("by same-name middleware " + entry.relation + " \"" + entry.toMiddleware + "\" middleware."));
                        }
                        relativeEntries.splice(toOverrideIndex, 1);
                    }
                    entriesNameSet.add(name);
                }
                relativeEntries.push(entry);
            },
            clone: function () { return cloneTo(constructStack()); },
            use: function (plugin) {
                plugin.applyToStack(stack);
            },
            remove: function (toRemove) {
                if (typeof toRemove === "string")
                    return removeByName(toRemove);
                else
                    return removeByReference(toRemove);
            },
            removeByTag: function (toRemove) {
                var isRemoved = false;
                var filterCb = function (entry) {
                    var tags = entry.tags, name = entry.name;
                    if (tags && tags.includes(toRemove)) {
                        if (name)
                            entriesNameSet.delete(name);
                        isRemoved = true;
                        return false;
                    }
                    return true;
                };
                absoluteEntries = absoluteEntries.filter(filterCb);
                relativeEntries = relativeEntries.filter(filterCb);
                return isRemoved;
            },
            concat: function (from) {
                var cloned = cloneTo(constructStack());
                cloned.use(from);
                return cloned;
            },
            applyToStack: cloneTo,
            resolve: function (handler, context) {
                var e_1, _a;
                try {
                    for (var _b = __values(getMiddlewareList().reverse()), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var middleware = _c.value;
                        handler = middleware(handler, context);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                return handler;
            },
        };
        return stack;
    };
    var stepWeights = {
        initialize: 5,
        serialize: 4,
        build: 3,
        finalizeRequest: 2,
        deserialize: 1,
    };
    var priorityWeights = {
        high: 3,
        normal: 2,
        low: 1,
    };

    var Client = /** @class */ (function () {
        function Client(config) {
            this.middlewareStack = constructStack();
            this.config = config;
        }
        Client.prototype.send = function (command, optionsOrCb, cb) {
            var options = typeof optionsOrCb !== "function" ? optionsOrCb : undefined;
            var callback = typeof optionsOrCb === "function" ? optionsOrCb : cb;
            var handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
            if (callback) {
                handler(command)
                    .then(function (result) { return callback(null, result.output); }, function (err) { return callback(err); })
                    .catch(
                // prevent any errors thrown in the callback from triggering an
                // unhandled promise rejection
                function () { });
            }
            else {
                return handler(command).then(function (result) { return result.output; });
            }
        };
        Client.prototype.destroy = function () {
            if (this.config.requestHandler.destroy)
                this.config.requestHandler.destroy();
        };
        return Client;
    }());

    var Command = /** @class */ (function () {
        function Command() {
            this.middlewareStack = constructStack();
        }
        return Command;
    }());

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics$1 = function(d, b) {
        extendStatics$1 = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics$1(d, b);
    };

    function __extends$1(d, b) {
        extendStatics$1(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spread() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    }

    /**
     * Lazy String holder for JSON typed contents.
     */
    /**
     * Because of https://github.com/microsoft/tslib/issues/95,
     * TS 'extends' shim doesn't support extending native types like String.
     * So here we create StringWrapper that duplicate everything from String
     * class including its prototype chain. So we can extend from here.
     */
    // @ts-ignore StringWrapper implementation is not a simple constructor
    var StringWrapper = function () {
        //@ts-ignore 'this' cannot be assigned to any, but Object.getPrototypeOf accepts any
        var Class = Object.getPrototypeOf(this).constructor;
        var Constructor = Function.bind.apply(String, __spread([null], arguments));
        //@ts-ignore Call wrapped String constructor directly, don't bother typing it.
        var instance = new Constructor();
        Object.setPrototypeOf(instance, Class.prototype);
        return instance;
    };
    StringWrapper.prototype = Object.create(String.prototype, {
        constructor: {
            value: StringWrapper,
            enumerable: false,
            writable: true,
            configurable: true,
        },
    });
    Object.setPrototypeOf(StringWrapper, String);
    /** @class */ ((function (_super) {
        __extends$1(LazyJsonString, _super);
        function LazyJsonString() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        LazyJsonString.prototype.deserializeJSON = function () {
            return JSON.parse(_super.prototype.toString.call(this));
        };
        LazyJsonString.prototype.toJSON = function () {
            return _super.prototype.toString.call(this);
        };
        LazyJsonString.fromObject = function (object) {
            if (object instanceof LazyJsonString) {
                return object;
            }
            else if (object instanceof String || typeof object === "string") {
                return new LazyJsonString(object);
            }
            return new LazyJsonString(JSON.stringify(object));
        };
        return LazyJsonString;
    })(StringWrapper));

    /**
     * <fullname>Amazon Cognito Federated Identities</fullname>
     *          <p>Amazon Cognito Federated Identities is a web service that delivers scoped temporary
     *          credentials to mobile devices and other untrusted environments. It uniquely identifies a
     *          device and supplies the user with a consistent identity over the lifetime of an
     *          application.</p>
     *          <p>Using Amazon Cognito Federated Identities, you can enable authentication with one or
     *          more third-party identity providers (Facebook, Google, or Login with Amazon) or an Amazon
     *          Cognito user pool, and you can also choose to support unauthenticated access from your app.
     *          Cognito delivers a unique identifier for each user and acts as an OpenID token provider
     *          trusted by AWS Security Token Service (STS) to access temporary, limited-privilege AWS
     *          credentials.</p>
     *          <p>For a description of the authentication flow from the Amazon Cognito Developer Guide
     *          see <a href="https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flow.html">Authentication Flow</a>.</p>
     *          <p>For more information see <a href="https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-identity.html">Amazon Cognito Federated Identities</a>.</p>
     */
    var CognitoIdentityClient = /** @class */ (function (_super) {
        __extends$5(CognitoIdentityClient, _super);
        function CognitoIdentityClient(configuration) {
            var _this = this;
            var _config_0 = __assign$d(__assign$d({}, ClientDefaultValues), configuration);
            var _config_1 = resolveRegionConfig(_config_0);
            var _config_2 = resolveEndpointsConfig(_config_1);
            var _config_3 = resolveAwsAuthConfig(_config_2);
            var _config_4 = resolveRetryConfig(_config_3);
            var _config_5 = resolveHostHeaderConfig(_config_4);
            var _config_6 = resolveUserAgentConfig(_config_5);
            _this = _super.call(this, _config_6) || this;
            _this.config = _config_6;
            _this.middlewareStack.use(getRetryPlugin(_this.config));
            _this.middlewareStack.use(getContentLengthPlugin(_this.config));
            _this.middlewareStack.use(getHostHeaderPlugin(_this.config));
            _this.middlewareStack.use(getLoggerPlugin(_this.config));
            _this.middlewareStack.use(getUserAgentPlugin(_this.config));
            return _this;
        }
        CognitoIdentityClient.prototype.destroy = function () {
            _super.prototype.destroy.call(this);
        };
        return CognitoIdentityClient;
    }(Client));

    var AmbiguousRoleResolutionType;
    (function (AmbiguousRoleResolutionType) {
        AmbiguousRoleResolutionType["AUTHENTICATED_ROLE"] = "AuthenticatedRole";
        AmbiguousRoleResolutionType["DENY"] = "Deny";
    })(AmbiguousRoleResolutionType || (AmbiguousRoleResolutionType = {}));
    var CognitoIdentityProvider;
    (function (CognitoIdentityProvider) {
        CognitoIdentityProvider.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(CognitoIdentityProvider || (CognitoIdentityProvider = {}));
    var CreateIdentityPoolInput;
    (function (CreateIdentityPoolInput) {
        CreateIdentityPoolInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(CreateIdentityPoolInput || (CreateIdentityPoolInput = {}));
    var IdentityPool;
    (function (IdentityPool) {
        IdentityPool.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(IdentityPool || (IdentityPool = {}));
    var InternalErrorException;
    (function (InternalErrorException) {
        InternalErrorException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(InternalErrorException || (InternalErrorException = {}));
    var InvalidParameterException;
    (function (InvalidParameterException) {
        InvalidParameterException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(InvalidParameterException || (InvalidParameterException = {}));
    var LimitExceededException;
    (function (LimitExceededException) {
        LimitExceededException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(LimitExceededException || (LimitExceededException = {}));
    var NotAuthorizedException;
    (function (NotAuthorizedException) {
        NotAuthorizedException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(NotAuthorizedException || (NotAuthorizedException = {}));
    var ResourceConflictException;
    (function (ResourceConflictException) {
        ResourceConflictException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ResourceConflictException || (ResourceConflictException = {}));
    var TooManyRequestsException;
    (function (TooManyRequestsException) {
        TooManyRequestsException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(TooManyRequestsException || (TooManyRequestsException = {}));
    var DeleteIdentitiesInput;
    (function (DeleteIdentitiesInput) {
        DeleteIdentitiesInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(DeleteIdentitiesInput || (DeleteIdentitiesInput = {}));
    var ErrorCode;
    (function (ErrorCode) {
        ErrorCode["ACCESS_DENIED"] = "AccessDenied";
        ErrorCode["INTERNAL_SERVER_ERROR"] = "InternalServerError";
    })(ErrorCode || (ErrorCode = {}));
    var UnprocessedIdentityId;
    (function (UnprocessedIdentityId) {
        UnprocessedIdentityId.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(UnprocessedIdentityId || (UnprocessedIdentityId = {}));
    var DeleteIdentitiesResponse;
    (function (DeleteIdentitiesResponse) {
        DeleteIdentitiesResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(DeleteIdentitiesResponse || (DeleteIdentitiesResponse = {}));
    var DeleteIdentityPoolInput;
    (function (DeleteIdentityPoolInput) {
        DeleteIdentityPoolInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(DeleteIdentityPoolInput || (DeleteIdentityPoolInput = {}));
    var ResourceNotFoundException;
    (function (ResourceNotFoundException) {
        ResourceNotFoundException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ResourceNotFoundException || (ResourceNotFoundException = {}));
    var DescribeIdentityInput;
    (function (DescribeIdentityInput) {
        DescribeIdentityInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(DescribeIdentityInput || (DescribeIdentityInput = {}));
    var IdentityDescription;
    (function (IdentityDescription) {
        IdentityDescription.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(IdentityDescription || (IdentityDescription = {}));
    var DescribeIdentityPoolInput;
    (function (DescribeIdentityPoolInput) {
        DescribeIdentityPoolInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(DescribeIdentityPoolInput || (DescribeIdentityPoolInput = {}));
    var ExternalServiceException;
    (function (ExternalServiceException) {
        ExternalServiceException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ExternalServiceException || (ExternalServiceException = {}));
    var GetCredentialsForIdentityInput;
    (function (GetCredentialsForIdentityInput) {
        GetCredentialsForIdentityInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetCredentialsForIdentityInput || (GetCredentialsForIdentityInput = {}));
    var Credentials$1;
    (function (Credentials) {
        Credentials.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(Credentials$1 || (Credentials$1 = {}));
    var GetCredentialsForIdentityResponse;
    (function (GetCredentialsForIdentityResponse) {
        GetCredentialsForIdentityResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetCredentialsForIdentityResponse || (GetCredentialsForIdentityResponse = {}));
    var InvalidIdentityPoolConfigurationException;
    (function (InvalidIdentityPoolConfigurationException) {
        InvalidIdentityPoolConfigurationException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(InvalidIdentityPoolConfigurationException || (InvalidIdentityPoolConfigurationException = {}));
    var GetIdInput;
    (function (GetIdInput) {
        GetIdInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetIdInput || (GetIdInput = {}));
    var GetIdResponse;
    (function (GetIdResponse) {
        GetIdResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetIdResponse || (GetIdResponse = {}));
    var GetIdentityPoolRolesInput;
    (function (GetIdentityPoolRolesInput) {
        GetIdentityPoolRolesInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetIdentityPoolRolesInput || (GetIdentityPoolRolesInput = {}));
    var MappingRuleMatchType;
    (function (MappingRuleMatchType) {
        MappingRuleMatchType["CONTAINS"] = "Contains";
        MappingRuleMatchType["EQUALS"] = "Equals";
        MappingRuleMatchType["NOT_EQUAL"] = "NotEqual";
        MappingRuleMatchType["STARTS_WITH"] = "StartsWith";
    })(MappingRuleMatchType || (MappingRuleMatchType = {}));
    var MappingRule;
    (function (MappingRule) {
        MappingRule.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(MappingRule || (MappingRule = {}));
    var RulesConfigurationType;
    (function (RulesConfigurationType) {
        RulesConfigurationType.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(RulesConfigurationType || (RulesConfigurationType = {}));
    var RoleMappingType;
    (function (RoleMappingType) {
        RoleMappingType["RULES"] = "Rules";
        RoleMappingType["TOKEN"] = "Token";
    })(RoleMappingType || (RoleMappingType = {}));
    var RoleMapping;
    (function (RoleMapping) {
        RoleMapping.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(RoleMapping || (RoleMapping = {}));
    var GetIdentityPoolRolesResponse;
    (function (GetIdentityPoolRolesResponse) {
        GetIdentityPoolRolesResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetIdentityPoolRolesResponse || (GetIdentityPoolRolesResponse = {}));
    var GetOpenIdTokenInput;
    (function (GetOpenIdTokenInput) {
        GetOpenIdTokenInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetOpenIdTokenInput || (GetOpenIdTokenInput = {}));
    var GetOpenIdTokenResponse;
    (function (GetOpenIdTokenResponse) {
        GetOpenIdTokenResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetOpenIdTokenResponse || (GetOpenIdTokenResponse = {}));
    var DeveloperUserAlreadyRegisteredException;
    (function (DeveloperUserAlreadyRegisteredException) {
        DeveloperUserAlreadyRegisteredException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(DeveloperUserAlreadyRegisteredException || (DeveloperUserAlreadyRegisteredException = {}));
    var GetOpenIdTokenForDeveloperIdentityInput;
    (function (GetOpenIdTokenForDeveloperIdentityInput) {
        GetOpenIdTokenForDeveloperIdentityInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetOpenIdTokenForDeveloperIdentityInput || (GetOpenIdTokenForDeveloperIdentityInput = {}));
    var GetOpenIdTokenForDeveloperIdentityResponse;
    (function (GetOpenIdTokenForDeveloperIdentityResponse) {
        GetOpenIdTokenForDeveloperIdentityResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(GetOpenIdTokenForDeveloperIdentityResponse || (GetOpenIdTokenForDeveloperIdentityResponse = {}));
    var ListIdentitiesInput;
    (function (ListIdentitiesInput) {
        ListIdentitiesInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ListIdentitiesInput || (ListIdentitiesInput = {}));
    var ListIdentitiesResponse;
    (function (ListIdentitiesResponse) {
        ListIdentitiesResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ListIdentitiesResponse || (ListIdentitiesResponse = {}));
    var ListIdentityPoolsInput;
    (function (ListIdentityPoolsInput) {
        ListIdentityPoolsInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ListIdentityPoolsInput || (ListIdentityPoolsInput = {}));
    var IdentityPoolShortDescription;
    (function (IdentityPoolShortDescription) {
        IdentityPoolShortDescription.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(IdentityPoolShortDescription || (IdentityPoolShortDescription = {}));
    var ListIdentityPoolsResponse;
    (function (ListIdentityPoolsResponse) {
        ListIdentityPoolsResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ListIdentityPoolsResponse || (ListIdentityPoolsResponse = {}));
    var ListTagsForResourceInput;
    (function (ListTagsForResourceInput) {
        ListTagsForResourceInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ListTagsForResourceInput || (ListTagsForResourceInput = {}));
    var ListTagsForResourceResponse;
    (function (ListTagsForResourceResponse) {
        ListTagsForResourceResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ListTagsForResourceResponse || (ListTagsForResourceResponse = {}));
    var LookupDeveloperIdentityInput;
    (function (LookupDeveloperIdentityInput) {
        LookupDeveloperIdentityInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(LookupDeveloperIdentityInput || (LookupDeveloperIdentityInput = {}));
    var LookupDeveloperIdentityResponse;
    (function (LookupDeveloperIdentityResponse) {
        LookupDeveloperIdentityResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(LookupDeveloperIdentityResponse || (LookupDeveloperIdentityResponse = {}));
    var MergeDeveloperIdentitiesInput;
    (function (MergeDeveloperIdentitiesInput) {
        MergeDeveloperIdentitiesInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(MergeDeveloperIdentitiesInput || (MergeDeveloperIdentitiesInput = {}));
    var MergeDeveloperIdentitiesResponse;
    (function (MergeDeveloperIdentitiesResponse) {
        MergeDeveloperIdentitiesResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(MergeDeveloperIdentitiesResponse || (MergeDeveloperIdentitiesResponse = {}));
    var ConcurrentModificationException;
    (function (ConcurrentModificationException) {
        ConcurrentModificationException.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(ConcurrentModificationException || (ConcurrentModificationException = {}));
    var SetIdentityPoolRolesInput;
    (function (SetIdentityPoolRolesInput) {
        SetIdentityPoolRolesInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(SetIdentityPoolRolesInput || (SetIdentityPoolRolesInput = {}));
    var TagResourceInput;
    (function (TagResourceInput) {
        TagResourceInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(TagResourceInput || (TagResourceInput = {}));
    var TagResourceResponse;
    (function (TagResourceResponse) {
        TagResourceResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(TagResourceResponse || (TagResourceResponse = {}));
    var UnlinkDeveloperIdentityInput;
    (function (UnlinkDeveloperIdentityInput) {
        UnlinkDeveloperIdentityInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(UnlinkDeveloperIdentityInput || (UnlinkDeveloperIdentityInput = {}));
    var UnlinkIdentityInput;
    (function (UnlinkIdentityInput) {
        UnlinkIdentityInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(UnlinkIdentityInput || (UnlinkIdentityInput = {}));
    var UntagResourceInput;
    (function (UntagResourceInput) {
        UntagResourceInput.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(UntagResourceInput || (UntagResourceInput = {}));
    var UntagResourceResponse;
    (function (UntagResourceResponse) {
        UntagResourceResponse.filterSensitiveLog = function (obj) { return (__assign$d({}, obj)); };
    })(UntagResourceResponse || (UntagResourceResponse = {}));

    var serializeAws_json1_1GetCredentialsForIdentityCommand = function (input, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var headers, body;
        return __generator$f(this, function (_a) {
            headers = {
                "content-type": "application/x-amz-json-1.1",
                "x-amz-target": "AWSCognitoIdentityService.GetCredentialsForIdentity",
            };
            body = JSON.stringify(serializeAws_json1_1GetCredentialsForIdentityInput(input));
            return [2 /*return*/, buildHttpRpcRequest(context, headers, "/", undefined, body)];
        });
    }); };
    var serializeAws_json1_1GetIdCommand = function (input, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var headers, body;
        return __generator$f(this, function (_a) {
            headers = {
                "content-type": "application/x-amz-json-1.1",
                "x-amz-target": "AWSCognitoIdentityService.GetId",
            };
            body = JSON.stringify(serializeAws_json1_1GetIdInput(input));
            return [2 /*return*/, buildHttpRpcRequest(context, headers, "/", undefined, body)];
        });
    }); };
    var deserializeAws_json1_1GetCredentialsForIdentityCommand = function (output, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var data, contents, response;
        return __generator$f(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (output.statusCode >= 300) {
                        return [2 /*return*/, deserializeAws_json1_1GetCredentialsForIdentityCommandError(output, context)];
                    }
                    return [4 /*yield*/, parseBody(output.body, context)];
                case 1:
                    data = _a.sent();
                    contents = {};
                    contents = deserializeAws_json1_1GetCredentialsForIdentityResponse(data);
                    response = __assign$d({ $metadata: deserializeMetadata(output) }, contents);
                    return [2 /*return*/, Promise.resolve(response)];
            }
        });
    }); };
    var deserializeAws_json1_1GetCredentialsForIdentityCommandError = function (output, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var parsedOutput, _a, response, errorCode, _b, _c, _d, _e, _f, _g, _h, _j, _k, parsedBody, message;
        var _l;
        return __generator$f(this, function (_m) {
            switch (_m.label) {
                case 0:
                    _a = [__assign$d({}, output)];
                    _l = {};
                    return [4 /*yield*/, parseBody(output.body, context)];
                case 1:
                    parsedOutput = __assign$d.apply(void 0, _a.concat([(_l.body = _m.sent(), _l)]));
                    errorCode = "UnknownError";
                    errorCode = loadRestJsonErrorCode(output, parsedOutput.body);
                    _b = errorCode;
                    switch (_b) {
                        case "ExternalServiceException": return [3 /*break*/, 2];
                        case "com.amazonaws.cognitoidentity#ExternalServiceException": return [3 /*break*/, 2];
                        case "InternalErrorException": return [3 /*break*/, 4];
                        case "com.amazonaws.cognitoidentity#InternalErrorException": return [3 /*break*/, 4];
                        case "InvalidIdentityPoolConfigurationException": return [3 /*break*/, 6];
                        case "com.amazonaws.cognitoidentity#InvalidIdentityPoolConfigurationException": return [3 /*break*/, 6];
                        case "InvalidParameterException": return [3 /*break*/, 8];
                        case "com.amazonaws.cognitoidentity#InvalidParameterException": return [3 /*break*/, 8];
                        case "NotAuthorizedException": return [3 /*break*/, 10];
                        case "com.amazonaws.cognitoidentity#NotAuthorizedException": return [3 /*break*/, 10];
                        case "ResourceConflictException": return [3 /*break*/, 12];
                        case "com.amazonaws.cognitoidentity#ResourceConflictException": return [3 /*break*/, 12];
                        case "ResourceNotFoundException": return [3 /*break*/, 14];
                        case "com.amazonaws.cognitoidentity#ResourceNotFoundException": return [3 /*break*/, 14];
                        case "TooManyRequestsException": return [3 /*break*/, 16];
                        case "com.amazonaws.cognitoidentity#TooManyRequestsException": return [3 /*break*/, 16];
                    }
                    return [3 /*break*/, 18];
                case 2:
                    _c = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1ExternalServiceExceptionResponse(parsedOutput)];
                case 3:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _c.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 4:
                    _d = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1InternalErrorExceptionResponse(parsedOutput)];
                case 5:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _d.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 6:
                    _e = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1InvalidIdentityPoolConfigurationExceptionResponse(parsedOutput)];
                case 7:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _e.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 8:
                    _f = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1InvalidParameterExceptionResponse(parsedOutput)];
                case 9:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _f.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 10:
                    _g = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1NotAuthorizedExceptionResponse(parsedOutput)];
                case 11:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _g.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 12:
                    _h = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1ResourceConflictExceptionResponse(parsedOutput)];
                case 13:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _h.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 14:
                    _j = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1ResourceNotFoundExceptionResponse(parsedOutput)];
                case 15:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _j.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 16:
                    _k = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1TooManyRequestsExceptionResponse(parsedOutput)];
                case 17:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _k.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 18:
                    parsedBody = parsedOutput.body;
                    errorCode = parsedBody.code || parsedBody.Code || errorCode;
                    response = __assign$d(__assign$d({}, parsedBody), { name: "" + errorCode, message: parsedBody.message || parsedBody.Message || errorCode, $fault: "client", $metadata: deserializeMetadata(output) });
                    _m.label = 19;
                case 19:
                    message = response.message || response.Message || errorCode;
                    response.message = message;
                    delete response.Message;
                    return [2 /*return*/, Promise.reject(Object.assign(new Error(message), response))];
            }
        });
    }); };
    var deserializeAws_json1_1GetIdCommand = function (output, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var data, contents, response;
        return __generator$f(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (output.statusCode >= 300) {
                        return [2 /*return*/, deserializeAws_json1_1GetIdCommandError(output, context)];
                    }
                    return [4 /*yield*/, parseBody(output.body, context)];
                case 1:
                    data = _a.sent();
                    contents = {};
                    contents = deserializeAws_json1_1GetIdResponse(data);
                    response = __assign$d({ $metadata: deserializeMetadata(output) }, contents);
                    return [2 /*return*/, Promise.resolve(response)];
            }
        });
    }); };
    var deserializeAws_json1_1GetIdCommandError = function (output, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var parsedOutput, _a, response, errorCode, _b, _c, _d, _e, _f, _g, _h, _j, _k, parsedBody, message;
        var _l;
        return __generator$f(this, function (_m) {
            switch (_m.label) {
                case 0:
                    _a = [__assign$d({}, output)];
                    _l = {};
                    return [4 /*yield*/, parseBody(output.body, context)];
                case 1:
                    parsedOutput = __assign$d.apply(void 0, _a.concat([(_l.body = _m.sent(), _l)]));
                    errorCode = "UnknownError";
                    errorCode = loadRestJsonErrorCode(output, parsedOutput.body);
                    _b = errorCode;
                    switch (_b) {
                        case "ExternalServiceException": return [3 /*break*/, 2];
                        case "com.amazonaws.cognitoidentity#ExternalServiceException": return [3 /*break*/, 2];
                        case "InternalErrorException": return [3 /*break*/, 4];
                        case "com.amazonaws.cognitoidentity#InternalErrorException": return [3 /*break*/, 4];
                        case "InvalidParameterException": return [3 /*break*/, 6];
                        case "com.amazonaws.cognitoidentity#InvalidParameterException": return [3 /*break*/, 6];
                        case "LimitExceededException": return [3 /*break*/, 8];
                        case "com.amazonaws.cognitoidentity#LimitExceededException": return [3 /*break*/, 8];
                        case "NotAuthorizedException": return [3 /*break*/, 10];
                        case "com.amazonaws.cognitoidentity#NotAuthorizedException": return [3 /*break*/, 10];
                        case "ResourceConflictException": return [3 /*break*/, 12];
                        case "com.amazonaws.cognitoidentity#ResourceConflictException": return [3 /*break*/, 12];
                        case "ResourceNotFoundException": return [3 /*break*/, 14];
                        case "com.amazonaws.cognitoidentity#ResourceNotFoundException": return [3 /*break*/, 14];
                        case "TooManyRequestsException": return [3 /*break*/, 16];
                        case "com.amazonaws.cognitoidentity#TooManyRequestsException": return [3 /*break*/, 16];
                    }
                    return [3 /*break*/, 18];
                case 2:
                    _c = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1ExternalServiceExceptionResponse(parsedOutput)];
                case 3:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _c.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 4:
                    _d = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1InternalErrorExceptionResponse(parsedOutput)];
                case 5:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _d.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 6:
                    _e = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1InvalidParameterExceptionResponse(parsedOutput)];
                case 7:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _e.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 8:
                    _f = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1LimitExceededExceptionResponse(parsedOutput)];
                case 9:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _f.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 10:
                    _g = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1NotAuthorizedExceptionResponse(parsedOutput)];
                case 11:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _g.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 12:
                    _h = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1ResourceConflictExceptionResponse(parsedOutput)];
                case 13:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _h.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 14:
                    _j = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1ResourceNotFoundExceptionResponse(parsedOutput)];
                case 15:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _j.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 16:
                    _k = [{}];
                    return [4 /*yield*/, deserializeAws_json1_1TooManyRequestsExceptionResponse(parsedOutput)];
                case 17:
                    response = __assign$d.apply(void 0, [__assign$d.apply(void 0, _k.concat([(_m.sent())])), { name: errorCode, $metadata: deserializeMetadata(output) }]);
                    return [3 /*break*/, 19];
                case 18:
                    parsedBody = parsedOutput.body;
                    errorCode = parsedBody.code || parsedBody.Code || errorCode;
                    response = __assign$d(__assign$d({}, parsedBody), { name: "" + errorCode, message: parsedBody.message || parsedBody.Message || errorCode, $fault: "client", $metadata: deserializeMetadata(output) });
                    _m.label = 19;
                case 19:
                    message = response.message || response.Message || errorCode;
                    response.message = message;
                    delete response.Message;
                    return [2 /*return*/, Promise.reject(Object.assign(new Error(message), response))];
            }
        });
    }); };
    var deserializeAws_json1_1ExternalServiceExceptionResponse = function (parsedOutput, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var body, deserialized, contents;
        return __generator$f(this, function (_a) {
            body = parsedOutput.body;
            deserialized = deserializeAws_json1_1ExternalServiceException(body);
            contents = __assign$d({ name: "ExternalServiceException", $fault: "client", $metadata: deserializeMetadata(parsedOutput) }, deserialized);
            return [2 /*return*/, contents];
        });
    }); };
    var deserializeAws_json1_1InternalErrorExceptionResponse = function (parsedOutput, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var body, deserialized, contents;
        return __generator$f(this, function (_a) {
            body = parsedOutput.body;
            deserialized = deserializeAws_json1_1InternalErrorException(body);
            contents = __assign$d({ name: "InternalErrorException", $fault: "server", $metadata: deserializeMetadata(parsedOutput) }, deserialized);
            return [2 /*return*/, contents];
        });
    }); };
    var deserializeAws_json1_1InvalidIdentityPoolConfigurationExceptionResponse = function (parsedOutput, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var body, deserialized, contents;
        return __generator$f(this, function (_a) {
            body = parsedOutput.body;
            deserialized = deserializeAws_json1_1InvalidIdentityPoolConfigurationException(body);
            contents = __assign$d({ name: "InvalidIdentityPoolConfigurationException", $fault: "client", $metadata: deserializeMetadata(parsedOutput) }, deserialized);
            return [2 /*return*/, contents];
        });
    }); };
    var deserializeAws_json1_1InvalidParameterExceptionResponse = function (parsedOutput, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var body, deserialized, contents;
        return __generator$f(this, function (_a) {
            body = parsedOutput.body;
            deserialized = deserializeAws_json1_1InvalidParameterException(body);
            contents = __assign$d({ name: "InvalidParameterException", $fault: "client", $metadata: deserializeMetadata(parsedOutput) }, deserialized);
            return [2 /*return*/, contents];
        });
    }); };
    var deserializeAws_json1_1LimitExceededExceptionResponse = function (parsedOutput, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var body, deserialized, contents;
        return __generator$f(this, function (_a) {
            body = parsedOutput.body;
            deserialized = deserializeAws_json1_1LimitExceededException(body);
            contents = __assign$d({ name: "LimitExceededException", $fault: "client", $metadata: deserializeMetadata(parsedOutput) }, deserialized);
            return [2 /*return*/, contents];
        });
    }); };
    var deserializeAws_json1_1NotAuthorizedExceptionResponse = function (parsedOutput, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var body, deserialized, contents;
        return __generator$f(this, function (_a) {
            body = parsedOutput.body;
            deserialized = deserializeAws_json1_1NotAuthorizedException(body);
            contents = __assign$d({ name: "NotAuthorizedException", $fault: "client", $metadata: deserializeMetadata(parsedOutput) }, deserialized);
            return [2 /*return*/, contents];
        });
    }); };
    var deserializeAws_json1_1ResourceConflictExceptionResponse = function (parsedOutput, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var body, deserialized, contents;
        return __generator$f(this, function (_a) {
            body = parsedOutput.body;
            deserialized = deserializeAws_json1_1ResourceConflictException(body);
            contents = __assign$d({ name: "ResourceConflictException", $fault: "client", $metadata: deserializeMetadata(parsedOutput) }, deserialized);
            return [2 /*return*/, contents];
        });
    }); };
    var deserializeAws_json1_1ResourceNotFoundExceptionResponse = function (parsedOutput, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var body, deserialized, contents;
        return __generator$f(this, function (_a) {
            body = parsedOutput.body;
            deserialized = deserializeAws_json1_1ResourceNotFoundException(body);
            contents = __assign$d({ name: "ResourceNotFoundException", $fault: "client", $metadata: deserializeMetadata(parsedOutput) }, deserialized);
            return [2 /*return*/, contents];
        });
    }); };
    var deserializeAws_json1_1TooManyRequestsExceptionResponse = function (parsedOutput, context) { return __awaiter$f(void 0, void 0, void 0, function () {
        var body, deserialized, contents;
        return __generator$f(this, function (_a) {
            body = parsedOutput.body;
            deserialized = deserializeAws_json1_1TooManyRequestsException(body);
            contents = __assign$d({ name: "TooManyRequestsException", $fault: "client", $metadata: deserializeMetadata(parsedOutput) }, deserialized);
            return [2 /*return*/, contents];
        });
    }); };
    var serializeAws_json1_1GetCredentialsForIdentityInput = function (input, context) {
        return __assign$d(__assign$d(__assign$d({}, (input.CustomRoleArn !== undefined && input.CustomRoleArn !== null && { CustomRoleArn: input.CustomRoleArn })), (input.IdentityId !== undefined && input.IdentityId !== null && { IdentityId: input.IdentityId })), (input.Logins !== undefined &&
            input.Logins !== null && { Logins: serializeAws_json1_1LoginsMap(input.Logins) }));
    };
    var serializeAws_json1_1GetIdInput = function (input, context) {
        return __assign$d(__assign$d(__assign$d({}, (input.AccountId !== undefined && input.AccountId !== null && { AccountId: input.AccountId })), (input.IdentityPoolId !== undefined &&
            input.IdentityPoolId !== null && { IdentityPoolId: input.IdentityPoolId })), (input.Logins !== undefined &&
            input.Logins !== null && { Logins: serializeAws_json1_1LoginsMap(input.Logins) }));
    };
    var serializeAws_json1_1LoginsMap = function (input, context) {
        return Object.entries(input).reduce(function (acc, _a) {
            var _b;
            var _c = __read$b(_a, 2), key = _c[0], value = _c[1];
            if (value === null) {
                return acc;
            }
            return __assign$d(__assign$d({}, acc), (_b = {}, _b[key] = value, _b));
        }, {});
    };
    var deserializeAws_json1_1Credentials = function (output, context) {
        return {
            AccessKeyId: output.AccessKeyId !== undefined && output.AccessKeyId !== null ? output.AccessKeyId : undefined,
            Expiration: output.Expiration !== undefined && output.Expiration !== null
                ? new Date(Math.round(output.Expiration * 1000))
                : undefined,
            SecretKey: output.SecretKey !== undefined && output.SecretKey !== null ? output.SecretKey : undefined,
            SessionToken: output.SessionToken !== undefined && output.SessionToken !== null ? output.SessionToken : undefined,
        };
    };
    var deserializeAws_json1_1ExternalServiceException = function (output, context) {
        return {
            message: output.message !== undefined && output.message !== null ? output.message : undefined,
        };
    };
    var deserializeAws_json1_1GetCredentialsForIdentityResponse = function (output, context) {
        return {
            Credentials: output.Credentials !== undefined && output.Credentials !== null
                ? deserializeAws_json1_1Credentials(output.Credentials)
                : undefined,
            IdentityId: output.IdentityId !== undefined && output.IdentityId !== null ? output.IdentityId : undefined,
        };
    };
    var deserializeAws_json1_1GetIdResponse = function (output, context) {
        return {
            IdentityId: output.IdentityId !== undefined && output.IdentityId !== null ? output.IdentityId : undefined,
        };
    };
    var deserializeAws_json1_1InternalErrorException = function (output, context) {
        return {
            message: output.message !== undefined && output.message !== null ? output.message : undefined,
        };
    };
    var deserializeAws_json1_1InvalidIdentityPoolConfigurationException = function (output, context) {
        return {
            message: output.message !== undefined && output.message !== null ? output.message : undefined,
        };
    };
    var deserializeAws_json1_1InvalidParameterException = function (output, context) {
        return {
            message: output.message !== undefined && output.message !== null ? output.message : undefined,
        };
    };
    var deserializeAws_json1_1LimitExceededException = function (output, context) {
        return {
            message: output.message !== undefined && output.message !== null ? output.message : undefined,
        };
    };
    var deserializeAws_json1_1NotAuthorizedException = function (output, context) {
        return {
            message: output.message !== undefined && output.message !== null ? output.message : undefined,
        };
    };
    var deserializeAws_json1_1ResourceConflictException = function (output, context) {
        return {
            message: output.message !== undefined && output.message !== null ? output.message : undefined,
        };
    };
    var deserializeAws_json1_1ResourceNotFoundException = function (output, context) {
        return {
            message: output.message !== undefined && output.message !== null ? output.message : undefined,
        };
    };
    var deserializeAws_json1_1TooManyRequestsException = function (output, context) {
        return {
            message: output.message !== undefined && output.message !== null ? output.message : undefined,
        };
    };
    var deserializeMetadata = function (output) {
        var _a;
        return ({
            httpStatusCode: output.statusCode,
            requestId: (_a = output.headers["x-amzn-requestid"]) !== null && _a !== void 0 ? _a : output.headers["x-amzn-request-id"],
            extendedRequestId: output.headers["x-amz-id-2"],
            cfId: output.headers["x-amz-cf-id"],
        });
    };
    // Collect low-level response body stream to Uint8Array.
    var collectBody = function (streamBody, context) {
        if (streamBody === void 0) { streamBody = new Uint8Array(); }
        if (streamBody instanceof Uint8Array) {
            return Promise.resolve(streamBody);
        }
        return context.streamCollector(streamBody) || Promise.resolve(new Uint8Array());
    };
    // Encode Uint8Array data into string with utf-8.
    var collectBodyString = function (streamBody, context) {
        return collectBody(streamBody, context).then(function (body) { return context.utf8Encoder(body); });
    };
    var buildHttpRpcRequest = function (context, headers, path, resolvedHostname, body) { return __awaiter$f(void 0, void 0, void 0, function () {
        var _a, hostname, _b, protocol, port, contents;
        return __generator$f(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, context.endpoint()];
                case 1:
                    _a = _c.sent(), hostname = _a.hostname, _b = _a.protocol, protocol = _b === void 0 ? "https" : _b, port = _a.port;
                    contents = {
                        protocol: protocol,
                        hostname: hostname,
                        port: port,
                        method: "POST",
                        path: path,
                        headers: headers,
                    };
                    if (resolvedHostname !== undefined) {
                        contents.hostname = resolvedHostname;
                    }
                    if (body !== undefined) {
                        contents.body = body;
                    }
                    return [2 /*return*/, new HttpRequest(contents)];
            }
        });
    }); };
    var parseBody = function (streamBody, context) {
        return collectBodyString(streamBody, context).then(function (encoded) {
            if (encoded.length) {
                return JSON.parse(encoded);
            }
            return {};
        });
    };
    /**
     * Load an error code for the aws.rest-json-1.1 protocol.
     */
    var loadRestJsonErrorCode = function (output, data) {
        var findKey = function (object, key) { return Object.keys(object).find(function (k) { return k.toLowerCase() === key.toLowerCase(); }); };
        var sanitizeErrorCode = function (rawValue) {
            var cleanValue = rawValue;
            if (cleanValue.indexOf(":") >= 0) {
                cleanValue = cleanValue.split(":")[0];
            }
            if (cleanValue.indexOf("#") >= 0) {
                cleanValue = cleanValue.split("#")[1];
            }
            return cleanValue;
        };
        var headerKey = findKey(output.headers, "x-amzn-errortype");
        if (headerKey !== undefined) {
            return sanitizeErrorCode(output.headers[headerKey]);
        }
        if (data.code !== undefined) {
            return sanitizeErrorCode(data.code);
        }
        if (data["__type"] !== undefined) {
            return sanitizeErrorCode(data["__type"]);
        }
        return "";
    };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign$1 = function() {
        __assign$1 = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign$1.apply(this, arguments);
    };

    function __awaiter$1(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator$1(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    var deserializerMiddleware = function (options, deserializer) { return function (next, context) { return function (args) { return __awaiter$1(void 0, void 0, void 0, function () {
        var response, parsed;
        return __generator$1(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, next(args)];
                case 1:
                    response = (_a.sent()).response;
                    return [4 /*yield*/, deserializer(response, options)];
                case 2:
                    parsed = _a.sent();
                    return [2 /*return*/, {
                            response: response,
                            output: parsed,
                        }];
            }
        });
    }); }; }; };

    var serializerMiddleware = function (options, serializer) { return function (next, context) { return function (args) { return __awaiter$1(void 0, void 0, void 0, function () {
        var request;
        return __generator$1(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, serializer(args.input, options)];
                case 1:
                    request = _a.sent();
                    return [2 /*return*/, next(__assign$1(__assign$1({}, args), { request: request }))];
            }
        });
    }); }; }; };

    var deserializerMiddlewareOption = {
        name: "deserializerMiddleware",
        step: "deserialize",
        tags: ["DESERIALIZER"],
        override: true,
    };
    var serializerMiddlewareOption = {
        name: "serializerMiddleware",
        step: "serialize",
        tags: ["SERIALIZER"],
        override: true,
    };
    function getSerdePlugin(config, serializer, deserializer) {
        return {
            applyToStack: function (commandStack) {
                commandStack.add(deserializerMiddleware(config, deserializer), deserializerMiddlewareOption);
                commandStack.add(serializerMiddleware(config, serializer), serializerMiddlewareOption);
            },
        };
    }

    /**
     * <p>Returns credentials for the provided identity ID. Any provided logins will be
     *          validated against supported login providers. If the token is for
     *          cognito-identity.amazonaws.com, it will be passed through to AWS Security Token Service
     *          with the appropriate role for the token.</p>
     *          <p>This is a public API. You do not need any credentials to call this API.</p>
     */
    var GetCredentialsForIdentityCommand = /** @class */ (function (_super) {
        __extends$5(GetCredentialsForIdentityCommand, _super);
        // Start section: command_properties
        // End section: command_properties
        function GetCredentialsForIdentityCommand(input) {
            var _this = 
            // Start section: command_constructor
            _super.call(this) || this;
            _this.input = input;
            return _this;
            // End section: command_constructor
        }
        /**
         * @internal
         */
        GetCredentialsForIdentityCommand.prototype.resolveMiddleware = function (clientStack, configuration, options) {
            this.middlewareStack.use(getSerdePlugin(configuration, this.serialize, this.deserialize));
            var stack = clientStack.concat(this.middlewareStack);
            var logger = configuration.logger;
            var clientName = "CognitoIdentityClient";
            var commandName = "GetCredentialsForIdentityCommand";
            var handlerExecutionContext = {
                logger: logger,
                clientName: clientName,
                commandName: commandName,
                inputFilterSensitiveLog: GetCredentialsForIdentityInput.filterSensitiveLog,
                outputFilterSensitiveLog: GetCredentialsForIdentityResponse.filterSensitiveLog,
            };
            var requestHandler = configuration.requestHandler;
            return stack.resolve(function (request) {
                return requestHandler.handle(request.request, options || {});
            }, handlerExecutionContext);
        };
        GetCredentialsForIdentityCommand.prototype.serialize = function (input, context) {
            return serializeAws_json1_1GetCredentialsForIdentityCommand(input, context);
        };
        GetCredentialsForIdentityCommand.prototype.deserialize = function (output, context) {
            return deserializeAws_json1_1GetCredentialsForIdentityCommand(output, context);
        };
        return GetCredentialsForIdentityCommand;
    }(Command));

    /**
     * <p>Generates (or retrieves) a Cognito ID. Supplying multiple logins will create an
     *          implicit linked account.</p>
     *          <p>This is a public API. You do not need any credentials to call this API.</p>
     */
    var GetIdCommand = /** @class */ (function (_super) {
        __extends$5(GetIdCommand, _super);
        // Start section: command_properties
        // End section: command_properties
        function GetIdCommand(input) {
            var _this = 
            // Start section: command_constructor
            _super.call(this) || this;
            _this.input = input;
            return _this;
            // End section: command_constructor
        }
        /**
         * @internal
         */
        GetIdCommand.prototype.resolveMiddleware = function (clientStack, configuration, options) {
            this.middlewareStack.use(getSerdePlugin(configuration, this.serialize, this.deserialize));
            var stack = clientStack.concat(this.middlewareStack);
            var logger = configuration.logger;
            var clientName = "CognitoIdentityClient";
            var commandName = "GetIdCommand";
            var handlerExecutionContext = {
                logger: logger,
                clientName: clientName,
                commandName: commandName,
                inputFilterSensitiveLog: GetIdInput.filterSensitiveLog,
                outputFilterSensitiveLog: GetIdResponse.filterSensitiveLog,
            };
            var requestHandler = configuration.requestHandler;
            return stack.resolve(function (request) {
                return requestHandler.handle(request.request, options || {});
            }, handlerExecutionContext);
        };
        GetIdCommand.prototype.serialize = function (input, context) {
            return serializeAws_json1_1GetIdCommand(input, context);
        };
        GetIdCommand.prototype.deserialize = function (output, context) {
            return deserializeAws_json1_1GetIdCommand(output, context);
        };
        return GetIdCommand;
    }(Command));

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    /**
     * An error representing a failure of an individual credential provider.
     *
     * This error class has special meaning to the {@link chain} method. If a
     * provider in the chain is rejected with an error, the chain will only proceed
     * to the next provider if the value of the `tryNextLink` property on the error
     * is truthy. This allows individual providers to halt the chain and also
     * ensures the chain will stop if an entirely unexpected error is encountered.
     */
    var ProviderError = /** @class */ (function (_super) {
        __extends(ProviderError, _super);
        function ProviderError(message, tryNextLink) {
            if (tryNextLink === void 0) { tryNextLink = true; }
            var _this = _super.call(this, message) || this;
            _this.tryNextLink = tryNextLink;
            return _this;
        }
        return ProviderError;
    }(Error));

    /**
     * @internal
     */
    function resolveLogins(logins) {
        return Promise.all(Object.keys(logins).reduce(function (arr, name) {
            var tokenOrProvider = logins[name];
            if (typeof tokenOrProvider === "string") {
                arr.push([name, tokenOrProvider]);
            }
            else {
                arr.push(tokenOrProvider().then(function (token) { return [name, token]; }));
            }
            return arr;
        }, [])).then(function (resolvedPairs) {
            return resolvedPairs.reduce(function (logins, _a) {
                var _b = __read$c(_a, 2), key = _b[0], value = _b[1];
                logins[key] = value;
                return logins;
            }, {});
        });
    }

    /**
     * Retrieves temporary AWS credentials using Amazon Cognito's
     * `GetCredentialsForIdentity` operation.
     *
     * Results from this function call are not cached internally.
     */
    function fromCognitoIdentity(parameters) {
        var _this = this;
        return function () { return __awaiter$g(_this, void 0, void 0, function () {
            var _a, _b, _c, AccessKeyId, Expiration, _d, SecretKey, SessionToken, _e, _f, _g, _h;
            var _j;
            return __generator$g(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        _f = (_e = parameters.client).send;
                        _g = GetCredentialsForIdentityCommand.bind;
                        _j = {
                            CustomRoleArn: parameters.customRoleArn,
                            IdentityId: parameters.identityId
                        };
                        if (!parameters.logins) return [3 /*break*/, 2];
                        return [4 /*yield*/, resolveLogins(parameters.logins)];
                    case 1:
                        _h = _k.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _h = undefined;
                        _k.label = 3;
                    case 3: return [4 /*yield*/, _f.apply(_e, [new (_g.apply(GetCredentialsForIdentityCommand, [void 0, (_j.Logins = _h,
                                    _j)]))()])];
                    case 4:
                        _a = (_k.sent()).Credentials, _b = _a === void 0 ? throwOnMissingCredentials() : _a, _c = _b.AccessKeyId, AccessKeyId = _c === void 0 ? throwOnMissingAccessKeyId() : _c, Expiration = _b.Expiration, _d = _b.SecretKey, SecretKey = _d === void 0 ? throwOnMissingSecretKey() : _d, SessionToken = _b.SessionToken;
                        return [2 /*return*/, {
                                identityId: parameters.identityId,
                                accessKeyId: AccessKeyId,
                                secretAccessKey: SecretKey,
                                sessionToken: SessionToken,
                                expiration: Expiration,
                            }];
                }
            });
        }); };
    }
    function throwOnMissingAccessKeyId() {
        throw new ProviderError("Response from Amazon Cognito contained no access key ID");
    }
    function throwOnMissingCredentials() {
        throw new ProviderError("Response from Amazon Cognito contained no credentials");
    }
    function throwOnMissingSecretKey() {
        throw new ProviderError("Response from Amazon Cognito contained no secret key");
    }

    var STORE_NAME = "IdentityIds";
    var IndexedDbStorage = /** @class */ (function () {
        function IndexedDbStorage(dbName) {
            if (dbName === void 0) { dbName = "aws:cognito-identity-ids"; }
            this.dbName = dbName;
        }
        IndexedDbStorage.prototype.getItem = function (key) {
            return this.withObjectStore("readonly", function (store) {
                var req = store.get(key);
                return new Promise(function (resolve) {
                    req.onerror = function () { return resolve(null); };
                    req.onsuccess = function () { return resolve(req.result ? req.result.value : null); };
                });
            }).catch(function () { return null; });
        };
        IndexedDbStorage.prototype.removeItem = function (key) {
            return this.withObjectStore("readwrite", function (store) {
                var req = store.delete(key);
                return new Promise(function (resolve, reject) {
                    req.onerror = function () { return reject(req.error); };
                    req.onsuccess = function () { return resolve(); };
                });
            });
        };
        IndexedDbStorage.prototype.setItem = function (id, value) {
            return this.withObjectStore("readwrite", function (store) {
                var req = store.put({ id: id, value: value });
                return new Promise(function (resolve, reject) {
                    req.onerror = function () { return reject(req.error); };
                    req.onsuccess = function () { return resolve(); };
                });
            });
        };
        IndexedDbStorage.prototype.getDb = function () {
            var openDbRequest = self.indexedDB.open(this.dbName, 1);
            return new Promise(function (resolve, reject) {
                openDbRequest.onsuccess = function () {
                    resolve(openDbRequest.result);
                };
                openDbRequest.onerror = function () {
                    reject(openDbRequest.error);
                };
                openDbRequest.onblocked = function () {
                    reject(new Error("Unable to access DB"));
                };
                openDbRequest.onupgradeneeded = function () {
                    var db = openDbRequest.result;
                    db.onerror = function () {
                        reject(new Error("Failed to create object store"));
                    };
                    db.createObjectStore(STORE_NAME, { keyPath: "id" });
                };
            });
        };
        IndexedDbStorage.prototype.withObjectStore = function (mode, action) {
            return this.getDb().then(function (db) {
                var tx = db.transaction(STORE_NAME, mode);
                tx.oncomplete = function () { return db.close(); };
                return new Promise(function (resolve, reject) {
                    tx.onerror = function () { return reject(tx.error); };
                    resolve(action(tx.objectStore(STORE_NAME)));
                }).catch(function (err) {
                    db.close();
                    throw err;
                });
            });
        };
        return IndexedDbStorage;
    }());

    var InMemoryStorage = /** @class */ (function () {
        function InMemoryStorage(store) {
            if (store === void 0) { store = {}; }
            this.store = store;
        }
        InMemoryStorage.prototype.getItem = function (key) {
            if (key in this.store) {
                return this.store[key];
            }
            return null;
        };
        InMemoryStorage.prototype.removeItem = function (key) {
            delete this.store[key];
        };
        InMemoryStorage.prototype.setItem = function (key, value) {
            this.store[key] = value;
        };
        return InMemoryStorage;
    }());

    var inMemoryStorage = new InMemoryStorage();
    function localStorage() {
        if (typeof self === "object" && self.indexedDB) {
            return new IndexedDbStorage();
        }
        if (typeof window === "object" && window.localStorage) {
            return window.localStorage;
        }
        return inMemoryStorage;
    }

    /**
     * Retrieves or generates a unique identifier using Amazon Cognito's `GetId`
     * operation, then generates temporary AWS credentials using Amazon Cognito's
     * `GetCredentialsForIdentity` operation.
     *
     * Results from `GetId` are cached internally, but results from
     * `GetCredentialsForIdentity` are not.
     */
    function fromCognitoIdentityPool(_a) {
        var _this = this;
        var accountId = _a.accountId, _b = _a.cache, cache = _b === void 0 ? localStorage() : _b, client = _a.client, customRoleArn = _a.customRoleArn, identityPoolId = _a.identityPoolId, logins = _a.logins, _c = _a.userIdentifier, userIdentifier = _c === void 0 ? !logins || Object.keys(logins).length === 0 ? "ANONYMOUS" : undefined : _c;
        var cacheKey = userIdentifier ? "aws:cognito-identity-credentials:" + identityPoolId + ":" + userIdentifier : undefined;
        var provider = function () { return __awaiter$g(_this, void 0, void 0, function () {
            var identityId, _a, _b, IdentityId, _c, _d, _e, _f;
            var _g;
            return __generator$g(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _a = cacheKey;
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, cache.getItem(cacheKey)];
                    case 1:
                        _a = (_h.sent());
                        _h.label = 2;
                    case 2:
                        identityId = _a;
                        if (!!identityId) return [3 /*break*/, 7];
                        _d = (_c = client).send;
                        _e = GetIdCommand.bind;
                        _g = {
                            AccountId: accountId,
                            IdentityPoolId: identityPoolId
                        };
                        if (!logins) return [3 /*break*/, 4];
                        return [4 /*yield*/, resolveLogins(logins)];
                    case 3:
                        _f = _h.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _f = undefined;
                        _h.label = 5;
                    case 5: return [4 /*yield*/, _d.apply(_c, [new (_e.apply(GetIdCommand, [void 0, (_g.Logins = _f,
                                    _g)]))()])];
                    case 6:
                        _b = (_h.sent()).IdentityId, IdentityId = _b === void 0 ? throwOnMissingId() : _b;
                        identityId = IdentityId;
                        if (cacheKey) {
                            Promise.resolve(cache.setItem(cacheKey, identityId)).catch(function () { });
                        }
                        _h.label = 7;
                    case 7:
                        provider = fromCognitoIdentity({
                            client: client,
                            customRoleArn: customRoleArn,
                            logins: logins,
                            identityId: identityId,
                        });
                        return [2 /*return*/, provider()];
                }
            });
        }); };
        return function () {
            return provider().catch(function (err) { return __awaiter$g(_this, void 0, void 0, function () {
                return __generator$g(this, function (_a) {
                    if (cacheKey) {
                        Promise.resolve(cache.removeItem(cacheKey)).catch(function () { });
                    }
                    throw err;
                });
            }); });
        };
    }
    function throwOnMissingId() {
        throw new ProviderError("Response from Amazon Cognito contained no identity ID");
    }

    var __assign = (undefined && undefined.__assign) || function () {
        __assign = Object.assign || function(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };
    var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };
    var logger = new ConsoleLogger('Credentials');
    var CREDENTIALS_TTL = 50 * 60 * 1000; // 50 min, can be modified on config if required in the future
    var CredentialsClass = /** @class */ (function () {
        function CredentialsClass(config) {
            this._gettingCredPromise = null;
            this._refreshHandlers = {};
            // Allow `Auth` to be injected for SSR, but Auth isn't a required dependency for Credentials
            this.Auth = undefined;
            this.configure(config);
            this._refreshHandlers['google'] = GoogleOAuth.refreshGoogleToken;
            this._refreshHandlers['facebook'] = FacebookOAuth.refreshFacebookToken;
        }
        CredentialsClass.prototype.getModuleName = function () {
            return 'Credentials';
        };
        CredentialsClass.prototype.getCredSource = function () {
            return this._credentials_source;
        };
        CredentialsClass.prototype.configure = function (config) {
            if (!config)
                return this._config || {};
            this._config = Object.assign({}, this._config, config);
            var refreshHandlers = this._config.refreshHandlers;
            // If the developer has provided an object of refresh handlers,
            // then we can merge the provided handlers with the current handlers.
            if (refreshHandlers) {
                this._refreshHandlers = __assign(__assign({}, this._refreshHandlers), refreshHandlers);
            }
            this._storage = this._config.storage;
            if (!this._storage) {
                this._storage = new StorageHelper().getStorage();
            }
            this._storageSync = Promise.resolve();
            if (typeof this._storage['sync'] === 'function') {
                this._storageSync = this._storage['sync']();
            }
            return this._config;
        };
        CredentialsClass.prototype.get = function () {
            logger.debug('getting credentials');
            return this._pickupCredentials();
        };
        CredentialsClass.prototype._pickupCredentials = function () {
            logger.debug('picking up credentials');
            if (!this._gettingCredPromise || !this._gettingCredPromise.isPending()) {
                logger.debug('getting new cred promise');
                this._gettingCredPromise = makeQuerablePromise(this._keepAlive());
            }
            else {
                logger.debug('getting old cred promise');
            }
            return this._gettingCredPromise;
        };
        CredentialsClass.prototype._keepAlive = function () {
            return __awaiter(this, void 0, void 0, function () {
                var cred, _a, Auth, user_1, session, refreshToken_1, refreshRequest, err_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            logger.debug('checking if credentials exists and not expired');
                            cred = this._credentials;
                            if (cred && !this._isExpired(cred) && !this._isPastTTL()) {
                                logger.debug('credentials not changed and not expired, directly return');
                                return [2 /*return*/, Promise.resolve(cred)];
                            }
                            logger.debug('need to get a new credential or refresh the existing one');
                            _a = this.Auth, Auth = _a === void 0 ? Amplify.Auth : _a;
                            if (!Auth || typeof Auth.currentUserCredentials !== 'function') {
                                return [2 /*return*/, Promise.reject('No Auth module registered in Amplify')];
                            }
                            if (!(!this._isExpired(cred) && this._isPastTTL())) return [3 /*break*/, 6];
                            logger.debug('ttl has passed but token is not yet expired');
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 5, , 6]);
                            return [4 /*yield*/, Auth.currentUserPoolUser()];
                        case 2:
                            user_1 = _b.sent();
                            return [4 /*yield*/, Auth.currentSession()];
                        case 3:
                            session = _b.sent();
                            refreshToken_1 = session.refreshToken;
                            refreshRequest = new Promise(function (res, rej) {
                                user_1.refreshSession(refreshToken_1, function (err, data) {
                                    return err ? rej(err) : res(data);
                                });
                            });
                            return [4 /*yield*/, refreshRequest];
                        case 4:
                            _b.sent(); // note that rejections will be caught and handled in the catch block.
                            return [3 /*break*/, 6];
                        case 5:
                            err_1 = _b.sent();
                            // should not throw because user might just be on guest access or is authenticated through federation
                            logger.debug('Error attempting to refreshing the session', err_1);
                            return [3 /*break*/, 6];
                        case 6: return [2 /*return*/, Auth.currentUserCredentials()];
                    }
                });
            });
        };
        CredentialsClass.prototype.refreshFederatedToken = function (federatedInfo) {
            logger.debug('Getting federated credentials');
            var provider = federatedInfo.provider, user = federatedInfo.user, token = federatedInfo.token, identity_id = federatedInfo.identity_id;
            var expires_at = federatedInfo.expires_at;
            // Make sure expires_at is in millis
            expires_at =
                new Date(expires_at).getFullYear() === 1970
                    ? expires_at * 1000
                    : expires_at;
            var that = this;
            logger.debug('checking if federated jwt token expired');
            if (expires_at > new Date().getTime()) {
                // if not expired
                logger.debug('token not expired');
                return this._setCredentialsFromFederation({
                    provider: provider,
                    token: token,
                    user: user,
                    identity_id: identity_id,
                    expires_at: expires_at,
                });
            }
            else {
                // if refresh handler exists
                if (that._refreshHandlers[provider] &&
                    typeof that._refreshHandlers[provider] === 'function') {
                    logger.debug('getting refreshed jwt token from federation provider');
                    return this._providerRefreshWithRetry({
                        refreshHandler: that._refreshHandlers[provider],
                        provider: provider,
                        user: user,
                    });
                }
                else {
                    logger.debug('no refresh handler for provider:', provider);
                    this.clear();
                    return Promise.reject('no refresh handler for provider');
                }
            }
        };
        CredentialsClass.prototype._providerRefreshWithRetry = function (_a) {
            var _this = this;
            var refreshHandler = _a.refreshHandler, provider = _a.provider, user = _a.user;
            var MAX_DELAY_MS = 10 * 1000;
            // refreshHandler will retry network errors, otherwise it will
            // return NonRetryableError to break out of jitteredExponentialRetry
            return jitteredExponentialRetry(refreshHandler, [], MAX_DELAY_MS)
                .then(function (data) {
                logger.debug('refresh federated token sucessfully', data);
                return _this._setCredentialsFromFederation({
                    provider: provider,
                    token: data.token,
                    user: user,
                    identity_id: data.identity_id,
                    expires_at: data.expires_at,
                });
            })
                .catch(function (e) {
                var isNetworkError = typeof e === 'string' &&
                    e.toLowerCase().lastIndexOf('network error', e.length) === 0;
                if (!isNetworkError) {
                    _this.clear();
                }
                logger.debug('refresh federated token failed', e);
                return Promise.reject('refreshing federation token failed: ' + e);
            });
        };
        CredentialsClass.prototype._isExpired = function (credentials) {
            if (!credentials) {
                logger.debug('no credentials for expiration check');
                return true;
            }
            logger.debug('are these credentials expired?', credentials);
            var ts = Date.now();
            /* returns date object.
                https://github.com/aws/aws-sdk-js-v3/blob/v1.0.0-beta.1/packages/types/src/credentials.ts#L26
            */
            var expiration = credentials.expiration;
            return expiration.getTime() <= ts;
        };
        CredentialsClass.prototype._isPastTTL = function () {
            return this._nextCredentialsRefresh <= Date.now();
        };
        CredentialsClass.prototype._setCredentialsForGuest = function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, identityPoolId, region, mandatorySignIn, identityId, e_1, cognitoClient, credentials, cognitoIdentityParams, credentialsProvider;
                var _this = this;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            logger.debug('setting credentials for guest');
                            _a = this._config, identityPoolId = _a.identityPoolId, region = _a.region, mandatorySignIn = _a.mandatorySignIn;
                            if (mandatorySignIn) {
                                return [2 /*return*/, Promise.reject('cannot get guest credentials when mandatory signin enabled')];
                            }
                            if (!identityPoolId) {
                                logger.debug('No Cognito Identity pool provided for unauthenticated access');
                                return [2 /*return*/, Promise.reject('No Cognito Identity pool provided for unauthenticated access')];
                            }
                            if (!region) {
                                logger.debug('region is not configured for getting the credentials');
                                return [2 /*return*/, Promise.reject('region is not configured for getting the credentials')];
                            }
                            identityId = undefined;
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this._storageSync];
                        case 2:
                            _b.sent();
                            identityId = this._storage.getItem('CognitoIdentityId-' + identityPoolId);
                            this._identityId = identityId;
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _b.sent();
                            logger.debug('Failed to get the cached identityId', e_1);
                            return [3 /*break*/, 4];
                        case 4:
                            cognitoClient = new CognitoIdentityClient({
                                region: region,
                                customUserAgent: getAmplifyUserAgent(),
                            });
                            credentials = undefined;
                            if (identityId) {
                                cognitoIdentityParams = {
                                    identityId: identityId,
                                    client: cognitoClient,
                                };
                                credentials = fromCognitoIdentity(cognitoIdentityParams)();
                            }
                            else {
                                credentialsProvider = function () { return __awaiter(_this, void 0, void 0, function () {
                                    var IdentityId, cognitoIdentityParams, credentialsFromCognitoIdentity;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, cognitoClient.send(new GetIdCommand({
                                                    IdentityPoolId: identityPoolId,
                                                }))];
                                            case 1:
                                                IdentityId = (_a.sent()).IdentityId;
                                                this._identityId = IdentityId;
                                                cognitoIdentityParams = {
                                                    client: cognitoClient,
                                                    identityId: IdentityId,
                                                };
                                                credentialsFromCognitoIdentity = fromCognitoIdentity(cognitoIdentityParams);
                                                return [2 /*return*/, credentialsFromCognitoIdentity()];
                                        }
                                    });
                                }); };
                                credentials = credentialsProvider().catch(function (err) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        throw err;
                                    });
                                }); });
                            }
                            return [2 /*return*/, this._loadCredentials(credentials, 'guest', false, null)
                                    .then(function (res) {
                                    return res;
                                })
                                    .catch(function (e) { return __awaiter(_this, void 0, void 0, function () {
                                    var credentialsProvider;
                                    var _this = this;
                                    return __generator(this, function (_a) {
                                        // If identity id is deleted in the console, we make one attempt to recreate it
                                        // and remove existing id from cache.
                                        if (e.name === 'ResourceNotFoundException' &&
                                            e.message === "Identity '" + identityId + "' not found.") {
                                            logger.debug('Failed to load guest credentials');
                                            this._storage.removeItem('CognitoIdentityId-' + identityPoolId);
                                            credentialsProvider = function () { return __awaiter(_this, void 0, void 0, function () {
                                                var IdentityId, cognitoIdentityParams, credentialsFromCognitoIdentity;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, cognitoClient.send(new GetIdCommand({
                                                                IdentityPoolId: identityPoolId,
                                                            }))];
                                                        case 1:
                                                            IdentityId = (_a.sent()).IdentityId;
                                                            this._identityId = IdentityId;
                                                            cognitoIdentityParams = {
                                                                client: cognitoClient,
                                                                identityId: IdentityId,
                                                            };
                                                            credentialsFromCognitoIdentity = fromCognitoIdentity(cognitoIdentityParams);
                                                            return [2 /*return*/, credentialsFromCognitoIdentity()];
                                                    }
                                                });
                                            }); };
                                            credentials = credentialsProvider().catch(function (err) { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    throw err;
                                                });
                                            }); });
                                            return [2 /*return*/, this._loadCredentials(credentials, 'guest', false, null)];
                                        }
                                        else {
                                            return [2 /*return*/, e];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        CredentialsClass.prototype._setCredentialsFromFederation = function (params) {
            var provider = params.provider, token = params.token, identity_id = params.identity_id;
            var domains = {
                google: 'accounts.google.com',
                facebook: 'graph.facebook.com',
                amazon: 'www.amazon.com',
                developer: 'cognito-identity.amazonaws.com',
            };
            // Use custom provider url instead of the predefined ones
            var domain = domains[provider] || provider;
            if (!domain) {
                return Promise.reject('You must specify a federated provider');
            }
            var logins = {};
            logins[domain] = token;
            var _a = this._config, identityPoolId = _a.identityPoolId, region = _a.region;
            if (!identityPoolId) {
                logger.debug('No Cognito Federated Identity pool provided');
                return Promise.reject('No Cognito Federated Identity pool provided');
            }
            if (!region) {
                logger.debug('region is not configured for getting the credentials');
                return Promise.reject('region is not configured for getting the credentials');
            }
            var cognitoClient = new CognitoIdentityClient({
                region: region,
                customUserAgent: getAmplifyUserAgent(),
            });
            var credentials = undefined;
            if (identity_id) {
                var cognitoIdentityParams = {
                    identityId: identity_id,
                    logins: logins,
                    client: cognitoClient,
                };
                credentials = fromCognitoIdentity(cognitoIdentityParams)();
            }
            else {
                var cognitoIdentityParams = {
                    logins: logins,
                    identityPoolId: identityPoolId,
                    client: cognitoClient,
                };
                credentials = fromCognitoIdentityPool(cognitoIdentityParams)();
            }
            return this._loadCredentials(credentials, 'federated', true, params);
        };
        CredentialsClass.prototype._setCredentialsFromSession = function (session) {
            var _this = this;
            logger.debug('set credentials from session');
            var idToken = session.getIdToken().getJwtToken();
            var _a = this._config, region = _a.region, userPoolId = _a.userPoolId, identityPoolId = _a.identityPoolId;
            if (!identityPoolId) {
                logger.debug('No Cognito Federated Identity pool provided');
                return Promise.reject('No Cognito Federated Identity pool provided');
            }
            if (!region) {
                logger.debug('region is not configured for getting the credentials');
                return Promise.reject('region is not configured for getting the credentials');
            }
            var key = 'cognito-idp.' + region + '.amazonaws.com/' + userPoolId;
            var logins = {};
            logins[key] = idToken;
            var cognitoClient = new CognitoIdentityClient({
                region: region,
                customUserAgent: getAmplifyUserAgent(),
            });
            /*
                Retreiving identityId with GetIdCommand to mimic the behavior in the following code in aws-sdk-v3:
                https://git.io/JeDxU

                Note: Retreive identityId from CredentialsProvider once aws-sdk-js v3 supports this.
            */
            var credentialsProvider = function () { return __awaiter(_this, void 0, void 0, function () {
                var IdentityId, cognitoIdentityParams, credentialsFromCognitoIdentity;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, cognitoClient.send(new GetIdCommand({
                                IdentityPoolId: identityPoolId,
                                Logins: logins,
                            }))];
                        case 1:
                            IdentityId = (_a.sent()).IdentityId;
                            this._identityId = IdentityId;
                            cognitoIdentityParams = {
                                client: cognitoClient,
                                logins: logins,
                                identityId: IdentityId,
                            };
                            credentialsFromCognitoIdentity = fromCognitoIdentity(cognitoIdentityParams);
                            return [2 /*return*/, credentialsFromCognitoIdentity()];
                    }
                });
            }); };
            var credentials = credentialsProvider().catch(function (err) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw err;
                });
            }); });
            return this._loadCredentials(credentials, 'userPool', true, null);
        };
        CredentialsClass.prototype._loadCredentials = function (credentials, source, authenticated, info) {
            var _this = this;
            var that = this;
            var identityPoolId = this._config.identityPoolId;
            return new Promise(function (res, rej) {
                credentials
                    .then(function (credentials) { return __awaiter(_this, void 0, void 0, function () {
                    var user, provider, token, expires_at, identity_id, e_2;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                logger.debug('Load credentials successfully', credentials);
                                if (this._identityId && !credentials.identityId) {
                                    credentials['identityId'] = this._identityId;
                                }
                                that._credentials = credentials;
                                that._credentials.authenticated = authenticated;
                                that._credentials_source = source;
                                that._nextCredentialsRefresh = new Date().getTime() + CREDENTIALS_TTL;
                                if (source === 'federated') {
                                    user = Object.assign({ id: this._credentials.identityId }, info.user);
                                    provider = info.provider, token = info.token, expires_at = info.expires_at, identity_id = info.identity_id;
                                    try {
                                        this._storage.setItem('aws-amplify-federatedInfo', JSON.stringify({
                                            provider: provider,
                                            token: token,
                                            user: user,
                                            expires_at: expires_at,
                                            identity_id: identity_id,
                                        }));
                                    }
                                    catch (e) {
                                        logger.debug('Failed to put federated info into auth storage', e);
                                    }
                                }
                                if (!(source === 'guest')) return [3 /*break*/, 4];
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, this._storageSync];
                            case 2:
                                _a.sent();
                                this._storage.setItem('CognitoIdentityId-' + identityPoolId, credentials.identityId // TODO: IdentityId is currently not returned by fromCognitoIdentityPool()
                                );
                                return [3 /*break*/, 4];
                            case 3:
                                e_2 = _a.sent();
                                logger.debug('Failed to cache identityId', e_2);
                                return [3 /*break*/, 4];
                            case 4:
                                res(that._credentials);
                                return [2 /*return*/];
                        }
                    });
                }); })
                    .catch(function (err) {
                    if (err) {
                        logger.debug('Failed to load credentials', credentials);
                        logger.debug('Error loading credentials', err);
                        rej(err);
                        return;
                    }
                });
            });
        };
        CredentialsClass.prototype.set = function (params, source) {
            if (source === 'session') {
                return this._setCredentialsFromSession(params);
            }
            else if (source === 'federation') {
                return this._setCredentialsFromFederation(params);
            }
            else if (source === 'guest') {
                return this._setCredentialsForGuest();
            }
            else {
                logger.debug('no source specified for setting credentials');
                return Promise.reject('invalid source');
            }
        };
        CredentialsClass.prototype.clear = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    this._credentials = null;
                    this._credentials_source = null;
                    logger.debug('removing aws-amplify-federatedInfo from storage');
                    this._storage.removeItem('aws-amplify-federatedInfo');
                    return [2 /*return*/];
                });
            });
        };
        /**
         * Compact version of credentials
         * @param {Object} credentials
         * @return {Object} - Credentials
         */
        CredentialsClass.prototype.shear = function (credentials) {
            return {
                accessKeyId: credentials.accessKeyId,
                sessionToken: credentials.sessionToken,
                secretAccessKey: credentials.secretAccessKey,
                identityId: credentials.identityId,
                authenticated: credentials.authenticated,
            };
        };
        return CredentialsClass;
    }());
    var Credentials = new CredentialsClass(null);
    Amplify.register(Credentials);

    /* eslint-disable */
    // WARNING: DO NOT EDIT. This file is automatically generated by AWS Amplify. It will be overwritten.

    const awsmobile = {
        "aws_project_region": "us-east-1"
    };

    Amplify.configure(awsmobile);
    const app = new App({
        target: document.body,
        props: {
            name: 'world',
        },
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
