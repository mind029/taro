import * as helper from '@tarojs/helper'
import { getPlatformType } from '@tarojs/shared'
import { EventEmitter } from 'events'
import { merge } from 'lodash'
import * as path from 'path'
import { AsyncSeriesWaterfallHook } from 'tapable'

import Plugin from './Plugin'
import { convertPluginsToObject, mergePlugins, printHelpLog, resolvePresetsOrPlugins } from './utils'
import {
  IS_ADD_HOOK,
  IS_EVENT_HOOK,
  IS_MODIFY_HOOK,
  PluginType
} from './utils/constants'

import type { Func, IProjectConfig, PluginItem } from '@tarojs/taro/types/compile'
import type Config from './Config'
import type {
  ICommand,
  IHook,
  IPaths,
  IPlatform,
  IPlugin,
  IPluginsObject,
  IPreset
} from './utils/types'

interface IKernelOptions {
  appPath: string
  config: Config
  presets?: PluginItem[]
  plugins?: PluginItem[]
}

/**
 * taro cli 命令执行控制内核类
 * 使用 tapable 插件机制，动态加载本地插件和预设，加载注册到 hooks 和 methods 中
 * 后续通过 applyPlugins 方法 和 tapable 的钩子机制，执行插件的 apply 方法。
 * https://juejin.cn/post/7055093774812184613
 */
export default class Kernel extends EventEmitter {
  appPath: string
  isWatch: boolean
  isProduction: boolean
  optsPresets: PluginItem[] | void
  optsPlugins: PluginItem[] | void
  plugins: Map<string, IPlugin>
  paths: IPaths
  extraPlugins: IPluginsObject
  globalExtraPlugins: IPluginsObject
  config: Config
  /**
   * 生成应用的配置文件
   */
  initialConfig: IProjectConfig
  initialGlobalConfig: IProjectConfig
  hooks: Map<string, IHook[]>
  methods: Map<string, Func[]>
  cliCommands: string []
  cliCommandsPath: string
  commands: Map<string, ICommand>
  platforms: Map<string, IPlatform>
  helper: any
  runOpts: any
  debugger: any

  constructor (options: IKernelOptions) {
    super()
    // this.debugger = process.env.DEBUG === 'Taro:Kernel' ? helper.createDebug('Taro:Kernel') : function () {}
    this.debugger = helper.createDebug('Taro:Kernel')
    this.appPath = options.appPath || process.cwd()
    this.optsPresets = options.presets
    // 插件
    this.optsPlugins = options.plugins

    /**
     * appPath/config/index.js 生成应用的配置文件
     */
    this.config = options.config

    /**
     * hooks 钩子，在 plugin 中调用 registerCommand、registerPlatform 都会把函数注册到 hooks Map 结构中
     */
    this.hooks = new Map()

    /**
     * ctx.registerMethod() 注册的方法，只要带上 fn 都会注册到 methods Map 结构中
     */
    this.methods = new Map()


    this.commands = new Map()

    this.platforms = new Map()
    this.initHelper()
    this.initConfig()
    this.initPaths()
  }

  initConfig () {
    // 把 config/index 等配置 copy 一份作为内核使用的副本
    this.initialConfig = this.config.initialConfig
    this.initialGlobalConfig = this.config.initialGlobalConfig
    this.debugger('initConfig', this.initialConfig)
  }

  initPaths () {
    this.paths = {
      appPath: this.appPath,
      nodeModulesPath: helper.recursiveFindNodeModules(path.join(this.appPath, helper.NODE_MODULES))
    } as IPaths
    if (this.config.isInitSuccess) {
      Object.assign(this.paths, {
        configPath: this.config.configPath,
        sourcePath: path.join(this.appPath, this.initialConfig.sourceRoot as string),
        outputPath: path.resolve(this.appPath, this.initialConfig.outputRoot as string)
      })
    }
    this.debugger(`initPaths:${JSON.stringify(this.paths, null, 2)}`)
  }

  initHelper () {
    this.helper = helper
    this.debugger('initHelper')
  }

