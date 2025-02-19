/*i18n-enable*/
import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import './app.less'

Taro?.monitorEvent?.on?.('all', (res) => {
  console.log('monitorEvent--', res)
  // if (['api', 'http', 'click'].includes(res.eventType)) {
  // }
})


const helloFn = (value?: string) => {
  return value as any
}

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    const carInfo: any = {}
    const a = `${carInfo?.licenseIssueDate?.year}-${carInfo?.licenseIssueDate?.month}`
    const b = Math.random() > 0.5 ? `${helloFn(carInfo?.licenseIssueDate?.year)}` : '--'

    const user: any = {}
    const c = `${user?.name}`            // a?.b
    const d = `${user?.['name']}`        // a?.['b']
    const e = `${helloFn(carInfo?.licenseIssueDate?.year)?.name}`       // a()?.b
    const f = `${user?.getName?.()}`     // a?.b?.()
    const g = `${carInfo?.license?.date?.getFullYear()}` // 深层可选链

    console.log('init', a)
  })

  // children 是将要会渲染的页面
  return children
}

export default App
