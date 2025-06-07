import { sortDrawList, DrawingList } from './client.js';

export class object {
    constructor(id, pos) {
       this.id = id;
       this.pos = pos;
       this.rot = 0;
       this.doDrawing = true; // Flag to control drawing
       this.zIndex = 0; // Default zIndex
    }
    changeZIndex(newZIndex) { //z index is only changeable through this method, requiring sorting each time
       this.zIndex = newZIndex;
       sortDrawList(); // Ensure DrawingList is sorted after changing zIndex
    }
    setDrawState(doDrawing) { 
    this.doDrawing = doDrawing
    }
    updateData(newData) {
      //update various data if provided
       this.pos = newData.pos || this.pos; 
       this.rot = newData.rot || this.rot; 
       this.doDrawing = newData.doDrawing !== undefined ? newData.doDrawing : this.doDrawing; 

       
    }
    
    //draw function will be provided in decendant classes
 }
 
 
 
export class Player extends object {
    constructor(id, pos, name) {
       super(id, pos);
       this.name = name;
       //rest is inhereted from object
    }
   updateData(newData) {
      super.updateData(newData); // Call the parent class's updateData
      this.name = newData.name || this.name; // Update name if provided
   }
    draw(ctx) {
       if (!this.doDrawing) {
          return; // Skip drawing if doDrawing is false
       }
 
       // Save the current context state
       ctx.save();
 
       // Translate to the oval's position and rotate the context
       ctx.translate(this.pos.x, this.pos.y);
       ctx.rotate(this.rot);
 
       // Draw the oval
       ctx.beginPath();
       ctx.ellipse(0, 0, 40, 20, 0, 0, Math.PI * 2); // Adjust radii (40, 20) for x and y axes
       ctx.fillStyle = "black";
       ctx.fill();
       ctx.closePath();
 
       // Restore the context to its original state
       ctx.restore();
 
       // draw the text
       ctx.font = "24px Arial"; 
       ctx.textAlign = "center"; 
       ctx.lineWidth = 4; // stroke width
       ctx.strokeStyle = "white"; // stroke color
       ctx.strokeText(this.name, this.pos.x, this.pos.y + 40); // Drawing stroke
       ctx.fillStyle = "black"; // text color
       ctx.fillText(this.name, this.pos.x, this.pos.y + 40); // Drawing text
    }
 } 