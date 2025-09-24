

let DrawingList = new Map(); //list of objects to draw
/*
drawinglist structure:

filled with objects that have a draw method
*/



//local x local y
let lx = 0
let ly = 0

let lastServerUpt = performance.now()
let currServerUpt = performance.now()

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


import * as objectType from "./classes.js"; //import classes






const socket = io();



const nameScreen = document.getElementById("name-screen");
const gameSpace = document.getElementById("game-space");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");



function pixelDensityResolve(canvas, ctx) { //make the canvas hd
   const dpr = window.devicePixelRatio || 1; 
   const rect = canvas.getBoundingClientRect(); 

   canvas.width = rect.width * dpr;
   canvas.height = rect.height * dpr;

   ctx.scale(dpr, dpr);
}
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

pixelDensityResolve(canvas, ctx);



let enteredName = false;

const maxLength = 10


let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;




function worldToViewport(worldPoint) {
   let screenX = worldPoint.x - lx + viewportWidth / 2;
   let screenY = -(worldPoint.y - ly) + viewportHeight / 2;
 


   return {x: screenX, y: screenY};
}




socket.on("connect", () => {
   socket.emit("screenSize", {width:viewportWidth, height:viewportHeight});
});

socket.on('nameRecieved', (data) => {
   nameScreen.style.display = "none";
   enteredName = true;
   
   //set lx and ly to the player's position (futureproofing for when server saves player position cross-session)
   lx = data.pos.x;
   ly = data.pos.y;

   data.pos = worldToViewport(data.pos)

   const newplayer = objectType.object.fromServerData(data);
   DrawingList.set(socket.id, newplayer);
   newplayer.changeZIndex(4); // Set initial zIndex to 4
});


const nameInput = document.getElementById("name-input");
const nameButton = document.getElementById("name-button");

document.addEventListener("resize", () => {
   // Update the viewport width and height
   viewportWidth = window.innerWidth;
   viewportHeight = window.innerHeight;
   pixelDensityResolve(canvas, ctx)
   
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

nameButton.addEventListener("click", sendName)

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

let bgTiles = [];
function updateBG() {
   const lpos = {x: lx, y: ly}
   if (bgTiles.length <4) {
      //create new bg tiles: waterpattern class
      for (let i=0; i<4; i++) {
         const tile = new waterPattern({pos: {x: (i%2)*canvas.width, y: Math.floor(i/2)*canvas.height}})
         DrawingList.set(tile.id, tile)
         bgTiles.push(tile.id)
      }
   }
}

socket.on("getObjects", (data) => {
   lastServerUpt = currServerUpt || performance.now()
   currServerUpt = performance.now()

   for (const [key,value] of Object.entries(data)) {
      if (key == socket.id) {
         lx = value.pos.x
         ly =  value.pos.y
      }

      value.pos = worldToViewport(value.pos)

      let obj = DrawingList.get(key)
      if (!obj) {
         obj = objectType.object.fromServerData(value)
         DrawingList.set(key,obj)
      } 
      obj.updateInterpolation(value)
   }

   for (const id of DrawingList.keys()) {
      if (!(id in data)) {
         DrawingList.delete(id)
      }
   }

});


   
//MAIN RENDERING LOOP
function renderLoop() {
   ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
   const now = performance.now();
   const alpha = (now - lastServerUpt) / (currServerUpt - lastServerUpt);


   //loop through rendering list
   const arr = Array.from(DrawingList.values())
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(shape => {
         shape.stepInterpolation(alpha);
         shape.draw(ctx); 
      });


   requestAnimationFrame(renderLoop);
}
renderLoop();


socket.on("kick", (message) => {
   alert(message);
   socket.disconnect();
   window.location.reload();
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









document.addEventListener('keydown', (event) => {
   //this is for debugging
   if (event.key === '9') {
      alert("DrawingList: "+ (DrawingList.size));
   }
   if (event.key === '0') {
      alert("lpos: ", lx, ly);
   }

   if (event.key === "j") {
      console.log("DrawingList: ", DrawingList);
   }

});




