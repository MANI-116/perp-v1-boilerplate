import type { EngineDeleteOrder, EngineMarket, EngineRampUser, EngineResponse, EngineUser, User } from "@repo/types";
import { matchingEngine } from "./matchingEnigne";
import { addUser, addMarket, orderBooks, users } from "./sharedResourcesManager";

function createUser(user:User):EngineUser{
   return addUser(user)
}

function createMarket(marketId:string):EngineMarket{
  return addMarket(marketId);

}

function deleteOrder(orderId:string,assetId:string):EngineDeleteOrder{
    const orderBook = orderBooks.get(assetId);
    if(!orderBook){
        return {error:"orderbook not found", orderId};
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
            const { orderId,marketId  } = request.payload
            const response = deleteOrder(orderId,marketId);
            return { event:"DELETE_ORDER",payload:response};
        }
    }
    throw new Error("no request type matched");


}
