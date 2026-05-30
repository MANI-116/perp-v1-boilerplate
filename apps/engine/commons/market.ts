import { Order, User, type Market,OrderBook, Fill,type EngineResponse, type MatchOrder} from "@repo/types"
import { transact } from "./common";
import { EXCHANGE_BALANCE } from "../sharedResourcesManager";
export function marketOrder(user:User,order:Order,market:Market,orderBooks:Map<string,OrderBook>,users:User[]):EngineResponse{

        let orderBook = orderBooks.get(order.assetId);
        if(orderBook === undefined){
            console.log("creating the orderbook for the asset");
            orderBook = new OrderBook(order.assetId);
        }
        let totalLevels = order.side === "SHORT"?orderBook.bidTree.getLength():orderBook.askTree.getLength()
        const matchedOrders:MatchOrder[]=[];
        for(let i =0; i< totalLevels;i++ ){
            //get the pricelevel from opposite side
            const level = order.side === "SHORT"?orderBook.bidTree.getTop():orderBook.askTree.getMinAsk();
            if(level === undefined){
                return { event:"ORDER_REJECTED",payload:{error:"no counter offers",orderId:order.orderId,timestamp:Date.now().toString()}}
            }
            let opSidelevelData= order.side === "LONG"?orderBook.asks.get(level):orderBook.bids.get(level);
            if(opSidelevelData === undefined){
                //no opposite price level present for the asset ,so put order in  orderbook
                order.side === "LONG"?orderBook.addBidOrder(order):orderBook.addAskOrder(order);
                return {event:"ORDER_REJECTED", payload:{orderId:order.orderId,error:"order is placed in the orderBook",timestamp:Date.now().toString()}};
            }
            
            //ask level avialable ---> we can match the order and execute the order --->add to position or open new position
            const ordersLength = opSidelevelData.list.length;

            for(let index = 0; index < ordersLength;index++){

                const requiredQty = order.qty - order.filled;
                const matchedOrder = opSidelevelData.list.getFirstOrder().value;
                const availablleQty = matchedOrder.qty- matchedOrder.filled;
                const matchedUser = users.filter((u)=>u.userId === matchedOrder.userId)[0];
                if(matchedUser === undefined) {
                    return { event:"ORDER_REJECTED",payload:{ orderId:order.orderId,error:"matchedUser not found",timestamp:Date.now().toString()}};
                }
                //executing the order
                if(requiredQty <= availablleQty){
                    transact(user,matchedUser,order,matchedOrder, orderBook,requiredQty,market);
    
                }else{
                    transact(user,matchedUser,order,matchedOrder,orderBook,availablleQty,market);
                }
                
                 matchedOrders.push({orderId:matchedOrder.orderId,qtyTransfered:matchedOrder.filled.toString(),timestamp:Date.now().toString(),availbleBalance:matchedUser.collateral.available.toString()})
  
                if(matchedOrder.filled === matchedOrder.qty ){
                    //order is filled completely so the order is removed from the pricelevel
                    matchedOrder.side === "SHORT"?orderBook.removeAskOrder(matchedOrder):orderBook.removeBuyOrder(matchedOrder);
                            }
                if(order.filled === order.qty){
                    return { event:"ORDER_FILLED" , payload:{orderId:order.orderId,filled:order.qty.toString(),price:order.price.toString(),matchedOrders,availbleBalance:user.collateral.available.toString()}}
                }
            
        }

        //if level is completed and qty not filled yet next level will pickup automatically
        //else if filled we are returning the data of filledqty

        }


        //we are out of liquidity in the market so we makr the order as FILLED but filledQty would be what ever we matched
        return { event:"ORDER_FILLED_PARTIALLY", payload:{orderId:order.orderId,filled:order.qty.toString(),price:order.price.toString(),matchedOrders,availbleBalance:user.collateral.available.toString()}}

}