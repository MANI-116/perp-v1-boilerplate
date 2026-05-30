import  { type OrderBook, type Market,User } from "@repo/types";

export const orderBooks = new Map<string,OrderBook>();
export const markets:Market[] = [{marketId:"market-001",markPrice:1000n,mmr:5n,takerRate:5n,makerRate:5n,taxationScale:3n,symbol:"SOLUSDT"}];
export const users:User[] = [];
export let EXCHANGE_BALANCE=1000n;

const user1 = new User("user-1");
const user2 = new User("user-2");
const user3 = new User("user-3");
users.push(user1);
users.push(user2);
users.push(user3);
user1.collateral.available += 15000n;
user2.collateral.available  += 1000n;
user3.collateral.available +=10000000n;

export function incrementExchangeBalance(amount:bigint){
    EXCHANGE_BALANCE += amount;
}

export function decrementExchangeBalance(amount:bigint){
    EXCHANGE_BALANCE -= amount;
}

export function addUser(user:User){
        const duplicateUser = users.filter((u)=>u.userId===user.userId)[0];
        if(duplicateUser)
        return { error:"conflict",message:"duplicate user found"};
    
        users.push(new User(user.userId,));
        return { message:"user added succesfullly"}

}

export function addMarket(marketId:string){
    const dupMarket = markets.filter((m)=>m.marketId===marketId)[0];
if(dupMarket) return { error:"conflict", message:"market with sameID found"};

markets.push({marketId,markPrice:0n,mmr:5n,takerRate:5n,makerRate:2n,taxationScale:3n,symbol:"SOLUSDT"});
return { message:"market is added"};

}
