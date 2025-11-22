const express = require('express');
const http = require('http')
const { Server } = require("socket.io"); 
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);



const ip = "0.0.0.0"
const port = 3000

app.get("/ban-info", (req,res)=>{
    const clientIp = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
    const bannedInfo = bannedIps[clientIp]
    if (bannedInfo) {
        res.json(bannedInfo)
    } else {
        res.json({})
    }
})

app.use((req,res,next)=>{
    const clientIp = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
    if (bannedIps[clientIp]) {
        const banInfo = bannedIps[clientIp];
        if (!banInfo.permanent) {
            if (banInfo.time < Date.now()) {
                delete bannedIps[clientIp]; // unban expired ban
            } else {
                res.sendFile(__dirname+"/banned/index.html")
                return;
            }
        } else {
            res.sendFile(__dirname+"/banned/index.html")
            return;
        }
        
    }
    next();
})



app.use(express.static('public'));


// players are also found in objects.
let objects = {};
let events = []; //sent to clients and emtpied 15hz. 
let players = {};



const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    input = input.trim();
    switch (true) {
        case input.startsWith('damageAll'): {
            const parts = input.split(' ');
            const parsed = parseInt(parts[1], 10);
            const amount = Number.isNaN(parsed) ? 10 : parsed;
            for (const socketid of Object.keys(players)) {
                if (objects[socketid] && typeof objects[socketid].health === 'number') {
                    objects[socketid].health -= amount;
                }
            }
            console.log(`damaged all for ${amount} damage`);
            break;
        }
        case input === 'data get':
            console.log('Current player data:');
            console.log(JSON.stringify(players));
            break;
        case input === 'data get playerboard':
            //log all players socket ids and names
            console.log('Current player board:');
            for (const socketId in players) {
                const player = players[socketId];
                console.log(`ID: ${socketId}, Name: ${player.name || 'Unnamed'}`);
            }
            break;
        
        case input.startsWith('data get player '):
            //extract the id
            const playerId = input.split(' ')[3];
            if (players[playerId]) {
                console.log(`Player ${playerId} data:`);
                console.log(JSON.stringify(players[playerId]));
            } else {
                console.log(`Player ${playerId} not found.`);
            }
            break;

        case input.startsWith('data set player '):
            //extract the id, property, and value
            const parts = input.split(' ');
            if (parts.length < 5) {
                console.log('Usage: data set player <id> <property> <value>');
                break;
            }
            const setPlayerId = parts[3];
            const property = parts[4];
            const value = parts.slice(5).join(' ');

            if (players[setPlayerId]) {
                if (property in players[setPlayerId]) {
                    //make sure that the data type of the value matches the property
                    const propertyType = typeof players[setPlayerId][property];
                    switch (propertyType) {
                        case 'number':
                            players[setPlayerId][property] = parseFloat(value);
                            break;
                        case 'string':
                            players[setPlayerId][property] = value;
                            console.log(`Property ${property} set to ${value} for player ${setPlayerId}.`);
                            break;
                        case 'boolean':
                            players[setPlayerId][property] = (value.toLowerCase() === 'true');
                            break;
                        case 'object':
                            try {
                                players[setPlayerId][property] = JSON.parse(value);
                            } catch (e) {
                                console.log(`Failed to parse JSON for property ${property}: ${e.message}`);
                            }
                            break;
                        default:
                            console.log(`Property ${property} has an unsupported type: ${propertyType}`);
                    }
                } else {
                    console.log(`Property ${property} does not exist for player ${setPlayerId}.`);
                }
            } else {console.log(`Player ${setPlayerId} not found.`); break;}
    }
});



