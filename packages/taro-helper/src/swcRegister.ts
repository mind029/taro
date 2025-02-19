interface ICreateSwcRegisterParam {
  only
  plugins?: [string, any][]
}

/**
 * 创建 swc 注册器
 *
 * @swc/register 允许你在运行时自动编译 JavaScript 或 TypeScript 文件，而不需要手动进行编译过程。你只需要在应用启动时通过 require('@swc/register') 引入该模块。
 *
 * 它会自动劫持 require() 方法，使得你所要求的 .ts 或 .jsx 等文件在加载时被 SWC 编译成 JavaScript。
 *
 * 举例，createSwcRegister() 调用后，后续加载 .ts 或 .jsx 等文件时，会自动被 SWC 编译成 JavaScript。
 * @example
 *
 * require('@swc/register');
 * require('./src/index.ts');
 */
export default function createSwcRegister ({ only, plugins }: ICreateSwcRegisterParam) {
  const config: Record<string, any> = {
    only: Array.from(new Set([...only])),
    jsc: {
      parser: {
        syntax: 'typescript',
        decorators: true
      },
      transform: {
        legacyDecorator: true
      }
    },
    module: {
      type: 'commonjs'
    }
  }

  if (plugins) {
    config.jsc.experimental = {
      plugins
    }
  }

  require('@swc/register')(config)
}
