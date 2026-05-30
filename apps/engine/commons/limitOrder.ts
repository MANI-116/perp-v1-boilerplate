import { User, Order, type Market, OrderBook, type EngineResponse,type MatchOrder} from "@repo/types"
import { transact } from "./common";
export  function matchOrder(user:User,order:Order,market:Market,orderBooks:Map<string,OrderBook>,users:User[]):EngineResponse{
    const { qty,leverage,price,side,status,filled,userId} = order;
    let orderBook = orderBooks.get(order.assetId);
    if(orderBook === undefined){
        console.log("creating the orderbook for the asset");
        orderBook = new OrderBook(order.assetId);
        orderBooks.set(order.assetId,orderBook);
    }


    //get the pricelevel for asks
    let opSidelevelData= order.side === "LONG"?orderBook.asks.get(order.price):orderBook.bids.get(order.price);
    if(opSidelevelData === undefined){
        //no opposite price level present for the asset ,so put order in  orderbook
        order.side === "LONG"?orderBook.addBidOrder(order):orderBook.addAskOrder(order);
        return {
            event:"ORDER_ACCEPTED",
            payload:{
                type:order.type,
                qty:qty.toString(),
                price:price.toString(),
                state:status,
                userId,filled:filled.toString(),
                side ,
                marketId:order.assetId,
                orderId:order.orderId,
                message:"order placed fully in the book",
                timestamp:Date.now().toString(),
                totalLocked:user.collateral.locked.toString()}};
    }
    
    //ask level avialable ---> we can match the order and execute the order --->add to position or open new position
    const ordersLength = opSidelevelData.list.length;
    //this will consume the availble qty in the market at that level
    let takerTax = 0n;
    const matchedOrders:MatchOrder[]=[];
    for(let index = 0; index < ordersLength;index++){
        const requiredQty = order.qty - order.filled;
        const matchedOrder = opSidelevelData.list.getFirstOrder().value;
        const availablleQty = matchedOrder.qty- matchedOrder.filled;
        const matchedUser = users.filter((u)=>u.userId === matchedOrder.userId)[0];
        if(matchedUser === undefined) {
            return {
                event:"ORDER_REJECTED",
                payload:{
                    error:"matchedUser nor found",
                    orderId:order.orderId,
                    type:order.type,
                    qty:qty.toString(),
                    price:price.toString(),
                    state:status,
                    userId,filled:filled.toString(),
                    side ,
                    marketId:order.assetId,
                    timestamp:Date.now().toString()
                }};
        }
        //executing the order
        let makerTax:bigint;
        if(requiredQty <= availablleQty){
            const response =transact(user,matchedUser,order,matchedOrder, orderBook,requiredQty,market);
            makerTax =response.makertax;
            takerTax += response.takerTax;

        }else{
            const response = transact(user,matchedUser,order,matchedOrder,orderBook,availablleQty,market);
            makerTax =response.makertax;
            takerTax += response.takerTax;
        }
        matchedOrders.push({
            userId:order.userId,
            tax:makerTax.toString(),
            orderId:matchedOrder.orderId,
            qtyTransfered:matchedOrder.filled.toString(),
            timestamp:Date.now().toString(),
            availbleBalance:matchedUser.collateral.available.toString()})
        if(matchedOrder.filled === matchedOrder.qty ){
            //order is filled completely so the order is removed from the pricelevel
            matchedOrder.side === "SHORT"?orderBook.removeAskOrder(matchedOrder):orderBook.removeBuyOrder(matchedOrder);
        }
        if(order.filled === order.qty){
            return { event:"ORDER_FILLED",
                    payload:{
                        tax:takerTax.toString(),
                        type:order.type,
                        qty:qty.toString(),
                        price:price.toString() ,
                        state:status,userId,
                        filled:filled.toString(),
                        side ,
                        marketId:order.assetId,
                        orderId:order.orderId,
                        matchedOrders,
                        availbleBalance:user.collateral.available.toString()}}
        }
        

    }

    if(order.filled != order.qty){
        //place in the order book:
        order.side === "LONG"?orderBook.addBidOrder(order):orderBook.addAskOrder(order);

    }
    return { event:"ORDER_FILLED_PARTIALLY",
        payload:{
            tax:takerTax.toString(),
            type:order.type,
            qty:qty.toString(),
            price:price.toString() ,
            state:status,userId,filled:filled.toString(),
            side ,marketId:order.assetId,
            orderId:order.orderId,
            matchedOrders,availbleBalance:user.collateral.available.toString()}};
}
