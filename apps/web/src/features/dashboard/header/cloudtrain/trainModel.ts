// All contact points share a single rail datum. Texture channels encode material,
// so the same drawing works in sunset, morning and moonlight.
export const TRAIN = {
  width: 1024, height: 256, rail: 232, worldWidth: .64,
  chimney: [889, 75],
  wheels: [
    [57, 11], [83, 11], [177, 11], [203, 11],
    [282, 11], [308, 11], [402, 11], [428, 11],
    [516, 14], [604, 14], [690, 16],
    [767, 24], [821, 24], [875, 24], [937, 11], [963, 11],
  ],
};
export const BRIDGE = { size: 512, rail: 149, worldWidth: .62, drift: .19 };

const material = (light: number, second = 0) => `rgb(${light},${second},0)`;

export function makeBridge() {
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = BRIDGE.size;
  const context = sprite.getContext('2d'); if (!context) throw new Error('Canvas 2D unavailable');
  const c = context;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = material(38); c.fillRect(0, 152, 512, 17);
  c.fillStyle = material(92); c.fillRect(0, 153, 512, 2);
  c.strokeStyle = material(42); c.lineWidth = 1.3;
  for (let x = 0; x < 512; x += 28) {
    c.beginPath(); c.moveTo(x, 157); c.lineTo(x + 14, 168); c.lineTo(x + 28, 157); c.stroke();
  }
  // Far-side cables stay behind the train.
  c.strokeStyle = material(42); c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(0, 57); c.quadraticCurveTo(256, 203, 512, 57); c.stroke();
  c.lineWidth = 1.1; c.beginPath(); c.moveTo(0, 64); c.quadraticCurveTo(256, 209, 512, 64); c.stroke();
  for (let x = 12; x < 512; x += 14) {
    const t = x / 512, y = (1 - t) ** 2 * 57 + 2 * (1 - t) * t * 203 + t ** 2 * 57;
    c.lineWidth = 1.05; c.beginPath(); c.moveTo(x, y); c.lineTo(x, 151); c.stroke();
  }
  // Rail-head top is exactly y=149. Sleepers and the girder are underneath.
  c.fillStyle = material(45); c.fillRect(0, BRIDGE.rail, 512, 3);
  c.fillStyle = material(176); c.fillRect(0, BRIDGE.rail, 512, 1);
  for (let x = 0; x < 512; x += 10) { c.fillStyle = material(72); c.fillRect(x, 151, 4, 2); }
  // The green channel marks foreground tower faces. They occlude a passing train.
  for (const x of [0, 512]) {
    c.fillStyle = material(30, 255);
    c.beginPath(); c.moveTo(x - 6, 47); c.lineTo(x + 6, 47); c.lineTo(x + 6, 147);
    c.lineTo(x + 10, 162); c.lineTo(x + 9, 512); c.lineTo(x - 9, 512); c.lineTo(x - 10, 162); c.closePath(); c.fill();
    c.fillRect(x - 9, 45, 18, 5); c.fillRect(x - 3, 38, 6, 7);
    c.fillStyle = material(112, 255); c.fillRect(x - 3, 52, 1.4, 91);
    c.fillStyle = material(65, 255); c.fillRect(x - 3, 166, 2.2, 346);
    for (let y = 64; y < 145; y += 18) { c.fillStyle = material(92, 255); c.fillRect(x + 1, y, 1.5, 1.5); }
  }
  return sprite;
}

