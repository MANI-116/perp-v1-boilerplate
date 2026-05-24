/**
 * ORDER ACCEPTED EVENT
 * ORDER REJECTED EVENT
 * ORDER FILLED EVENT --> qty filled completely
 * ORDER PARTIALLY FILLED EVENT
 */


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

export interface MatchOrder{
    orderId:string,
    qtyTransfered:string,
    timestamp:string,
    availbleBalance:string
}
export interface OrderFilled{
    orderId:string,
    filledQty:string,
    price:string,
    availbleBalance:string,
    matchedOrders:MatchOrder[]
}

export interface OrderAccepted{
    message:string,
    timestamp:string,
    totalLocked:string,
    orderId:string
}

export interface OrderRejected{
    error:string,
    orderId:string
}
export type EngineEvent = "ORDER_FILLED_PARTIALLY"|"ORDER_FILLED"|"ORDER_ACCEPTED"|"ORDER_REJECTED";

export interface EngineResponse{
    event:EngineEvent,
    payload:OrderFilled|OrderAccepted|OrderRejected
}
