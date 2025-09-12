import { sortDrawList, DrawingList } from './client.js';

function lerp(prev, goal, alpha) {
   return prev * (1 - alpha) + goal * alpha;
}

class object {
    constructor(id, pos) {
       this.id = id;

       this.isDataPresentForInterpolation = false;

       this.pos = pos;
       this.last = { pos: { x: pos.x, y: pos.y } };
       this.goal = { pos: { x: pos.x, y: pos.y } };

       this.lastTime = 0;
       this.goalTime = performance.now();

       this.doDrawing = true;
       this.zIndex = 0;
    }

   static fromServerData(data) {
      const classToCreate = object.classMap[data.className];
      if (!classToCreate) {
         throw new Error(`Unknown class name: ${data.className}`);
      }
      return classToCreate.fromData(data);
   }

   static fromData(data) {
      return new this(data.id)
   }


   changeZIndex(newZIndex) {
      this.zIndex = newZIndex;
      sortDrawList();
   }

   updateInterpolation(goalData, goalTime) {
      if (this.goal && this.last) {
         this.isDataPresentForInterpolation = true;
      }

      if (goalData.pos !== undefined) {
         if (this.goal && this.goal.pos) {
            this.last.pos = { x: this.goal.pos.x, y: this.goal.pos.y };
         }
         this.goal.pos = { x: goalData.pos.x, y: goalData.pos.y };
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

      const alpha = (currentTimestamp - this.lastTime) / ((this.goalTime) - this.lastTime);

      this.pos.x = lerp(this.last.pos.x, this.goal.pos.x, alpha);
      this.pos.y = lerp(this.last.pos.y, this.goal.pos.y, alpha);
   }
    //draw function will be provided in descendant classes
 }
 
class Player extends object {
   constructor(data) {
      super(data.id, data.pos, true);
      this.name = data.name;
      this.lastTimestamp = 0;
      this.rot = 0;
      this.last.rot = 0;
      this.goal.rot = 0;
   }

   static fromData(data) {
      return new this(data.id, data.pos, data.willMove, data.name);
   }


   updateInterpolation(goalData, goalTime) {
   super.updateInterpolation(goalData, goalTime);
   if (goalData.rot !== undefined) {
      this.last.rot = this.goal.rot;
      this.goal.rot = goalData.rot;
      this.lastTime = performance.now();
      this.goalTime = goalTime || performance.now();
   }
   }
   stepInterpolation(currentTimestamp) {
   super.stepInterpolation(currentTimestamp);
   if (this.goal.rot !== undefined && this.last.rot !== undefined) {
      const alpha = (currentTimestamp - this.lastTime) / ((this.goalTime) - this.lastTime);
      this.rot = lerp(this.last.rot, this.goal.rot, alpha);
   }
   }
   draw(ctx) {
      if (!this.doDrawing) {
         return;
      }
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, 40, 20, 0, 0, Math.PI * 2);
      ctx.fillStyle = "black";
      ctx.fill();
      ctx.closePath();
      ctx.restore();
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "white";
      ctx.strokeText(this.name, this.pos.x, this.pos.y + 40);
      ctx.fillStyle = "black";
      ctx.fillText(this.name, this.pos.x, this.pos.y + 40);
   }
} 

 class WaterCircle extends object {
   constructor(id, pos, willMove, size) {
      super(id, pos, willMove);
      this.outerRadius = size;
      this.innerRadius = size * 0.8;
      this.opacity = 0.5;
   }

   static fromData(data) {
      return new this(data.id, data.pos, data.willMove, data.size); 
   }

   updateInterpolation(goalData, goalTime) {
      super.updateInterpolation(goalData, goalTime);

      if (goalData.outerRadius !== undefined) {
         this.last.outerRadius = this.goal.outerRadius ?? this.outerRadius;
         this.goal.outerRadius = goalData.outerRadius;
      }
      if (goalData.innerRadius !== undefined) {
         this.last.innerRadius = this.goal.innerRadius ?? this.innerRadius;
         this.goal.innerRadius = goalData.innerRadius;
      }
      if (goalData.opacity !== undefined) {
         this.last.opacity = this.goal.opacity ?? this.opacity;
         this.goal.opacity = goalData.opacity;
      }
      this.lastTime = performance.now();
      this.goalTime = goalTime || performance.now();
   }

   stepInterpolation(currentTimestamp) {
      super.stepInterpolation(currentTimestamp);

      const alpha = (currentTimestamp - this.lastTime) / (this.goalTime - this.lastTime);

      if (this.goal.outerRadius !== undefined && this.last.outerRadius !== undefined) {
         this.outerRadius = lerp(this.last.outerRadius, this.goal.outerRadius, alpha);
      }
      if (this.goal.innerRadius !== undefined && this.last.innerRadius !== undefined) {
         this.innerRadius = lerp(this.last.innerRadius, this.goal.innerRadius, alpha);
      }
      if (this.goal.opacity !== undefined && this.last.opacity !== undefined) {
         this.opacity = lerp(this.last.opacity, this.goal.opacity, alpha);
      }
   }
   draw(ctx) {
      if (!this.doDrawing) {
         return;
      }
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.outerRadius, 0, Math.PI * 2, false);
      ctx.arc(this.pos.x, this.pos.y, this.innerRadius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fillStyle = "white";
      ctx.fill("evenodd");
      ctx.restore();
   }
}
export { object, Player, WaterCircle };