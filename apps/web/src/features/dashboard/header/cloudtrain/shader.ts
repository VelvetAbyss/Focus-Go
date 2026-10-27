// Original Focus&go Cloudbound shader, from the approved standalone V2.
import { TRAIN, BRIDGE } from './trainModel'
import { STEAM_COUNT } from './steam'
export const vertex = `attribute vec2 position; varying vec2 uv;
void main(){ uv = position * .5 + .5; gl_Position=vec4(position,0.,1.); }`;

export const fragment = `precision highp float;
varying vec2 uv;
uniform vec2 resolution;
uniform float time, travel, billow, detail, palette, viewportHeight;
uniform float steamAmount, trainScale, railOffset, cloudLevel, compact;
uniform sampler2D noiseMap, bridgeMap, trainMap;
uniform vec4 steamParticles[${STEAM_COUNT}];
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return texture2D(noiseMap,(i+f+.5)/256.).r; }
float fbm(vec2 p){
  float f=noise(p)*.55; p=p*2.03+vec2(11.3,7.2);
  f+=noise(p)*.26; p=p*2.01+vec2(21.7,9.3);
  f+=noise(p)*.13; p=p*2.06+vec2(5.3,19.1);
  f+=noise(p)*.06*detail; p=p*2.01+vec2(17.9,2.3);
  f+=noise(p)*.035*detail; p=p*2.03+vec2(8.1,13.7);
  f+=noise(p)*.018*detail;
  return f/(.94+.113*detail);
}
vec3 color(vec3 sunset,vec3 morning,vec3 night){return palette<.5?sunset:(palette<1.5?morning:night);}
// Each bank is a continuously evolving contour field, with painted shadow bands.
float cloud(vec2 p,float altitude,float scale,float drift,float seed){
  float x=p.x+travel*drift;
  float spacing=.66/scale;
  float cell=floor(x/spacing);
  float top=altitude+.4;
  // Overlapping circular updrafts provide rounded cumulus silhouettes.
  // Small fractal perturbations roughen their edges without creating spires.
  for(int i=-2;i<=2;i++){
    float id=cell+float(i);
    float rnd=noise(vec2(id*3.7+seed,seed+11.));
    float cx=(id+.35+noise(vec2(id+seed,13.))*.3)*spacing;
    float r=spacing*(.62+rnd*.43);
    float dx=abs(x-cx);
    float rise=sqrt(max(0.,r*r-dx*dx));
    float height=altitude+(rnd-.5)*(.045+billow*.25)-rise*(.22+billow*.85);
    height+=sin(id*1.91+time*.045)*.015*billow;
    if(dx<r) top=min(top,height);
  }
  float broad=noise(vec2(x*.62+seed,seed+3.))-.5;
  top+=broad*(.15+billow*.75);
  vec2 q=vec2(x*scale*7.+seed,p.y*scale*7.+seed*.39);
  float rough=(fbm(q+vec2(time*.018,-time*.012))-.5)*detail*(.04+billow*.10);
  return p.y-top+rough;
}
vec3 paint(vec3 under,float d,vec3 rim,vec3 body,vec3 shadow,float softness){
  float edge=smoothstep(-softness,softness,d);
  float b1=smoothstep(.030,.033,d),b2=smoothstep(.145,.149,d);
  vec3 c=mix(rim,body,b1); c=mix(c,shadow,b2);
  return mix(under,c,edge);
}
float segment(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.));}
vec3 wheel(vec3 c,vec2 p,vec2 center,float radius,float distance,vec3 iron,vec3 metal,float aa){
  vec2 q=p-center;float r=length(q);
  if(r>radius+aa)return c;
  float edge=1.-smoothstep(radius-aa*.5,radius+aa*.5,r);
  float rim=1.-smoothstep(.7,1.5+aa*.4,abs(r-(radius-2.)));
  float theta=atan(q.y,q.x)-distance/radius;
  float spoke=(1.-smoothstep(.10,.22+aa*.01,abs(sin(theta*5.))))*step(4.,r)*step(r,radius-4.);
  float hub=1.-smoothstep(2.,4.+aa*.3,r);
  vec3 w=mix(iron*.70,metal*.62,rim*.75);
  w=mix(w,metal*.82,max(spoke*.65,hub));
  return mix(c,w,edge);
}
void main(){
  vec2 st=vec2(uv.x,1.-uv.y);
  float aspect=resolution.x/resolution.y;
  // Crop the landscape to the existing masthead. Model scale stays about
  // 140 CSS pixels wide without expanding the original layout.
  float framing=max(.30,viewportHeight/220.);
  float railScreen=mix(.55,.40,compact)-railOffset;
  vec2 p=vec2((st.x-.5)*aspect*framing,(st.y-railScreen)*framing+.725);
  float skyMix=smoothstep(.0,.86,p.y);
  vec3 skyTop=color(vec3(.48,.60,.82),vec3(.60,.74,.78),vec3(.12,.18,.29));
  vec3 skyBottom=color(vec3(.96,.68,.45),vec3(.95,.87,.70),vec3(.41,.36,.49));
  vec3 c=mix(skyTop,skyBottom,skyMix);
  // Subtle evening disk; mostly hidden behind the cloud banks.
  float sun=1.-smoothstep(.065,.068,length(p-vec2(aspect*.25,.29)));
  c=mix(c,color(vec3(1.,.87,.62),vec3(1.,.95,.80),vec3(.88,.88,.75)),sun*.75);
  float d=cloud(p,.38,1.9,.047,12.7);
  c=paint(c,d,color(vec3(.99,.91,.79),vec3(.98,.96,.86),vec3(.53,.57,.64)),color(vec3(.91,.80,.72),vec3(.81,.86,.79),vec3(.39,.43,.55)),color(vec3(.83,.68,.65),vec3(.64,.75,.72),vec3(.28,.33,.45)),.0015);
  d=cloud(p,.49,2.4,.085,37.3);
  c=paint(c,d,color(vec3(.85,.47,.34),vec3(.77,.79,.63),vec3(.48,.39,.53)),color(vec3(.74,.37,.31),vec3(.63,.69,.60),vec3(.35,.28,.43)),color(vec3(.62,.31,.31),vec3(.49,.60,.57),vec3(.24,.24,.37)),.0014);
  d=cloud(p,.59,2.1,.125,7.4);
  c=paint(c,d,color(vec3(1.,.73,.48),vec3(.98,.88,.68),vec3(.66,.53,.58)),color(vec3(1.,.60,.33),vec3(.90,.77,.57),vec3(.53,.40,.50)),color(vec3(.97,.50,.28),vec3(.76,.65,.51),vec3(.40,.32,.44)),.0013);
  d=cloud(p,.72,3.5,.19,52.8);
  c=paint(c,d,color(vec3(1.,.85,.63),vec3(.99,.92,.76),vec3(.66,.62,.68)),color(vec3(.93,.65,.48),vec3(.80,.79,.66),vec3(.47,.44,.57)),color(vec3(.72,.44,.41),vec3(.55,.65,.59),vec3(.31,.33,.45)),.0012);
  // The wheel bottoms and rail head use precisely the same world coordinate.
  float railY=.725;
  float bridgeScale=${BRIDGE.worldWidth.toFixed(6)}/${BRIDGE.size.toFixed(1)};
  vec2 bp=vec2(fract(p.x/${BRIDGE.worldWidth.toFixed(6)}+travel*${BRIDGE.drift.toFixed(6)}), (p.y-(railY-${BRIDGE.rail.toFixed(1)}*bridgeScale))/${BRIDGE.worldWidth.toFixed(6)});
  vec4 bridge=texture2D(bridgeMap,bp);
  bridge.a*=step(0.,bp.y)*step(bp.y,1.);
  vec3 iron=color(vec3(.24,.16,.17),vec3(.23,.29,.27),vec3(.16,.16,.24));
  vec3 bridgeColor=mix(iron,vec3(.91,.55,.35),bridge.r*.24);
  c=mix(c,bridgeColor,bridge.a);
  // Train follows the camera. The world moves past it.
  float headroom=max(.02,railScreen*framing-.012)*${(TRAIN.width/(TRAIN.rail-TRAIN.chimney[1])).toFixed(6)};
  float trainWidth=min(min(${TRAIN.worldWidth.toFixed(6)}*trainScale,aspect*framing*.90),headroom);
  float centerX=mix(-.14,aspect*framing*.27,compact);
  float trainLeft=clamp(centerX-trainWidth*.5,-aspect*framing*.475,aspect*framing*.475-trainWidth);
  float modelScale=trainWidth/${TRAIN.width.toFixed(1)};
  float trainY=railY-${TRAIN.rail.toFixed(1)}*modelScale;
  vec2 model=(p-vec2(trainLeft,trainY))/modelScale;
  vec2 tp=model/vec2(${TRAIN.width.toFixed(1)},${TRAIN.height.toFixed(1)});
  vec4 train=texture2D(trainMap,tp);
  train.a*=step(0.,tp.x)*step(tp.x,1.)*step(0.,tp.y)*step(tp.y,1.);
  vec3 metal=color(vec3(.75,.57,.40),vec3(.64,.67,.57),vec3(.51,.57,.66));
  vec3 body=mix(iron*.82,metal,train.r*.86);
  body=mix(body,color(vec3(1.,.84,.53),vec3(.99,.92,.72),vec3(1.,.77,.43)),train.g);
  c=mix(c,body,train.a);
  float distance=travel*${(BRIDGE.worldWidth*BRIDGE.drift).toFixed(8)}/modelScale;
  float aa=max(.8,framing/(resolution.y*modelScale));
  if(model.x>0. && model.x<1024. && model.y>175. && model.y<234.){
    ${TRAIN.wheels.map(([x,r]) => `c=wheel(c,model,vec2(${x.toFixed(1)},${(TRAIN.rail-r).toFixed(1)}),${r.toFixed(1)},distance,iron,metal,aa);`).join('\n    ')}
    // One crank phase drives all three coupled wheels and the piston crosshead.
    float a=distance/24.;vec2 crank=vec2(cos(a),sin(a))*13.;
    vec2 a1=vec2(767.,208.)+crank,a2=vec2(821.,208.)+crank,a3=vec2(875.,208.)+crank;
    float pistonY=195.;
    vec2 crosshead=vec2(a3.x+sqrt(2500.-pow(pistonY-a3.y,2.)),pistonY);
    float rod=min(segment(model,a1,a3),segment(model,a3,crosshead));
    c=mix(c,metal*.88,1.-smoothstep(1.2,2.8+aa*.25,rod));
    float joints=min(min(length(model-a1),length(model-a2)),length(model-a3));
    c=mix(c,metal,1.-smoothstep(2.,4.+aa*.2,joints));
    // A narrow contact shadow connects each grounded wheel to the rail.
    float contact=(1.-smoothstep(.35,1.8,abs(model.y-232.)))*step(35.,model.x)*step(model.x,978.);
    c=mix(c,iron*.78,contact*.45);
  }
  vec2 chimney=vec2(trainLeft,trainY)+vec2(${TRAIN.chimney[0].toFixed(1)},${TRAIN.chimney[1].toFixed(1)})*modelScale;
  vec2 relative=(p-chimney)/(trainWidth/${TRAIN.worldWidth.toFixed(6)});
  float density=0.;
  if(relative.x>-.80 && relative.x<.06 && relative.y>-.42 && relative.y<.025){
    for(int i=0;i<${STEAM_COUNT};i++){
      vec4 particle=steamParticles[i];
      if(particle.w>.001){
        vec2 delta=(relative-particle.xy)/vec2(particle.z*1.28,particle.z);
        // Small curls break up the plume edge while preserving a soft, dense core.
        vec2 curlField=vec2(noise(p*91.+vec2(time*.37,float(i)*7.3)),noise(p*79.-vec2(float(i)*3.9,time*.29)))-.5;
        delta+=curlField*.38;
        float d2=dot(delta,delta);
        if(d2<6.){
          float curl=noise(p*125.+vec2(float(i)*7.3,time*.30));
          density+=exp(-d2*(1.6+curl*.8))*particle.w*(.68+curl*.5);
        }
      }
    }
    // Thin fresh jet, exactly anchored to the mouth; it joins the first puffs.
    float jet=(1.-smoothstep(.002,.006,abs(relative.x)))*(1.-smoothstep(.004,.020,-relative.y))*step(relative.y,.0);
    density+=jet*.58;
  }
  float smoke=(1.-exp(-density*1.45*steamAmount))*.84;
  c=mix(c,color(vec3(1.,.96,.87),vec3(.99,.98,.92),vec3(.79,.83,.89)),smoke);
  c=mix(c,bridgeColor,bridge.a*bridge.g);
  // Fit the near cloud sea beneath the bridge in the original short masthead.
  // Compress the drifting contours vertically, keeping every crest below the
  // wheel/rail contact while leaving enough cloud body to read as a cloud bank.
  float nearContour=cloud(vec2(p.x,1.),1.08,3.1,.29,81.2);
  float cloudDrop=(.65-cloudLevel)*.09;
  float cloudRoom=(1.-railScreen)*framing;
  float nearGap=max(.014,.022+cloudDrop+.085*smoothstep(-.24,.24,-nearContour));
  float foregroundTop=railY+min(nearGap,max(.014,cloudRoom-.055));
  float shortHeader=1.-smoothstep(110.,200.,viewportHeight);
  d=mix(min(cloud(p,1.08+cloudDrop,3.1,.29,81.2),p.y-railY-.014),p.y-foregroundTop,shortHeader);
  c=paint(c,d,color(vec3(1.,.90,.73),vec3(.99,.94,.79),vec3(.60,.62,.69)),color(vec3(.94,.76,.60),vec3(.82,.83,.71),vec3(.43,.47,.59)),color(vec3(.75,.55,.51),vec3(.57,.69,.64),vec3(.28,.32,.45)),.001);
  float frontContour=cloud(vec2(p.x,1.12),1.22,3.7,.39,113.6);
  float frontGap=.082+cloudDrop+.065*smoothstep(-.24,.24,-frontContour);
  d=mix(min(cloud(p,1.22+cloudDrop,3.7,.39,113.6),p.y-railY-.035),p.y-(railY+min(frontGap,max(.035,cloudRoom-.025))),shortHeader);
  c=paint(c,d,color(vec3(.80,.58,.51),vec3(.75,.80,.69),vec3(.43,.46,.57)),color(vec3(.65,.45,.47),vec3(.58,.69,.63),vec3(.29,.34,.47)),color(vec3(.43,.34,.40),vec3(.40,.54,.52),vec3(.19,.25,.37)),.001);
  float grain=texture2D(noiseMap,gl_FragCoord.xy/256.).r-.5;
  c+=grain*.018;
  float vignette=1.-.11*pow(length((st-.5)*vec2(1.05,.8)),1.4);
  gl_FragColor=vec4(c*vignette,1.);
}`;
