const socket = io();

const nameScreen = document.getElementById("name-screen");
const map = document.getElementById("game-map");
const gameSpace = document.getElementById("game-space");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");


function pixelDensityResolve(canvas, ctx) { //make the canvas hd
   const dpr = window.devicePixelRatio || 1; 
   const rect = canvas.getBoundingClientRect(); 

   // Set the canvas's internal resolution to match the display's pixel density
   canvas.width = rect.width * dpr;
   canvas.height = rect.height * dpr;

   // Scale the drawing context to match the device pixel ratio
   ctx.scale(dpr, dpr);
}
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Call this function after getting the canvas and context
pixelDensityResolve(canvas, ctx);




let enteredName = false;

const maxLength = 10


const viewportWidth = window.innerWidth;
const viewportHeight = window.innerHeight;

//local copy of player data
let players = {};

//list of objects canvas should render
let DrawingList = []
/*
drawinglist structure:

filled with objects that have a draw method
*/

const friction = 1.6 //not lower than 1
const speed = 3 //negative speed invert controls

let speedX = 0
let speedY = 0

//local x local y
let lx = 0
let ly = 0


function worldToViewport(cameraOrigin, worldPoint) {
   const [camX, camY] = cameraOrigin;
   const [x1, y1] = worldPoint;
 
   const screenX = x1 - camX + viewportWidth / 2;
   const screenY = y1 - camY + viewportHeight / 2;
 
   return [screenX, screenY];
 }
function findDrawingListItemsWithId(id) {
   // Filter the DrawingList to find all items with the matching ID
   const matches = DrawingList.filter(item => item instanceof Player && item.id === id);

   // If there are duplicates, remove all but the first match
   if (matches.length > 1) {
      for (let i = 1; i < matches.length; i++) {
         const index = DrawingList.indexOf(matches[i]);
         if (index > -1) {
            DrawingList.splice(index, 1); // Remove duplicate
         }
      }
   }

   // Return the first match or undefined if no match is found
   return matches[0];
 }

class Player {
   constructor(id, pos, name) {
      this.id = id;
      this.pos = pos;
      this.name = name;
   }
   move(newPos) {
      this.pos = newPos;
   }
   draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = "blue";
      ctx.fill();
      ctx.closePath();

      // Draw the name above the circle
      ctx.font = "12px Arial"; // Set font size and style
      ctx.fillStyle = "black"; // Set text color
      ctx.textAlign = "center"; // Center the text horizontally
      ctx.fillText(this.name, this.pos.x, this.pos.y - 20); // Position text above the circle
   }
   updateName(newName) {
      this.name = newName;
   }
}





socket.on("connect", () => {
   socket.emit("screenSize", {width:viewportWidth, height:viewportHeight});
});

socket.on('nameRecieved', (data) => {
   nameScreen.style.display = "none";
   enteredName = true;

   //set local copy of player data to what server sent us
   players[socket.id] = data;

   const spos = { x: worldToViewport([lx, -ly], [data.pos.x, -data.pos.y])[0], y: worldToViewport([lx, -ly], [data.pos.x, -data.pos.y])[1] };
   DrawingList.push(new Player(socket.id, spos, data.name));
});


const nameInput = document.getElementById("name-input");
const nameButton = document.getElementById("name-button");

document.addEventListener("resize", () => {
   // Update the viewport width and height
   viewportWidth = window.innerWidth;
   viewportHeight = window.innerHeight;

   // Send the new screen size to the server
   socket.emit("screenSize", {width:viewportWidth, height:viewportHeight});
});

function sendName() {
   const name = nameInput.value;

   if (name === "") {
      return;
   }
   if (name.length > maxLength) {
      alert("Name must be less than "+maxLength+" characters");
      return;
   }

   socket.emit("name", name);
   nameInput.value = "";
}

nameButton.addEventListener("click", () => {
   sendName();
});

nameInput.addEventListener('keydown', function(event) {
   const allowedKeys = ['Backspace', 'ArrowLeft', 'ArrowRight', 'Delete', 'Tab', 'Enter'];
 
   // Allow Enter key to print the placeholder message
   if (event.key === 'Enter') {
     sendName();
     return;
   }
 
   // Prevent further typing if max length is reached and not using control keys
   if (
      nameInput.value.length >= maxLength &&
     !allowedKeys.includes(event.key) &&
     nameInput.selectionStart === nameInput.selectionEnd // block unless replacing selected text
   ) {
     event.preventDefault();
   }
 });

socket.on("getPlayers", (data) => {
   // Iterate over the players object
   
   for (const id in data) {
      alert(data[id].name)
      // Check if the player is not the current user
      if (id !== socket.id && data[id] && data[id].name != null) {
         // Store the player data in the local players object
         players[id] = data[id];        

         //set positions based off data given by server
         const [screenX, screenY] = worldToViewport([lx, -ly], [data[id].pos.x, -data[id].pos.y]);
         DrawingList.push(new Player(id, { x: screenX, y: screenY }, data[id].name));
      }
   }
});

