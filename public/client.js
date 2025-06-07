//local copy of player data
let players = {};

//list of objects canvas should render
export let DrawingList = []
/*
drawinglist structure:

filled with objects that have a draw method
*/


let speedX = 0
let speedY = 0

//local x local y
let lx = 0
let ly = 0


/*
z index layers: 
0 - background
1 - terrain
2 - items
3 - players
4 - local player
5 - objects above player (planes / explosions)
5 - ui
6 - chat

menus do not have z indexes as they are made of html elements instead of canvas.
*/


import {object, Player} from "./classes.js"; //import classes







const socket = io();



const nameScreen = document.getElementById("name-screen");
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


let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;




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


socket.on("connect", () => {
   socket.emit("screenSize", {width:viewportWidth, height:viewportHeight});
});

socket.on('nameRecieved', (data) => {
   nameScreen.style.display = "none";
   enteredName = true;
   
   //set local copy of player data to what server sent us
   players[socket.id] = data;

   const spos = { x: worldToViewport([lx, -ly], [data.pos.x, -data.pos.y])[0], y: worldToViewport([lx, -ly], [data.pos.x, -data.pos.y])[1] };
   const newplayer = new Player(socket.id, spos, data.name);
   newplayer.changeZIndex(4); // Set initial zIndex to 4
   DrawingList.push(newplayer);
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

 const keysPressed = [];



socket.on("getObjects", (data) => {
   for (const [key,value] of Object.entries(data)) {
      const x = worldToViewport([lx, -ly], [value.pos.x, -value.pos.y]);
      const spos = { x: x[0], y: x[1] };
      if (value.isPlayer === true) {
         DrawingList[key] = new Player(value.id, spos, value.name);
      } else {
         DrawingList[key] = new object(value.id, spos);
      }
   }
});







//MAIN KEYBOARD CONTROLS





document.addEventListener("keydown", (event) => {
   if (!enteredName) {
      return;
   }

   // Mark the key as pressed
   if (!keysPressed.includes(event.key)) {
      keysPressed.push(event.key);
   }
   

   socket.emit("input", keysPressed)
});

document.addEventListener("keyup", (event) => {
   if (!enteredName) {
      return;
   }

   // Remove the key from the pressed keys array
   const index = keysPressed.indexOf(event.key);
   if (index > -1) {
      keysPressed.splice(index, 1);
   }

   // Mark the key as released
   socket.emit("input", keysPressed)
});




let mousepos = { x: 0, y: 0 };
document.addEventListener("mousemove", (event) => {
   mousepos.x = event.clientX;
   mousepos.y = event.clientY;
});







export function sortDrawList() {
   // Sort DrawingList based on zIndex
   DrawingList.sort((a, b) => a.zIndex - b.zIndex);
}
   
//MAIN RENDERING LOOP
function renderLoop() {
   ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

   ctx.canvas.width = window.innerWidth;
   ctx.canvas.height = window.innerHeight;

   //loop through rendering list
   for (const shape of DrawingList) {
      shape.draw(ctx); 
   }

   requestAnimationFrame(renderLoop);
}
renderLoop();


document.addEventListener('keydown', (event) => {
   //this is for debugging
   if (event.key === 'Enter' && enteredName) {
      alert(DrawingList.length)
   }
   if (event.key === '0') {
      alert(lx + " " + ly);
   }
});