  /**
   * 初始化预设和插件
   */
  initPresetsAndPlugins () {
    // 16、把内置预设、插件 和 appPath/config/index.js 中预设、插件合并。
    const initialConfig = this.initialConfig
    const initialGlobalConfig = this.initialGlobalConfig
    const cliAndProjectConfigPresets = mergePlugins(this.optsPresets || [], initialConfig.presets || [])()
    const cliAndProjectPlugins = mergePlugins(this.optsPlugins || [], initialConfig.plugins || [])()
    const globalPlugins = convertPluginsToObject(initialGlobalConfig.plugins || [])()
    const globalPresets = convertPluginsToObject(initialGlobalConfig.presets || [])()

    this.debugger('initPresetsAndPlugins', cliAndProjectConfigPresets, cliAndProjectPlugins)
    this.debugger('globalPresetsAndPlugins', globalPlugins, globalPresets)
    process.env.NODE_ENV !== 'test' &&

    // 17、createSwcRegister() 调用后，后续加载 .ts 或 .jsx 等文件时，会自动被 SWC 编译成 JavaScript。避免加载失败。
    helper.createSwcRegister({
      only: [
        ...Object.keys(cliAndProjectConfigPresets),
        ...Object.keys(cliAndProjectPlugins),
        ...Object.keys(globalPresets),
        ...Object.keys(globalPlugins)
      ]
    })

    this.plugins = new Map()
    this.extraPlugins = {}
    this.globalExtraPlugins = {}

    // 18、解析配置中的预设和全局中的预设，19-28 子流程
    this.resolvePresets(cliAndProjectConfigPresets, globalPresets)

    // 29、解析插件项目和全局插件，30-38 子流程
    this.resolvePlugins(cliAndProjectPlugins, globalPlugins)
  }

  /**
   * 加载预设
   *
   * @param cliAndProjectPresets 项目配置中的预设
   * @param globalPresets 全局配置中的预设
   */
  resolvePresets (cliAndProjectPresets: IPluginsObject, globalPresets: IPluginsObject) {
    // 19、解析 appPath/config/index.js 中配置的预设转换成 带 apply() 的数组数据，用于循环加载
    const resolvedCliAndProjectPresets = resolvePresetsOrPlugins(this.appPath, cliAndProjectPresets, PluginType.Preset)

    // 这个用法可以学习，while + 数组 shift 的方式。
    while (resolvedCliAndProjectPresets.length) {
      // 21、拿到统一成 apply 方法的对象，进行初始化
      this.initPreset(resolvedCliAndProjectPresets.shift()!)
    }

    // 28、同上，重复 21-27的逻辑
    const globalConfigRootPath = path.join(helper.getUserHomeDir(), helper.TARO_GLOBAL_CONFIG_DIR)
    const resolvedGlobalPresets = resolvePresetsOrPlugins(globalConfigRootPath, globalPresets, PluginType.Plugin, true)
    while (resolvedGlobalPresets.length) {
      this.initPreset(resolvedGlobalPresets.shift()!, true)
    }
  }

  /**
   * 加载插件
   *
   * @param cliAndProjectPlugins 项目配置中的插件
   * @param globalPlugins 全局配置中的插件
   */
  resolvePlugins (cliAndProjectPlugins: IPluginsObject, globalPlugins: IPluginsObject) {
    // 30、合并 kernel 初始化前的插件和配置中的插件。
    cliAndProjectPlugins = merge(this.extraPlugins, cliAndProjectPlugins)

    // 31、把插件文件路径 转换为 插件对象，即包含 apply 方法。
    const resolvedCliAndProjectPlugins = resolvePresetsOrPlugins(this.appPath, cliAndProjectPlugins, PluginType.Plugin)

    globalPlugins = merge(this.globalExtraPlugins, globalPlugins)
    const globalConfigRootPath = path.join(helper.getUserHomeDir(), helper.TARO_GLOBAL_CONFIG_DIR)
    const resolvedGlobalPlugins = resolvePresetsOrPlugins(globalConfigRootPath, globalPlugins, PluginType.Plugin, true)

    // 32、合并 kernel 插件、config配置插件、全局插件数组
    const resolvedPlugins = resolvedCliAndProjectPlugins.concat(resolvedGlobalPlugins)

    // 注册插件
    while (resolvedPlugins.length) {
      // 33、循环 initPlugin 方法
      this.initPlugin(resolvedPlugins.shift()!)
    }

    // 注册完重置
    this.extraPlugins = {}
    this.globalExtraPlugins = {}
  }

  /**
   * 加载预设，因为预设中可以包含预设和插件，存在递归 initPreset 情况。
   * @param preset
   * @param isGlobalConfigPreset
   */
  initPreset (preset: IPreset, isGlobalConfigPreset?: boolean) {
    this.debugger('initPreset', preset)
    const { id, path, opts, apply } = preset

    // 22、把路径和当前 this，创建 plugin 对象实例。
    const pluginCtx = this.initPluginCtx({ id, path, ctx: this })

    // 23、调用暴露的 apply 方法。
    // 示例：调用 src/presets/commands/build.ts 注册的函数。
    const { presets, plugins } = apply()(pluginCtx, opts) || {}

    // 注册到插件
    // 写入到 plugins 对象 this.plugins.set(plugin.id, plugin)
    this.registerPlugin(preset)
    if (Array.isArray(presets)) {
      // 递归处理
      const _presets = resolvePresetsOrPlugins(this.appPath, convertPluginsToObject(presets)(), PluginType.Preset, isGlobalConfigPreset)
      while (_presets.length) {
        this.initPreset(_presets.shift()!, isGlobalConfigPreset)
      }
    }
    if (Array.isArray(plugins)) {
      isGlobalConfigPreset
        ? (this.globalExtraPlugins = merge(this.globalExtraPlugins, convertPluginsToObject(plugins)()))
        : (this.extraPlugins = merge(this.extraPlugins, convertPluginsToObject(plugins)()))
    }
  }

