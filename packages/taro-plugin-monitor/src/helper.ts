import { Events } from '@tarojs/shared'

import type {
  ApiCallEvent,
  BaseEvent,
  ClickEvent,
  CustomErrorEvent,
  CustomUserEvent,
  EventLevel,
  EventType,
  HttpEvent,
  LifecycleEvent,
  TrackingEvent,
} from './type'

declare const getCurrentPages: any

let nextId = 1 // 用于生成唯一ID

/**
 * 生成唯一ID，由于不同事件触发都是异步的，用于后续上报前进行排序，保证上报顺序
 * @returns
 */
export const generateId = (): string => {
  const timestamp = Date.now()

  return `${timestamp}_${nextId++}`
}

/**
 * 获取当前页面路径
 * @returns
 */
const getCurPage = () => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]

  return page?.$taroPath || ''
}

/**
 * 生成基础信息
 * @param eventType 事件类型
 * @param eventLevel 事件级别
 * @returns
 */
export const generateBaseEvent = <T extends EventType>(eventType: T, eventLevel: EventLevel = 'info') => {
  return {
    eventId: generateId(),
    eventType,
    eventLevel,
    stime: Date.now(),
    pageUrl: getCurPage()?.split('?')?.[0] || 'home',
    fullUrl: getCurPage() || 'home'
  } satisfies BaseEvent<T>
}


/**
 * 生成点击事件
 * @param options.eventLevel 事件级别
 * @param options.elementText 元素文本
 * @param options.elementName 元素名称
 * @param options.elementProps 元素属性
 * @param options.elementDetail 元素详情
 */
export const generateClickEvent = (options: Omit<ClickEvent, keyof BaseEvent> & { eventLevel: EventLevel }) => {
  const {
    eventLevel,
    elementText,
    elementName,
    elementProps,
    elementDetail,
  } = options

  return {
    ...generateBaseEvent('click', eventLevel),
    elementText,
    elementName,
    elementProps,
    elementDetail,
  } satisfies ClickEvent
}

/**
 * 生成 API 信息
 * @param options.eventLevel 事件级别
 * @param options.apiBaseInfo 基础信息
 * @param options.apiName API 名称
 * @param options.apiArgs API 参数
 * @param options.apiStatus API 状态
 * @param options.apiResponse API 响应
 */
export const generateApiCallEvent = (options: Omit<ApiCallEvent, keyof BaseEvent | 'duration' | 'etime'> & { eventLevel: EventLevel, apiBaseInfo: BaseEvent }) => {
  const { eventLevel, apiBaseInfo, apiName, apiArgs, apiStatus, apiResponse } = options
  const etime = Date.now()

  return {
    ...apiBaseInfo,
    eventLevel,
    eventType: 'api',
    etime,
    apiName,
    apiArgs: JSON.stringify(apiArgs),
    apiStatus,
    apiResponse: JSON.stringify(apiResponse),
    duration: etime - apiBaseInfo.stime,
  } satisfies ApiCallEvent
}

/**
 * 生成 HTTP 信息
 * @param options.eventLevel 事件级别
 * @param options.httpBaseInfo 基础信息
 * @param options.otherOptions 其他选项
 * @param options.response 响应
 */
export const generateHttpEvent = <T extends EventType>(options: { eventLevel: EventLevel, httpBaseInfo: BaseEvent<T>, otherOptions: Record<string, any>, response: Record<string, any> }) => {
  const { eventLevel, httpBaseInfo, otherOptions, response } = options

  // 来自于微信 request 等网络api
  // https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html
  // TODO: 需要考虑其他网络api，比如 downloadFile、uploadFile 等
  const { method = '', url: requestUrl = '', data: params = {}, header = {}, timeout = 0 } = otherOptions || {}
  const { statusCode = '未知', data: responseData = {} } = response || {}
  const etime = Date.now()

  return {
    ...httpBaseInfo,
    eventLevel,
    eventType: 'http',
    method,
    requestUrl,
    params: JSON.stringify(params),
    headers: JSON.stringify(header),
    body: JSON.stringify(responseData),
    statusCode,
    etime,
    timeout,
    duration: etime - httpBaseInfo.stime,
  } satisfies HttpEvent
}

/**
 * 生成生命周期事件
 * @param options.eventLevel 事件级别
 * @param options.lifecycleStage 生命周期阶段
 * @param options.lifecycleOption 生命周期选项
 */
export const generateLifecycleEvent = (options: Omit<LifecycleEvent, keyof BaseEvent> & { eventLevel: EventLevel }) => {
  const { eventLevel, lifecycleStage, lifecycleOption } = options

  return {
    ...generateBaseEvent('lifecycle', eventLevel),
    lifecycleStage,
    lifecycleOption
  } satisfies LifecycleEvent
}

