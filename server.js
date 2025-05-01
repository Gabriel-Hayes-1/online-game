const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

let clickCount = 0;

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected');
  
    // Send current count to new user
    socket.emit('updateCount', clickCount);
  
    socket.on('click', () => {
      clickCount++;
      io.emit('updateCount', clickCount); // send to all clients
    });
  
    socket.on('disconnect', () => {
      console.log('A user disconnected');
    });
});

const PORT = 3000;

http.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});