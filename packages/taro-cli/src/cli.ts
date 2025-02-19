import { dotenvParse, fs, patchEnv } from '@tarojs/helper'
import { Config, Kernel } from '@tarojs/service'
import * as minimist from 'minimist'
import * as path from 'path'

import customCommand from './commands/customCommand'
import { getPkgVersion } from './util'

const DISABLE_GLOBAL_CONFIG_COMMANDS = ['build', 'global-config', 'doctor', 'update', 'config']
const DEFAULT_FRAMEWORK = 'react'

export default class CLI {
  appPath: string
  constructor (appPath) {
    this.appPath = appPath || process.cwd()
  }

  run () {
    return this.parseArgs()
  }

  async parseArgs () {
    // 解析得到 cli 参数
    const args = minimist(process.argv.slice(2), {
      alias: {
        version: ['v'],
        help: ['h'],
        port: ['p'],
        resetCache: ['reset-cache'], // specially for rn, Removes cached files.
        publicPath: ['public-path'], // specially for rn, assets public path.
        bundleOutput: ['bundle-output'], // specially for rn, File name where to store the resulting bundle.
        sourcemapOutput: ['sourcemap-output'], // specially for rn, File name where to store the sourcemap file for resulting bundle.
        sourceMapUrl: ['sourcemap-use-absolute-path'], // specially for rn, Report SourceMapURL using its full path.
        sourcemapSourcesRoot: ['sourcemap-sources-root'], // specially for rn, Path to make sourcemaps sources entries relative to.
        assetsDest: ['assets-dest'], // specially for rn, Directory name where to store assets referenced in the bundle.
        envPrefix: ['env-prefix'],
      },
      boolean: ['version', 'help', 'disable-global-config'],
      default: {
        build: true,
      },
    })
    const _ = args._
    const command = _[0]
    if (command) {
      // 下面这些命令是得到预设和本次命令插件执行路径
      const appPath = this.appPath
      const presetsPath = path.resolve(__dirname, 'presets')
      const commandsPath = path.resolve(presetsPath, 'commands')
      const platformsPath = path.resolve(presetsPath, 'platforms')
      const commandPlugins = fs.readdirSync(commandsPath)
      const targetPlugin = `${command}.js`

      // 设置环境变量
      // 等效与：process.env.NODE_ENV = process.env.NODE_ENV || args.env
      process.env.NODE_ENV ||= args.env
      if (process.env.NODE_ENV === 'undefined' && (command === 'build' || command === 'inspect')) {
        process.env.NODE_ENV = (args.watch ? 'development' : 'production')
      }
      args.type ||= args.t
      if (args.type) {
        process.env.TARO_ENV = args.type
      }
      if (typeof args.plugin === 'string') {
        process.env.TARO_ENV = 'plugin'
      }
      const mode = args.mode || process.env.NODE_ENV
      // 这里解析 dotenv 以便于 config 解析时能获取 dotenv 配置信息
      const expandEnv = dotenvParse(appPath, args.envPrefix, mode)

      const disableGlobalConfig = !!(args['disable-global-config'] || DISABLE_GLOBAL_CONFIG_COMMANDS.includes(command))

      const configEnv = {
        mode,
        command,
      }
      // 2、传入项目 appPath 得到配置实例，目的是加载解析 项目 config 下的配置文件
      // 目的是加载解析 项目 this.appPath/config 下的配置文件
      // 用于加载注册用户 在 config/index.ts 里面插件、设置等等。
      const config = new Config({
        appPath: this.appPath,
        disableGlobalConfig: disableGlobalConfig
      })

      // 3、config.init() 加载 appPath/config/index.js 对应的配置文件。
      await config.init(configEnv)

      // 用于动态加载和执行 config/预设 中暴露的插件和命令等
      // 4、创建内核实例 new Kernel()，用于后续加载 预设、config中的插件等。已经控制运行流程。
      const kernel = new Kernel({
        appPath,
        presets: [
          // 默认预设
          path.resolve(__dirname, '.', 'presets', 'index.js')
        ],
        config,
        plugins: []
      })
      kernel.optsPlugins ||= []

      const initialConfig = kernel.config?.initialConfig
      // 5、把项目中 env 环境配置对象，赋值到 项目配置文件中。
      if (initialConfig) {
        initialConfig.env = patchEnv(initialConfig, expandEnv)
      }
      if (command === 'doctor') {
        kernel.optsPlugins.push('@tarojs/plugin-doctor')
      } else if (commandPlugins.includes(targetPlugin)) {
        // 执行命令的时候，判断如果不是 doctor 命令，则把 命令作为 kernel 默认插件。
        // 插件对应路径：packages/taro-cli/src/presets/commands/xxx.js
        // 举例：taro build 执行命令的时候，会执行 packages/taro-cli/src/presets/commands/build.js 文件。
        kernel.optsPlugins.push(path.resolve(commandsPath, targetPlugin))
      }

      // 7、把内置预设命令插件传递给 kernel，可以暴露给其他插件使用
      kernel.cliCommandsPath = commandsPath
      kernel.cliCommands = commandPlugins
        .filter(commandFileName => /^[\w-]+(\.[\w-]+)*\.js$/.test(commandFileName))
        .map(fileName => fileName.replace(/\.js$/, ''))

      // 8、根据 cli 命令：taro build -type=weapp 动态调用
      switch (command) {
        case 'inspect':
        case 'build': {
          // 9、taro build 构建
          let plugin
          let platform = args.type
          const { publicPath, bundleOutput, sourcemapOutput, sourceMapUrl, sourcemapSourcesRoot, assetsDest } = args

          // 针对不同的内置平台注册对应的端平台插件
          switch (platform) {
            case 'weapp':
            case 'alipay':
            case 'swan':
            case 'tt':
            case 'qq':
            case 'jd':
            case 'h5':
            case 'harmony-hybrid':
              // 10、根据构建命令参数 传入 type，kernel 动态注册对应的端平台插件。用于后续 run 时候加载。
              kernel.optsPlugins.push(`@tarojs/plugin-platform-${platform}`)
              break
            default: {
              // plugin, rn
              const platformPlugins = fs.readdirSync(platformsPath)
              const targetPlugin = `${platform}.js`
              if (platformPlugins.includes(targetPlugin)) {
                kernel.optsPlugins.push(path.resolve(platformsPath, targetPlugin))
              }
              break
            }
          }
          // 11、根据 appPath/config/index.js 中 framework 字段，动态注册对应的端平台框架插件。
          const framework = kernel.config?.initialConfig.framework || DEFAULT_FRAMEWORK
          const frameworkMap = {
            vue: '@tarojs/plugin-framework-vue2',
            vue3: '@tarojs/plugin-framework-vue3',
            react: '@tarojs/plugin-framework-react',
            preact: '@tarojs/plugin-framework-react',
            nerv: '@tarojs/plugin-framework-react',
          }
          if (frameworkMap[framework]) {
            kernel.optsPlugins.push(frameworkMap[framework])
          }

          // 12、 判断是额外否有插件参数
          if (typeof args.plugin === 'string') {
            plugin = args.plugin
            platform = 'plugin'
            kernel.optsPlugins.push(path.resolve(platformsPath, 'plugin.js'))
            if (plugin === 'weapp' || plugin === 'alipay' || plugin === 'jd') {
              kernel.optsPlugins.push(`@tarojs/plugin-platform-${plugin}`)
            }
          }

          // 传递 inspect 参数即可
          if (command === 'inspect') {
            customCommand(command, kernel, args)
            break
          }

          // 13、customCommand 执行命令函数
          customCommand(command, kernel, {
            _,
            platform,
            plugin,
            isWatch: Boolean(args.watch),
            // Note: 是否把 Taro 组件编译为原生自定义组件
            isBuildNativeComp: _[1] === 'native-components',
            // Note: 新的混合编译模式，支持把组件单独编译为原生组件
            newBlended: Boolean(args['new-blended']),
            // Note: 是否禁用编译
            withoutBuild: !args.build,
            port: args.port,
            env: args.env,
            deviceType: args.platform,
            resetCache: !!args.resetCache,
            publicPath,
            bundleOutput,
            sourcemapOutput,
            sourceMapUrl,
            sourcemapSourcesRoot,
            assetsDest,
            qr: !!args.qr,
            blended: Boolean(args.blended),
            h: args.h
          })
          break
        }
        case 'init': {
          customCommand(command, kernel, {
            _,
            appPath,
            projectName: _[1] || args.name,
            description: args.description,
            typescript: args.typescript,
            framework: args.framework,
            compiler: args.compiler,
            npm: args.npm,
            templateSource: args['template-source'],
            clone: !!args.clone,
            template: args.template,
            css: args.css,
            h: args.h
          })
          break
        }
        default:
          customCommand(command, kernel, args)
          break
      }
    } else {
      if (args.h) {
        console.log('Usage: taro <command> [options]')
        console.log()
        console.log('Options:')
        console.log('  -v, --version       output the version number')
        console.log('  -h, --help          output usage information')
        console.log()
        console.log('Commands:')
        console.log('  init [projectName]  Init a project with default templete')
        console.log('  config <cmd>        Taro config')
        console.log('  create              Create page for project')
        console.log('  build               Build a project with options')
        console.log('  update              Update packages of taro')
        console.log('  info                Diagnostics Taro env info')
        console.log('  doctor              Diagnose taro project')
        console.log('  inspect             Inspect the webpack config')
        console.log('  help [cmd]          display help for [cmd]')
      } else if (args.v) {
        console.log(getPkgVersion())
      }
    }
  }
}
