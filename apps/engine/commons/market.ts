import { Order, User, type Market,OrderBook, Fill} from "@repo/types"
import { transact } from "./common";
export function marketOrder(user:User,order:Order,market:Market,orderBooks:Map<string,OrderBook>,users:User[],fills:Fill[]){

        let orderBook = orderBooks.get(order.assetId);
        if(orderBook === undefined){
            console.log("creating the orderbook for the asset");
            orderBook = new OrderBook(order.assetId);
        }
        let totalLevels = order.side === "SHORT"?orderBook.bidTree.getLength():orderBook.askTree.getLength()

        for(let i =0; i< totalLevels;i++ ){
            //get the pricelevel from opposite side
            const level = order.side === "SHORT"?orderBook.bidTree.getTop():orderBook.askTree.getMinAsk();
            if(level === undefined){
                return { success:false, message:"level not found"}
            }
            let opSidelevelData= order.side === "LONG"?orderBook.asks.get(level):orderBook.bids.get(level);
            if(opSidelevelData === undefined){
                //no opposite price level present for the asset ,so put order in  orderbook
                order.side === "LONG"?orderBook.addBidOrder(order):orderBook.addAskOrder(order);
                return {status:true, message:"order is placed in the orderBook"};
            }
            
            //ask level avialable ---> we can match the order and execute the order --->add to position or open new position
            const ordersLength = opSidelevelData.list.length;

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

        //if level is completed and qty not filled yet next level will pickup automatically
        //else if filled we are returning the data of filledqty

        }


        //we are out of liquidity in the market so we makr the order as FILLED but filledQty would be what ever we matched
        return { status:true , message:"not enough liquidity in the maket,executed for the availble qty",data:{fills:order.filled}}

}