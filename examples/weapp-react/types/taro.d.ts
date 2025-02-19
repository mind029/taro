import '@tarojs/components'

declare module '@tarojs/components' {
  interface StandardProps {
    dataInfo?: any; // ✅ 增加 dataTid 属性
    trackInfo?: any; // ✅ 增加 dataTid 属性
  }
}
