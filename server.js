const { table } = require('console');
const express = require('express');
const { json } = require('stream/consumers');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// (i) players are also found in objects.
const objects = {};
const players = {};

app.use(express.static('public'));

function getObjectsVisibleTo(id) {
    const player = objects[id];
    const viewport = player.viewport

    const visiblePlayers = {};

    for (i in objects) {
        const object = objects[i];
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
            io.to(socketId).emit('getObjects', objects); 
        }
        console.log(`objects: ${JSON.stringify(objects)}`);
    }




    //manage player motion, motion decay, and inputs
    for (const socketId in players) {
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
        const rotAccel = (rotSpeedConstant / mass) * deltaTime;

        const baseDrag = 0.05;
        const dampingFactor = Math.max(0, 1 - (baseDrag / mass) * deltaTime); 

        motion.x *= dampingFactor; // decay motion x
        motion.y *= dampingFactor; // decay motion y
        rotMotion *= dampingFactor; // decay rotation motion

        // apply inputs
        if (inputs.includes('ArrowLeft') || inputs.includes('a')) {
            rotMotion -= rotAccel; // rotate left
        }
        if (inputs.includes('ArrowRight') || inputs.includes('d')) {
            rotMotion += rotAccel; // rotate right
        }

        if (inputs.includes('ArrowUp') || inputs.includes('w')) {
            motion.x += Math.cos(rot) * motionAccel; // move forward
            motion.y += Math.sin(rot) * motionAccel; // move forward
        }
        if (inputs.includes('ArrowDown') || inputs.includes('s')) {
            motion.x -= Math.cos(rot) * motionAccel; // move backward
            motion.y -= Math.sin(rot) * motionAccel; // move backward
        }


        // apply motion to player position
        player.pos.x += motion.x * deltaTime;
        player.pos.y += motion.y * deltaTime;
        player.rot += rotMotion * deltaTime;


    }

        
    




    loopCounter = (loopCounter + 1) % 60;
}, 1000 / 60); // 60 htz calculation rate

io.on('connection', (socket) => {
    //set default statistics

    // (i) all properties including 'constant' are to be stats for the players' ship.
    players[socket.id] = {
        id:socket.id,
        name: null,
        pos:{x:0,y:0},
        motion: {x:0,y:0}, 
        motionConstant: 0.1,
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

const PORT = 3000;

http.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

