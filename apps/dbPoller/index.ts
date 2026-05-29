import { createClient } from "redis";
import { prisma} from "@repo/db"
import {  type EngineResponse, type Transaction } from "@repo/types"
// we need only receivers 

//we need to listen to the response queue ,so that we maintain orders and transactions fills
const receiver = createClient();

interface RedisResponse{   
    name: string;
    messages: {
        id: string;
        message: {
            [x: string]: string;
        };
        millisElapsedFromDelivery?: number | undefined;
        deliveriesCounter?: number | undefined;
    }[]
}

receiver.on("error",(e)=>{
    console.log("error occured on connection to the redisstream-",e)
})


await receiver.connect();

try {
    await receiver.xGroupCreate("response-stream","dbPoller","$",{MKSTREAM:true})
    
} catch (error) {
    if(error instanceof Error)
    console.log("error on creating dbPOller group-",error.name,error.message);
    else console.log("unknown error-",error);
}

while(true){

    const response = await receiver.xReadGroup("dbPoller","poller-1",[{key:"response-stream",id:">"}],{BLOCK:2000}) as (RedisResponse[] |null)
    if(response === null) continue;
  
    const stream = response[0];
    if(stream === undefined) continue;
    for(const msg of stream.messages){
        if(msg.message.message === undefined){
              await receiver.xAck("response-stream","dbPoller",msg.id);
          continue;
        }
        const message = JSON.parse(msg.message.message )as EngineResponse;
        dbWorker(message)
        console.log("message from the response stream-",message);
        await receiver.xAck("response-stream","dbPoller",msg.id);

    }

}

 function  dbWorker(message:EngineResponse){

    switch(message.event){
        case "ORDER_FILLED_PARTIALLY":
            updateOrder(message)
            break;        
        case "ORDER_FILLED":
            updateOrder(message)
            break;
        case "ORDER_ACCEPTED":
            updateOrder(message)
            break;
        case "ORDER_REJECTED":
            updateOrder(message)
            break;
    }

}

async function updateOrder(orderDetails:EngineResponse){
    try {
    if(orderDetails.event === "ORDER_ACCEPTED"){
      //create new order
         const { side,qty, type, marketId,orderId,slippage,price,userId,state} = orderDetails.payload;
            //no need to check wether there is an existing order because postgress make sure of it due to the unique constraint on orderId
            const response = await prisma.order.create({
                data:{
                    side,
                    type,
                    qty:BigInt(qty),
                    price:BigInt(price),
                    marketId,
                    userId,
                    orderId,
                    filled:0n,
                    state
  
                }
            })

            return;
        
        }
        if(orderDetails.event === "ORDER_REJECTED"){
            //create an order with status closed:
            const { side,qty, type, marketId,orderId,slippage,price,userId,state} = orderDetails.payload;
            //no need to check wether there is an existing order because postgress make sure of it due to the unique constraint on orderId
            const response = await prisma.order.create({
                data:{
                    side,
                    type,
                    filled:0n,
                    qty:BigInt(qty),
                    price:BigInt(price),
                    marketId,
                    userId,
                    orderId,
                    state:"CLOSED"
  
                }
            })

            return;
        }
        
        if(orderDetails.event === "ORDER_FILLED" || orderDetails.event === "ORDER_FILLED_PARTIALLY"){
            //update the existing order with filled and status and also create if not existed
            //create fills or transactions

            //get the transactions:
            const {orderId,filled,price,matchedOrders,userId,side,type,marketId,qty,tax}= orderDetails.payload;

            //check order exists or not:
            const order = await prisma.order.findUnique({where:{orderId}});
            if(!order){
                //create order:
                const response = await prisma.order.create({
                data:{
                    side,
                    type,
                    qty:BigInt(qty),
                    price:BigInt(price),
                    marketId,
                    userId,
                    orderId,
                    filled:BigInt(filled),
                    state:`${BigInt(qty) === BigInt(filled) ? "CLOSED":"FILLED"}`
  
                }
            })

            }else{

                await prisma.order.update({where:{orderId},
                data:{
                    filled:{increment:BigInt(filled)},
                    state:`${order.qty === order.filled + BigInt(filled) ? "CLOSED" : "FILLED"}`
                }})

                console.log("updated the order")
            }

            for(const matchedOrder of matchedOrders){
                //update the order
                const order = await prisma.order.findUnique({where:{orderId:matchedOrder.orderId}});
                if(!order) throw new Error("order matched on the non existing order");
                
                const updateOrder = await prisma.order.update({
                    where:{orderId:matchedOrder.orderId},
                    data:{
                        filled:{increment:BigInt(matchedOrder.qtyTransfered)},
                        state:`${order.qty=== order.filled+BigInt(matchedOrder.qtyTransfered) ? "CLOSED":"FILLED" }`
                    }
                })

                console.log("updated the order-",updateOrder);
                //make the fill
                const response = await prisma.transaction.create({
                    data:{
                        takerId:userId,
                        makerId:matchedOrder.userId,
                        takerFee:BigInt(tax),
                        makerFee:BigInt(matchedOrder.tax),
                        takerOrderId:orderId,
                        makerOrderId:matchedOrder.orderId,
                        qty:BigInt(matchedOrder.qtyTransfered),
                        price:BigInt(price)
                    },
                    select:{
                        id:true
                    }
                });

                console.log("transaction created:-",response);
            }

            return;
        }
        
    } catch (error) {
        console.log("error occurred on creating the order ",error);
        
    }

}



