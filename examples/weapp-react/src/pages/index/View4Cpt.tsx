import { View } from "@tarojs/components"
import { useMemo } from "react"

export function View4Cpt() {
  const handleClick4 = (evt) => {
    console.log('-----------------------')
    console.log('[页面] handleClick4', evt)
  }

  const tid = useMemo(() => {
    return 'handleClick4-tid'
  }, [])

  const ddd = useMemo(() => {
    return {
      name: "mjind",
      age: 18,
      gender: "male",
      address: "beijing",
      phone: "12345678901",
      email: "mjind@example.com",
      website: "https://mjind.com",
    }
  }, [])

  return (
    <View className="click4-top" style='height: 100rpx;'>
      <View ddd={ddd}  id='click4-id' className='class1 class2' dataTid={tid} onClick={handleClick4}>点击4-1</View>
    </View>
  )
}
