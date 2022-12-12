// We will need to 'require' some packages to use for this file
const dotenv = require('dotenv'); // This allows us to use the constants in our .env file
dotenv.config(); // Read the constants in our .env file
 
// Require the needed discord.js classes
const Discord = require('discord.js');
 
// Create a new Discord client
const client = new Discord.Client();
 
const AssistantV2 = require('ibm-watson/assistant/v2'); // Add Watson Assistant
const { IamAuthenticator } = require('ibm-watson/auth'); // Add Watson Authentication
 
// Add our assistant from the IBM Watson Assistant service
const assistant = new AssistantV2({
    version: '2021-11-27',
    authenticator: new IamAuthenticator({
      apikey: process.env.ASSISTANT_KEY,
    }),
    serviceUrl: process.env.ASSISTANT_URL,
});
 
let sessionIds = [];
 
async function sendMessage(message) {
    return new Promise(async (resolve,reject)=>{
        try {
    
            // Check if this user is in the sessionIds
            let sessionId = sessionIds.find(x=>x.uid == message.author.id);
    
            // If no session was found
            if(sessionId == undefined || Date.now() >= sessionId.lastUsed+(1000*60*5)){
                sessionId = (await assistant.createSession({ assistantId: process.env.ASSISTANT_ID  })).result.session_id;
                sessionIds.push({
                    uid: message.author.id,
                    sessionId,
                    lastUsed: Date.now()
                })
            }else{
                sessionId.lastUsed = Date.now();
                sessionId = sessionId.sessionId;
            }
    
    
            // Send the user's question to our assistant
            assistant.message({
                    input: { text: message.content.substring(1) },
                    assistantId: process.env.ASSISTANT_ID,
                    sessionId: sessionId
                }).then(response => {
    
                    let reply = response.result.output.generic[0];
    
                    // Build the embed base
                    let embed = new Discord.MessageEmbed();
                    // Add the colour
                    embed.setColor("#2ecc71");
    
                    // Check if the type of reply is sequential text
                    if(reply.response_type == "text"){
                        // Grab the text reply from the first value
                        embed.addField("Answer",reply.text);
                        //message.reply(reply.text);
                    }else if(reply.response_type == "suggestion"){
                        embed.setTitle(reply.title);
    
                        // For each suggestion
                        for(let suggestion of reply.suggestions){
                            try{
                                //embed.addField(suggestion.label,suggestion.output.generic[0].text);
                                //embed.addField(suggestion.label,'\u200B');
                                embed.addField('\u200B',suggestion.label);
                            }catch(e){
                                // couldn't add this suggestion
                            } 
                        }
                    }
                    // If this response type is an image
                    else if(reply.response_type == "image"){
                        embed.setImage(reply.source);
                        embed.setTitle("Here's an image that will help!");
                    }// If this response type is a video
                    else if(reply.response_type == "video"){
                        message.reply(reply.source);
                        return resolve();
                    }else{
                        console.log(`No idea what this is:\nreply.response_type: ${reply.response_type}`);
                        message.reply(`No idea what this is:\nreply.response_type: ${reply.response_type}`);
                        return resolve();
                    }
    
                    // Reply with a packed embed
                    message.reply(embed).then((res)=>{
                        return resolve();
                    }).catch((err)=>{
                        return reject(err);
                    });
    
                }).catch(err => {
                    // In case of an error, tell us what it is in the terminal
                    return reject(err);
                });
        } catch (error) {
            // In case of an error, tell us what it is in the terminal
            return reject(error);
        }  

    });
}
 
client.once('ready', () => {
    console.log('Ready!');
});
 
client.login(process.env.DISCORD_TOKEN);
 
const prefix = "<@1048379085908357180>"
 
client.on('message', message => {
    // If the message doesn't start with the prefix or the message is coming from another bot, we're not going to do anything
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    // Otherwise, we'll send that message to our assistant
    sendMessage(message).then((res)=>{
        console.log(`Message successfully replied to.`);
    }).catch((err)=>{
        console.log(`Failed to send message`);
        console.log(err);
    });
});