function getObjectsVisibleTo(id) {
    const player = objects[id];
    const viewport = player.viewport

    const visiblePlayers = {};
    const buffer = 50; // Add a buffer to the viewport size

    for (i in objects) {
        
        const object = objects[i];
        if (object.className==="Player" && object.state!='alive') {
            continue; // skip players without a name
        }

        // Check if the other player is within the viewport bounds
        if (
            object.pos.x >= player.pos.x - (viewport.width / 2 + buffer) &&
            object.pos.x <= player.pos.x + (viewport.width / 2 + buffer) &&
            object.pos.y >= player.pos.y - (viewport.height / 2 + buffer) &&
            object.pos.y <= player.pos.y + (viewport.height / 2 + buffer) 
            
        ) {
            visiblePlayers[i] = object;
        }
    }
    const visibleEvents = [];
    for (const event of events) {
        if (
            event.pos.x >= player.pos.x - (viewport.width / 2 + buffer) &&
            event.pos.x <= player.pos.x + (viewport.width / 2 + buffer) &&
            event.pos.y >= player.pos.y - (viewport.height / 2 + buffer) &&
            event.pos.y <= player.pos.y + (viewport.height / 2 + buffer) 
        ) {
            visibleEvents.push(event);
        }
    }

    return [visiblePlayers, visibleEvents];
}



let lastSent = {};

/* 
lastSent: {
    playerid:{
        objectName: {
            <data>
        },objectName: {
            <data>
        }
    }
}

*/

const epsilon = 1e-10 //ten decimals
function deepEqual(a, b) {
  if (a === b) return true;
  
  if (typeof a =="number" && typeof b =="number") {
    return Math.abs(a-b)<epsilon
  }

  if (typeof a !== "object" || typeof b !== "object" || a == null || b == null) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let key of keysA) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}




function buildDelta(newState, lastState) {
    const delta = {};
    lastState = lastState || {}
    for (let [k,v] of Object.entries(newState)){
        delta[k] = {}
        for (let property in v) {
            lastState[k] = lastState[k]||{}
            if (!deepEqual(v[property], lastState[k][property])){
                //add to difference
                delta[k][property] = v[property];
            }
        }
    }
    return delta;
}


let loopCounter = 0;
let lastTime = performance.now();

function cleanData(data){ //removes blacklisted properties from an OBJECT with id (dont use on events)
    return Object.fromEntries(
        Object.entries(data).filter(([key]) => !blacklistedProperties.includes(key))
    )
}

function cheapHitboxCheck(pid) {
    const player = objects[pid]
    let hits=[]
    for (const [key,value] of Object.entries(objects)) {
        if (key === pid) continue;
        if (!value.name) continue;
        const rSum = (player.cheapHitbox.radius || 0) + (value.cheapHitbox.radius || 0);
        const mindist = rSum * rSum;

        const playerOffsetX = player.cheapHitbox.offset.x || 0;
        const playerOffsetY = player.cheapHitbox.offset.y || 0;
        const valueOffsetX = value.cheapHitbox.offset.x || 0;
        const valueOffsetY = value.cheapHitbox.offset.y || 0;

        const worldAx = player.pos.x + playerOffsetX;
        const worldAy = player.pos.y + playerOffsetY;
        const worldBx = value.pos.x + valueOffsetX;
        const worldBy = value.pos.y + valueOffsetY;

        const dx = worldAx - worldBx;
        const dy = worldAy - worldBy;
        const dist = dx * dx + dy * dy;
        if (dist < mindist) {
            hits.push(key)
        }
    
    }
    return hits
}

