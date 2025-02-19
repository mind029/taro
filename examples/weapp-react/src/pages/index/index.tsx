import { View, Text, Button, Input } from '@tarojs/components'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import './index.less'
import { View4Cpt } from './View4Cpt'

const getTrackInfo = () => {
  const deviceInfo = Taro.getSystemInfoSync()
  return {
    deviceInfo
  }
}

const getRemoteConfig = async () => {
  // https://t.lxstatic.com/dos/ucma/2.31.1/custom/setting.json?r=0.6456141262552164
  const res = await Taro.request({
    url: `https://t.lxstatic.com/dos/ucma/2.31.1/custom/setting.json?r=${Date.now()}`,
  })

  console.log('getRemoteConfig res', res)
}

export default function Index() {

  const [dataInfo, setDataInfo] = useState<any>({})

  useLoad(async () => {
    await getRemoteConfig()
    setDataInfo(getTrackInfo())
  })

  useDidShow(() => {
  })

  const handleClick = () => {
    console.log('-----------------------')
    const sysInfo = Taro.getSystemInfoSync()
    console.log(sysInfo)
  }

  const handleClick2 = async () => {
    console.log('-----------------------')
    const res = await Taro.getStorageInfo({
    })

    console.log('handleClick2', res)
  }

  const handleClick3 = async () => {
    console.log('-----------------------')
    const res = await Taro.getStorageInfo()
    console.log('handleClick3', res)
  }

  const handleClick5 = async () => {
    console.log('-----------------------')
    try {
      await Taro.navigateTo({
        url: '/pages/index2/index'
      })
    } catch (err) {
      console.log('handleClick5 error', err)
    }
  }

  const handleClick6 = () => {
    console.log('-----------------------')
    throw new Error('抛出错误')
  }


  const handleClick7 = () => {
    Taro.showToast({
      title: 'showToast',
      icon: 'success',
      duration: 3000
    })
  }

  const handleClick8 = () => {
    wx.showToast({
      title: 'showToast8',
      icon: 'success',
      duration: 3000
    })
  }

  const handleClick9 = async () => {
    const res = await Taro.showModal({
      title: 'showToast9',
      content: 'showToast9',
      success: (res) => {
        console.log('handleClick9 success', res)
      },
      fail: (res) => {
        console.log('handleClick9 fail', res)
      }
    })

    console.log('handleClick9', res)
  }

  const handleClick10 = async () => {
    const res = wx.showModal({
      title: 'showToast10',
      content: 'showToast10'
    })

    console.log('handleClick101 proxy', res)
  }

  return (
    <View className='index'>
      <Text>Hello world!1111111</Text>

      <Button dataInfo={dataInfo} type='default' onClick={getRemoteConfig}>getData</Button>
      <Button dataInfo={dataInfo} type='default' onClick={handleClick}>点击11111111111111</Button>
      <Button type='default' onClick={handleClick2}>点击2</Button>
      <Button type='default' onClick={handleClick3}>点击3</Button>

      <View4Cpt />

      <Button type='default' onClick={handleClick5}>跳转到页面2</Button>
      <Button type='default' onClick={handleClick6}>抛出错误</Button>


      <View>表单组件：</View>
      <Input type='text' placeholder='将会获取焦点' focus/>

      <Button type='default' onClick={handleClick7}>showToast</Button>
      <Button type='default' onClick={handleClick8}>showToast8</Button>
      <Button type='default' onClick={handleClick9}>showModal9</Button>
      <Button type='default' onClick={handleClick10}>showModal10</Button>
    </View>
  )
}
