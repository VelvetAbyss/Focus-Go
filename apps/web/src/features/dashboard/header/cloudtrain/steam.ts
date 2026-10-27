// A small continuous simulation. A speed change accelerates existing steam;
// it never repositions the entire plume or emits a particle away from the stack.
export const STEAM_COUNT = 24;
const LIFE = 3.15, INTERVAL = .16;
const smooth = (a: number,b: number,x: number) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t); };

export function createSteam() {
  const particles: ({ x: number; y: number; vx: number; vy: number; age: number; seed: number } | null)[] = Array(STEAM_COUNT).fill(null);
  const data = new Float32Array(STEAM_COUNT * 4);
  let accumulator=0, next=0, serial=0;
  function spawn() {
    const seed = serial++ * 2.399963;
    particles[next] = { x:0,y:0,vx:-.018,vy:-.093,age:0,seed };
    next = (next + 1) % STEAM_COUNT;
  }
  function step(dt: number,worldSpeed: number) {
    // Short substeps keep particle motion stable at 30fps or after a busy frame.
    const count=Math.max(1,Math.ceil(dt*60)), h=dt/count;
    for(let n=0;n<count;n++){
      accumulator+=h;
      while(accumulator>=INTERVAL){accumulator-=INTERVAL;spawn();}
      for(let i=0;i<particles.length;i++){
        const p=particles[i]; if(!p)continue;
        p.age+=h; if(p.age>=LIFE){particles[i]=null;continue;}
        const curl=smooth(.15,.9,p.age);
        const wind=-(.065+worldSpeed*.96);
        p.vx+=(wind-p.vx)*Math.min(1,h*1.8);
        p.vy+=(-.044-p.vy)*Math.min(1,h*.75);
        p.x+=(p.vx+Math.sin(p.age*3.7+p.seed)*.012*curl)*h;
        p.y+=(p.vy+Math.cos(p.age*4.3+p.seed)*.009*curl)*h;
      }
    }
    data.fill(0);
    particles.forEach((p,i)=>{
      if(!p)return;
      data[i*4]=p.x; data[i*4+1]=p.y;
      data[i*4+2]=.0045+Math.pow(p.age,.92)*.016;
      data[i*4+3]=smooth(0,.09,p.age)*(1-smooth(1.25,LIFE,p.age));
    });
  }
  function reset(worldSpeed: number) {
    particles.fill(null);accumulator=INTERVAL;next=0;serial=0;
    // Start with an established plume rather than a sudden bare chimney.
    for(let i=0;i<180;i++)step(1/60,worldSpeed);
  }
  return { data, step, reset };
}