  // 初始化插件
  initPlugin (plugin: IPlugin) {
    const { id, path, opts, apply } = plugin
    // 34、创建  plugin 对象实例。
    const pluginCtx = this.initPluginCtx({ id, path, ctx: this })
    this.debugger('initPlugin', plugin)

    // 35、把当前插件示例，注册到内核中
    this.registerPlugin(plugin)

    // 37、执行加载插件函数，插件函数内，就值调用 ctx.registerCommand 等等操作注册命令等等
    apply()(pluginCtx, opts)

    // 38、检查插件参数，有些注册插件带有 schema validate 函数，可以二次检查
    this.checkPluginOpts(pluginCtx, opts)
  }

  applyCliCommandPlugin (commandNames: string[] = []) {
    const existsCliCommand: string[] = []
    for (let i = 0; i < commandNames.length; i++) {
      const commandName = commandNames[i]
      const commandFilePath = path.resolve(this.cliCommandsPath, `${commandName}.js`)
      if (this.cliCommands.includes(commandName)) existsCliCommand.push(commandFilePath)
    }
    const commandPlugins = convertPluginsToObject(existsCliCommand || [])()

    // 在 resolvePresetsOrPlugins 之前，先注册 swc 注册器，避免 命令插件 中 的 .ts 或 .jsx 等文件加载失败。
    helper.createSwcRegister({ only: [...Object.keys(commandPlugins)] })
    const resolvedCommandPlugins = resolvePresetsOrPlugins(this.appPath, commandPlugins, PluginType.Plugin)
    while (resolvedCommandPlugins.length) {
      this.initPlugin(resolvedCommandPlugins.shift()!)
    }
  }

  checkPluginOpts (pluginCtx, opts) {
    if (typeof pluginCtx.optsSchema !== 'function') {
      return
    }
    this.debugger('checkPluginOpts', pluginCtx)
    const joi = require('joi')
    const schema = pluginCtx.optsSchema(joi)
    if (!joi.isSchema(schema)) {
      throw new Error(`插件${pluginCtx.id}中设置参数检查 schema 有误，请检查！`)
    }
    const { error } = schema.validate(opts)
    if (error) {
      error.message = `插件${pluginCtx.id}获得的参数不符合要求，请检查！`
      throw error
    }
  }

  /**
   * 注到插件列表中。
   * @param plugin
   */
  registerPlugin (plugin: IPlugin) {
    this.debugger('registerPlugin', plugin)
    // 检查相同文件路径是否重复，防止重复注册。
    if (this.plugins.has(plugin.id)) {
      throw new Error(`插件 ${plugin.id} 已被注册`)
    }
    // 36、把插件注册到内核中 kernel.plugins 属性中
    this.plugins.set(plugin.id, plugin)
  }

  initPluginCtx ({ id, path, ctx }: { id: string, path: string, ctx: Kernel }) {
    const pluginCtx = new Plugin({ id, path, ctx })
    const internalMethods = ['onReady', 'onStart']
    const kernelApis = [
      'appPath',
      'plugins',
      'platforms',
      'paths',
      'helper',
      'runOpts',
      'initialConfig',
      'applyPlugins',
      'applyCliCommandPlugin'
    ]
    internalMethods.forEach(name => {
      if (!this.methods.has(name)) {
        pluginCtx.registerMethod(name)
      }
    })

    // 这里我没看明白，为什么 pluginCtx 劫持？意图是啥？
    // 文档：https://docs.taro.zone/docs/plugin-custom#ctxregistermethodarg-string---name-string-fn-function--fn-function
    // 原因：就是把 注册的 methods 暴露给 ctx 来调用。这样在各个插件之间就可以调用了。
    // 举例：ctx.writeFileToDist
    return new Proxy(pluginCtx, {
      get: (target, name: string) => {
        if (this.methods.has(name)) {
          const method = this.methods.get(name)
          if (Array.isArray(method)) {
            return (...arg) => {
              method.forEach(item => {
                item.apply(this, arg)
              })
            }
          }
          return method
        }
        if (kernelApis.includes(name)) {
          return typeof this[name] === 'function' ? this[name].bind(this) : this[name]
        }
        return target[name]
      }
    })
  }

