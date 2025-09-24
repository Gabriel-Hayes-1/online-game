
function lerp(prev, goal, alpha) {
   return prev * (1 - alpha) + goal * alpha;
}

class object {
   constructor(data) {
      this.id = data.id;
      this.pos = data.pos;

      this.prev = {}
      this.curr = {}

      this.doDrawing = true;
      this.zIndex = 0;
   }

   static fromServerData(data) {
      const classToCreate = classMap[data.className];
      if (!classToCreate) {
         throw new Error(`Unknown class name: ${data.className}`);
      }
      return new classToCreate(data);
   }


   changeZIndex(newZIndex) {
      this.zIndex = newZIndex;
   }

   updateInterpolation(serverData) {
      this.prev = this.curr || serverData
      this.curr = serverData
   }
   
   stepInterpolation(alpha) {
      const interpolators = this.constructor.interpolators || {};
      for (const [key, func] of Object.entries(interpolators)) {
         this[key] = func(this.prev[key], this.curr[key], alpha);
      }
   }

   draw(ctx) {
      throw new Error("This is an abstract method and should be implemented in subclasses");
   }
}
 
class Player extends object {
   constructor(data) {
      super(data); // id and pos
      this.name = data.name;
      this.rot = 0;
      this.zIndex = 4;
   }

   static interpolators = {
      pos: (a, b, t) => ({
         x: lerp(a?.x || 0, b?.x || 0, t),
         y: lerp(a?.y || 0, b?.y || 0, t)
      }),
      rot: (prev, goal, alpha) => lerp(prev, goal, alpha)
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
   constructor(data) {
      super(data);
      this.radius = data.radius;
      this.opacity = data.opacity;
      this.zIndex = 3;
   }

   static interpolators = {
      pos: (a, b, t) => ({
         x: lerp(a?.x || 0, b?.x || 0, t),
         y: lerp(a?.y || 0, b?.y || 0, t)
      }),
      radius: (a, b, t) => lerp(a, b, t),
      opacity: (a, b, t) => lerp(a, b, t)
   }



   draw(ctx) {
      if (!this.doDrawing) {
         return;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0,this.opacity);
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius*0.8, 0, Math.PI * 2, false);
      ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fillStyle = "white";
      ctx.fill("evenodd");
      ctx.restore();
   }
}
class waterPattern {
   constructor(data) {
      this.pos = data.pos;
      this.id = data.id || crypto.randomUUID();
      this.zIndex = 0;
      this.image = new Image();
      this.loaded = false;
      this.image.src = '/assets/images/waterTexture.jpg';
      image.onload = () => {
         this.imgWidth = image.width;
         this.imgHeight = image.height;
         this.loaded = true;
      }

   }
  
   setpos(newpos) {
      this.pos = newpos;
   }

   draw(ctx) {
      ctx.drawImage(this.image, 
         this.pos.x - this.imgWidth/2, 
         this.pos.y - this.imgHeight/2,
      );
   }
}
const classMap = {
   "object": object,
   "Player": Player,
   "WaterCircle": WaterCircle
}
export { object, Player, WaterCircle };