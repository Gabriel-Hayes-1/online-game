const express = require('express');
const http = require('http')
const os = require('os');
const { Server } = require("socket.io"); 
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1"; // if not connected to a network
}

const ip = getLocalIP();
const port = 3000

// (i) players are also found in objects.
const objects = {};
const players = {};

app.use(express.static('public'));


const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    input = input.trim();
    switch (true) {
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

    for (i in objects) {
        
        const object = objects[i];
        if (object.className==="Player" && !object.name) {
            continue; // skip players without a name
        }

        // Check if the other player is within the viewport bounds
        const buffer = 50; // Add a buffer to the viewport size
        if (
            object.pos.x >= player.pos.x - (viewport.width / 2 + buffer) &&
            object.pos.x <= player.pos.x + (viewport.width / 2 + buffer) &&
            object.pos.y >= player.pos.y - (viewport.height / 2 + buffer) &&
            object.pos.y <= player.pos.y + (viewport.height / 2 + buffer) 
            
        ) {
            visiblePlayers[i] = object;
        }
    }
    return visiblePlayers;
}

let loopCounter = 0;
let lastTime = performance.now();



// main server loop
setInterval(() => {
    let deltaTime = (performance.now() - lastTime) / 1000 ;
    lastTime = performance.now();

    if (loopCounter % 4 == 0) {
        //15 htz: send object data to each player. 
        //determine what each player can see, and send visible things

        for (const socketId in players) {
            const visiblePlayers = getObjectsVisibleTo(socketId);
            
            io.to(socketId).emit('getObjects', visiblePlayers); 
        }
    }




    //manage player motion, motion decay, and inputs
    for (const socketId in players) {
        if (objects[socketId].name == null) {
            continue
        }
        const player = players[socketId];
        const motion = player.motion;
        const inputs = player.inputs;
        const rot = player.rot;
        let rotMotion = player.rotMotion;
        const mass = player.mass; // mass affects inertia of player
        const motionConstant = player.motionConstant;
        const rotSpeedConstant = player.rotSpeedConstant;

        // decay motion towards zero
        const motionAccel = (motionConstant / mass) * deltaTime; 
        // Scale rotation acceleration by current speed (absolute value)
        // Add a small constant (e.g., 0.2) to allow some turning when nearly stopped
        const speedFactor = (Math.abs(player.motion) + 2)/100;
        const rotAccel = (rotSpeedConstant / mass) * deltaTime * speedFactor;

        const baseDrag = 0.1;
        const dampingFactor = Math.max(0, 1 - (baseDrag / mass) * deltaTime); 

        player.motion *= dampingFactor; // decay forward/backward speed
        rotMotion *= dampingFactor; // decay rotation motion

        // apply inputs
        if (inputs.includes('ArrowLeft') || inputs.includes('a')) {
            rotMotion -= rotAccel; // rotate left
        }
        if (inputs.includes('ArrowRight') || inputs.includes('d')) {
            rotMotion += rotAccel; // rotate right
        }

        if (inputs.includes('ArrowUp') || inputs.includes('w')) {
            player.motion += motionAccel; // accelerate forward
        }
        if (inputs.includes('ArrowDown') || inputs.includes('s')) {
            player.motion -= motionAccel; // accelerate backward
        }

        // apply motion to player position
        player.pos.x += Math.cos(rot) * player.motion * deltaTime;
        player.pos.y += Math.sin(-rot) * player.motion * deltaTime;
        player.rot += rotMotion * deltaTime;
        player.rotMotion = rotMotion; // update stored rotation motion


        //summon watercircles
        
        if (loopCounter % Math.max(Math.floor((1/player.motion)*500),5) === 0) {
            const WaterCircle = {
                id: crypto.randomUUID(),
                className: 'WaterCircle',
                pos: { x: player.pos.x, y: player.pos.y },
                radius: 10,
                opacity:0.6,
                owner: socketId
            }
            objects[WaterCircle.id] = WaterCircle; // add water circle to objects
        }
        
    }

    //loop through all objects and modify properties for each: any object's properties that change over time should be updated here.
    for (const id in objects) {
        switch (objects[id].className) {
            case 'WaterCircle':
                const speed = players[objects[id].owner] ? Math.abs(players[objects[id].owner].motion) : 0;
                objects[id].opacity -= 0.005; // fade out over time
                objects[id].radius += Math.sqrt(objects[id].radius)*(speed/2000)+0.1
                if (objects[id].opacity <= 0) {
                    delete objects[id]; // remove the water circle if it fades out completely
                }
                break;
        }
    }


    loopCounter = (loopCounter + 1) % 60;
}, 1000 / 60); // 60 htz calculation rate

function kickSocket(socketId, message = 'You have been kicked from the server.') {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
        socket.emit('kick', message); // send kick message to the client
        socket.disconnect(true); // force disconnect
        console.log(`Socket ${socketId} has been kicked: ${message}`);
    } else {
        console.warn(`Socket ${socketId} not found for kicking.`);
    }
}


io.on('connection', (socket) => {
    //set default statistics

    // (i) all properties including 'constant' are to be stats for the players' ship.
    players[socket.id] = {
        id:socket.id,
        className: 'Player', //this is a VERY IMPORTANT property. client need this to know what type of object this is.
        name: null,
        pos:{x:0,y:0},
        motion: 0, //motion is momentum based on direction you are facing.
        motionConstant: 10,
        inputs: [], // array of input names supplied by client
        mass: 1, // weight affects inertia of player
        rot:0,
        rotMotion: 0, 
        rotSpeedConstant: 1, // constant for rotation speed

        

        viewport:{width:0,height:0}
    };
    objects[socket.id] = players[socket.id]; // add player to objects

    console.log(`A user connected: ${socket.id}. There are now ${Object.keys(players).length} players connected.`);

    socket.on("screenSize", (data) => {
        players[socket.id].viewport = data;
        console.log(`Player ${socket.id} set screen size to ${data}`);

        //send the user player data of the players that are visible to him
        const visiblePlayers = getObjectsVisibleTo(socket.id);
        io.to(socket.id).emit('getObjects', visiblePlayers); // send to the user who connected

    });

    socket.on('input', (inputs) => {
        players[socket.id].inputs = inputs
    });

    

    socket.on('name', (name) => {
        const maxNameLength = 10; 
        if (name.length > maxNameLength) { //clients cant be trusted to limit name length
            console.warn(`Player ${socket.id} tried to set their name to ${name}, which is longer than ${maxNameLength} characters. They may be cheating.`);
            name = name.substring(0, maxNameLength); // limit name length
        }
        
        if (players[socket.id]) {
            players[socket.id].name = name;
        }
        console.log(`Player ${socket.id} set name to ${name}`);
        io.to(socket.id).emit('nameRecieved', players[socket.id]); // send to the user who set the name

        
    });
  
    

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        //remove the socket id from players
        delete players[socket.id];
        delete objects[socket.id]
        //broadcast who disconnected
        socket.broadcast.emit('disconnected', { id: socket.id });
    });
});

let host = "127.0.0.1"
if (ip != "127.0.0.1") {
    host = "0.0.0.0"
}
console.log(host)
server.listen(port,host, () => {
    console.log(`Server is running on http://${host==="127.0.0.1"?"localhost":ip}:${port}`);
});