  async applyPlugins (args: string | { name: string, initialVal?: any, opts?: any }) {
    let name
    let initialVal
    let opts
    if (typeof args === 'string') {
      name = args
    } else {
      name = args.name
      initialVal = args.initialVal
      opts = args.opts
    }
    this.debugger('applyPlugins')
    this.debugger(`applyPlugins:name:${name}`)
    this.debugger(`applyPlugins:initialVal:${initialVal}`)
    this.debugger(`applyPlugins:opts:${opts}`)
    if (typeof name !== 'string') {
      throw new Error('调用失败，未传入正确的名称！')
    }
    // 40、从 hooks 去当前 name  钩子函数。如果 hooks 通过 tapable 包裹了，则直接执行，否则调用 tapable 包裹
    const hooks = this.hooks.get(name) || []
    if (!hooks.length) {
      // 避免重复初始化
      return await initialVal
    }

    // 41、创建 异步串行执行钩子。每个钩子返回一个值，并将该值传递给下一个钩子。
    const waterfall = new AsyncSeriesWaterfallHook(['arg'])
    if (hooks.length) {
      const resArr: any[] = []
      for (const hook of hooks) {
        // 注册异步钩子函数。
        waterfall.tapPromise({
          name: hook.plugin!,
          stage: hook.stage || 0,
          // @ts-ignore
          before: hook.before
        }, async arg => {
          // 43、回调 当前 hookname 对应的钩子函数，这里就是修改 ctx 和 kernel 数据了
          const res = await hook.fn(opts, arg)
          if (IS_MODIFY_HOOK.test(name) && IS_EVENT_HOOK.test(name)) {
            return res
          }
          if (IS_ADD_HOOK.test(name)) {
            resArr.push(res)
            return resArr
          }
          return null
        })
      }
    }

    // 42、执行 当前 name 对应的钩子函数。
    return await waterfall.promise(initialVal)
  }

  runWithPlatform (platform) {
    if (!this.platforms.has(platform)) {
      throw new Error(`不存在编译平台 ${platform}`)
    }
    const config = this.platforms.get(platform)!
    const withNameConfig = this.config.getConfigWithNamed(config.name, config.useConfigName)
    process.env.TARO_PLATFORM = getPlatformType(config.name, config.useConfigName)
    return withNameConfig
  }

  setRunOpts (opts) {
    this.runOpts = opts
  }

  runHelp (name: string) {
    const command = this.commands.get(name)
    const defaultOptionsMap = new Map()
    defaultOptionsMap.set('-h, --help', 'output usage information')
    let customOptionsMap = new Map()
    if (command?.optionsMap) {
      customOptionsMap = new Map(Object.entries(command?.optionsMap))
    }
    const optionsMap = new Map([...customOptionsMap, ...defaultOptionsMap])
    printHelpLog(name, optionsMap, command?.synopsisList ? new Set(command?.synopsisList) : new Set())
  }

  /**
   * 1调用 内核的 run 方法。
   *
   * @param args
   * @returns
   */
  async run (args: string | { name: string, opts?: any }) {
    // 这里采用参数归一的方方式，适配字符串，对象参数。
    let name
    let opts
    if (typeof args === 'string') {
      name = args
    } else {
      name = args.name
      opts = args.opts
    }
    this.debugger('command:run')
    this.debugger(`command:run:name:${name}`)
    this.debugger('command:runOpts')
    this.debugger(`command:runOpts:${JSON.stringify(opts, null, 2)}`)
    this.setRunOpts(opts)

    this.debugger('initPresetsAndPlugins')
    // 15、初始化操作：项目配置、项目路径信息、项目插件；执行完成之后，所有的编译插件、平台编译插件都将挂载到 Kernel实例上，供后续编译程序使用。在装载完成后，将触发 Kernel第一个钩子 - onReady。
    // 子流程：16-38
    this.initPresetsAndPlugins()

    // 39、触发 onReady 钩子，子流程：40-43
    await this.applyPlugins('onReady')

    this.debugger('command:onStart')

    // 44、触发 onStart 钩子
    await this.applyPlugins('onStart')

    if (!this.commands.has(name)) {
      throw new Error(`${name} 命令不存在`)
    }

    if (opts?.isHelp) {
      return this.runHelp(name)
    }

    // 45、如果参数 platform ，则触发 modifyRunnerOpts
    if (opts?.options?.platform) {
      opts.config = this.runWithPlatform(opts.options.platform)
      await this.applyPlugins({
        name: 'modifyRunnerOpts',
        opts: {
          opts: opts?.config
        }
      })
    }

    // 46、最后执行 传入的命令，这里是 build 命令。
    await this.applyPlugins({
      name,
      opts
    })
  }
}
