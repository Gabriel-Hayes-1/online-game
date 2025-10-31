function lerp(prev, goal, alpha) {
   return prev * (1 - alpha) + goal * alpha;
}
function generateUUID() { //because crypto.randomUUID is inconsistent due to browser support (allegedly)
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}
function drawHitbox(self,hb,col="rgba(255,0,0,0.6)"){
   let fpos
   if (hb.offset) {
      const ox = hb.offset.x || 0;
      const oy = hb.offset.y || 0;
      const r = self.rot || 0;
      const cos = Math.cos(r);
      const sin = Math.sin(r);
      const rx = ox * cos - oy * sin;
      const ry = ox * sin + oy * cos;
      fpos = { x: (self.lpos?.x || 0) + rx, y: (self.lpos?.y || 0) + ry };
   } else {
      fpos = { x: (self.lpos?.x || 0), y: (self.lpos?.y || 0) };
   }
   

   ctx.save();
   ctx.beginPath();
   ctx.arc(fpos.x, fpos.y, hb.radius || 0, 0, Math.PI * 2);
   ctx.strokeStyle = col;
   ctx.lineWidth = 2;
   ctx.stroke();
   ctx.restore();
}
class object {
   constructor(data) {
      this.id = data.id || generateUUID();
      this.pos = data.pos;
      this.lpos = data.pos

      this.prev = {};
      this.curr = {};
      
      this.hitboxes = data.hitboxes||[]
      if(data.cheapHitbox)this.cheapHitbox=data.cheapHitbox

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

   forceInterpolation(data) { //change data without interpolation
      this.prev = { ...(this.curr || {}), ...data };
      this.curr = { ...(this.curr || {}), ...data };

   }

   updateInterpolation(data) {
      if (data.hitboxes) this.hitboxes = data.hitboxes
      this.prev = { ...(this.curr || {}) };
      this.curr = { ...(this.curr || {}), ...data };
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
   drawHitboxes(ctx){
      //this is in parent class, since its the same for all classes.
      if (!hitbox) return
      for (const hb of this.hitboxes){
         drawHitbox(this,hb)
      }
      const chH=this.cheapHitbox
      if (chH){
         drawHitbox(this,chH,"rgba(0,255,0,0.6)")
      }
   }
}
 
class Player extends object {
   constructor(data) {
      super(data); // id and pos
      this.name = data.name;
      this.team = data.team
      this.rot = 0;
      this.zIndex = 4;
      this.local = data.local || false;
      
      
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
      this.lpos = cam.worldToViewport(this.pos)
      ctx.save();
      ctx.translate(this.lpos.x, this.lpos.y);
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
      ctx.strokeText(this.name, this.lpos.x, this.lpos.y + 40);
      ctx.fillStyle = "black";
      ctx.fillText(this.name, this.lpos.x, this.lpos.y + 40);
   }
} 
class lplayer extends Player {
   constructor(data){
      super(data)
   }
   static interpolators = {
      rot: (prev, goal, alpha) => lerp(prev, goal, alpha)
   }
}

class camera extends object {
   constructor(data) {
      super(data)
      this.nonIntPos = {x:0,y:0}
      this.doDrawing = false;
      this.local = data.local || false; 
      this.canvas = data.canvas.getBoundingClientRect();
   }

   draw(){return};
   worldToViewport(worldPos){
      return {
         x: worldPos.x-this.pos.x + this.canvas.width/2,
         y: worldPos.y-this.pos.y + this.canvas.height/2
      }
   }
   nonIntWorldToViewport(worldPos){
      return {
         x:worldPos.x-this.nonIntPos.x + this.canvas.width/2,
         y:worldPos.y-this.nonIntPos.y + this.canvas.height/2
      }
   }
   static interpolators = {
      pos: (a, b, t) => ({
         x: lerp(a?.x || 0, b?.x || 0, t),
         y: lerp(a?.y || 0, b?.y || 0, t)
      })
   }
}

class WaterCircle extends object {
   constructor(data) {
      super(data);
      this.owner = data.owner
      this.radius = data.radius || 5;
      this.opacity = data.opacity||0.7;
      this.zIndex = 3;
      this.local = true;
   }


   tick(delta) { //local object, called every frame
      this.radius += delta * 0.05;
      this.opacity -= delta * 0.0005;
      this.lpos = cam.worldToViewport(this.pos)
      if (this.opacity <= 0) return true; //signal for deletion
      return false; 
   }


   draw(ctx) {
      if (!this.doDrawing) {
         return;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0,this.opacity);
      ctx.beginPath();
      ctx.arc(this.lpos.x, this.lpos.y, this.radius*0.8, 0, Math.PI * 2, false);
      ctx.arc(this.lpos.x, this.lpos.y, this.radius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fillStyle = "white";
      ctx.fill("evenodd");
      ctx.restore();
   }
}
class waterPattern extends object{
   constructor(data) {
      super(data)
      this.tilenum = data.tilenum
      this.zIndex = 0;
      this.local = true; //very important: prevents deletion by server update
      this.image = new Image();
      this.visible = true;
      this.image.src = '/assets/images/waterTexture.jpeg';
      const largerSide = Math.max(window.innerWidth,window.innerHeight)
      this.imgSize = {x:largerSide/2,y:largerSide/2}
   }
   static initialize() {
      for (let i=0; i<9; i++) {
      const tile = new this({pos: {x: cam.pos.x, y: cam.pos.y},tilenum:i})
      DrawingList.set(tile.id, tile)
      }
   }
   tick(delta){
      const tileX = Math.floor((cam.pos.x/this.imgSize.x)+0.5)
      const tileY = Math.floor((cam.pos.y/this.imgSize.y)+0.5)

      const tx = (this.tilenum%3)-1
      const ty = (-Math.floor(this.tilenum/3)+2)-1

      this.pos = cam.worldToViewport({x:(tx+tileX)*this.imgSize.x,y:(ty+tileY)*this.imgSize.y})

   }
   
   
   

   draw(ctx) {
      ctx.drawImage(this.image, 
         this.pos.x - (this.imgSize.x/2),
         this.pos.y - (this.imgSize.y/2),
         this.imgSize.x,
         this.imgSize.y
      );
   }
}



const classMap = { //local objects dont need to be here
   "object": object,
   "Player": Player,
   "WaterCircle": WaterCircle
}
