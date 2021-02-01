
# 请你说说 Vue 中 slot 和 slot-scope 的原理（2.6.11 深度解析）

## 前言

Vue 中的 `slot` 和 `slot-scope` 一直是一个进阶的概念，对于我们的日常的组件开发中不常接触，但是却非常强大和灵活。
在 Vue 2.6 中

1. `slot` 和 `slot-scope` 在组件内部被统一整合成了`函数`
2. 他们的渲染作用域都是`子组件`
3. 并且都能通过`this.$scopedSlots`去访问

这使得这种模式的开发体验变的更为统一，本篇文章就基于 `2.6.11` 的最新代码来解析它的原理。

对于 2.6 版本更新的插槽语法，如果你还不太了解，可以看看这篇尤大的官宣

举个简单的例子，社区有个异步流程管理的库： `vue-promised`，它的用法是这样的：

```html
<Promised :promise="usersPromise">
  <template v-slot:pending>
    <p>Loading...</p>
  </template>
  <template v-slot="data">
    <ul>
      <li v-for="user in data">{{ user.name }}</li>
    </ul>
  </template>
  <template v-slot:rejected="error">
    <p>Error: {{ error.message }}</p>
  </template>
</Promised>
```

可以看到，我们只要把一个用来处理请求的异步`promise`传递给组件，它就会自动帮我们去完成这个`promise`，并且响应式的对外抛出`pending`，`rejected`，和异步执行成功后的数据 `data`。

这可以大大简化我们的异步开发体验，原本我们要手动执行这个`promise`，手动管理状态处理错误等等……

而这一切强大的功能都得益于Vue 提供的`slot-scope`功能，它在封装的灵活性上甚至有点接近于`Hook`，组件甚至可以完全不关心`UI`渲染，只帮助父组件管理一些`状态`。

## 类比 React

如果你有 `React` 的开发经验，其实这就类比 `React` 中的 `renderProps` 去理解就好了。（如果你没有 `React` 开发经验，请跳过）

```js
import React from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

// 这是一个对外提供鼠标位置的 render props 组件
class Mouse extends React.Component {
  state = { x: 0, y: 0 }

  handleMouseMove = (event) => {
    this.setState({
      x: event.clientX,
      y: event.clientY
    })
  }

  render() {
    return (
      <div style={{ height: '100%' }} onMouseMove={this.handleMouseMove}>
        // 这里把 children 当做函数执行，来对外提供子组件内部的 state
        {this.props.children(this.state)}
      </div>
    )
  }
}

class App extends React.Component {
  render() {
    return (
      <div style={{ height: '100%' }}>
        // 这里就很像 Vue 的 作用域插槽
        <Mouse>
         ({ x, y }) => (
           // render prop 给了我们所需要的 state 来渲染我们想要的
           <h1>The mouse position is ({x}, {y})</h1>
         )
        </Mouse>
      </div>
    )
  }
})

ReactDOM.render(<App/>, document.getElementById('app'))
```

## 原理解析

### 初始化

对于这样的一个例子来说

```html
<test>

  <!--具名插槽-->
  <template v-slot:bar>
    <span>Hello</span>
  </template>

  <!--作用域插槽-->
  <template v-slot:foo="prop">
    <span>{{prop.msg}}</span>
  </template>
</test>
```

这段模板会被编译成这样：

```js
with (this) {
  return _c("test", {
    scopedSlots: _u([
      {
        key: "bar",
        fn: function () {
          return [_c("span", [_v("Hello")])];
        },
      },
      {
        key: "foo",
        fn: function (prop) {
          return [_c("span", [_v(_s(prop.msg))])];
        },
      },
    ])
  });
}
```

然后经过初始化时的一系列处理（`resolveScopedSlots`, `normalizeScopedSlots`） `test` 组件的实例 `this.$scopedSlots` 就可以访问到这两个 `foo` 、 `bar` 函数。（如果未命名的话，`key` 会是 `default` 。）

进入 `test` 组件内部，假设它是这样定义的：

```html
<div>
  <slot name="bar"></slot>
  <slot name="foo" v-bind="{ msg }"></slot>
</div>
<script>
  new Vue({
    name: "test",
    data() {
      return {
        msg: "World",
      };
    },
    mounted() {
      // 一秒后更新
      setTimeout(() => {
        this.msg = "Changed";
      }, 1000);
    },
  });
</script>
```

那么 `template` 就会被编译为这样的函数：

```js
with (this) {
  return _c("div", [ _t("bar"), _t("foo", null, null, { msg }) ], 2);
}
```

已经有那么些端倪了，接下来就研究一下 `_t` 函数的实现，就可以接近真相了。

`_t` 也就是 `renderSlot` 的别名，简化后的实现是这样的：

```TS
export function renderSlot (
  name: string,
  fallback: ?Array<VNode>,
  props: ?Object,
  bindObject: ?Object
): ?Array<VNode> {
  // 通过 name 拿到函数
  const scopedSlotFn = this.$scopedSlots[name]
  let nodes
  if (scopedSlotFn) { // scoped slot
    props = props || {}
    // 执行函数返回 vnode
    nodes = scopedSlotFn(props) || fallback
  }
  return nodes
}
```

其实很简单，

如果是 `普通插槽`，就直接调用函数生成 `vnode`，如果是 `作用域插槽`，

就直接带着 `props` 也就是 `{ msg }` 去调用函数生成 `vnode`。 2.6 版本后统一为函数的插槽降低了很多心智负担。

