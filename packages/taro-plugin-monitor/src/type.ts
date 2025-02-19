// 定义 App 级别生命周期
type AppLifecycle = "onLaunch" | "onShow" | "onHide";

// 定义 Page 级别生命周期（基础）
type PageBasicLifecycle =
  | "onLoad"
  | "onUnload"
  | "onReady"
  | "onShow"
  | "onHide";

// 定义 Page 级别生命周期（事件）
type PageEventLifecycle =
  | "onPullDownRefresh"
  | "onReachBottom"
  | "onPageScroll"
  | "onResize"
  | "onTitleClick"
  | "onOptionMenuClick"
  | "onPopMenuClick"
  | "onPullIntercept"
  | "onAddToFavorites";

// 定义 Page 级别生命周期（分享相关）
export type PageShareLifecycle = "onShareAppMessage" | "onShareTimeline";

// 组合所有生命周期
export type LifecycleStage =
  | AppLifecycle
  | PageBasicLifecycle
  | PageEventLifecycle
  | PageShareLifecycle;

/** 事件类型 */
export type EventType = "click" | "api" | "http" | "lifecycle" | "custom" | "error";
export type EventLevel = "info" | "warn" | "error";

/** 基础埋点事件 */
export interface BaseEvent<T extends EventType = any> {
  /**
   * 事件ID
   */
  eventId: string;
  /**
   * 事件类型
   */
  eventType: T

  /**
   * 事件级别
   */
  eventLevel: "info" | "warn" | "error";

  /**
   * 触发时间
   */
  stime: number;


  /**
   * 额外信息
   */
  extra?: Record<string, any>;

  /**
   * 页面URL
   */
  pageUrl?: string;

  /**
   * 页面完整URL
   */
  fullUrl?: string;
}

/** 点击事件 */
export interface ClickEvent extends BaseEvent {
  eventType: "click";

  /**
   * 元素文本
   */
  elementText: string;

  /**
   * 元素节点，举例：View、button
   */
  elementName: string;

  /**
   * 元素属性
   */
  elementProps?: Record<string, any> | string;

  /**
   * 元素描述
   */
  elementDetail?: Record<string, any> | string;
}

/** 小程序 API，需要排除网络请求，只记录小程序 API 调用事件 */
export interface ApiCallEvent extends BaseEvent {
  eventType: "api";

  /**
   * 接口名称
   */
  apiName: string;


   /**
   * 接口参数
   */
   apiArgs?: Record<string, any> | string;


  /**
   * 接口状态
   */
  apiStatus?: "success" | "fail" | "complete";


  /**
   * 接口响应，成功是失败响应都在这里
   */
  apiResponse?: Record<string, any> | string;

  /**
   * 结束时间
   */
  etime: number;

  /**
   * 耗时
   */
  duration: number;
}

/** 网络请求事件 */
export interface HttpEvent extends BaseEvent {
  eventType: "http";

  /**
   * 请求方法
   */
  method: "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "HEAD" | "TRACE" | "CONNECT";

  /**
   * 请求URL
   */
  requestUrl: string;

  /**
   * 请求参数
   */
  params?: Record<string, any> | string;

  /**
   * 请求头
   */
  headers?: Record<string, any> | string;

  /**
   * 请求体
   */
  body?: Record<string, any> | string;

  /**
   * 请求状态码
   */
  statusCode: number;

  /**
   * 请求超时时间
   */
  timeout?: number

  /**
   * 结束时间
   */
  etime: number;

  /**
   * 耗时
   */
  duration: number;
}

/** 生命周期事件 */
export interface LifecycleEvent extends BaseEvent {
  eventType: "lifecycle";
  lifecycleStage: LifecycleStage;
  lifecycleOption?: Record<string, any> | string;
}

/** 自定义事件 */
export interface CustomUserEvent extends BaseEvent {
  eventType: "custom";
  customName: string;
  customData?: Record<string, any>;
}

/** 错误事件 */
export interface CustomErrorEvent extends BaseEvent {
  eventType: "error";
  errType: "error" | "onUnhandledRejection"
  errMsg: string;
  stackTrace: string;
  errExtraData?: Record<string, any>;
}

/** 埋点事件的最终联合类型 */
export type TrackingEvent =
  | ClickEvent
  | ApiCallEvent
  | HttpEvent
  | LifecycleEvent
  | CustomUserEvent
  | CustomErrorEvent;