function expensiveCollision(id1,id2,dt) {
    if (id1===id2) return null //shouldnt happen, just to make sure
    const obj1 = objects[id1]
    //convert motion ,direction to vx vy
    const vx = obj1.motion.x*dt
    const vy = obj1.motion.y*dt

    const obj2 = objects[id2]
    const hitboxes1 = obj1.hitboxes
    const hitboxes2 = obj2.hitboxes
    let minT = 1
    loop1: for (const [id, value] of Object.entries(hitboxes1)) {
        for (const [id2, value2] of Object.entries(hitboxes2)) {
            //compare each hitcircle to each hitcircle 
            const cos1 = Math.cos(obj1.rot);
            const sin1 = Math.sin(-obj1.rot);
            const ax = obj1.pos.x + value.offset.x * cos1 - value.offset.y * sin1;
            const ay = obj1.pos.y + value.offset.x * sin1 + value.offset.y * cos1;

            const cos2 = Math.cos(obj2.rot);
            const sin2 = Math.sin(-obj2.rot);
            const bx = obj2.pos.x + value2.offset.x * cos2 - value2.offset.y * sin2;
            const by = obj2.pos.y + value2.offset.x * sin2 + value2.offset.y * cos2;

            const dx = ax-bx
            const dy = ay-by
            const dist = Math.hypot(dx,dy)
            const r = value.radius + value2.radius

            if (dist<r){
                //already inside of them, push out, and break completely
                const overlap = r - dist
                let vector = {x:0,y:0}
                if (dist > 0) {
                    vector.x = dx/dist
                    vector.y = dy/dist
                } else {
                    //chose any direction
                    vector.x = 1
                    vector.y = 0
                }
                vector.x *= Math.max(overlap,100)
                vector.y *= Math.max(overlap,100)
                obj1.motion=vector

                return false
            }

            const a = vx*vx + vy*vy
            const b = 2 * (dx * vx + dy * vy)
            const c = dx*dx + dy*dy - r*r

            const disc = b*b - 4*a*c
            if (disc<0){
                continue; //no collision
            }
            const t1 = (-b - Math.sqrt(disc)) / (2*a)
            //const t2 = (-b + Math.sqrt(disc)) / (2*a)

            if (t1>=0 && t1<=1){
                minT = Math.min(minT,t1)
                continue;
            }
            // if (t2>=0 && t2<=1){
            //     minT = Math.min(minT,t2)
            //     continue;
            // }
        }        
    }
    //minT>1 = no collision (not possible tho cuz mint starts at 1)
    //minT=1 = no collision
    //minT<1 = collision at minT
    if (minT==1) return false
    // console.log(`about to collide: mint:${(minT)}, motion (${Math.round(vx)},${Math.round(vy)})`)
    //calculate new motion vector
    return {x: vx * minT,y:vy * minT}
}

// main server loop
setInterval(() => {
    let deltaTime = (performance.now() - lastTime) / 1000 ;
    lastTime = performance.now();

    if (loopCounter % 4 == 0) {
        //15 htz: send object data to each player. 
        //determine what each player can see, and send visible things

        for (const socketId in players) {
            const visible = getObjectsVisibleTo(socketId);
            if (visible) {
                let delta = buildDelta(visible[0],lastSent[socketId])
                for (const id in delta) {
                    delta[id] = cleanData(delta[id]);
                }
                io.to(socketId).emit('getObjects', delta,Date.now()); 

                if (visible[1].length > 0) {
                    io.to(socketId).emit('getEvents', visible[1],Date.now())
                }
                lastSent[socketId] = structuredClone(visible[0])
            }
        }
        events = []; //clear events after sending them to every player
    }
    




    //manage player motion, motion decay, and inputs
    for (const socketId in players) {
        if (objects[socketId].name == null) {
            continue
        }
        const player = players[socketId];
        const inputs = player.inputs;
        const rot = player.rot;
        const mass = player.mass; // mass affects inertia of player
        const motionConstant = player.motionConstant;
        const rotSpeedConstant = player.rotSpeedConstant;

        const speed = Math.hypot(player.motion.x, player.motion.y);
        const maxSpeed = 100
        const forward = {x: Math.cos(rot), y: Math.sin(-rot)};

        const turnFactor = 0.1; // how quickly velocity aligns with facing
        player.motion.x = (1 - turnFactor) * player.motion.x + turnFactor * forward.x * speed;
        player.motion.y = (1 - turnFactor) * player.motion.y + turnFactor * forward.y * speed;

        // decay motion towards zero
        const thrust = (motionConstant / mass) * deltaTime; 
        // Scale rotation acceleration by current speed (absolute value)
        // Add a small constant (e.g., 0.2) to allow some turning when nearly stopped
        const speedFactor = (Math.abs(speed) + 2)/100;
        const rotAccel = Math.max((rotSpeedConstant / mass) * speedFactor,10) *deltaTime;

        const baseDrag = 0.1;
        const dampingFactor = Math.max(0, 1 - (baseDrag / mass) * deltaTime); 

        player.motion.x *= dampingFactor; 
        player.motion.y *= dampingFactor; 
        // reduce rotational motion with same damping, but scale decay by speed:
        // when moving faster, rotation is preserved more; when near-stopped it decays faster.
        const rotSpeedPreserve = Math.max(0.1, Math.abs(speed) / maxSpeed); // minimum preservation so it still decays
        player.rotMotion *= dampingFactor * rotSpeedPreserve;

        // apply inputs
        if (inputs.includes('ArrowLeft') || inputs.includes('a')) {
            player.rotMotion -= rotAccel; // rotate left
        }
        if (inputs.includes('ArrowRight') || inputs.includes('d')) {
            player.rotMotion += rotAccel; // rotate right
        }

        if (inputs.includes('ArrowUp') || inputs.includes('w')) {
            player.motion.x += Math.cos(rot) * thrust;
            player.motion.y += Math.sin(-rot) * thrust;
        }
        if (inputs.includes('ArrowDown') || inputs.includes('s')) {
            player.motion.x -= Math.cos(rot) * thrust;
            player.motion.y -= Math.sin(-rot) * thrust;
        }

        const newSpeed = Math.hypot(player.motion.x, player.motion.y);
        if (newSpeed > maxSpeed) {
            
            player.motion.x *= maxSpeed / newSpeed;
            player.motion.y *= maxSpeed / newSpeed;
        }

        //run collision checks
        //first cheap, then advanced

        const candidates = cheapHitboxCheck(socketId) //candidates for more detailed check
    
        for (const candidate of candidates) {
            const newvec= expensiveCollision(socketId,candidate,deltaTime)
            if (newvec) {
                player.motion.x = newvec.x
                player.motion.y = newvec.y
            }
        }

        


        // apply motion to player position
        player.pos.x += player.motion.x * deltaTime;
        player.pos.y += player.motion.y * deltaTime;
        player.rot +=(player.rotMotion * deltaTime);

        // check death
        if (player.health <= 0 ) {
            player.state = "dead"
            player.health = 0
            io.to(socketId).emit("death",{score:0,cause:'kill',player:null,method:'',name:player.name})
        }


        //summon watercircles
        
        if (player.state == 'alive') {
            const minSpeed = 0.01; 
            const clampedSpeed = Math.max(speed, minSpeed);

            // adjust scalingFactor for density
            const scalingFactor = 500; 
            const interval = Math.max(Math.floor(scalingFactor / clampedSpeed), 5);

            if (loopCounter % interval === 0) {
                const WaterCircle = {
                    id: crypto.randomUUID(),
                    type: 'WaterCircle',
                    pos: { x: player.pos.x, y: player.pos.y },
                    owner: socketId
                };
                events.push(WaterCircle);
            }
        }

        
        
    }


    loopCounter++;
}, 1000 / 60); // 60 htz calculation rate

