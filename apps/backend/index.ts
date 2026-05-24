import express, {type Request} from "express";
import{z, ZodError} from "zod"
import jwt,{type JwtPayload} from "jsonwebtoken"
import cookieParser  from "cookie-parser"
import { User} from "@repo/types"
import { engineManager } from "../engine/index.ts";
import { ResponseManager} from "./util.ts"


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
        leverage:z.string().regex(/^\d+$/),
        qty:z.string().regex(/^\d+$/),
        price:z.string().regex(/^\d+$/),
        userId:z.string().min(1)

})

const signUpSchema = z.object({
    username:z.string().min(4).max(25),
    password:z.string().min(6).max(30)
})


app.post("/signup", async (req, res) => {
    console.log("user signup");
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
    const userId = generateId();
    const newUser:TempUser  = {userId,username,password}
    users.push(newUser);
    return res.status(201).send({message:"user created", userId})
})


app.post("/signin", (req, res) => {
    
    const parsedData =  signUpSchema.safeParse(req.body);
    
    if(!parsedData.success){
        return res.status(400).json({
            message: "validation error",
            error: parsedData.error
        })
    }
    
    const {username, password } = parsedData.data;
    
    const user = users.filter((user)=>user.username===username && user.password === password)[0];
    
    if(user === undefined ) return res.status(400).send({message:"please check your password and username"});
    
    //cerate token
    const passCode = process.env.JWT_PASS;
    if(passCode === undefined) { console.log(" env are not loaded")
        return res.status(500).send({message:"internal server error"});
}
const token = jwt.sign({userId:user.userId},passCode,{expiresIn:"1d"});

return res.status(200).cookie("Authorization",token).json({message:"successfull"});
})
app.post("/onramp", AuthMiddleWare,(req:AuthRequest, res) => {
    console.log("ramping the users balance");
    
})
app.post("/order", async (req, res) => {
    try {
        
        // const userId = req.userId;
        // if(!userId) return  res.send("no user found");
        const payload = CreateOrderSchema.parse(req.body);
        const corelationId = generateId();
        const response = await responseManager.putRequest({payload:JSON.stringify({...payload}),payloadType:"createOrder",corelationId})
        
        return res.json({...response})
        
    } catch (error) {
        if( error instanceof ZodError){
            console.log("invalid user payload");
            return res.status(403).json(error)
        }
        return res.status(500).send("internal server error");
        
    }
})
app.delete("/order", (req, res) => {
    
})
app.get("/equity/available", (req, res) => {})
app.get("/positions/open/:marketId", (req, res) => {});
app.get("/positions/closed/:marketId", (req, res) => {});
app.get("/orders/open/:marketId", (req, res) => {})
app.get("/orders/:marketId", (req, res) => {})
app.get("/fills", (req, res) => {});


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