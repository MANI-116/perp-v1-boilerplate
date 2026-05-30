import express, {response, type Request} from "express";
import{z, ZodError} from "zod"
import jwt,{type JwtPayload} from "jsonwebtoken"
import cookieParser  from "cookie-parser"
import { ResponseManager} from "./util.ts"
import { prisma } from "@repo/db"


const responseManager = await ResponseManager.create()
interface CustomJwtResponse extends JwtPayload{
    userId:string

}
interface AuthRequest extends Request{
     userId ?:string;
}
const app = express();
app.use(express.json());
app.use(cookieParser());

 function generateId(){
    const id = `ord-${Date.now() + Math.random()*1e6}`;
    return id;
}

interface TempUser {
    password:string,
    username:string,
    userId:string
}
const users:TempUser[] = [];

const TypeSchema = z.enum(["LIMIT","MARKET"]);
const SideSchema = z.enum(["SHORT",'LONG'])
const CreateOrderSchema = z.object({
        type:TypeSchema,
        marketId:z.string().min(4),
        side:SideSchema,
        leverage:z.string().regex(/^\d+$/).transform((l)=>BigInt(l)),
        qty:z.string().regex(/^\d+$/).transform((q)=>BigInt(q)),
        price:z.string().regex(/^\d+$/).transform((p)=>BigInt(p)),
        userId:z.string().min(1)

})

const signUpSchema = z.object({
    name:z.string().min(1).max(90),
    username:z.string().min(4).max(25),
    password:z.string().min(6).max(30)
})

const createMarketSchema = z.object({
    name:z.string().min(2),
    symbol:z.string(),
    slug:z.string(),
    scale:z.string(),
    markPrice:z.string(),
    takerRate:z.string(),
    makerRate:z.string(),
    mmr:z.string()
})

app.post("/admin/market",async (req,res)=>{

    try {
        
        const marketDetails = createMarketSchema.parse(req.body);
    
        const response = await prisma.market.create({
            data:{
                ...marketDetails,
                  scale:BigInt(marketDetails.scale),
                    markPrice:BigInt(marketDetails.markPrice),
                    takerRate:BigInt(marketDetails.takerRate),
                    makerRate:BigInt(marketDetails.makerRate),
                    mmr:BigInt(marketDetails.mmr)

            },
            select:{id:true}
        })

        console.log("market is created-",response);

       const engineResponse =  responseManager.putRequest({type:"CREATE_MARKET",payload:{marketId:response.id}});

       res.status(200).send("market added successfully");
    } catch (error) {
        
        res.status(500).send("unknownerror")
    }


})


app.post("/signup", async (req, res) => {
    console.log("user signup");

    try {   
        const parsedResponse = await signUpSchema.safeParseAsync(req.body);
        if(!parsedResponse.success){
            return res.status(400).json({message:"validation error", error:parsedResponse.error})
        }
        
        const { username, password, name } = parsedResponse.data;
        
        const userFound = await prisma.user.findUnique({
            where:{username:username},
            select:{userId:true}, });
        if(userFound  !=  null) {
            return res.status(401).send({message:"username taken", error:"duplicate"});
        }
        
        //create the user
        
        const newUser  = await prisma.user.create({
            data:{
                username:username,
                name:name,
                password:password
            },
            select:{
                userId:true
            }
        })
        if(!newUser.userId){
            throw new Error("userId not created");
        }
        const userId = newUser.userId ;
        //add user to the engine
        responseManager.putRequest({type:"CREATE_USER",payload:{userId}})
        return res.status(201).send({message:"user created", userId:newUser.userId});
    } catch (error) {

        return res.status(404).send({error:"error occured",message:error})
        
    }

})


app.post("/signin",async (req, res) => {

    try {
        
        const parsedData =  signUpSchema.safeParse(req.body);
        
        if(!parsedData.success){
            return res.status(400).json({
                message: "validation error",
                error: parsedData.error
            })
        }
        
        const {username, password } = parsedData.data;
        
        const user = await prisma.user.findUnique({
            where:{
                username:username
            },
            select:{
                password:true,
                userId:true
            }
        });

        if(!user || user.password != password) return res.status(400).send({message:"please check your password and username"});
        
        //cerate token
        const passCode = process.env.JWT_PASS;
        if(passCode === undefined) { console.log(" env are not loaded")
            return res.status(500).send({message:"internal server error"});
    }
    const token = jwt.sign({userId:user.userId},passCode,{expiresIn:"1d"});
    
    return res.status(200).cookie("Authorization",token).json({message:"successfull"});
    } catch (error) {      
        return res.status(404).send({error:"error occured",message:error})
               
    }
    
})
app.post("/onramp", AuthMiddleWare,(req:AuthRequest, res) => {
    console.log("ramping the users balance");
    
})
app.post("/order", async (req, res) => {
    try {
        
        // const userId = req.userId;
        // if(!userId) return  res.send("no user found");
        const payload = CreateOrderSchema.parse(req.body);
        const orderId = generateId();
        const response = await responseManager.putRequest({type:"CREATE_ORDER",payload:{...payload,orderId}})
        
        return res.json({...response})
        
    } catch (error) {
        if( error instanceof ZodError){
            console.log("invalid user payload");
            return res.status(403).json(error)
        }
        return res.status(500).send("internal server error");
        
    }
})

