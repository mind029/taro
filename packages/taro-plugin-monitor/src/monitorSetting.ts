import { type IMonitorSetting } from './config'

// 编译时到运行时的配置，不能放到 index.ts 中去加载，否则就会出现顺序打包
// 原因是 index.ts 先 require ，在生成。所有这里把默认值 放到 config.ts 中
export const monitorSetting: Partial<IMonitorSetting> = {}