function kick(socketId, message = 'You have been kicked from the server.',fromBan=false) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
        socket.emit('kick', message,fromBan); // send kick message to the client
        socket.disconnect(true); // force disconnect
        console.log(`Socket ${socketId} has been kicked: ${message}`);
    } else {
        console.warn(`Socket ${socketId} not found for kicking.`);
    }
}

let bannedIps = {}
function ban(ip, message="You have been banned from the server.",time) {
    let perm
    if (typeof time == "number") {
        perm = false
    } else {
        perm = true
    }
    bannedIps[ip] = {msg:message,time:(time*1000)+Date.now(),permanent:perm}
    console.log(`Banned IP ${ip} for ${perm?"permanently":time+" seconds"}. Reason: ${message}`)
    
    for (const [id,socket] of io.sockets.sockets) {
        const socketIp = socket.handshake.headers['cf-connecting-ip'] || socket.handshake.address
        if (socketIp === ip) {
            kick(id,message,true)
        }
    }
}
function unban(ip) {
    if (bannedIps[ip]) {
        delete bannedIps[ip]
        console.log(`Unbanned IP ${ip}.`)
    } else {
        console.log(`IP ${ip} is not banned.`)
    }
}

function getNextTeam(){
    let teamCount = {red:0,blue:0}
    for (let id of Object.keys(players)) {
        const player = players[id];
        const team = player.team;
        if (team) {
            if (team==="red") teamCount.red++
            if (team==="blue") teamCount.blue++
        }
    }
    //attempt to balance
    if (teamCount.red<teamCount.blue){
        return "red"
    } else if (teamCount.blue<teamCount.red){
        return "blue"
    } else {
        let a =["red","blue"]
        return a[Math.floor(Math.random()*2)] //random choice
    }
}

