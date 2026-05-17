import express from "express";
import{z} from "zod"
import jwt from "jsonwebtoken"
import cookieParser  from "cookie-parser"
const app = express();
app.use(express.json());
app.use(cookieParser());
const users = [{
    userId: 1,
    username: "harkirat",
    password: 123123,
    collateral: {
         available: 2000,
         locked: 1000
    },
     positions: [
        { market: "SOL", type: "LONG", qty: 10, margin: 500, liquidationPrice: 80, averagePrice: 90 },
        { market: "ETH", type: "SHORT", qty: 1, margin: 500, liquidationPrice: 2000, averagePrice: 1900 }
    ],
    orders: [
        { orderId: 1, market: "SOL", type: "LONG", qty: 10, margin: 500, orderType: "limit", price: 90, status: "filled" },
        { orderId: 2, market: "ETH", type: "SHORT", qty: 10, margin: 500, orderType: "limit", price: 1900, status: "filled" },
        { orderId: 3, market: "BTC", type: "LONG", qty: 10, margin: 500, orderType: "limit", price: 1900, status: "cancelled" },
    ]
}, {
    userId: 2,
    username: "raman",
    password: 123123,
    collateral: {
         available: 2000,
         locked: 2000
    },
    positions: [
        { market: "SOL", type: "SHORT", qty: 10,  margin: 1000, liquidationPrice: 80, pnL: 200, averagePrice: 90 },
        { market: "ETH", type: "LONG", qty: 1, margin: 1000, liquidationPrice: 2000, pnL: -100, averagePrice: 1900 }
    ],
    orders: [
        { orderId: 10, market: "SOL", type: "SHORT", qty: 10, margin: 500, orderType: "market", price: 90, status: "filled" },
        { orderId: 11, market: "ETH", type: "LONG", qty: 10, margin: 500, orderType: "market", price: 1900, status: "filled" },
        { orderId: 12, market: "ZEC", type: "LONG", qty: 10, margin: 500, orderType: "limit", price: 1900, status: "open" },
    ]
}];

type Bid = {
    availableQty: number,
    openOrders: { userId: number, qty: number, filledQty: number, orderId: number, createdAt: Date }[]
}

type Orderbook = {
    bids: Record<string, Bid>,
    asks: Record<string, Bid>,
    lastTradedPrice: number,
    indexPrice: number
}

type Orderbooks = Record<string, Orderbook>

const orderbooks: Orderbooks = {
     SOL: { bids: {}, asks: {}, lastTradedPrice: 90, indexPrice: 90.01 },
     ETH: { bids: {}, asks: {}, lastTradedPrice: 1900, indexPrice: 1899.9 }
}

const fills = [{
    maker: 1,
    taker: 2,
    market: "SOL",
    qty: 10,
    price: 90,
    long: 1,
    short: 2
}, {
    maker: 1,
    taker: 2,
    market: "ETH",
    qty: 1,
    price: 1900,
    long: 2,
    short: 1
}];

type Fill = typeof fills[0];

type User = typeof users[0];

type Position = typeof users[0]["positions"][0];
type Orders = typeof users[0]["orders"][0];


const signUpSchema = z.object({
    username:z.string().min(4).max(25),
    password:z.number()
})


app.post("/signup", async (req, res) => {

    const parsedResponse = await signUpSchema.safeParseAsync(req.body);
    if(!parsedResponse.success){
        return res.status(400).json({message:"validation error", error:parsedResponse.error})
    }

    const { username, password } = parsedResponse.data;

    const userFound = users.filter((user)=>user.username === username);
    if(userFound.length != 0) {
        return res.status(401).send({message:"username taken", error:"duplicate"});
    }

    //create the user
    const userId = Math.random()*1000000
    const newUser:User  = {
        userId,
        username,
        password,
        collateral:{
            available:0,
            locked:0
        },
        orders:[],
        positions:[]
        
    } 
    users.push(newUser);
    return res.status(201).send({message:"user created", userId})
})


function AuthMiddleWare(req:express.Request,res:express.Response,next:express.NextFunction){

    const token =  req.cookies.get("Authorization");
    if(token === undefined) return res.status(400).json({message:"cookie not found"});
    const passcode = process.env.JWT_PASS;
    if(passcode === undefined) {
        console.log("env not loaded");
        return res.status(500).json({"message":"env not found error"});
    }

    try {
        const tokenData = jwt.verify(token,passcode);
        console.log("token data",tokenData);
        req.body.username = tokenData;
        next();      
        
    } catch (error) {

        console.log("error on authentication",error);
        
        return res.status(400).json({message:"error on authorization",error});
        
    }
}
app.post("/signin", (req, res) => {

    const parsedData =  signUpSchema.safeParse(req.body);

    if(!parsedData.success){
        return res.status(400).json({
            message: "validation error",
            error: parsedData.error
        })
    }

    const {username, password } = parsedData.data;

    const user = users.filter((user)=>user.username===username && user.password === password);

    if(user.length === 0 ) return res.status(400).send({message:"please check your password and username"});

    //cerate token
    const passCode = process.env.JWT_PASS;
    if(passCode === undefined) { console.log(" env are not loaded")
        return res.status(500).send({message:"internal server error"});
    }
    const token = jwt.sign({username},passCode,{expiresIn:"1d"});

    return res.status(200).cookie("Authorization",token).json({message:"successfull"});
})
app.post("/onramp", (req, res) => {})
app.post("/order", (req, res) => {})
app.delete("/order", (req, res) => {})
app.get("/equity/available", (req, res) => {})
app.get("/positions/open/:marketId", (req, res) => {});
app.get("/positions/closed/:marketId", (req, res) => {});
app.get("/orders/open/:marketId", (req, res) => {})
app.get("/orders/:marketId", (req, res) => {})
app.get("/fills", (req, res) => {});

async function liqudationChecks(asset: string, price: number) {

}


async function onPriceUpdateFromBinance(asset: string, price: number) {
    liqudationChecks(asset, price);   
}
