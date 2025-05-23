const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const players = {}

app.use(express.static('public'));

function getPlayersVisibleTo(id) {
    const player = players[id];
    const viewport = player.viewport

    const visiblePlayers = {};

    for (i in players) {
        if (i == id) continue; // skip the player itself
        const otherPlayer = players[i];
        // Check if the other player is within the viewport bounds
        if (
            otherPlayer.pos.x >= player.pos.x - viewport.width / 2 &&
            otherPlayer.pos.x <= player.pos.x + viewport.width / 2 &&
            otherPlayer.pos.y >= player.pos.y - viewport.height / 2 &&
            otherPlayer.pos.y <= player.pos.y + viewport.height / 2
        ) {
            visiblePlayers[i] = otherPlayer;
        }
    }
    return visiblePlayers;
}


io.on('connection', (socket) => {
    //set default statistics
    players[socket.id] = {id:socket.id,
        name: null,
        pos:{x:0,y:0},
        inventory:[],
        rot:0,
        viewport:{width:0,height:0}
    };

    // Send current playerdata to new user
    socket.on("screenSize", (data) => {
        players[socket.id].viewport = data;
        console.log(`Player ${socket.id} set screen size to ${data}`);

        //send the user player data of the players that are visible to him
        const visiblePlayers = getPlayersVisibleTo(socket.id);
        io.to(socket.id).emit('getPlayers', visiblePlayers); // send to the user who connected

    });


    

    socket.on('name', (name) => {
        if (players[socket.id]) {
            players[socket.id].name = name;
        }
        console.log(`Player ${socket.id} set name to ${name}`);
        io.to(socket.id).emit('nameRecieved', players[socket.id]); // send to the user who set the name

        
        socket.broadcast.emit('newPlayer', {id:socket.id, data: players[socket.id]} ); // send to all other users
    });
  
    socket.on('move', (pos) => {
        if (players[socket.id]) {
            players[socket.id].pos = pos;
            socket.broadcast.emit('move', { id: socket.id, pos: pos });
        }
    });
    socket.on('inventory', (inv) => {
        if (players[socket.id]) {
            players[socket.id].inventory = inv;
            socket.broadcast.emit('inventory', { id: socket.id, inv: inv });
        }
    });
    socket.on('rotate', (rot) => {
        if (players[socket.id]) {
            players[socket.id].rot = rot;
            socket.broadcast.emit('rotate', { id: socket.id, rot: rot });
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        //remove the socket id from players
        delete players[socket.id];
        //broadcast who disconnected
        socket.broadcast.emit('disconnected', { id: socket.id });
    });
});

const PORT = 3000;

http.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

