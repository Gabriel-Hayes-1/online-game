let DrawingList = new Map(); //list of objects to draw


let lastServerUpt = performance.now()
let currServerUpt = performance.now()


var socket = io();




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

const cam = new camera({pos:{x:0,y:0},id:"cam",canvas:canvas,target:null})
DrawingList.set(cam.id, cam)

var enteredName = false;

let maxLength = 0
var maxChatLen = 0


let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;



function nameFromID(id) {
   return DrawingList.get(id)?DrawingList.get(id).name:null
}
function teamFromID(id) {
   return DrawingList.get(id)?DrawingList.get(id).team:null
}


socket.on("connect", () => {
   socket.emit("screenSize", {width:viewportWidth, height:viewportHeight});
});
socket.on("config",(data)=>{
   maxLength = data.maxNameLength
   maxChatLen = data.maxChatLen
})

socket.on('nameRecieved', (data) => {
   nameRecievedUI(data)
   

   enteredName = true;
   

   cam.forceInterpolation({pos:{x:data.pos.x,y:data.pos.y*-1}})


   data.pos = data.pos
   data.local = false;
   const newplayer = new lplayer(data);
   DrawingList.set(socket.id, newplayer);

   newplayer.changeZIndex(4); // Set initial zIndex to 4
   
});

socket.on("disconnected",(name)=>{
   localChatmsg(""+name+" has disconnected.")
})
socket.on("connected",(name)=>{
   localChatmsg(""+name+" has connected.")
})


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


waterPattern.initialize()


socket.on("getObjects", (data) => {
   lastServerUpt = currServerUpt || performance.now()
   currServerUpt = performance.now()


   for (const [key,value] of Object.entries(data)) {
      if (Object.keys(value).length>0){
         //console.log(value)
      }
      let obj = DrawingList.get(key)

      if (!obj) {
         obj = object.fromServerData(value);
         DrawingList.set(key,obj);
      }

      obj.updateValues(value) //process non-interpolated data like health (not related to movement)

      if (key === socket.id) { //handle special case
         if (value.pos) {
            value.pos.y *=-1
            cam.updateInterpolation({pos:value.pos})
            cam.nonIntPos = value.pos
         }
         if (value.rot) {
            obj.updateInterpolation({rot:value.rot})
         }
         continue
      }

      if (value.pos) {
         value.pos.y *=-1; //y flippage due to +Y being down on client, and up on server
         value.pos = value.pos; //store worldpos on objects, they handle worldtoviewport themselves
      } 


      obj.updateInterpolation(value)
   }

   for (const id of DrawingList.keys()) {
      if (!Object.hasOwn(data,id)) {
         if (DrawingList.get(id).local) continue;
         if (DrawingList.get(id) instanceof camera) continue;
         DrawingList.delete(id) //if key found but no data, that signifies deletion. 
         // no change but still exsists: {<id>:{}}, deletion: {}
         
      }
   }
});

socket.on("getEvents", (data) => {
   for (const event of data) {
      switch (event.type) {
         case "WaterCircle":
            const circle = new WaterCircle(event);
            event.pos.y *=-1
            circle.worldPos = event.pos
            DrawingList.set(circle.id, circle);
            break;
         default:
            console.warn(`Unknown event type: ${event.type}`);
      }
   }
})

socket.on("death", (data)=>{
   deathUI(data)
})

var hitbox = false


//MAIN RENDERING LOOP
let lastTime=performance.now();
function renderLoop(time) {
   ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
   const now = performance.now();
   let alpha = (now - lastServerUpt) / (currServerUpt - lastServerUpt);

   //yeah alpha probably needs to be based on server time but whatever idc
   
   alpha = Math.min(alpha,10)
 
   //loop through rendering list
   Array.from(DrawingList.values())
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(shape => {
         if (shape.local && shape.tick) {
            if (shape.tick(time - lastTime)) DrawingList.delete(shape.id)
         }
         if (shape.constructor.name=="lplayer"){ //make exception for localplayer 
            shape.pos = cam.pos
         }
         if (!shape.local) {
            shape.stepInterpolation(alpha)
         }
         if (!shape.doDrawing) return;
         shape.draw(ctx);
         shape.drawAccessories(ctx)
      });
   


   lastTime = time;
   requestAnimationFrame(renderLoop);
}
renderLoop();

//ik ts means nothing but server boots you anyways lol 
socket.on("kick", (message) => {
   alert(message);
   socket.disconnect();
   window.location.reload();
});



//MAIN KEYBOARD CONTROLS

const keysPressed = new Map()
let stickWarn = null

document.addEventListener("keydown", (event) => {
   const key = event.key
   if (!enteredName) {
      return;
   }
   if (document.getElementById("chat-inp")===document.activeElement) return
   
   if (key == 's') {
      keysPressed.delete('w')
      if (stickWarn) {
         stickWarn.remove()
      }
   }

   //mark the key as pressed
   if (!keysPressed.has(key)){ 
      keysPressed.set(key,{held:true,time:performance.now()})
      socket.emit("input", Array.from(keysPressed.keys()))
   } else {
      const kp = keysPressed.get(key)
      if (!kp.held){
         if (kp.stuck){
            keysPressed.set(key,{held:true,time:performance.now(),stuck:false})
            stickWarn.remove()
         }
      }
   }

   if (key=="k"){
      hitbox = !hitbox
   }
   

}); 


document.addEventListener("keyup", (event) => {
   const key = event.key
   if (!enteredName) {
      return;
   }
   //if (document.getElementById("chat-inp")===document.activeElement) return

   // Remove the key from the pressed keys array
   
   if (keysPressed.has(key)) {
      const kp = keysPressed.get(key)
      if (performance.now()-kp.time>5000) {
         if (key =="w") {
            keysPressed.set(key,{held:false,time:kp.time,stuck:true})
            stickWarn = addWarning('Automove enabled.')
            return
         }
      }
      keysPressed.delete(key)
      socket.emit("input", Array.from(keysPressed.keys()))
   }

});




let mousepos = { x: 0, y: 0 };
document.addEventListener("mousemove", (event) => {
   mousepos.x = event.clientX;
   mousepos.y = event.clientY;
});









document.addEventListener('keydown', (event) => {
   //this is for debugging
   if (document.getElementById("chat-inp")===document.activeElement) return

   if (event.key === '9') {
      console.log("DrawingList: "+ (DrawingList.size));
   }
   if (event.key === '0') {
      console.log(cam.pos)
   }

   if (event.key === "j") {
      console.log("DrawingList: ", DrawingList);
   }

});