const delteOrderSchema = z.object({
    orderId:z.string().min(2),
    marketId:z.string().min(2)
})
app.delete("/order", async (req, res) => {

    try {
            const parsedOrder = delteOrderSchema.safeParse(req.body);
            if(parsedOrder.error){
                return res.status(400).json(parsedOrder.data)
            }
            const response = await responseManager.putRequest({type:"DELETE_ORDER",payload:parsedOrder.data});

            return res.status(204).json(response);
        
            
    } catch (error) {

        res.status(500).json({error:"internal server error"});
        
    }
    
})
app.get("/equity/available",AuthMiddleWare, async(req, res) => {

    try {
        const userId = req.body.userId as string;
        const response = await responseManager.putRequest({type:"GET_EQUITY",payload:{userId}});
        res.json({...response});
    } catch (error) {
        
    }
})
app.get("/positions/open/:marketId",AuthMiddleWare, async (req, res) => {
    
    try {
        const{ marketId} = req.params;
        if(!marketId) return res.status(400).send({error:"plz send correct marketId"}) ;
        if(typeof marketId != "string") return res.status(400).send({error:"plz send correct marketId"});
        const userId = req.body.userId as string;
        const response = await responseManager.putRequest({type:"GET_OPEN_POSITIONS",payload:{userId,marketId}});
        res.json({...response});
        
    } catch (error) {
        
    }

});
app.get("/positions/closed/:marketId",AuthMiddleWare,async (req, res) => {
    
    try {
                const{ marketId} = req.params;
        const userId = req.body.userId as string;
        if(!marketId) return res.status(400).send({error:"plz send correct marketId"}) ;
        if(typeof marketId != "string") return res.status(400).send({error:"plz send correct marketId"});
        const response = await responseManager.putRequest({type:"GET_CLOSED_POSITIONS",payload:{userId,marketId}});
        res.json({...response});
        
    } catch (error) {
        
    }

});
app.get("/orders/open/:marketId",AuthMiddleWare,async (req, res) => {
     try {
        const userId = req.body.userId;
        const {marketId } = req.params;

        if(typeof marketId != "string") return res.send("send proper marketid")
        const orders = await prisma.order.findMany({where:{
            userId,
            marketId ,
            state:"OPEN"
        }})

        return res.status(200).json({orders});

    } catch (error) {
         res.status(500).json({error:"internal server error"});
        
    }
})
app.get("/orders/:marketId",AuthMiddleWare,async (req, res) => {
    try {
        const userId = req.body.userId;
        const {marketId } = req.params;

        if(typeof marketId != "string") return res.send("send proper marketid")
        const orders = await prisma.order.findMany({where:{
            userId,
            marketId 
        }})

        return res.status(200).json({orders});

    } catch (error) {
         res.status(500).json({error:"internal server error"});
        
    }
})  
app.get("/fills",AuthMiddleWare,async (req, res) => {
    const userId = req.body.userId;
try {
    const fills = await prisma.transaction.findMany({
        where:{
            OR:[
                {takerId:userId},
                {makerId:userId}
            ]
        },
        select:{
            qty:true,
            price:true,
            marketId:true
        }
    });

    return res.status(200).json({fills});
} catch (error) {
            res.status(500).json({error:"internal server error"});
}
    

});


app.listen(process.env.PORT,()=>{
    console.log(`server is running on the port-${process.env.PORT}`);
})

function AuthMiddleWare(req:AuthRequest,res:express.Response,next:express.NextFunction){

    const token =  req.cookies.Authorization;
    if(token === undefined) return res.status(400).json({message:"cookie not found"});
    const passcode = process.env.JWT_PASS;
    if(passcode === undefined) {
        console.log("env not loaded");
        return res.status(500).json({"message":"env not found error"});
    }

    try {
        const tokenData = jwt.verify(token,passcode) as CustomJwtResponse;
        if(typeof tokenData === "string"){ throw new Error("expected customJwt but got string")}
        console.log("token data",tokenData);
        req.userId= tokenData.userId;
        next();      
        
    } catch (error) {

        console.log("error on authentication",error);
        
        return res.status(400).json({message:"error on authorization",error});
        
    }
}