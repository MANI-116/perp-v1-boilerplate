import { User, Order, type Market, OrderBook,Fill} from "@repo/types"
import { transact } from "./common";
export  function matchOrder(user:User,order:Order,market:Market,orderBooks:Map<string,OrderBook>,users:User[],fills:Fill[]){

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
        return {status:true, message:"order is placed in the orderBook"};
    }
    
    //ask level avialable ---> we can match the order and execute the order --->add to position or open new position
    const ordersLength = opSidelevelData.list.length;
    //this will consume the availble qty in the market at that level
    for(let index = 0; index < ordersLength;index++){
        const requiredQty = order.qty - order.filled;
        const matchedOrder = opSidelevelData.list.getFirstOrder().value;
        const availablleQty = matchedOrder.qty- matchedOrder.filled;
        const matchedUser = users.filter((u)=>u.userId === matchedOrder.userId)[0];
        if(matchedUser === undefined) {
            return { success:false, message:"matchedUser not found"};
        }
        //executing the order
        if(requiredQty <= availablleQty){
            transact(user,matchedUser,order,matchedOrder, orderBook,requiredQty,market,fills);

        }else{
            transact(user,matchedUser,order,matchedOrder,orderBook,availablleQty,market,fills);
        }

        if(matchedOrder.filled === matchedOrder.qty ){
            //order is filled completely so the order is removed from the pricelevel
            matchedOrder.side === "SHORT"?orderBook.removeAskOrder(matchedOrder):orderBook.removeBuyOrder(matchedOrder);
        }
        if(order.filled === order.qty){
            return { status:true , message:"order executed",data:{fills:order.filled.toString()}}
        }
        

    }

    if(order.filled != order.qty){
        //place in the order book:
        order.side === "LONG"?orderBook.addBidOrder(order):orderBook.addAskOrder(order);

    }
    return { status:true,message:"order executed partially",data:{filled:order.filled.toString()}};
}
