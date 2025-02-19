import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

export default function Index() {


  useDidShow(() => {
    console.log('页面3 onShow')
    Taro.showToast({
      title: '页面3 onShow',
      icon: 'none'
    })
  })

  return (
    <View className="index">
      <Text>页面3</Text>

      <Button type='default' onClick={() => {
        Taro.navigateTo({
          url: '/pages/index4/index'
        })
      }}>跳转页面4</Button>
    </View>
  )
}
