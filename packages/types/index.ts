

function generateId(){
    const id = `ord-${Date.now() + Math.random()*1e6}`;
    return id;
}

export interface PayloadOrder{
    type:"MARKET"|"LIMIT",
    marketId:string
    userId:string,
    side:OrderSide,
    leverage:bigint,
    qty:bigint,
    price:bigint,
    orderId:string
}

export interface EngineCreateOrder{
    type:"MARKET"|"LIMIT",
    marketId:string
    userId:string,
    side:OrderSide,
    leverage:string,
    qty:string,
    price:string,
    orderId:string
}

export class Fill{
    private fillId:string;
    private tradeId:string;

    constructor(public userId:string, public qty:bigint, public price:bigint,public orderId:string ){
        this.fillId = generateId();
        this.tradeId = generateId();

    }
}


export interface Collateral{
    available:bigint,
    locked:bigint
}
export class User {
    public collateral:Collateral;
    public positions:Position[];
    public orders:Order[];
    
    constructor(public userId:string){
        this.positions = [];
        this.orders = [];
        this.collateral = {available:0n,locked:0n}

    }
}

export interface Market{
    markPrice:bigint,
    marketId:string,
    mmr:bigint,
    takerRate:bigint,
    makerRate:bigint,
    taxationScale:bigint
}
export class Position {
    public id:string;
    public state:"CLOSED"|"OPEN"="OPEN";
    public initialMargin:bigint;
    public unrealizedPnL:bigint;
    public avgPrice:bigint;
    public liquidationPrice:bigint;
  

    
     setInitialMargin(){
        const positionalSize = this.avgPrice * this.qty;
    

     }
     setUnrealizedPnL(){
        this.unrealizedPnL =( this.market.markPrice-this.avgPrice)*this.qty;
     }

     setLiquidationPrice(){
        if(this.qty === 0n || this.state ==="CLOSED"){
            throw new Error("qty is zero,we cannot measure of zero qty or state is closed ");
        }
        let direction =  this.side ==="SHORT" ?1n:-1n;
        this.liquidationPrice = ((this.avgPrice*this.qty)+this.initialMargin*direction)/(this.qty * (1000n-this.market.mmr));
     }
    
     setLeverage(leverage:bigint){

     }
    constructor(public userId:string, public market:Market, public qty:bigint, price:bigint, public side:"LONG"|"SHORT",leverage:bigint){
        this.id = generateId();
  
        this.avgPrice = price;
         const positionalSize = this.avgPrice * this.qty;
        this.initialMargin = positionalSize/leverage;
        this.unrealizedPnL =( this.market.markPrice-this.avgPrice)*this.qty;
        let direction =  this.side ==="SHORT" ?1n:-1n;
        this.liquidationPrice = ((this.avgPrice*this.qty)+this.initialMargin*direction)/(this.qty * (1000n-this.market.mmr));

        
    }

    setNewAvgPrice(price:bigint,qty:bigint){
        this.avgPrice =( (this.avgPrice * this.qty)+(price*qty))/(this.qty+qty)
    }
    addFill(price:bigint,qty:bigint,leverage:bigint,side:"LONG"|"SHORT"){
        //know wether the add fill is on the on the same side or not
    

        const sameSide = side === this.side;
        if(sameSide){
            //add quantity
            //recalculate the avg price,liquidationPrice and also the margins and also change the unrealized PnL
            this.qty += qty;
            this.setNewAvgPrice(price,qty);
            const margin = (price*qty)/leverage;
            this.initialMargin += margin;
            this.setLiquidationPrice();

            
        }else{

            if(qty < this.qty){
                /**
                 * decrease quantity
                 * avg price wont change
                 * inital margin decreased
                 * calculate liquidation
                 */
                const marginPerQty = this.qty/this.initialMargin; 
                this.qty -= qty;
                this.initialMargin = this.qty*marginPerQty;
                
                this.setLiquidationPrice();

            }else if(qty > this.qty){
                //reversal case
                const netQuantity = qty - this.qty;
                this.qty = netQuantity;
                this.avgPrice= price;
               
                this.side = side;
                this.initialMargin = (netQuantity*price)/leverage ;
                this.setLiquidationPrice()

            }else{
                //close the position
                this.state = "CLOSED";

            }
  

        }
       
       

    }
}
export type OrderStatus = "FILLED"|"PARTIALLY_FILLED"|"CANCELED"|"OPEN"
export type OrderSide = "SHORT" | "LONG"
export class Order{
    public maintenanceMargin:bigint;
    public initialMargin:bigint;
    public filled:bigint = 0n;
    public status:OrderStatus = "OPEN"
    constructor(public orderId:string,public userId:string,public assetId:string, public qty:bigint, public side:OrderSide , public price:bigint, public leverage:bigint){
        console.log("orderId-",this.orderId)
        if(this.orderId === "" || this.orderId === undefined) throw new Error("orderId is needed")
        this.initialMargin =(this.qty*this.price)/this.leverage 
        this.maintenanceMargin = (this.qty * this.price*5n)/1000n;
    }
}


