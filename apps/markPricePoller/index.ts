import { WebSocket } from "ws"
import { createClient} from "redis"

const sender = createClient();
sender.on("error",(error)=>{
    console.log(error);
})

await sender.connect();

const URL = process.env.BINANCE_URL;
if(!URL) {console.log("env is not loaded");}
const ws = new WebSocket(URL!);

ws.on("connecton",()=>{
    console.log("conncected to binance wss");
})

ws.on("message",(bufferMessage)=>{
    console.log("got the following from binance-",bufferMessage.toString());
    const data = JSON.parse(bufferMessage.toString());
    const { p:markPrice,s:symbol} = data;
    const id = sender.xAdd("engine-stream","*",{event:"UPDATE_MARKPRICE",payload:JSON.stringify({symbol,markPrice})});
    console.log("shared the markPrice with the engine-",id);


})