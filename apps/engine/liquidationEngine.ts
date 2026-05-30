import  {type Node, type Position,generateId } from "@repo/types";
import { orderBooks } from "./sharedResourcesManager";
import { sender } from ".";
export async function liquidationEngine(newMarkPrice:{marketId:string,markPrice:string}){
    const orderBook = orderBooks.get(newMarkPrice.marketId);
    const lp = BigInt(newMarkPrice.markPrice);
    if(orderBook  === undefined) throw new Error("orderBook is not defined");
    let longLp = orderBook.longsTree.getTop();
    if(longLp === undefined) return { message:"no longs availble"}
    while(lp < longLp){
        //liquidate the positions with this lp 
        const levelData = orderBook.longs.get(lp);
        if(levelData === undefined) return {message:"no positions at this lp"}
        const positionsList = levelData.list;
        const totalPositions = positionsList.length;
        let position:Node<Position>|null = positionsList.getFirstOrder();

        for(let i =0;i<totalPositions;i++){

            //place opposite order with the quantity at market ;
            if(position === null ) break;
            const payload = {
                                userId:position.value.userId,
                                marketId:position.value.market,
                                type:"MARKET",
                                side:"SHORT",
                                qty:position.value.qty,
                                leverage:"1"
                            };
           try {
                const id = await sender.xAdd("engine-stream","*",{paylooadType:"createOrder",corelationId:generateId(),payload:JSON.stringify(payload)})
           } catch (error) {
            console.log("error on sending the liquidation reuest to the engine-stream")
            
           }   
           
           position = position.right;
            
        }
        //get new lp
        orderBook.longsTree.pop();
        longLp = orderBook.longsTree.getTop();
        if(longLp === undefined) break;

    }


    ////liquidate the short positions
     let shortLp = orderBook.shortsTree.getMinAsk();
     if(shortLp === undefined) return { message:"no longs availble"}
    while(lp > shortLp){
        //liquidate the positions with this lp 
        const levelData = orderBook.shorts.get(lp);
        if(levelData === undefined) return {message:"no positions at this lp"}
        const positionsList = levelData.list;
        const totalPositions = positionsList.length;
        let position:Node<Position>|null = positionsList.getFirstOrder();

        for(let i =0;i<totalPositions;i++){

            //place opposite order with the quantity at market ;
            if(position === null ) break;
            const payload = {
                                userId:position.value.userId,
                                marketId:position.value.market,
                                type:"MARKET",
                                side:"LONG",
                                qty:position.value.qty,
                                leverage:"1"
                            };
           try {
                const id = await sender.xAdd("engine-stream","*",{paylooadType:"createOrder",corelationId:generateId(),payload:JSON.stringify(payload)})
           } catch (error) {
            console.log("error on sending the liquidation reuest to the engine-stream")
            
           }   
           
           position = position.right;
            
        }
        //get new lp
        orderBook.shortsTree.pop();
        shortLp = orderBook.shortsTree.getMinAsk();
        if(shortLp === undefined) break;

    }

    return { message:"iquidations got triggered annd placed orders in the engine-stream"}
    
}