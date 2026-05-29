import { createClient} from "redis"
import { type CreateUser,type PayloadOrder,type EngineRequest} from "@repo/types"
export function generateId(){
    const id = `ord-${Date.now() + Math.random()*1e6}`;
    return id;
}

type EngineResponse = {
    corelationId: string;
    status: string;
    data?: any;
};
interface Stream {
     name: string; 
     messages: { id: string; message: { [x: string]: string; };
      millisElapsedFromDelivery?: number | undefined; 
      deliveriesCounter?: number | undefined
}[]
};
type XReadResponse = Stream[] |null;


type RedisClientType = ReturnType<typeof createClient>;

export class ResponseManager{
    private requestMap:Map<string,(value:EngineResponse)=>void>;
    
    constructor(private sender:RedisClientType,private receiver:RedisClientType){
        this.requestMap = new Map<string,(value:EngineResponse)=>void>();
        this.responsePuller();


    }

    private  async responsePuller(){
        while(true){
            console.log("fetching the reesponses from the engine....")
            const response:XReadResponse = await this.receiver.xReadGroup("response-group","response",[{
                key:"response-stream",
                id:">"
            }],{BLOCK:20000}) as XReadResponse;
            console.log("response from the queue-",response)
            if(!response) continue;
            const stream = response[0];
            if(stream === undefined) continue;
            const messages = stream.messages
            for(const msg of messages){
                console.log("msg fro the response stream-",msg);
                const response = msg.message  ;
                console.log("response from the queue-",response);
                if(response.corelationId){
                    
                    const resolver = this.requestMap.get(response.corelationId);
                   
                    if(resolver === undefined) continue;
                     console.log("resolver found-")
                    resolver(JSON.parse(response.message as string));
                    this.requestMap.delete(response.corelationId);
                }
                await this.receiver.xAck("response","backend-1",msg.id);
            }
  
        }
    }
    async putRequest(type:string,message:EngineRequest["payload"]){
        try {
            const corelationId = generateId();
          const id = await this.sender.xAdd("engine-stream","*",{corelationId,type,payload:JSON.stringify(message)});
        console.log("messsage is added to the queue")
        return new Promise<EngineResponse>((res,rej)=>{
            this.requestMap.set(corelationId,res);
        })      
        } catch (error) {
          console.log("error on placing the request to the engine-",error);
          return null  
        }
      
        

    }

    public static async create(){
        const receiver = createClient();
        const sender = createClient();

        receiver.on("error",(error)=>{
            console.log("error on receiver connecting to redis-",error);
        })
        sender.on("error", (error)=>{
            console.log("error on connecting the sender to redis-",error)
        })
        receiver.on("connection",()=>{
            console.log("connected to to send data");
        })
        receiver.on("connection",()=>{
            console.log("copnnedted to queue to receive data")
        })
        await receiver.connect();
        await sender.connect();
        return new ResponseManager(sender,receiver);
    }
}


