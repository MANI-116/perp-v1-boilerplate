import {OrderBook , Order,type Market, User, Fill, type PayloadOrder,type EngineResponse,Node,Position, type EngineUser, type EngineMarket, type EngineRampUser, type EngineDeleteOrder} from "@repo/types"
import { matchOrder } from "./commons/limitOrder";
import { marketOrder } from "./commons/market";
import { calculateEstimatedPrice } from "./commons/common";
import {createClient} from "redis";


const receiver = createClient();
const sender = createClient();


receiver.on("error",(error)=>{
    console.log("error on connecting the reciver-",error);
})

sender.on("error",(error)=>{
    console.log("error on connecting the sender-",error);

})


await receiver.connect();
await sender.connect();

const fills:Fill[]=[];
const orderBooks = new Map<string,OrderBook>();
const markets:Market[] = [{marketId:"market-001",markPrice:1000n,mmr:5n,takerRate:5n,makerRate:5n,taxationScale:3n}];
const user1 = new User("user-1");
const user2 = new User("user-2");
const user3 = new User("user-3");
const users:User[] = [];
users.push(user1);
users.push(user2);
users.push(user3);
user1.collateral.available += 15000n;
user2.collateral.available  += 1000n;
user3.collateral.available +=10000000n;

type EngineRequestType = "createOrder"|"deleteOrder"
interface EngineRequest{
    type:EngineRequestType,
    payload:PayloadOrder
}

function createUser(user:User):EngineUser{
    const duplicateUser = users.filter((u)=>u.userId===user.userId)[0];
    if(duplicateUser)
    return { error:"conflict",message:"duplicate user found"};

    users.push(new User(user.userId,));
    return { message:"user added succesfullly"}
}

function createMarket(marketId:string):EngineMarket{
const dupMarket = markets.filter((m)=>m.marketId===marketId)[0];
if(dupMarket) return { error:"conflict", message:"market with sameID found"};

markets.push({marketId,markPrice:0n,mmr:5n,takerRate:5n,makerRate:2n,taxationScale:3n});
return { message:"market is added"};

}

function deleteOrder(orderId:string,assetId:string):EngineDeleteOrder{
    const orderBook = orderBooks.get(assetId);
    if(!orderBook){
        return {error:"orderbook not found", orderId:order.orderId};
    }

    orderBook.deleteOrder(orderId);
    return { message:"order deleted", orderId};

}

function rampUser({userId,credit}:{userId:string,credit:bigint}):EngineRampUser{
    const user = users.filter((u)=> u.userId === userId)[0];
    if(!user){
        return {message:"user not found "};
    }

    user.collateral.available += credit;
    return { totalBalance :user.collateral.available.toString()};
}

function generateId(){
    const id = `ord-${Date.now() + Math.random()*1e6}`;
    return id;
}


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
export function engineManager(request:any):EngineResponse|null{

    request.payload = JSON.parse(request.payload);
    console.log("message from the sreams-",request);

    switch(request.type){
        case "CREATE_ORDER":{
            console.log("create order is invoked");
          const payload = { ...request.payload, price:BigInt(request.payload.price),qty:BigInt(request.payload.qty),leverage:BigInt(request.payload.leverage)}        
          return  matchingEngine(payload)
        }
        case "CREATE_USER":{
            const {userId} = request.payload;
            const payload = createUser(userId);
            return {event:"CREATE_USER",payload}
        }
        
        case "CREATE_MARKET":{
            const { marketId} = request.payload;
            const payload = createMarket(marketId);
             return {event:"CREATE_MARKET",payload};
        }       
        case "RAMP_USER":{
            const {userId,credit}=request.payload;
            const payload = rampUser({userId,credit});
            return { event:"RAMP_USER",payload};    
        }
        case "DELETE_ORDER":{
            const response = deleteOrder(payload)
        }
    }
    throw new Error("no request type matched");


}

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
                state:"CLOSED"} }
    }

    if(market === undefined){
        return { event:"ORDER_REJECTED",payload:{
            error:"market not found",
            timestamp:Date.now().toString(),
                ...payload,
                qty:payload.qty.toString(),
                price:payload.price.toString(),
                filled:"0n",
                state:"CLOSED"
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
                    state:"CLOSED"} }
        }

        //now we have the collateral needed to put the order in the book or execute it:
        //create order
        const order = new Order(payload.orderId,payload.userId,payload.marketId,payload.qty,payload.side,payload.price,payload.leverage);

        const response =  matchOrder(user,order,market,orderBooks,users,fills);
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
                    state:"CLOSED"}};
            
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
                state:"CLOSED"}}

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
                    state:"CLOSED"}};
        if(estimatedPrice === undefined) return  { 
            event:"ORDER_REJECTED",
            payload:{
                error:"unable to lock the balance",
                timestamp:Date.now().toString(),
                ...payload,
                qty:payload.qty.toString(),
                price:payload.price.toString(),
                filled:"0n",
                state:"CLOSED"}};;
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
                    state:"CLOSED"}};
        }
        const order = new Order(payload.orderId,payload.userId,payload.marketId,payload.qty,payload.side,estimatedPrice,payload.leverage);
        const response = marketOrder(user,order,market,orderBooks,users,fills);
        return response;

}

//creating the "engine" group queue --> consumed by the dbPoller and the engine

try {
    await receiver.xGroupCreate("engine-stream","engine-group","$",{MKSTREAM:true});
    console.log("engine queue with engine group is created")
    
} catch (error) {
    
    if(error instanceof Error && error.message.includes("BUSYGROUP")){
        console.log("group already created--",error.name);
    }

    if(error instanceof Error){
        console.log("error-name:",error.name,"\nerror-message:",error.message)
    }

    console.log("error on creating the engine stream")
}

try {
    await sender.xGroupCreate("response-stream","response-group","$",{MKSTREAM:true});
    console.log("response group iscreated wih response key");

} catch (error) {

    if(error instanceof Error && error.message.includes("BUSYGROUP")){
        console.log("error while creating the request group---",error.name,"--",error.message);
    }
    console.log("creating the response-stream");
    
}
while(true){
    let id = "0";
    console.log("waiting for the response....")
    try {
                                                                                                                                                     
        const response:RedisResponse[]|null =await receiver.xReadGroup("engine-group","engine",[{key:"engine-stream",id:">"}],{BLOCK:10000}) as RedisResponse[];
        console.log("response form the stream--",response);
        if(response === null) continue;
        const messages = response[0]?.messages
        console.log("response from the queue-",messages)
        if(messages === undefined) continue;
        for(const msg of messages){
            id = msg.id;
            const response = engineManager(msg.message);
            if(response === null) continue;

            
            console.log("reponse form the engineManager-",response);
            const res = await receiver.xAck("engine-stream","engine-group",id);
            const senderRes = await sender.xAdd("response-stream","*",{message:JSON.stringify(response),corelationId:msg.message.corelationId?msg.message.corelationId:""});
            console.log("sender response-",senderRes);
    
        }
    } catch (error) {
        console.log("error on receiving signals-",error);
        
    }
}

interface RedisResponse  {
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