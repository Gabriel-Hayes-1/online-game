import { sortDrawList, DrawingList } from './client.js';

function lerp(prevPos, currentPos, alpha) {
   return prevPos * (1 - alpha) + currentPos * alpha;
}


export class object {
    constructor(id, pos,willMove) {
       this.id = id;
       this.willObjectMove = willMove 

       this.isDataPresentForInterpolation = false; // Flag to indicate if data is present for interpolation

       this.pos = pos;
      this.lastPos = null;
      console.log("pos ", this.pos, "lastpos ", this.lastPos)
      this.goalPos = null; 
      
      this.lastTime = 0
      this.goalTime = performance.now();

       this.rot = 0;

      this.lastRot = 0
      this.goalRot = 0;


       this.doDrawing = true; // Flag to control drawing
       this.zIndex = 0; // Default zIndex
    }
    changeZIndex(newZIndex) { //z index is only changeable through this method, requiring sorting each time
       this.zIndex = newZIndex;
       sortDrawList(); // Ensure DrawingList is sorted after changing zIndex
    }
   updateInterpolation(goalData, goalTime) {
      if (this.goalPos != null && this.lastPos != null) {
         this.isDataPresentForInterpolation = true; // Set flag to true if goalPos is provided
      }

       
      if (goalData.rot !== undefined) {
         this.goalRot = goalData.rot || this.rot; // Update goal rotation if provided
         this.lastRot = this.rot;
         this.lastTime = performance.now();
         this.goalTime = goalTime || performance.now();
      }

      if (goalData.pos !== undefined) {
         if (this.goalPos != null) {
            this.lastPos = { x: this.goalPos.x, y: this.goalPos.y}; 
         }
         this.goalPos = { x: goalData.pos.x, y: goalData.pos.y }; 
         this.goalTime = goalTime || performance.now();
      } 
   }
   stepInterpolation(currentTimestamp) {
      if (!this.willObjectMove) {
         
         return;
      }
      if (!this.isDataPresentForInterpolation) {
         return;
      }

      //calculate the alpha value for interpolation


      const alpha = (currentTimestamp - this.lastTime) / ((this.goalTime) - this.lastTime);
  
      // Interpolate position 
      this.pos.x = lerp(this.lastPos.x, this.goalPos.x, alpha);
      this.pos.y = lerp(this.lastPos.y, this.goalPos.y, alpha);



      // Interpolate rotation
      this.rot = lerp(this.lastRot, this.goalRot, alpha);
   }

   
    //draw function will be provided in decendant classes
 }
 
 
 
export class Player extends object {
    constructor(id, pos, willMove, name) {
       super(id, pos,willMove);
       this.name = name;
       this.lastTimestamp = 0; // Timestamp of the last update (also for interpolation)
   
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