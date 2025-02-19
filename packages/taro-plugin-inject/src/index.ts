
import { esbuild } from '@tarojs/helper'
import { isArray, isFunction, isObject, isString } from '@tarojs/shared'
import * as path from 'path'

import type { IPluginContext, TaroPlatformBase } from '@tarojs/service'

type VoidComponents = Set<string>
type NestElements = Map<string, number>

export interface IOptions {
  /**
   * 设置组件是否可以渲染子元素
   */
  voidComponents: string[] | ((list: VoidComponents) => VoidComponents)

  /**
   * 设置组件模版的循环次数
   */
  nestElements: Record<string, number> | ((elem: NestElements) => NestElements)

  /**
   * 修改、新增组件的属性
   */
  components: Record<string, Record<string, any>>

  /**
   * 新增组件时的名称映射
   */
  componentsMap: Record<string, string>

  /**
   * 新增同步 API
   */
  syncApis: string[]

  /**
   * 新增异步 API
   */
  asyncApis: string[]

  /**
   * 设置第三方自定义组件的属性的默认值
   */
  thirdPartyComponents: Record<string, Record<string, any>>
}

export default (ctx: IPluginContext, options: IOptions) => {
  const fs = ctx.helper.fs

  ctx.registerMethod({
    name: 'onSetupClose',
    fn (platform: TaroPlatformBase) {
      const {
        // 设置组件是否可以渲染子元素
        voidComponents,
        // 设置组件模版的循环次数
        nestElements,
        // 修改、新增组件的属性
        components,
        // 新增同步 API
        syncApis,
        // 新增异步 API
        asyncApis,
        // 新增组件时的名称映射
        componentsMap,
        // 设置第三方自定义组件的属性的默认值
        thirdPartyComponents
      } = options

      const template = platform.template
      if (!template) return

      if (isArray(voidComponents)) {
        // 把数组的元素添加到 template.voidElements 的 set 集合中
        voidComponents.forEach(el => template.voidElements.add(el))
      } else if (isFunction(voidComponents)) {
        template.voidElements = voidComponents(template.voidElements)
      }


      if (isObject<NestElements>(nestElements)) {
        for (const key in nestElements) {
          template.nestElements.set(key, nestElements[key])
        }
      } else if (isFunction(nestElements)) {
        template.nestElements = nestElements(template.nestElements)
      }

      if (components || syncApis || asyncApis || componentsMap) {
        // 注入 runtime path
        // taro 支持多个 runtime：platform.runtimePath = [platform.runtimePath, injectedPath]
        // 通过这种方式，可以 动态扩展 hostConfig 和修改各种构建配置参数。
        // packages/taro-webpack5-runner/src/plugins/MiniPlugin.ts
        // runner 会把 runtimePath 传给 @taro/loader 进行处理
        // link: packages/taro-loader/src/app.ts
        injectRuntimePath(platform)

        if (components) {
          template.mergeComponents(ctx, components)
        }

        if (componentsMap) {
          injectComponentsReact(fs, platform.taroComponentsPath, componentsMap)
          platform.taroComponentsPath = `@tarojs/plugin-inject/dist/components-react`
        }

        injectComponents(fs, components)
        injectApis(fs, syncApis, asyncApis)
      }

      if (thirdPartyComponents) {
        template.mergeThirdPartyComponents(thirdPartyComponents)
      }
    }
  })
}

function injectRuntimePath (platform: TaroPlatformBase) {
  const injectedPath = `@tarojs/plugin-inject/dist/runtime`
  if (isArray(platform.runtimePath)) {
    platform.runtimePath.push(injectedPath)
  } else if (isString(platform.runtimePath)) {
    platform.runtimePath = [platform.runtimePath, injectedPath]
  }
}

function injectComponentsReact (fs, taroComponentsPath, componentsMap) {
  const filePath = path.resolve(__dirname, '../dist/components-react.js')
  fs.writeFileSync(filePath, `
export * from '${taroComponentsPath}'
${Object.keys(componentsMap).map((key) => `export const ${key} = '${componentsMap[key]}'`).join('\n')}
`)
  // 提前使用 esbuild 进行 bundle，避免 Webpack 分析过程中的错误，#13299 #14520
  const result = esbuild.buildSync({
    entryPoints: [filePath],
    bundle: true,
    write: false,
    format: 'esm',
  })
  fs.writeFileSync(filePath, result.outputFiles[0].text)
}

function injectComponents (fs, components) {
  // 重写 components
  fs.writeFileSync(path.resolve(__dirname, '../dist/components.js'), `
export const components = ${components ? JSON.stringify(components) : JSON.stringify({})};
`)
}

function injectApis (fs, syncApis, asyncApis) {
  // 重写 components
  fs.writeFileSync(path.resolve(__dirname, '../dist/apis-list.js'), `
export const noPromiseApis = new Set(${syncApis ? JSON.stringify(syncApis) : JSON.stringify([])});
export const needPromiseApis = new Set(${asyncApis ? JSON.stringify(asyncApis) : JSON.stringify([])});
`)
}