export class Node<T>{
     left:Node<T>|null = null;
     right:Node<T>|null = null;

    constructor(public value:T){

    }

}
export class Dll<T>{
    private head:Node<T>;
    private tail:Node<T>;
    public length:number=0;
    constructor(node:Node<T>){
        this.head = node;
        this.tail = node;
        this.length++;
    }
    getFirstOrder(){
        return this.head;
    }

    addNode(node:Node<T>){
        //we need to  connect node to the tail and point the tail to the node
        this.tail.right = node;
        node.left = this.tail;
        this.tail  = node;
        this.length++;

    }

    removeNode(node:Node<T>):{success:boolean,message:string}{
        //start of the list
        if(this.head === node){
            //remove connection to the right node from node and left connections of right node
            //point head to the next node
            let rightNode = this.head.right;
            if(rightNode === null){
                //single node;
                return { success:false,message:"single node ,so remove the DLL"}
            }
            this.head = rightNode
            node.right = null;
            rightNode.left = null;
            this.length--;
            return { success:true, message:"removed the node"}
        }
        //at the end
        if(this.tail === node){

            let leftNode = node.left;
            if(leftNode === null) return { success:false,message:"single node,remove the list"}
            this.tail = leftNode;
            leftNode.right = null;
            node.left =null;
            this.length--;
            return { success:true, message:"removed the node"}
        }

        //middle of the list
        const leftNode = node.left
        const rightNode = node.right
        if(!leftNode || !rightNode ) return { success:false, message:"unable to remove node"}
        leftNode.right = rightNode;
        node.left = null;
        rightNode.left=leftNode;
        node.right = null;
        this.length--;
        return { success:true, message:"removed the node"}

    }


}

interface Qty{
    qty:bigint;
}

export class PriceLevelObject<T extends Qty>{
    public totalQty:bigint = 0n;
    public list:Dll<T>;
    private length:number=0;

    constructor(order:T){
        let orderNode = new Node<T>(order);
        this.list = new Dll<T>(orderNode);
        this.length ++;
        const qty = order.qty;
        this.totalQty += qty;
        return 

    }
    

    addNode(node:Node<T>){
        this.length++;
        const qty = node.value.qty;
        this.totalQty += qty;
        this.list.addNode(node);
        return;

    }

    removeNode(node:Node<T>){
        const response = this.list.removeNode(node);
        if(response.success){
            this.totalQty -= node.value.qty;
            this.length --;
        }
        return response;
    }

}

export class BidTree{
    private prices:bigint[];
    constructor(){
        this.prices = [];
    }
    getLength(){
        return this.prices.length
    }

    private findPosition(price:bigint,start:number,end:number):number{
        if(start < end || this.prices.length >= end) return -1;
        if(start === end ){
            if(this.prices[start] === price) {
                return start;
            }else if(this.prices[start]! < price){
                return start+1;

            }else{
                return start -1;
            }
        }

        const middle = start + (end-start)/2 ;
        if(this.prices[middle] === price){
            return middle;
        }else if(this.prices[middle]! < price){
            return this.findPosition(price,middle+1,end);
        }

        return this.findPosition(price,start,middle-1);

    }
    removePrice(price:bigint){
               const position = this.findPosition(price,0,this.prices.length-1);
               if(position > 0 || position === this.prices.length || this.prices[position] != price){
                return true;

               }

               if(this.prices[position] === price){
                
                const res = this.prices.splice(position,1);
                return true;

               }
    }