socket.on("newPlayer", (data) => {
   id = data.id
   data = data.data
   
   players[id] = data;
   
   
   //set positions based off data given by server
   const [screenX, screenY] = worldToViewport([lx, -ly], [data.pos.x, -data.pos.y]);
   const playerInDrawList = findDrawingListItemsWithId(id);
   if (playerInDrawList) {
      playerInDrawList.move({ x: screenX, y: screenY });
   } else {
      console.warn(`Player ${id} not found in DrawingList. Adding new entry.`);
      // Create a new entry for the player in the drawing list
      DrawingList.push(new Player(id, { x: screenX, y: screenY }, data.name));
   }
});

socket.on("disconnected", (data) => {
   const id = data.id;

   //remove from drawing list
   DrawingList = DrawingList.filter(item => item.id !== id);

   // Remove the player from the local players object
   delete players[id];
});

socket.on("move", (data) => {
   const id = data.id;
   const pos = data.pos;
   //update the local copy of coordniates
   players[id].pos = pos;

   // Convert world coordinates to viewport coordinates
   const [screenX, screenY] = worldToViewport([lx, -ly], [pos.x, -pos.y]);
   // Update the player's position

   const drawlistObject = findDrawingListItemsWithId(id);
   drawlistObject.move({ x: screenX, y: screenY });
});



//MAIN KEYBOARD CONTROLS

function move(vector) {
   if (Math.abs(vector.x) + Math.abs(vector.y) > 0) {
         //only do calculations when actually moving

      // Update speed based on the vector components
      speedX += vector.x * speed;
      speedY += vector.y * speed;

      lx += speedX;
      ly += speedY;
      map.style.left = -lx + "px";
      map.style.top = ly + "px";


      // Emit the movement to the server only when actually moving
      socket.emit("move", { x: lx, y: ly });


      for (const id in players) {
         // Convert world coordinates to viewport coordinates
         const [screenX, screenY] = worldToViewport([lx, -ly], [players[id].pos.x, -players[id].pos.y]);
      
         // Find the corresponding Player object in the DrawingList
         const drawlistObject = findDrawingListItemsWithId(id);
         if (drawlistObject) {
            // Update the Player object's position
            drawlistObject.pos.x = screenX;
            drawlistObject.pos.y = screenY;
         } else {
            console.warn(`Player ${id} not found in DrawingList.`);
         }
      }
   }
}


const keysPressed = {};

document.addEventListener("keydown", (event) => {
   if (!enteredName) {
      return;
   }

   // Mark the key as pressed
   keysPressed[event.key] = true;
});

document.addEventListener("keyup", (event) => {
   if (!enteredName) {
      return;
   }

   // Mark the key as released
   delete keysPressed[event.key];
});
let angle = 0
mousepos = { x: 0, y: 0 };
document.addEventListener("mousemove", (event) => {
   mousepos.x = event.clientX;
   mousepos.y = event.clientY;
});

//main interval 
setInterval(() => {
   if (!enteredName) { //do not run main loop when name not entered
      return;
   }

   // Slowing movement
   if (Math.abs(speedX) <= 0.1) speedX = 0;
   else speedX = Math.round((speedX / friction) * 10) / 10;

   if (Math.abs(speedY) <= 0.1) speedY = 0;
   else speedY = Math.round((speedY / friction) * 10) / 10;

   
   
   if (Math.abs(lastAngle - angle) > 0) {
      socket.emit("rotate", angle);
   }
   

   // Initialize a cumulative vector
   let vector = { x: 0, y: 0 };

   // Add vectors based on keys pressed
   if (keysPressed["ArrowUp"] || keysPressed["w"]) {
      vector.y += 1;
   }
   if (keysPressed["ArrowDown"] || keysPressed["s"]) {
      vector.y -= 1;
   }
   if (keysPressed["ArrowLeft"] || keysPressed["a"]) {
      vector.x -= 1;
   }
   if (keysPressed["ArrowRight"] || keysPressed["d"]) {
      vector.x += 1;
   }

   // Normalize the vector for diagonal movement
   if (vector.x !== 0 && vector.y !== 0) {
      const magnitude = Math.sqrt(vector.x ** 2 + vector.y ** 2);
      vector.x /= magnitude;
      vector.y /= magnitude;
   }

   // Call move with the cumulative vector
   move(vector);
}, 1000/40); // Adjust the interval as needed for smooth movement




   
//MAIN RENDERING LOOP
function renderLoop() {
   ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

   //loop through rendering list
   for (const shape of DrawingList) {
      shape.draw(ctx); //soo clean
   }


   requestAnimationFrame(renderLoop);
}
renderLoop();


document.addEventListener('keydown', (event) => {
   if (event.key === 'Enter' && enteredName) {
      alert("this will open the chat box")
   }});