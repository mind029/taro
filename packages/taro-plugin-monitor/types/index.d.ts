/// <reference types="@tarojs/taro" />

// 扩展 Taro 的静态方法
declare namespace Taro {
  interface TaroStatic {
    monitorEvent: {
      on: (eventName: 'all', callback: (track: any) => void) => void
      off: (eventName: 'all') => void
    }
  }
}