    addPrice(price:bigint):boolean{
        if(this.prices.length === 0){
            this.prices.push(price);
            return true;
        }
        const position = this.findPosition(price,0,this.prices.length-1);
        if(position === -1){
            //insert at start;
            this.prices.push(price);
            //shift the prices
            for(let i = this.prices.length-1;i >0 ; i--){
                this.prices[i]!=this.prices[i-1];
            }

            this.prices[0] = price;
            return true;
        }
        if(position === this.prices.length){
            this.prices.push(price);
            return true;
        }
        if(this.prices[position] === price) return true;
        this.prices.push(price)

        //shifting prices right to place the element in the position
        for( let i = this.prices.length-1;i >= position; i++){
            this.prices[i] = this.prices[i-1]!;
        }

        this.prices[position] = price;
        return true;
    }

    getTop(){
        return this.prices[this.prices.length-1];
    }

    pop(){
        return this.prices.pop();
    }


}

export class AskTree{
    private prices:bigint[];
    constructor(){
        this.prices = [];
    }
    getLength(){
        return this.prices.length;
    }
     private findPosition(price:bigint,start:number,end:number):number{
        if(start > end || start >= this.prices.length || end >= this.prices.length || start < 0 || end < 0 ){
            return -1;
        }
        if( start === end){
            if(price < this.prices[start]!){
                return start+1;
            }else if(price > this.prices[start]!){
                return start-1;
            }else{
                return start;
            }
        }

        const middle = start + (end-start)/2;

        if(price < this.prices[middle]!){
            return this.findPosition(price,middle+1,end);

        }else if(price > this.prices[middle]!){
            return this.findPosition(price,start,middle-1);

        }
        return middle;

    }
    private shift(start:number,end:number):{success?:boolean,message:string}{
        if(end+1 >= this.prices.length){
            return { success:false, message:"end is out of bound"}

        }
        for(let current =  end;current >= start; current--){
            this.prices[current+1] = this.prices[current]!;

        }

        return { success:true,message:"shifted succesfully"};
    }
    addPrice(price:bigint):boolean{
        //when array is empty length is 0
        if(this.prices.length === 0){
            this.prices.push(price);
            return true;
        }
        const index = this.findPosition(price,0,this.prices.length-1);
        console.log("place to put price-",index);
        if(index === -1 ){
            //insert at start
            this.prices.push(price);
            const res = this.shift(0,this.prices.length-1);
             if(!res.success){ 
            console.log("error while shifting--", res.message)
            return false;
            }
            this.prices[0] = price;
            return true;
        }

        if(index === this.prices.length){
            //insert at the end:
            this.prices.push(price);
            return true;
        }
        //already found
        if(this.prices[index] === price){
            return true;
        }
         //shifting needed
         //make space for the new element
       
         const res = this.shift(index,this.prices.length-1);
         if(!res.success){ 
            console.log("error while shifting--", res.message)
            return false;
         }
         this.prices[index]=price;
         return true;
        
    }

    removePrice(price:bigint){
        const position = this.findPosition(price,0,this.prices.length);
        if(position === -1 || position === this.prices.length) return true;
        if(this.prices[position] === price){
            //remove the price
            if(position === this.prices.length-1){
                this.prices.pop();
                return true;
            }
            for(let index =position; index < this.prices.length;index++){
                this.prices[index] = this.prices[index+1]!;
            }
            this.prices.pop();
            return true
        }
        return false;
    }

    getMinAsk(){
        return this.prices[this.prices.length-1];
    }
    pop(){
        return this.prices.pop()
    }
}



