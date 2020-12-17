import Vue from './Vue';

Vue.prototype.$on = function (event, fn) {
    let vm = this;

    if (Array.isArray(event)) {
        for (let i = 0, l = event.length; i < l; i++) {
            this.$on(evnet[i], fn);
        }
    } else {
        (vm._events[event] || (vm._events[event] = [])).push(fn);
    }

    return vm;
}

Vue.prototype.$off = function (event, fn) {
    let vm = this;

    if (!arguments.length) {
        vm._events = Object.create(null);
        return vm;
    }

    if (Array.isArray(event)) {
        for (let i = 0, l = event.length; i < l; i++) {
            this.$off(evnet[i], fn);
        }
        return vm;
    }

    let cbs = vm._events[event];
    if (!cbs) {
        return vm;
    }
    if (arguments.length === 1) {
        vm._events[event] = Object.create(null);
        return vm;
    }

    if (fn) {
        const cbs = vm._events[event];
        let cb;
        let i = cbs.length;

        while (i--) {
            cb = cbs[i];
            if (cb === fn || cb.fn === fn) {
                cbs.splice(i, 1);
                break;
            }
        }
    }

    return vm;
}


Vue.prototype.$once = function (event, fn) {
    let vm = this;

    function on() {
        vm.$off(event, fn);
        fn.apply(vm, arguments);
    }

    on.fn = fn;
    vm.$on(on, fn);

    return vm;
}

Vue.prototype.$emit = function (event) {
    let vm = this
    let args = Array.prototype.slice.call(arguments, 1);
    let cbs = vm._events[event];
    if (cbs) {
        for (let i = 0, l = cbs.length; i < l; i++) {
            try {
                cbs[i].apply(vm, args);
            } catch (e) {
                console.error(e);
            }
        }
    }

    return vm;
}