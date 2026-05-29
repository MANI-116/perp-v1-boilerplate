/**
 * ORDER ACCEPTED EVENT
 * ORDER REJECTED EVENT
 * ORDER FILLED EVENT --> qty filled completely
 * ORDER PARTIALLY FILLED EVENT
 */

import type { EngineCreateOrder, OrderSide, PayloadOrder } from ".."


/**
 * ORDER FILLED HAVE FOLLOWING
 * ->details of order
 * ->details of metched order
 * ->detials transactions
 * 
 * mainOrder:
 * orderId
 * filled
 * 
 * matchedorders:[]
 * matchedorderId
 * qty-transfered
 * price
 * {
 * eventType:"ORDERFILLED"
 * orderId:string;
 * matchedOrders:matchOrder[]
 * }
 * matchOrder{
 * price:string,
 * qtyTransfered:string
 * orderId
 * }
 * 
 */



/**
 * ORDER_PARTIALLY_FILLED HAVE FOLLOWING
 * ->details of order
 * ->details of metched order
 * ->detials transactions
 * 
 * mainOrder:
 * orderId
 * filled
 * 
 * matchedorders:[]
 * matchedorderId
 * qty-transfered
 * price:string
 * {
 * eventType:"ORDER_PARTIALLY_FILLED"
 * orderId:string;
 * matchedOrders:matchOrder[]
 * }
 * matchOrder{
 * price:string,
 * qtyTransfered:string
 * orderId
 * }
 * 
 */

type Direction = "1"|"-1"

type OrderType = "LIMIT"| "MARKET"

export interface CreateOrderPayload{

}
export interface CreateUser{
    userId:string,
    collateral:{
        available:string,
        locked:string
    }
}

export interface EngineDeleteOrder{
    error?:string,
    message?:string,
    orderId:string,

}

export interface CreateMarket{
     name: string;
    symbol: string;
    slug: string;
    scale: string;
    markPrice: string;
    takerRate: string;
    makerRate: string;
    mmr: string;

}

export interface EngineRequest{
    type:"CREATE_ORDER"|"CREATE_USER"|"RAMP_USER"|"CREATE_MARKET"|"UPDATE_MARKET",
    payload:CreateUser|EngineCreateOrder|CreateMarket
    corelationId:string
}

export interface MatchOrder{
    orderId:string,
    userId:string,
    tax:string,
    qtyTransfered:string,
    timestamp:string,
    availbleBalance:string
}
export interface OrderFilled extends Order{
    availbleBalance:string,
    tax:string
    matchedOrders:MatchOrder[]
}

type OrderState = "OPEN"|"FILLED"|"CLOSED"
export interface OrderAccepted extends Order{
    message:string,
    timestamp:string,
    totalLocked:string,
    
}

export interface Order{
    orderId:string,
    state:OrderState,
    side:OrderSide,
    type:OrderType,
    qty:string,
    filled:string,
    slippage?:string,
    price:string,
    marketId:string,
    userId:string
  

}

export interface OrderRejected extends Order{
    error:string,
    timestamp:string
    
}
export type EngineEvent = "ORDER_FILLED_PARTIALLY"|"ORDER_FILLED"|"ORDER_ACCEPTED"|"ORDER_REJECTED";

export type EngineResponse =
  {
    [K in keyof EventMap]: {
      event: K;
      payload: EventMap[K];
    };
  }[keyof EventMap];

export interface EventMap{
    "ORDER_FILLED":OrderFilled,
    "ORDER_FILLED_PARTIALLY":OrderFilledPartially,
    "ORDER_REJECTED":OrderRejected,
    "ORDER_ACCEPTED":OrderAccepted,
    "CREATE_USER":EngineUser,
    "CREATE_MARKET":EngineRampUser,
    "RAMP_USER":EngineMarket,
    "DELETE_ORDER":EngineDeleteOrder

}

export interface EngineUser{
    error?:string,
    message:string

}

export interface EngineRampUser{
    error?:string,
    message?:string,
    totalBalance?:string

}
export interface EngineMarket{

}

interface OrderFilledPartially extends OrderFilled{

}
