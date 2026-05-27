import { User, OrderBook,Position,Fill,Order,type Market, type OrderSide } from "@repo/types"

function emergencyLiquidation(position:Position){

}

export function calculateEstimatedPrice(qty:bigint,side:OrderSide,orderBook:OrderBook){
        let filled =0n;
     
        let totalLevels = side === "SHORT"?orderBook.bidTree.getLength():orderBook.askTree.getLength()
        const removedPrices:bigint[]=[]
        let notionalSize = 0n;
        for(let i =0; i< totalLevels;i++ ){
            //get the pricelevel from opposite side
            const priceLevel = side === "SHORT"?orderBook.bidTree.getTop():orderBook.askTree.getMinAsk();
            if(priceLevel === undefined){
                console.log("bug: trees length and the actual number of prices are not mapped");
                continue;
            }
            let opSidelevelData= side === "LONG"?orderBook.asks.get(priceLevel):orderBook.bids.get(priceLevel);
            if(opSidelevelData === undefined){
                //TODO
                return;
            }
            
            const requiredQty = qty - filled;
            const availableQty = opSidelevelData.totalQty;
            if(availableQty >= requiredQty){
                filled += requiredQty;
                notionalSize += requiredQty* priceLevel;
                break;
            }else{
                filled += availableQty;
                notionalSize +=  availableQty*priceLevel;
                removedPrices.push(priceLevel);
                side === "SHORT"? orderBook.bidTree.removePrice(priceLevel): orderBook.askTree.removePrice(priceLevel);
            }

        }
        removedPrices.forEach((p)=> side === "SHORT"? orderBook.bidTree.addPrice(p): orderBook.askTree.addPrice(p))
        if(filled === 0n){
            return 0n;
        }
        let estimatedPrice = notionalSize/filled ;
        if(estimatedPrice === undefined) return 0n;
        return estimatedPrice;
}


export function PartialFillPosition(position:Position,order:Order,user:User,qty:bigint){

    if(position.qty < qty){
        return { success:false, message:"cannot fill the postion , had less qty"}
    }
    const direction = position.side === "SHORT" ? -1n :1n;
    const realizedPnL = (order.price-position.avgPrice)*qty*direction;
    const releasedMargin = (position.initialMargin*qty)/position.qty; 
    const settlementAmount =  releasedMargin+ realizedPnL;
    

    if(settlementAmount < 0){
        return emergencyLiquidation(position);
    }
    user.collateral.available += settlementAmount;
    position.initialMargin -= releasedMargin
    position.qty -= qty;
    order.filled += qty;

    if(position.qty === 0n){
        position.state = "CLOSED"
    }


    
    return;

}

function applyTaxation(position:Position,qty:bigint,price:bigint,type:"taker"|"maker",market:Market,exchangeBalance:bigint){
    
    let taxRate = type === "taker" ? market.takerRate : market.makerRate;
    const tax = (qty * price * taxRate)/market.taxationScale;

    if(position.initialMargin <= tax){
        emergencyLiquidation(position);
    }
    position.initialMargin -= tax;
    exchangeBalance += tax;
    
}

export function updatePositions(position:Position,order:Order,qty:bigint,user:User,orderBook:OrderBook){
    /**
         * we have the existing position, but the order either to settle or take more
         */
        const presentSide = order.side;
        if(position.side === presentSide){

            position.addFill(order.price,qty,order.leverage,position.side);
            order.filled += qty;
        }else{
            //settle the contract for quantity qty
            //need to settle the unrealizedPnL
            if(qty > position.qty){
                PartialFillPosition(position,order,user,position.qty);
                const newQty = qty - position.qty;
                //remove old position
                position.side === "SHORT"?orderBook.removeShort(position):orderBook.removeLong(position);
                position = new Position(user.userId,position.market,newQty,order.qty,order.side,order.leverage);

            }else{
                //settle the position
                PartialFillPosition(position,order,user,qty);
            }
        }
       
      

    
}

interface TransactResponse {
        matchedOrder:{
            direction:"1"|"-1",
            transactAmount:string
        },
        order:{
              direction:"1"|"-1",
            transactAmount:string
        }
    }
export function transact(bidder:User,asker:User,bidOrder:Order,askOrder:Order,orderBook:OrderBook,qty:bigint,market:Market,exchangeBalance:bigint){

     let sellerPosition = asker.positions.filter((p)=>p.market.marketId === askOrder.assetId)[0];
     let bidPosition = bidder.positions.filter((p)=>p.market.marketId === askOrder.assetId)[0];
     
     if(sellerPosition === undefined){
        //create new position
        sellerPosition = new Position(askOrder.userId,market,qty,askOrder.price,askOrder.side,askOrder.leverage);
        //ADDING POSITION TO THE SHORTS OR LONGS
        orderBook.addShort(sellerPosition);
        asker.positions.push(sellerPosition);
        askOrder.filled += qty;
        
     }else{
       updatePositions(sellerPosition,askOrder,qty,asker,orderBook);
     }
     
     
     applyTaxation(sellerPosition,qty,askOrder.price,"maker",market,exchangeBalance);

     if(bidPosition === undefined){
        //create new position     
        bidPosition = new Position(bidOrder.userId,market,qty,bidOrder.price,bidOrder.side,bidOrder.leverage);
        bidder.positions.push(bidPosition);
        orderBook.addLong(bidPosition);
        bidOrder.filled += qty; 
     }else{
        updatePositions(bidPosition,bidOrder,qty,bidder,orderBook)
     }
    
         applyTaxation(bidPosition,qty,askOrder.price,"maker",market,exchangeBalance);
    //position is filled completely -> then remove postion from the user and set its status to completed
    if(sellerPosition.qty === 0n){
        //position filled completely-->position status
        asker.positions = asker.positions.filter((p)=>{return !(p.qty === 0n)});
        sellerPosition.side === "SHORT" ? orderBook.removeShort(sellerPosition):orderBook.removeLong(sellerPosition);
        
        
    }else{
 
        sellerPosition.side === "SHORT" ? orderBook.removeShort(sellerPosition):orderBook.removeLong(sellerPosition);
        //positions are partially filled --> needto calculate the new liquidation prices and set the 
        sellerPosition.setLiquidationPrice();
        //add positions with new liquidation prices
        sellerPosition.side === "SHORT" ? orderBook.addShort(sellerPosition):orderBook.addLong(sellerPosition);       
    }
        

    if(bidPosition.qty === 0n){
        bidder.positions = bidder.positions.filter((p)=> !(p.qty===0n));
        bidPosition.side === "SHORT" ? orderBook.removeShort(bidPosition):orderBook.removeLong(bidPosition);
        
    }else{

        bidPosition.side === "SHORT" ? orderBook.removeShort(bidPosition):orderBook.removeLong(bidPosition);
        bidPosition.setLiquidationPrice();
        bidPosition.side === "SHORT" ? orderBook.addShort(bidPosition):orderBook.addLong(bidPosition);
    }
  
    return;
}
