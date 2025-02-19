import { View, Text, Button, PageMeta, PageMetaProps } from '@tarojs/components'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'

export default function Index() {
  const [myPageStyle, setMyPageStyle] = useState<any>({})

  const list = useMemo(() => {
    // 创建200条数据，mock 一个人对象
    return Array.from({ length: 200 }, (_, index) => ({
      id: index,
      name: `name${index}`,
      age: 18 + index,
      gender: index % 2 === 0 ? 'male' : 'female',
    }))
  }, [])

  useLoad(() => {
    // console.log('[页面2] loaded.')
  })

  const dataInfo = useMemo(() => {
    return {
      dataTid: '1234567890',
    }
  }, [])

  const handleSetPageMeta = (style: string) => {
    setMyPageStyle(style)
  }

  useDidShow(() => {
    console.log('页面2 onShow')
    Taro.showToast({
      title: '页面2 onShow',
      icon: 'none',
    })
  })

  return (
    <View>
      <PageMeta pageStyle={myPageStyle} />
      <View className="index">
        <View>
          <Text>页面2</Text>

          <Button type="default" onClick={() => handleSetPageMeta('overflow-y: hidden;')}>
            更改 pageMeta1
          </Button>

          <Button type="default" onClick={() => handleSetPageMeta('overflow-y: auto;')}>
            更改 pageMeta2
          </Button>

          <Button
            trackInfo="123123123"
            dataInfo={dataInfo}
            type="default"
            onClick={() => {
              Taro.navigateTo({
                url: '/pages/index3/index',
              })
            }}
          >
            跳转页面3
          </Button>

          {/* 循环上面 list 数据 */}
          {list.map((item) => (
            <View key={item.id}>
              <Text>
                {item.name}-{item.age}-{item.gender}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
