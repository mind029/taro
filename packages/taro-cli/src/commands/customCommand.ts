import { Kernel } from '@tarojs/service'

/**
 * 通过 kernel 执行命令
 * @param command 执行命令 名称，对应 presets/commands 中的命令名称
 * @param kernel 内核
 * @param args 命令行参数
 */
export default function customCommand (
  command: string,
  kernel: Kernel,
  args: { _: string[], [key: string]: any }
) {
  if (typeof command === 'string') {
    const options: any = {}
    const excludeKeys = ['_', 'version', 'v', 'help', 'h', 'disable-global-config']
    Object.keys(args).forEach(key => {
      if (!excludeKeys.includes(key)) {
        options[key] = args[key]
      }
    })

    // 14、调用 kernel.run() 运行命令
    kernel.run({
      name: command,
      opts: {
        _: args._,
        options,
        isHelp: args.h
      }
    })
  }
}