const maxNameLength = 30; 
const maxChatLen = 300;


const blacklistedProperties = [ //List of names of player properties to not send to anyone.
    "inputs",
    "viewport",
    "ip",
    //"cheapHitbox"
]

io.on('connection', (socket) => {
    //set default statistics

    const ip = socket.handshake.headers['cf-connecting-ip'] || socket.handshake.address

    ban(ip,"you're banned for testing. this will be fixed soon!",true) //20 sec

    // all properties including 'constant' are to be stats for the players' ship.
    players[socket.id] = {
        id:socket.id,
        className: 'Player', //this is a VERY IMPORTANT property. client need this to know what type of object this is.
        ip: ip,
        admin: false, 
        state: "noname", // states: noname, alive, dead, spectating
        team: "none",
        zoom:1, 
        health:100,
        maxHealth:100,
        name: null,
        pos:{x:0,y:0}, 
        motion:{x:0,y:0},
        motionConstant: 10,
        inputs: [], // array of input names supplied by client
        mass: 1, // weight affects inertia of player
        rot:0,
        rotMotion: 0, 
        rotSpeedConstant: 1, // constant for rotation speed
        hitboxes: [//for expensive check
            {offset:{x:0,y:0},radius:20},
            {offset:{x:20,y:0},radius:15},
            {offset:{x:30,y:0},radius:10},
            {offset:{x:-20,y:0},radius:15},
            {offset:{x:-30,y:0},radius:10},
        ],
        cheapHitbox:{offset:{x:0,y:0},radius:40}, //for cheap check

        

        viewport:{width:0,height:0}
    };
    objects[socket.id] = players[socket.id]; // add player to objects

    console.log(`A user connected: ${ip} (${socket.id}). There are now ${Object.keys(players).length} players connected.`);

    socket.emit("config",{maxNameLength:maxNameLength,maxChatLen:maxChatLen})

    socket.on("screenSize", (data) => {
        players[socket.id].viewport = data;

    });

    socket.on('input', (inputs) => {
        players[socket.id].inputs = inputs
    });

    socket.on('chat',(msg,to)=>{
        let team = "all"
        if (to==="team") {
            team = players[socket.id].team
        }

        if (typeof msg !== 'string') return; //invalid message
        if (msg.length > maxChatLen) {
            //client suspected of cheating; our client code should prevent this
            console.log(`Player ${socket.id} sent a chat message longer than ${maxChatLen} characters. They may be cheating.`);
            
            return
        }
        io.to(team).emit('chat',{name:players[socket.id].name,team:players[socket.id].team},msg,team)
    })


    socket.on('name', (name) => {
        const player = players[socket.id]
        if (players[socket.id].state == "noname" || players[socket.id].state=="dead") { //must be dead or no name to change name

            if (name.length > maxNameLength) { //clients cant be trusted to limit name length
                console.log(`Player ${socket.id} tried to set their name to ${name}, which is longer than ${maxNameLength} characters. They may be cheating.`);
                name = name.substring(0, maxNameLength); // limit name length
            }
            
            if (player) {
                player.name = name;
                player.state = "alive"
                if (player.team = 'none') {
                    player.team = getNextTeam();
                }
            }
            socket.join(player.team); //join team room
            socket.join("all")

            console.log(`Player ${socket.id} set name to ${name}`);
            
            socket.broadcast.emit('connected',player.name); //notify others
            socket.emit('nameRecieved', player); // send to the user who set the name
        
        }
        
    });
  


    socket.on('disconnect', () => {
        if (!objects[socket.id]) return; //socket exsists without entry?
        console.log(`User disconnected: ${socket.id} (${objects[socket.id].name})`);
        socket.broadcast.emit('disconnected', objects[socket.id].name);
        delete players[socket.id];
        delete objects[socket.id]
        //broadcast who disconnected
    });
});

let host = "0.0.0.0"
if (process.argv.includes("--local")){
    host = "127.0.0.1"
}


server.listen(port,host, () => {
    console.log(`Server is running on http://${host==="127.0.0.1"?"localhost":ip}:${port} and https://steelseas.xyz`);
});

