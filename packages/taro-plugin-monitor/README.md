# @lx-frontend/taro-plugin-monitor

> 可以为小程序平台注入

## 版本要求

Taro 3.3+

## 安装

在 Taro 项目根目录下安装

```bash
$ npm i @lx-frontend/taro-plugin-monitor --save
```

## 使用

### 引入插件

请确保 Taro CLI 已升级至 Taro `3.3.0` 的最新版本。

修改项目 `config/index.js` 中的 plugins 配置为如下

```js
const config = {
  ...
  plugins: [
      [
        '@lx-frontend/taro-plugin-monitor',
        {
          monitor: {
            /**
             * 允许触发事件的节点名称
             */
            allowNodeNames: ['view', 'button', 'text', 'image'] as string[],

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

            /**
             * 是否开启生成 data-tid 属性
             */
            enableTid: false,
          },
        },
      ],
    ],
  ...
}
```

### 修改类型文件 `global.d.ts`

在 taro 项目 `global.d.ts`，增加类型，以便在 Taro api 上增加监控回调属性 `Taro.monitorEvent`

```ts
/// <reference types="@tarojs/taro" />
// 新增
/// <reference types="@lx-frontend/taro-plugin-monitor/types/index.d.ts" />

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.sass';
declare module '*.styl';

declare namespace NodeJS {
  interface ProcessEnv {
    /** NODE 内置环境变量, 会影响到最终构建生成产物 */
    NODE_ENV: 'development' | 'production',
    /** 当前构建的平台 */
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'h5' | 'rn' | 'tt' | 'quickapp' | 'qq' | 'jd'
    /**
     * 当前构建的小程序 appid
     * @description 若不同环境有不同的小程序，可通过在 env 文件中配置环境变量`TARO_APP_ID`来方便快速切换 appid， 而不必手动去修改 dist/project.config.json 文件
     * @see https://taro-docs.jd.com/docs/next/env-mode-config#特殊环境变量-taro_app_id
     */
    TARO_APP_ID: string
  }
}
```

### 在 Taro 项目 src/app.ts 增加监控回调

```ts
import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import './app.less'

// 事件监听
Taro.monitorEvent.on('all', (res) => {
  console.log('monitorEvent', res)
})

function App({ children }: PropsWithChildren<any>) {

  useLaunch(() => {
    console.log('App launched.')
  })

  // children 是将要会渲染的页面
  return children
}

export default App
```

## TODO

- [ ] 增加 spm 支持
