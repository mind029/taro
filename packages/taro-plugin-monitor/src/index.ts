
import { isArray, isObject, isString } from '@tarojs/shared'
import * as path from 'path'

import { type IMonitorSetting, defaultMonitorSetting } from './config'

import type { IPluginContext, TaroPlatformBase } from '@tarojs/service'

export interface IOptions {
  /**
   * 监控配置
   */
  monitor: IMonitorSetting
}

export default (ctx: IPluginContext, options: IOptions) => {
  const fs = ctx.helper.fs

  ctx.registerMethod({
    name: 'onSetupClose',
    fn (platform: TaroPlatformBase) {
      const {
        monitor
      } = options

      const template = platform.template
      if (!template) return

      if (!isObject<IMonitorSetting>(monitor)) {
        throw new Error('monitor must be an object, eq: { allowNodeNames: ["view", "button", "text", "image"], enableApiMonitor: true, enableLifecycleMonitor: true, enableErrorMonitor: true }')
      }

      // 如果配置了 enableTid，则开启生成 data-tid 属性
      // 遍历所有组件，增加 data-tid 属性，便于自动化测试
      // TODO: 后面继续研究
      // if (monitor.enableTid ?? defaultMonitorSetting.enableTid) {
      //   // Notice：当前发现部分组件对新增 data-tid 属性不友好，如果增加了自定义属性，可能导致页面渲染少一部分内容，或者属性错乱。
      //   // 'i.dataTid' 同名表示动态值，有值小程序才会渲染。
      //   template.mergeComponents(ctx, {
      //     View: {
      //       tid: 'i.tid'
      //     }
      //   })
      // }

      // 把监控配置转换成运行时配置。
      injectMonitorSetting(fs, monitor)

      // 注入 runtime path
      // taro 支持多个 runtime：platform.runtimePath = [platform.runtimePath, injectedPath]
      // 通过这种方式，可以 动态扩展 hostConfig 和修改各种构建配置参数。
      // packages/taro-webpack5-runner/src/plugins/MiniPlugin.ts
      // runner 会把 runtimePath 传给 @taro/loader 进行处理
      // link: packages/taro-loader/src/app.ts
      injectRuntimePath(platform)
    }
  })
}

function injectRuntimePath (platform: TaroPlatformBase) {
  const injectedPath = `@tarojs/taro-plugin-monitor/dist/runtime`
  if (isArray(platform.runtimePath)) {
    platform.runtimePath.push(injectedPath)
  } else if (isString(platform.runtimePath)) {
    platform.runtimePath = [platform.runtimePath, injectedPath]
  }
}

/**
 * 把编译时参数转换成运行时配置
 * @param fs 文件系统
 * @param monitorSetting 监控配置
 */
function injectMonitorSetting (fs, monitorSetting) {
  // 合并配置
  const mergedMonitorSetting = Object.assign(defaultMonitorSetting, monitorSetting)

  // 写入文件
  fs.writeFileSync(path.resolve(__dirname, '../dist/monitorSetting.js'), `
export const monitorSetting = ${JSON.stringify(mergedMonitorSetting)};
`)
}