export class OrderBook{
    private assetId:string;
    public asks:Map<bigint,PriceLevelObject<Order>>;
    public bids:Map<bigint,PriceLevelObject<Order>>;
    public askTree:AskTree;
    public bidTree:BidTree;
    public longsTree:BidTree;
    public shortsTree:AskTree;
    private ordersRef:Map<string,Node<Order>>
    public longs:Map<bigint,PriceLevelObject<Position>>
    public shorts:Map<bigint,PriceLevelObject<Position>>
    private postionsRef:Map<string,Node<Position>>
    constructor(assetId:string){
        this.assetId = assetId;
        this.asks = new Map<bigint,PriceLevelObject<Order>>();
        this.bids = new Map<bigint,PriceLevelObject<Order>>();
        this.askTree  = new AskTree();
        this.bidTree = new BidTree();
        this.longsTree = new BidTree();
        this.shortsTree = new AskTree();
        this.ordersRef = new Map<string,Node<Order>>();
        this.longs = new Map<bigint,PriceLevelObject<Position>>();
        this.shorts = new Map<bigint,PriceLevelObject<Position>>();
        this.postionsRef = new Map<string,Node<Position>>();
    }

    deleteOrder(orderId:string){
        const node =  this.ordersRef.get(orderId);
        if(!node) return { error:"did not find the reference"};
        const order = node.value;
        const side = order.side;
        const priceLevel = order.price;
        const levelData = side === "SHORT" ? this.asks.get(priceLevel):this.bids.get(priceLevel);
        levelData?.removeNode(node);
        
    }
    addShortLiquidationPrice(price:bigint){
       return  this.shortsTree.addPrice(price);
    }
    addLongLiquidationPrice(price:bigint){
       return  this.longsTree.addPrice(price);
    }
    addAskOrder(order:Order){
        const price = order.price
        //wether level is present or not 
        const levelData = this.asks.get(price);
        if(levelData === undefined) {
            //create level and create ask level price in ask tree and add order to the list
            let newLevelData = new PriceLevelObject<Order>(order);
            this.askTree.addPrice(price);
            this.asks.set(price,newLevelData);
            this.ordersRef.set(order.orderId,newLevelData.list.getFirstOrder())
            return;

        }else{
            //present add order to the list and update the qty
            const orderNode = new Node<Order>(order);
            levelData.addNode(orderNode);
            this.ordersRef.set(order.orderId,orderNode);

        }


    }

    addBidOrder(order:Order){
        const price = order.price;

        //check level
        const levelData = this.bids.get(price);
        if(levelData === undefined){
            //level not there create the level and add bidprice to the bidtree and add the order
            const newLevelData = new PriceLevelObject<Order>(order);
            this.bids.set(price,newLevelData);
            this.bidTree.addPrice(price);
            this.ordersRef.set(order.orderId,newLevelData.list.getFirstOrder());
            return;
        }else{

        const node = new Node<Order>(order);
        levelData?.addNode(node);
        this.ordersRef.set(order.orderId,node);
        return;        
    }
    }

    
    removeAskOrder(order:Order){
        //we need to remove the orderRef
        //we need to remove the level if dll have only one order also
        const priceLevel = order.price;
        const priceLevelData = this.asks.get(priceLevel);
        if(priceLevelData === undefined){
            return { succes:true,message:"price level not found"};

        }
        const levelList = priceLevelData.list;
        let orderNode = this.ordersRef.get(order.orderId);
        if(orderNode === undefined){ return {success:true,message:"order not found"}}
        const response = priceLevelData.removeNode(orderNode);
        if(!response.success){
            //we nee to remove the price level
            this.asks.delete(priceLevel);
            console.log("removed the price Level")
            
        }
        this.ordersRef.delete(order.orderId);
        return { success:"true",message:"removed order"}

    }

    removeBuyOrder(order:Order){
        //we need to remove the orderRef
        //we need to remove the level if dll have only one order also
        const priceLevel = order.price;
        const priceLevelData = this.bids.get(priceLevel);
        if(priceLevelData === undefined){
            return { succes:true,message:"price level not found"};

        }
        const levelList = priceLevelData.list;
        let orderNode = this.ordersRef.get(order.orderId);
        if(orderNode === undefined){ return {success:true,message:"order not found"}}
        const response = priceLevelData.removeNode(orderNode);
        if(!response.success){
            //we nee to remove the price level
            this.bids.delete(priceLevel);
            console.log("removed the price Level")
            
        }
        this.ordersRef.delete(order.orderId);
        return { success:"true",message:"removed order"}

    }