/**
 * 生成自定义事件
 * @param options.eventLevel 事件级别
 * @param options.customName 自定义名称
 * @param options.customData 自定义数据
 */
export const generateCustomUserEvent = (options: Omit<CustomUserEvent, keyof BaseEvent> & { eventLevel: EventLevel }) => {
  const { eventLevel, customName, customData } = options

  return {
    ...generateBaseEvent('custom', eventLevel),
    customName,
    customData
  } satisfies CustomUserEvent
}


/**
 * 生成错误事件
 * @param options.eventLevel 事件级别
 * @param options.errType 错误类型
 * @param options.errMsg 错误消息
 * @param options.stackTrace 堆栈跟踪
 * @param options.errExtraData 错误额外数据
 */
export const generateCustomErrorEvent = (options: Omit<CustomErrorEvent, keyof BaseEvent> & { eventLevel: EventLevel }) => {
  const { eventLevel, errType, errMsg, stackTrace, errExtraData } = options

  return {
    ...generateBaseEvent('error', eventLevel),
    errType,
    errMsg,
    stackTrace,
    errExtraData
  } satisfies CustomErrorEvent
}



// ===========================================以上不同类型事件数据生成辅佐函数======================================================



// 监控 event，订阅与触发
export const monitorEvent = new Events()
export const triggerEvent = (trackingEvent: TrackingEvent) => {
  monitorEvent.trigger('all', trackingEvent)
}


// 监控 event，订阅与触发
const networkProps = ['request', 'downloadFile', 'uploadFile']

/**
 * 处理 API 事件
 * @param prop 事件类型
 * @param apiBaseInfo 基础信息
 * @param otherOptions 其他选项
 * @param res 响应
 * @param apiState
 */
export const handleApiEvent = <T extends EventType>(
  prop: string,
  apiBaseInfo: BaseEvent<T>,
  otherOptions: Record<string, any> = {},
  res: Record<string, any>,
  apiState: 'success' | 'fail' | 'complete',
) => {
  try {
    if (networkProps.includes(prop)) {
      // 上报网络请求事件
      triggerEvent(
        generateHttpEvent(
          {
            eventLevel: 'info',
            httpBaseInfo: apiBaseInfo,
            otherOptions,
            response: res
          }
        )
      )
    } else {
      // 上报 API 事件
      triggerEvent(
        generateApiCallEvent(
          {
            eventLevel: 'info',
            apiBaseInfo,
            apiName: prop,
            apiArgs: otherOptions,
            apiStatus: apiState,
            apiResponse: res
          }
        )
      )
    }
  } catch (_error) {
    console.error('handleApiEvent', _error)
  }
}

/**
 * wx 对象 和 taro 对象构造监控函数
 * @param target
 * @param prop
 * @param originalMethod
 */
export const creatorMonitorHandler = (target: Record<string, any>, prop: string, originalMethod: any) => {
  return function (...args: any[]) {
    const [options, ...restArgs] = args

    // 传统 API 和网络 API 有不同数据结构
    const eventType = networkProps.includes(prop) ? 'http' : 'api'
    const apiBaseInfo = generateBaseEvent(eventType, 'info')
    const { success, fail, complete, ...otherOptions } = options || {}

    // 处理有 success 和 fail 、complete 的情况
    if (typeof options === 'object' && (success || fail || complete)) {
      const obj: Record<string, any> = Object.assign({}, options)
      if (typeof success === 'function') {
        obj.success = function (...callbackArgs: any[]) {
          handleApiEvent(prop, apiBaseInfo, otherOptions, callbackArgs?.[0], 'success')
          success.apply?.(target, callbackArgs)
        }
      }

      if (typeof fail === 'function') {
        obj.fail = function (...callbackArgs: any[]) {
          handleApiEvent(prop, apiBaseInfo, otherOptions, callbackArgs?.[0], 'fail')
          fail.apply?.(target, callbackArgs)
        }
      }

      if (typeof complete === 'function') {
        obj.complete = function (...callbackArgs: any[]) {
          handleApiEvent(prop, apiBaseInfo, otherOptions, callbackArgs?.[0], 'complete')
          complete.apply?.(target, callbackArgs)
        }
      }
      return originalMethod.apply(target, [obj, ...restArgs])
    } else {
      // 传统 wx.xxx() 或者 await wx.xxx(options) 的情况
      // 传统 Taro.xxx() 或者 await Taro.xxx(options) 的情况
      const maybePromiseOrRes = originalMethod.apply(target, args)
      if (maybePromiseOrRes?.then) {
        return maybePromiseOrRes.then((res) => {
          handleApiEvent(prop, apiBaseInfo, otherOptions, res, 'success')
          return res
        }).catch((err) => {
          handleApiEvent(prop, apiBaseInfo, otherOptions, err, 'fail')
          throw err
        })
      } else {
        handleApiEvent(prop, apiBaseInfo, args, {}, 'success')
        return maybePromiseOrRes
      }
    }
  }
}


