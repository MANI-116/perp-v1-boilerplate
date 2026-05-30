import {type RedisResponse} from "@repo/types"
import {createClient} from "redis";
import { engineManager } from "./engineManager";

const receiver = createClient();
export const sender = createClient();


receiver.on("error",(error)=>{
    console.log("error on connecting the reciver-",error);
})

sender.on("error",(error)=>{
    console.log("error on connecting the sender-",error);

})


await receiver.connect();
await sender.connect();



//creating the "engine" group queue --> consumed by the dbPoller and the engine

try {
    await receiver.xGroupCreate("engine-stream","engine-group","$",{MKSTREAM:true});
    console.log("engine queue with engine group is created")
    
} catch (error) {
    
    if(error instanceof Error && error.message.includes("BUSYGROUP")){
        console.log("group already created--",error.name);
    }

    if(error instanceof Error){
        console.log("error-name:",error.name,"\nerror-message:",error.message)
    }

    console.log("error on creating the engine stream")
}

try {
    await sender.xGroupCreate("response-stream","response-group","$",{MKSTREAM:true});
    console.log("response group iscreated wih response key");

} catch (error) {

    if(error instanceof Error && error.message.includes("BUSYGROUP")){
        console.log("error while creating the request group---",error.name,"--",error.message);
    }
    console.log("creating the response-stream");
    
}
while(true){
    let id = "0";
    console.log("waiting for the response....")
    try {
                                                                                                                                                     
        const response:RedisResponse[]|null =await receiver.xReadGroup("engine-group","engine",[{key:"engine-stream",id:">"}],{BLOCK:10000}) as RedisResponse[];
        console.log("response form the stream--",response);
        if(response === null) continue;
        const messages = response[0]?.messages
        console.log("response from the queue-",messages)
        if(messages === undefined) continue;
        for(const msg of messages){
            id = msg.id;
            const response = engineManager(msg.message);
            if(response === null) continue;

            
            console.log("reponse form the engineManager-",response);
            const res = await receiver.xAck("engine-stream","engine-group",id);
            const senderRes = await sender.xAdd("response-stream","*",{message:JSON.stringify(response),corelationId:msg.message.corelationId?msg.message.corelationId:""});
            console.log("sender response-",senderRes);
    
        }
    } catch (error) {
        console.log("error on receiving signals-",error);
        
    }
}