    addLong(position:Position){
        const liquidationPrice = position.liquidationPrice;

        //if we have the pricelevel 
        let levelData = this.longs.get(liquidationPrice);
        let positionRef:Node<Position>
        if(levelData === undefined){
        //-->  create the the pricelevel and add postion and add level to the longsTree
            levelData = new PriceLevelObject<Position>(position);
            this.longs.set(liquidationPrice,levelData);
            positionRef = levelData.list.getFirstOrder();
            this.longsTree.addPrice(liquidationPrice);

        }else{
            //-->then added it to the list add postion reference to positionrefmap 
            positionRef = new Node<Position>(position)
            levelData.list.addNode(positionRef);
            
        }
        //add the reference to the map
        this.postionsRef.set(positionRef.value.id,positionRef);
        return { message:"added successfully"};

    }

    addShort(position:Position){
        const liquidationPrice = position.liquidationPrice;

        //if we have the pricelevel 
        let levelData = this.shorts.get(liquidationPrice);
        let positionRef:Node<Position>
        if(levelData === undefined){
        //-->  create the the pricelevel and add postion and add level to the longsTree
            levelData = new PriceLevelObject<Position>(position);
            this.shorts.set(liquidationPrice,levelData);
            positionRef = levelData.list.getFirstOrder();
            this.shortsTree.addPrice(liquidationPrice);

        }else{
            //-->then added it to the list add postion reference to positionrefmap 
            positionRef = new Node<Position>(position)
            levelData.list.addNode(positionRef);
            
        }
        //add the reference to the map
        this.postionsRef.set(positionRef.value.id,positionRef);
        return { message:"added successfully"};

    }

    removeShort(position:Position ,lp?:bigint){
        //get the level
        // ******** lp is for the postions which transitioned from the short to long
        //single order remove level,remove ref and remove treePrice check wether positon is long or short
        const level = lp? this.shorts.get(lp): this.shorts.get(position.liquidationPrice);
        if(level === undefined){ return { success:false, message:"position doesnot exist"}};
        //get the reference of the position
        const posRef = this.postionsRef.get(position.id);
        if(posRef === undefined){
            return { success:false, message:"no position found"}
        }
        const response = level.list.removeNode(posRef);
        if(!response.success){
            //single order ,need to remove the whole level and levelprice in the shorts tree
            console.log("removing level and the pprice in tree")
            this.shorts.delete(position.liquidationPrice);
            this.shortsTree.removePrice(position.liquidationPrice);
            this.postionsRef.delete(position.id);
            return {success:true,message:"position removed succesfully"}
        }
        this.postionsRef.delete(position.id);
        return { success:true, message:"removed the postion"}
        

    }

    removeLong(position:Position,lp?:bigint){
        //get the level
        //single order remove level,remove ref and remove treePrice
        const level =lp?this.longs.get(lp): this.longs.get(position.liquidationPrice);
        if(level === undefined){ return { success:false, message:"position doesnot exist"}};
        //get the reference of the position
        const posRef = this.postionsRef.get(position.id);
        if(posRef === undefined){
            return { success:false, message:"no position found"}
        }
        const response = level.list.removeNode(posRef);
        if(!response.success){
            //single order ,need to remove the whole level and levelprice in the longs tree
            console.log("removing level and the pprice in tree")
            this.longs.delete(position.liquidationPrice);
            this.longsTree.removePrice(position.liquidationPrice);
            this.postionsRef.delete(position.id);
            return {success:true,message:"position removed succesfully"}
        }
        this.postionsRef.delete(position.id);
        return { success:true, message:"removed the postion"}

    }

    

}


export interface Transaction{
  qty:bigint 
  price:bigint
  takerId: string       
  makerId: string       
  takerFee:bigint
  makerFee :bigint
  orderId: string       
}



export  * from "./structures/engineEvents.ts"