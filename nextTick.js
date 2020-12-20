let callbakcs = [];
let pending = false;

let flushCallbacks = function() {
    pending = false;
    let copies = callbakcs.slice(0);
    callbakcs.length = 0;
    for (let i = 0, l = copies.length; i < l; i++) {
        copies[i]();
    }
}

let microtimerFunc;
let p = Promise.resolve();
microtimerFunc = () => {
    p.then(flushCallbacks);
}

let nextTick = function(cb, ctx) {
    if (cb) {
        callbakcs.push(() => {
            cb.call(ctx);
        })
    }

    // pending 为 false 时把 microTimerFunction 添加到微任务队中
    // 等待事件循环
    if (!pending) {
        pending = true;
        microtimerFunc();
    }
}