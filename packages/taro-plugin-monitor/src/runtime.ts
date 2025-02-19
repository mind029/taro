import { hooks, mergeReconciler } from '@tarojs/shared'

import {
  generateClickEvent,
  generateCustomErrorEvent,
  generateLifecycleEvent,
  monitorEvent,
  monitorTaroCalls,
  monitorWxCalls,
  triggerEvent,
} from './helper'
import { monitorSetting } from './monitorSetting'

declare let wx: any

const {
  enableLifecycleMonitor,
  enableErrorMonitor,
  enableNodeMonitor,
  enableApiMonitor,
  allowNodeNames = [],
} = monitorSetting

/**
 * 监控 Reconciler 配置
 * taro 的 hostConfig
 * @doc https://docs.taro.zone/docs/platform-plugin/how
 * @doc https://docs.taro.zone/docs/platform-plugin/reconciler
 */
const hostConfig = {
  initNativeApi (taro) {
    // 控制是否劫持 wx
    if (enableApiMonitor) {
      // 分别处理 wx 和 taro 对象
      // 这里有点看不懂，wx 对象只能通过 proxy 处理后，才能劫持到。taro 对象则是 taro['xxx'] = function() {} 方式。
      wx = monitorWxCalls(wx)
      monitorTaroCalls(taro)
    }

    // 拓展 taro 对象，增加 monitorEvent 属性
    taro.monitorEvent = monitorEvent
  },
  modifyRecursiveComponentConfig (defaultConfig) {
    hooks.tap('getLifecycle', function (instance, lifecycle: string) {
      const rawLifecycle = lifecycle
      lifecycle = lifecycle.replace(/^on(Show|Hide)$/, 'componentDid$1')

      // 特别注意：对 instance 操作只能使用 Object.assign，不能使用 ... 展开运算符
      // 原因：instance 是组件实例，展开运算符会丢失组件实例的属性
      // 比如：instance.componentDidShow = function () {，简单说就是 页面生命周期部分方法没办法触发。
      // 这样会导致 componentDidShow 被覆盖，无法正常触发
      // 所以只能使用 Object.assign 来添加新的属性
      if (enableLifecycleMonitor) {
        // 上报生命周期事件
        triggerEvent(
          generateLifecycleEvent({
            eventLevel: 'info',
            lifecycleStage: rawLifecycle as any,
            lifecycleOption: '',
          })
        )

        Object.assign(instance, {
          onLaunch: [
            function (res) {
              triggerEvent(
                generateLifecycleEvent({
                  eventLevel: 'info',
                  lifecycleStage: 'onLaunch',
                  lifecycleOption: JSON.stringify(res),
                })
              )
            },
          ],
        })
      }

      // 默认情况下，只有 生命周期相关的事件触发。
      // 这里需要把 异常事件也注册进来。
      // packages/taro-plugin-react/src/runtime/connect.ts:422 triggerAppHook
      if (enableErrorMonitor) {
        Object.assign(instance, {
          onError: [
            function (err) {
              // 这里 err 是 string
              // 上报普通异常事件
              triggerEvent(
                generateCustomErrorEvent({
                  eventLevel: 'error',
                  errType: 'error',
                  errMsg: JSON.stringify(err),
                  stackTrace: JSON.stringify(err?.stack),
                })
              )
            },
          ],
          onUnhandledRejection: [
            function (err) {
              // 上报未处理 promise 异常事件
              // 这里 err 是 object
              triggerEvent(
                generateCustomErrorEvent({
                  eventLevel: 'error',
                  errType: 'onUnhandledRejection',
                  errMsg: JSON.stringify(err?.reason?.message),
                  stackTrace: JSON.stringify(err?.reason?.stack),
                })
              )
            },
          ],
        })
      }

      return instance[lifecycle]
    })

    return defaultConfig
  },
  // 所有事件都要经过此方法
  // taro 把所有的事件都会经过 eventHandler 处理。一个点击事件中，除触发 tap、touchstart 、touchend 等等一大堆事件。
  // packages/taro-runtime/src/dsl/common.ts:282 行
  // config.eh = eventHandler
  // 这就是为什么 taro 渲染后，所有节点都有 eh 原因
  modifyTaroEvent (event, element) {
    if (!enableNodeMonitor) return
    // event 这个 event 就是 dsl 转换成给小程序结构的 事件回调 event
    // 只允许 tap 事件
    if (event?.type === 'tap' && allowNodeNames?.includes(element?.nodeName)) {
      // 可以通过 element._root 得到当前事件触发页面数据，比如 页面 url 等等
      // 可以通过 element 得到当前点击元素的信息，拿到节点的 props 完整数据。
      triggerEvent(
        generateClickEvent({
          eventLevel: 'info',
          elementText: `${event?._relatedInfo?.anchorTargetText || element?.textContent}`,
          elementName: element?.nodeName ?? '',
          elementProps: JSON.stringify(element?.props),
          elementDetail: JSON.stringify(event?.detail),
        })
      )
    }
  },
}

mergeReconciler(hostConfig)
