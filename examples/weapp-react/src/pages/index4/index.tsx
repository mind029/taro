import { View, Text } from '@tarojs/components'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { useMemo } from 'react'

export default function Index() {

  const list = useMemo(() => {
    // 创建200条数据，mock 一个人对象
    return Array.from({ length: 200 }, (_, index) => ({
      id: index,
      name: `name${index}`,
      age: 18 + index,
      gender: index % 2 === 0 ? 'male' : 'female'
    }))
  }, [])


  useDidShow(() => {
    console.log('页面4 onShow')
    Taro.showToast({
      title: '页面4 onShow',
      icon: 'none'
    })
  })

  return (
    <View className="index">
      <Text>页面4</Text>

      {/* 循环上面 list 数据 */}
      {list.map((item) => (
        <View key={item.id}>
          <Text>{item.name}-{item.age}-{item.gender}</Text>
        </View>
      ))}
    </View>
  )
}