export function makeTrain() {
  const sprite = document.createElement('canvas'); sprite.width = TRAIN.width; sprite.height = TRAIN.height;
  const context = sprite.getContext('2d'); if (!context) throw new Error('Canvas 2D unavailable');
  const c = context; c.lineJoin = 'round'; c.lineCap = 'round';
  const box = (x: number,y: number,w: number,h: number,light: number,r=0,window=0) => {
    c.fillStyle = material(light,window); c.beginPath(); c.roundRect(x,y,w,h,r); c.fill();
  };
  const line = (points: number[][],light: number,width=1) => {
    c.strokeStyle = material(light); c.lineWidth = width; c.beginPath();
    points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.stroke();
  };
  function shadedBox(x: number,y: number,w: number,h: number,values: number[][],r: number) {
    const g=c.createLinearGradient(x,y,x,y+h);
    for (const [stop,value] of values) g.addColorStop(stop,material(value));
    c.fillStyle=g; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill();
  }
  function rivets(x1: number,x2: number,y: number,step=14) {
    for(let x=x1;x<x2;x+=step){c.fillStyle=material(125);c.beginPath();c.arc(x,y,1,0,Math.PI*2);c.fill();}
  }
  // Passenger carriages: curved roof, recessed window frames, panel seams,
  // springs, two four-wheel bogies and a visible coupling between carriages.
  for (const x of [25,250]) {
    shadedBox(x,135,210,66,[[0,82],[.2,68],[.55,44],[1,19]],3);
    box(x+3,180,204,18,54); line([[x+4,182],[x+206,182]],122,1.4);
    shadedBox(x-5,124,220,15,[[0,125],[.35,76],[1,22]],7);
    line([[x+1,125],[x+207,125]],151,1.3);
    box(x+20,117,172,8,52,4); line([[x+23,118],[x+188,118]],108);
    for(let i=0;i<7;i++){
      const wx=x+12+i*27;
      box(wx-2,143,23,32,12,2); box(wx,146,19,25,0,1,238);
      box(wx+1,147,17,4,0,0,165); box(wx+8.5,146,2,25,29);
      line([[wx-1,174],[wx+21,174]],120);
      line([[wx+22,180],[wx+22,197]],30);
    }
    box(x+2,201,206,6,21); box(x+12,207,185,5,40);
    for(const bx of [x+32,x+152]){
      box(bx-9,210,44,8,27,3); line([[bx-4,212],[bx+30,212]],108,2);
      for(let j=0;j<4;j++) line([[bx+5+j*4,208],[bx+2+j*4,213],[bx+5+j*4,217]],73,1);
    }
    rivets(x+10,x+202,195,19);
    box(x+212,190,9,9,12,2); line([[x+212,204],[x+228,204]],86,3);
  }
  // Tender: sloped coal bunker, individual coal fragments, chassis and steps.
  shadedBox(484,153,151,52,[[0,89],[.15,48],[1,23]],2);
  box(478,148,162,6,110,1); line([[490,157],[490,196],[627,196],[627,157]],101,1.2);
  c.fillStyle=material(18); c.beginPath(); c.moveTo(489,148); c.lineTo(505,136); c.lineTo(523,140); c.lineTo(548,128); c.lineTo(571,135); c.lineTo(592,129); c.lineTo(630,148); c.closePath(); c.fill();
  for(let i=0;i<11;i++){const x=502+i*11,y=139+Math.sin(i*2.7)*4;box(x,y,7,4,57,2);}
  rivets(493,629,160,15); rivets(493,629,198,15);
  box(480,205,159,8,17); line([[497,217],[622,217]],83,3); line([[639,202],[658,202]],77,4);
  for(let i=0;i<3;i++)box(630,180+i*10,9,3,119);
  // Cab: separate front face, thick window sills and a curved overhanging roof.
  shadedBox(658,111,91,86,[[0,96],[.3,58],[1,23]],2);
  box(736,115,13,82,24); line([[737,116],[737,193]],131,1.2);
  shadedBox(649,99,110,14,[[0,143],[.35,79],[1,21]],6);
  line([[655,100],[751,100]],156,1.2);
  for(const x of [671,706]){box(x-2,123,27,34,17,3);box(x,126,23,27,0,2,242);line([[x-1,158],[x+25,158]],137,2);}
  line([[665,167],[731,167]],109,1.3); rivets(666,736,187,12);
  box(657,196,98,8,24); box(661,204,14,7,105); box(659,214,16,4,90);
  // Boiler: top light, middle barrel, underside, rings and front smokebox.
  shadedBox(743,137,192,58,[[0,162],[.13,117],[.36,76],[.67,49],[1,17]],24);
  for(const x of [770,823,874,914]){
    box(x,140,3,51,29,1);box(x-1,142,1.4,46,163);
  }
  shadedBox(916,137,30,57,[[0,101],[.25,62],[1,13]],10);
  c.fillStyle=material(48);c.beginPath();c.ellipse(943,166,6,25,0,0,Math.PI*2);c.fill();
  line([[945,153],[945,180]],117,1.3);box(946,163,6,5,134,2);
  // Steam dome, safety valve, flared stack and dark mouth.
  shadedBox(792,118,27,25,[[0,151],[.3,89],[1,40]],9);box(788,138,35,5,83,2);
  box(839,127,13,13,86,4);box(842,122,6,8,149,2);
  c.fillStyle=material(60);c.beginPath();c.moveTo(879,139);c.lineTo(878,89);c.lineTo(868,79);c.lineTo(910,79);c.lineTo(900,89);c.lineTo(899,139);c.closePath();c.fill();
  line([[882,88],[883,132]],154,2);box(867,74,44,6,25,2);line([[870,75],[907,75]],145,1.4);
  box(872,135,33,5,102,2);
  // Running board, wheel splashers, cylinder, handrail and cowcatcher.
  box(740,194,217,6,23);line([[748,194],[956,194]],156,1.6);
  for(const x of [767,821,875]){
    c.strokeStyle=material(40);c.lineWidth=6;c.beginPath();c.arc(x,208,27,Math.PI,Math.PI*2);c.stroke();
    c.strokeStyle=material(119);c.lineWidth=1;c.beginPath();c.arc(x,208,30,Math.PI+.1,Math.PI*2-.1);c.stroke();
  }
  shadedBox(914,182,37,23,[[0,124],[.45,61],[1,22]],6);
  line([[758,153],[914,153]],162,1.6);
  for(const x of [766,817,869,910])line([[x,151],[x,158]],134,1.2);
  line([[938,194],[984,226],[950,226]],70,3);
  for(let i=0;i<5;i++)line([[946+i*5,201+i*3],[950+i*7,226]],51,2);
  box(945,192,23,4,121);box(949,154,10,13,28,3);box(954,157,5,6,0,1,240);
  return sprite;
}
