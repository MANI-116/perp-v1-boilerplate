import { OrderBook,Position, PriceLevelObject ,Node} from "@repo/types"


/**
 * snapshot of all positions ===> apply funding rate per position and create new map for longs and shorts and pass it to the original positions
 */
export function fundingRateEngine(orderBook:OrderBook,rate:bigint,direction:-1n|1n){

    const newShorts = new Map<bigint,PriceLevelObject<Position>>();
    const newLongs = new Map<bigint,PriceLevelObject<Position>>();

    orderBook.shorts.forEach((levelObject)=>{
        let position = levelObject.list.getFirstOrder();
        applyFundingRate(position.value,rate,direction,newShorts,newLongs);       
    })

    orderBook.longs.forEach((levelObject)=>{
        let position = levelObject.list.getFirstOrder();
        applyFundingRate(position.value,rate,direction,newShorts,newLongs);
    })

    orderBook.shorts = newShorts;
    orderBook.longs = newLongs;

    
}

/**
 * funding rate get applied
 * -cut or add the fundingrate amount to the position
 * -calculate new lp
 * -change based on the lp 
 */
function applyFundingRate(position:Position,rate:bigint,direction:-1n|1n,shorts:Map<bigint,PriceLevelObject<Position>>,longs:Map<bigint,PriceLevelObject<Position>>){

    position.initialMargin += position.side === "SHORT" ?   (position.qty * position.avgPrice*rate*direction)/1000n: (position.qty * position.avgPrice*rate*direction*-1n)/1000n;
    position.setLiquidationPrice();

    const newLp = position.liquidationPrice;

    let level = position.side === "SHORT"?shorts.get(newLp):longs.get(newLp);
    if(level === undefined){
        level = new PriceLevelObject<Position>(position);
        position.side === "SHORT" ? shorts.set(newLp,level) : longs.set(newLp,level);
    }else{
        level.addNode(new Node<Position>(position))
    }



}