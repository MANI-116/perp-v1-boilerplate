import { type PayloadOrder,type EngineResponse, Order } from "@repo/types";
import { calculateEstimatedPrice } from "./commons/common";
import { matchOrder } from "./commons/limitOrder";
import { marketOrder } from "./commons/market";
import {markets, orderBooks, users} from "./sharedResourcesManager"
export  function matchingEngine(payload:PayloadOrder):EngineResponse{
        //based on the side wether buy or sell we devide the order
    
    const market = markets.filter((m)=>m.marketId === payload.marketId)[0]; 
    const user = users.filter((user)=>user.userId === payload.userId)[0];
    if(user === undefined){
        console.log("bidder not found")
        return {
            event:"ORDER_REJECTED",
            payload:{
                error:"user not found",
                timestamp:Date.now().toString(),
                ...payload,
                qty:payload.qty.toString(),
                price:payload.price.toString(),
                filled:"0n",
                state:"CANCELED"} }
    }

    if(market === undefined){
        return { event:"ORDER_REJECTED",payload:{
            error:"market not found",
            timestamp:Date.now().toString(),
                ...payload,
                qty:payload.qty.toString(),
                price:payload.price.toString(),
                filled:"0n",
                state:"CANCELED"
            }};
    }

    
    if(payload.type === "LIMIT"){

        //first check the balances and lock collateral or initial margin from the leverage took and maintenance margin
        const positionSize = payload.qty*payload.price;
        const initialMargin = positionSize/payload.leverage;

        //lock the collateral from the available 
        if(user.collateral.available > initialMargin){
            //lock the initial margin
            user.collateral.available -= initialMargin;
            user.collateral.locked += initialMargin;

        }else{
            return {
                event:"ORDER_REJECTED",
                payload:{
                    error:"user doesnot have enough margin for the leverage",
                    timestamp:Date.now().toString(),
                    ...payload,
                    qty:payload.qty.toString(),
                    price:payload.price.toString(),
                    filled:"0n",
                    state:"CANCELED"} }
        }

        //now we have the collateral needed to put the order in the book or execute it:
        //create order
        const order = new Order(payload.orderId,payload.userId,payload.marketId,payload.qty,payload.side,payload.price,payload.leverage,"LIMIT");

        const response =  matchOrder(user,order,market,orderBooks,users);
        return response;
        

    }
        //execute for marketOrder
         let orderBook = orderBooks.get(payload.marketId);
        if(orderBook === undefined){
            console.log("creating the orderbook for the asset");
            return { 
                event:"ORDER_REJECTED",
                payload:{
                    error:"orderbook does not exist cannot place order",
                    timestamp:Date.now().toString(),
                    ...payload,
                    qty:payload.qty.toString(),
                    price:payload.price.toString(),
                    filled:"0n",
                    state:"CANCELED"}};
            
        }
          let totalLevels = payload.side === "SHORT"?orderBook.bidTree.getLength():orderBook.askTree.getLength();
          if(totalLevels === 0) return {
             event:"ORDER_REJECTED",
             payload:{
                error:"doesnot have liquidity in the market to place the order",
                timestamp:Date.now().toString(),
                ...payload,
                qty:payload.qty.toString(),
                price:payload.price.toString(),
                filled:"0n",
                state:"CANCELED"}}

        const estimatedPrice = calculateEstimatedPrice(payload.qty,payload.side,orderBook);
        if(estimatedPrice === 0n) return  { 
            event:"ORDER_REJECTED",
            payload:{
                error:"unable to lock the balance",
                timestamp:Date.now().toString(),
                    ...payload,
                    qty:payload.qty.toString(),
                    price:payload.price.toString(),
                    filled:"0n",
                    state:"CANCELED"}};
        if(estimatedPrice === undefined) return  { 
            event:"ORDER_REJECTED",
            payload:{
                error:"unable to lock the balance",
                timestamp:Date.now().toString(),
                ...payload,
                qty:payload.qty.toString(),
                price:payload.price.toString(),
                filled:"0n",
                state:"CANCELED"}};;
          //first check the balances and lock collateral or initial margin from the leverage took and maintenance margin
        const positionSize = payload.qty*estimatedPrice;
        const initialMargin = positionSize/payload.leverage;

        //lock the collateral from the available 
        if(user.collateral.available > initialMargin){
            //lock the initial margin
            user.collateral.available -= initialMargin;
            user.collateral.locked += initialMargin;

        }else{
            return  { 
                event:"ORDER_REJECTED",
                payload:{
                    error:"user doesnot have enough margin for the leverage",
                    timestamp:Date.now().toString(),
                    ...payload,
                    qty:payload.qty.toString(),
                    price:payload.price.toString(),
                    filled:"0n",
                    state:"CANCELED"}};
        }
        const order = new Order(payload.orderId,payload.userId,payload.marketId,payload.qty,payload.side,estimatedPrice,payload.leverage,"MARKET");
        const response = marketOrder(user,order,market,orderBooks,users);
        return response;

}