### 更新

在上面的 `test` 组件中， `1s` 后我们通过 `this.msg = "Changed"`; 触发响应式更新，此时编译后的 `render` 函数：

```JS
with (this) {
  return _c("div", [_t("bar"), _t("foo", null, null, { msg })], 2);
}
```

重新执行，此时的 `msg` 已经是更新后的 `Changed` 了，自然也就实现了更新。

一种特殊情况是，在父组件的作用域里也使用了响应式的属性并更新，比如这样：

```html
<test>
  <template v-slot:bar>
    <span>Hello {{msgInParent}}</span>
  </template>
  <template v-slot:foo="prop">
    <span>{{prop.msg}}</span>
  </template>
</test>
<script>
  new Vue({
    name: "App",
    el: "#app",
    mounted() {
      setTimeout(() => {
        this.msgInParent = "Changed";
      }, 1000);
    },
    data() {
      return {
        msgInParent: "msgInParent",
      };
    },
    components: {
      test: {
        name: "test",
        data() {
          return {
            msg: "World",
          };
        },
        template: `
          <div>
            <slot name="bar"></slot>
            <slot name="foo" v-bind="{ msg }"></slot>
          </div>
        `,
      },
    },
  });
</script>
```

其实，是因为执行 `_t` 函数时，全局的组件渲染上下文是 `子组件`，那么依赖收集自然也就是收集到 `子组件`的依赖了。所以在 `msgInParent` 更新后，其实是直接去触发子组件的重新渲染的，对比 2.5 的版本，这是一个优化。

那么还有一些额外的情况，比如说 `template` 上有 `v-if`、 `v-for` 这种情况，举个例子来说：

```html
<test>
  <template v-slot:bar v-if="show">
    <span>Hello</span>
  </template>
</test>
```

```js
function render() {
  with(this) {
    return _c('test', {
      scopedSlots: _u([(show) ? {
        key: "bar",
        fn: function () {
          return [_c('span', [_v("Hello")])]
        },
        proxy: true
      } : null], null, true)
    })
  }
}
```

注意这里的 `_u` 内部直接是一个三元表达式，读取 `_u` 是发生在父组件的 `_render` 中，那么此时子组件是收集不到这个 `show` 的依赖的，所以说 `show` 的更新只会触发父组件的更新，那这种情况下子组件是怎么重新执行 `$scopedSlot` 函数并重渲染的呢？

我们已经有了一定的前置知识：Vue的更新粒度，知道 `Vue` 的组件不是`递归更新`的，但是 `slotScopes` 的函数执行是发生在子组件内的，父组件在更新的时候一定是有某种方式去通知子组件也进行更新。

其实这个过程就发生在父组件的重渲染的 `patchVnode`中，到了 `test` 组件的 `patch` 过程，进入了 `updateChildComponent` 这个函数后，会去检查它的 `slot` 是否是稳定的，显然 `v-if` 控制的 `slot` 是非常不稳定的。

```js
  const newScopedSlots = parentVnode.data.scopedSlots
  const oldScopedSlots = vm.$scopedSlots
  const hasDynamicScopedSlot = !!(
    (newScopedSlots && !newScopedSlots.$stable) ||
    (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) ||
    (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key)
  )

  // Any static slot children from the parent may have changed during parent's
  // update. Dynamic scoped slots may also have changed. In such cases, a forced
  // update is necessary to ensure correctness.
  const needsForceUpdate = !!hasDynamicScopedSlot
  
  if (needsForceUpdate) {
    // 这里的 vm 对应 test 也就是子组件的实例，相当于触发了子组件强制渲染。
    vm.$forceUpdate()
  }
```

这里有一些优化措施，并不是说只要有 `slotScope` 就会去触发子组件强制更新。

有如下三种情况会强制触发子组件更新：

1. `scopedSlots` 上的 `$stable` 属性为 `false`

一路追寻这个逻辑，最终发现这个 `$stable` 是 `_u` 也就是 `resolveScopedSlots` 函数的第三个参数决定的，由于这个 `_u` 是由编译器生成 `render` 函数时生成的的，那么就到 `codegen` 的逻辑中去看：

```js
  let needsForceUpdate = el.for || Object.keys(slots).some(key => {
    const slot = slots[key]
    return (
      slot.slotTargetDynamic ||
      slot.if ||
      slot.for ||
      containsSlotChild(slot) // is passing down slot from parent which may be dynamic
    )
  })
```

简单来说，就是用到了一些动态语法的情况下，就会通知子组件对这段 `scopedSlots` 进行强制更新。

2. 也是 `$stable` 属性相关，旧的 `scopedSlots` 不稳定

这个很好理解，旧的 `scopedSlots` 需要强制更新，那么渲染后一定要强制更新。

3. 旧的 `$key` 不等于新的 `$key`

这个逻辑比较有意思，一路追回去看 `$key` 的生成，可以看到是 `_u` 的第四个参数 `contentHashKey`，这个`contentHashKey` 是在 `codegen` 的时候利用 `hash` 算法对生成代码的字符串进行计算得到的，也就是说，这串函数的生成的 `字符串` 改变了，就需要强制更新子组件。

```js
function hash(str) {
  let hash = 5381
  let i = str.length
  while(i) {
    hash = (hash * 33) ^ str.charCodeAt(--i)
  }
  return hash >>> 0
}
```

`作者：ssh_晨曦时梦见兮
链接：https://juejin.cn/post/6844904115886096392
来源：掘金
著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。`