// 有限控制劫持 API
const allowProxyApi = new Set<string>([
  'addPhoneContact',
  'authorize',
  'canvasGetImageData',
  'canvasPutImageData',
  'canvasToTempFilePath',
  'checkSession',
  'chooseAddress',
  'chooseImage',
  'chooseInvoiceTitle',
  'chooseLocation',
  'chooseVideo',
  'clearStorage',
  'closeBLEConnection',
  'closeBluetoothAdapter',
  'closeSocket',
  'compressImage',
  'connectSocket',
  'createBLEConnection',
  'request',
  'downloadFile',
  'exitMiniProgram',
  'getAvailableAudioSources',
  'getBLEDeviceCharacteristics',
  'getBLEDeviceServices',
  'getBatteryInfo',
  'getBeacons',
  'getBluetoothAdapterState',
  'getBluetoothDevices',
  'getClipboardData',
  'getConnectedBluetoothDevices',
  'getConnectedWifi',
  'getExtConfig',
  'getFileInfo',
  'getImageInfo',
  'getLocation',
  'getNetworkType',
  'getSavedFileInfo',
  'getSavedFileList',
  'getScreenBrightness',
  'getSetting',
  'getStorage',
  'getStorageInfo',
  'getSystemInfo',
  'getUserInfo',
  'getWifiList',
  'hideHomeButton',
  'hideShareMenu',
  'hideTabBar',
  'hideTabBarRedDot',
  'loadFontFace',
  'login',
  'makePhoneCall',
  'navigateBack',
  'navigateBackMiniProgram',
  'navigateTo',
  'navigateToBookshelf',
  'navigateToMiniProgram',
  'notifyBLECharacteristicValueChange',
  'hideKeyboard',
  'hideLoading',
  'hideNavigationBarLoading',
  'hideToast',
  'openBluetoothAdapter',
  'openDocument',
  'openLocation',
  'openSetting',
  'pageScrollTo',
  'previewImage',
  'queryBookshelf',
  'reLaunch',
  'readBLECharacteristicValue',
  'redirectTo',
  'removeSavedFile',
  'removeStorage',
  'removeTabBarBadge',
  'requestSubscribeMessage',
  'saveFile',
  'saveImageToPhotosAlbum',
  'saveVideoToPhotosAlbum',
  'scanCode',
  'sendSocketMessage',
  'setBackgroundColor',
  'setBackgroundTextStyle',
  'setClipboardData',
  'setEnableDebug',
  'setInnerAudioOption',
  'setKeepScreenOn',
  'setNavigationBarColor',
  'setNavigationBarTitle',
  'setScreenBrightness',
  'setStorage',
  'setTabBarBadge',
  'setTabBarItem',
  'setTabBarStyle',
  'showActionSheet',
  'showFavoriteGuide',
  'showLoading',
  'showModal',
  'showShareMenu',
  'showTabBar',
  'showTabBarRedDot',
  'showToast',
  'startBeaconDiscovery',
  'startBluetoothDevicesDiscovery',
  'startDeviceMotionListening',
  'startPullDownRefresh',
  'stopBeaconDiscovery',
  'stopBluetoothDevicesDiscovery',
  'stopCompass',
  'startCompass',
  'startAccelerometer',
  'stopAccelerometer',
  'showNavigationBarLoading',
  'stopDeviceMotionListening',
  'stopPullDownRefresh',
  'switchTab',
  'uploadFile',
  'vibrateLong',
  'vibrateShort',
  'writeBLECharacteristicValue'
])

/**
 * 监控 taro 对象
 * 注意，只能采用 taro['xxx'] = function() {} 的方式，才能劫持到。
 * @param target
 */
export const monitorTaroCalls = (target: Record<string, any>) => {
  Object.keys(target).forEach(prop => {
    if (!allowProxyApi.has(prop)) return
    const originalMethod = target[prop]
    if (typeof originalMethod === 'function') {
      target[prop] = creatorMonitorHandler(target, prop, originalMethod)
    }
  })
}

/**
 * 监控微信对象
 * 注意，只能通过 proxy 处理后，才能劫持到。
 * @param target
 */
export const monitorWxCalls = (target: Record<string, any>) => {
  return new Proxy(target, {
    get (target, prop: string, receiver) {
      const originalMethod = Reflect.get(target, prop, receiver)

      if (typeof originalMethod === 'function' && allowProxyApi.has(prop)) {
        return creatorMonitorHandler(target, prop, originalMethod)
      }

      return originalMethod
    }
  })
}
