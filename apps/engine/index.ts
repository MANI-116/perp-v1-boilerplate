import {OrderBook , Order,type Market, User, Fill, type PayloadOrder,type EngineResponse} from "@repo/types"
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
const markets:Market[] = [{marketId:"market-001",markPrice:1000n,mmr:5n}];
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

function createUser(user:User){
    const duplicateUser = users.filter((u)=>u.userId===user.userId)[0];
    if(duplicateUser)
    return { error:"conflict",message:"duplicate user found"};

    users.push(new User(user.userId,));
    return { message:"user added succesfullly"}
}

function createMarket(marketId:string){
const dupMarket = markets.filter((m)=>m.marketId===marketId)[0];
if(dupMarket) return { error:"conflict", message:"market with sameID found"};

markets.push({marketId,markPrice:0n,mmr:5n});
return { message:"market is added"};

}

function rampUser({userId,credit}:{userId:string,credit:bigint}){
    const user = users.filter((u)=> u.userId === userId)[0];
    if(!user){
        return {message:"user not found "};
    }

    user.collateral.available += credit;
    return { totalBalance :user.collateral.available};
}

function generateId(){
    const id = `ord-${Date.now() + Math.random()*1e6}`;
    return id;
}
export function engineManager(request:any):EngineResponse{

    request.payload = JSON.parse(request.payload);
    console.log("message from the sreams-",request);

    // switch(request.payloadType){
    //     case "createOrder":{
    //         console.log("create order is invoked");
    //       const payload = { ...request.payload, price:BigInt(request.payload.price),qty:BigInt(request.payload.qty),leverage:BigInt(request.payload.leverage)}        
    //       return  matchingEngine(payload)
    //     break;}
    //     // case "createUser":{
    //     //     const {userId} = request.payload;
    //     //     return createUser(userId);}
    //     //     break;
    //     // case "createMarket":
    //     //     const { marketId} = request.payload;
    //     //     return createMarket(marketId);
    //     //     break;
    //     // case "rampUser":{
    //     //     const {userId,credit}=request.payload;
    //     //     return rampUser({userId,credit});}
    //         break;
    // }
         const payload = { ...request.payload, price:BigInt(request.payload.price),qty:BigInt(request.payload.qty),leverage:BigInt(request.payload.leverage)} 

         return  matchingEngine(payload)


}

export  function matchingEngine(payload:PayloadOrder):EngineResponse{
        //based on the side wether buy or sell we devide the order
    
    const market = markets.filter((m)=>m.marketId === payload.marketId)[0]; 
    const user = users.filter((user)=>user.userId === payload.userId)[0];
    if(user === undefined){
        console.log("bidder not found")
        return {event:"ORDER_REJECTED",payload:{error:"user not found",orderId:payload.orderId} }
    }

    if(market === undefined){
        return { event:"ORDER_ACCEPTED",payload:{error:"market not found",orderId:payload.orderId}};
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
            return { event:"ORDER_REJECTED",payload:{error:"user doesnot have enough margin for the leverage",orderId:payload.orderId} }
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
            return { event:"ORDER_REJECTED",payload:{error:"orderbook does not exist cannot place order",orderId:payload.orderId}};
            
        }
          let totalLevels = payload.side === "SHORT"?orderBook.bidTree.getLength():orderBook.askTree.getLength();
          if(totalLevels === 0) return { event:"ORDER_REJECTED",payload:{error:"doesnot have liquidity in the market to place the order",orderId:payload.orderId}}

        const estimatedPrice = calculateEstimatedPrice(payload.qty,payload.side,orderBook);
        if(estimatedPrice === 0n) return  { event:"ORDER_REJECTED",payload:{error:"unable to lock the balance",orderId:payload.orderId}};
        if(estimatedPrice === undefined) return  { event:"ORDER_REJECTED",payload:{error:"unable to lock the balance",orderId:payload.orderId}};;
          //first check the balances and lock collateral or initial margin from the leverage took and maintenance margin
        const positionSize = payload.qty*estimatedPrice;
        const initialMargin = positionSize/payload.leverage;

        //lock the collateral from the available 
        if(user.collateral.available > initialMargin){
            //lock the initial margin
            user.collateral.available -= initialMargin;
            user.collateral.locked += initialMargin;

        }else{
            return  { event:"ORDER_REJECTED",payload:{error:"user doesnot have enough margin for the leverage",orderId:payload.orderId}};
        }
        const orderId = generateId();
        const order = new Order(orderId,payload.userId,payload.marketId,payload.qty,payload.side,estimatedPrice,payload.leverage);
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