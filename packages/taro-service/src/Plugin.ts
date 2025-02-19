import { addPlatforms } from '@tarojs/helper'

import type { Func } from '@tarojs/taro/types/compile'
import type Kernel from './Kernel'
import type { ICommand, IHook, IPlatform } from './utils/types'

export default class Plugin {
  id: string
  path: string
  ctx: Kernel
  optsSchema: Func

  constructor (opts) {
    this.id = opts.id
    this.path = opts.path
    this.ctx = opts.ctx
  }

  /**
   * 注册 hook
   *
   * @param hook
   */
  register (hook: IHook) {
    if (typeof hook.name !== 'string') {
      throw new Error(`插件 ${this.id} 中注册 hook 失败， hook.name 必须是 string 类型`)
    }
    if (typeof hook.fn !== 'function') {
      throw new Error(`插件 ${this.id} 中注册 hook 失败， hook.fn 必须是 function 类型`)
    }
    // 26、获取当前插件中 hooks，用于合并 hooks
    const hooks = this.ctx.hooks.get(hook.name) || []
    // 这个 id 就是 fPath，也就是插件的绝对路径。
    hook.plugin = this.id
    // 27、写入到同名的 hooks 中，这里是 build。
    this.ctx.hooks.set(hook.name, hooks.concat(hook))
  }

  /**
   * 注册命令
   *
   * @param command
   */
  registerCommand (command: ICommand) {
    if (this.ctx.commands.has(command.name)) {
      throw new Error(`命令 ${command.name} 已存在`)
    }
    // 25、写入到当前插件实例 ctx.commands 中，用于后续避免不同插件重复注册同名命令
    this.ctx.commands.set(command.name, command)
    //   { name: 'build', fn: () => {}}
    this.register(command)
  }

  /**
   * 注册平台
   *
   * @param platform
   */
  registerPlatform (platform: IPlatform) {
    if (this.ctx.platforms.has(platform.name)) {
      throw new Error(`适配平台 ${platform.name} 已存在`)
    }
    // // eslint-disable-next-line dot-notation
    // 写是写入到 全局 global 对象中。
    addPlatforms(platform.name)
    this.ctx.platforms.set(platform.name, platform)
    this.register(platform)
  }

  /**
   * 注册方法
   *
   * @param args
   */
  registerMethod (...args) {
    const { name, fn } = processArgs(args)
    const methods = this.ctx.methods.get(name) || []
    // 写入到 hooks 中，用于后续 applyPlugins 调用
    methods.push(fn || function (fn: Func) {
      this.register({
        name,
        fn
      })
    }.bind(this))
    this.ctx.methods.set(name, methods)
  }

  /**
   * 添加插件选项 schema
   *
   * @param schema
   */
  addPluginOptsSchema (schema) {
    this.optsSchema = schema
  }
}

function processArgs (args) {
  let name, fn
  if (!args.length) {
    throw new Error('参数为空')
  } else if (args.length === 1) {
    if (typeof args[0] === 'string') {
      name = args[0]
    } else {
      name = args[0].name
      fn = args[0].fn
    }
  } else {
    name = args[0]
    fn = args[1]
  }
  return { name, fn }
}
