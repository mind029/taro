export type IMonitorSetting = {
  allowNodeNames: string[]
  enableNodeMonitor: boolean
  enableApiMonitor: boolean
  enableLifecycleMonitor: boolean
  enableErrorMonitor: boolean
}

// 编译时到运行时的配置，不能放到 index.ts 中去加载，否则就会出现命名打包排除了
// 然后又 require ，出现顺序错误加载失败问题。
export const defaultMonitorSetting: IMonitorSetting = {
  /**
   * 允许触发事件的节点名称
   */
  allowNodeNames: [
    'view',
    'button',
    'text',
    'image',
  ] as string[],

  /**
   * 是否开启节点监控
   */
  enableNodeMonitor: true,

  /**
   * 是否开启 API 监控
   */
  enableApiMonitor: true,

  /**
   * 是否开启生命周期监控
   */
  enableLifecycleMonitor: true,

  /**
   * 是否开启错误监控
   */
  enableErrorMonitor: true,
}
