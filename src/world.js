/* AXO's little world. Original geometry, lighting and animation; no dependencies. */
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const vec = {
  add: (a,b) => a.map((v,i)=>v+b[i]), sub:(a,b)=>a.map((v,i)=>v-b[i]),
  mul:(a,s)=>a.map(v=>v*s), dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  norm:a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);}
};
function identity(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
function multiply(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function compose(p=[0,0,0],r=[0,0,0],s=[1,1,1]){
  const [x,y,z]=r,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  const rx=[1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1],ry=[cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1],rz=[cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1];
  let m=multiply(multiply(ry,rx),rz);for(let j=0;j<3;j++)for(let i=0;i<3;i++)m[j*4+i]*=s[j];m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;
}
function normalMatrix(m){const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],bc=vec.cross(b,c),ca=vec.cross(c,a),ab=vec.cross(a,b),d=vec.dot(a,bc)||1;return [...vec.mul(bc,1/d),...vec.mul(ca,1/d),...vec.mul(ab,1/d)];}
function lookAt(eye,target){const z=vec.norm(vec.sub(eye,target)),x=vec.norm(vec.cross([0,1,0],z)),y=vec.cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-vec.dot(x,eye),-vec.dot(y,eye),-vec.dot(z,eye),1];}
function orthographic(l,r,b,t,n,f){return [2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1];}
function transform(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
const COLORS={cream:'#f1ebd8',white:'#fff8e7',mint:'#b6d4bb',green:'#8db49c',sage:'#8da88b',dark:'#203b36',ink:'#142e2b',lime:'#dfed9b',water:'#8fc9b4',cyan:'#bcf3da',sand:'#dfcfad',sandDark:'#b7a483',pink:'#e0b1cb',lavender:'#b2a7e8',rose:'#e0b1cb',cobalt:'#6b9baa',jade:'#7fa99a',lakeDepth:'#18233f',lakeSurface:'#315372',darkAmethyst:'#231942',dustyGrape:'#5e548e',amethystSmoke:'#9f86c0',lilac:'#be95c4',pinkOrchid:'#e0b1cb',signal:'#8deafa'};
const FLORA={
  dahlia:{id:'dahlia-scapigera',scientificName:'Dahlia scapigera',habitat:'Terrestrial',form:'eight elongated ray florets',height:.29},
  cosmos:{id:'cosmos-atrosanguineus',scientificName:'Cosmos atrosanguineus',habitat:'Terrestrial',form:'rounded eight-petal cup',height:.44},
  tigridia:{id:'tigridia-vanhouttei',scientificName:'Tigridia vanhouttei',habitat:'Terrestrial',form:'three broad tepals and spotted cup',height:.34},
  laelia:{id:'laelia-speciosa',scientificName:'Laelia speciosa',habitat:'Epiphytic · branch mount',form:'orchid with three sepals, two petals and curled lip',height:.40},
  nymphaea:{id:'nymphaea-gracilis',scientificName:'Nymphaea gracilis',habitat:'Aquatic · floating leaves',form:'two whorls of pointed waterlily petals',height:.10}
};
function geometry(positions,normals,indices){return {positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint16Array(indices)};}
function sphere(segs=28,rings=18){const p=[],n=[],idx=[];for(let j=0;j<=rings;j++){const v=j/rings,ph=v*PI;for(let i=0;i<=segs;i++){const th=i/segs*TAU,x=-Math.cos(th)*Math.sin(ph),y=Math.cos(ph),z=Math.sin(th)*Math.sin(ph);p.push(x,y,z);n.push(x,y,z);}}for(let j=0;j<rings;j++)for(let i=0;i<segs;i++){const a=j*(segs+1)+i,b=a+segs+1;idx.push(a,b,a+1,b,b+1,a+1);}return geometry(p,n,idx);}
function cylinder(segs=48,top=1,bottom=1,height=1){const p=[],n=[],idx=[];for(let j=0;j<=1;j++)for(let i=0;i<=segs;i++){const t=i/segs*TAU,r=j?top:bottom,x=Math.cos(t),z=Math.sin(t);p.push(x*r,(j-.5)*height,z*r);n.push(...vec.norm([x,(bottom-top)/height,z]));}for(let i=0;i<segs;i++){const a=i,b=i+segs+1;idx.push(a,b,a+1,b,b+1,a+1);}for(let j=0;j<=1;j++){const base=p.length/3,r=j?top:bottom,y=(j-.5)*height;p.push(0,y,0);n.push(0,j?1:-1,0);for(let i=0;i<=segs;i++){const t=i/segs*TAU;p.push(r*Math.cos(t),y,r*Math.sin(t));n.push(0,j?1:-1,0);}for(let i=0;i<segs;i++)j?idx.push(base,base+i+2,base+i+1):idx.push(base,base+i+1,base+i+2);}return geometry(p,n,idx);}
function box(){const p=[],n=[],idx=[];const faces=[[[1,0,0],[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],[[-1,0,0],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],[[0,1,0],[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],[[0,-1,0],[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],[[0,0,1],[1,-1,1],[1,1,1],[-1,1,1],[-1,-1,1]],[[0,0,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[1,-1,-1]]];for(const f of faces){const b=p.length/3;for(let i=1;i<5;i++){p.push(...f[i].map(x=>x*.5));n.push(...f[0]);}idx.push(b,b+1,b+2,b,b+2,b+3);}return geometry(p,n,idx);}
function mergeParts(parts){
  const p=[],n=[],idx=[];
  for(const {source,matrix}of parts){
    const offset=p.length/3,nm=normalMatrix(matrix);
    for(let i=0;i<source.positions.length;i+=3){p.push(...transform(matrix,Array.from(source.positions.slice(i,i+3))));const x=source.normals[i],y=source.normals[i+1],z=source.normals[i+2];n.push(...vec.norm([nm[0]*x+nm[3]*y+nm[6]*z,nm[1]*x+nm[4]*y+nm[7]*z,nm[2]*x+nm[5]*y+nm[8]*z]));}
    for(const index of source.indices)idx.push(index+offset);
  }
  return geometry(p,n,idx);
}
function stoneBlock(width,depth,height,bevel=.02,seed=1){
  const widths=Array.isArray(width)?width:[width,width],w=Math.min(...widths),d=depth/2,h=height/2;
  const b=Math.min(bevel,height*.32,w*.18,depth*.18),p=[],n=[],idx=[];
  let state=seed>>>0;const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const cuts=Array.from({length:4},()=>b*(.8+rand()*.9)),x=w/2;
  const outline=[[-x+cuts[0],-d],[x-cuts[1],-d],[x,-d+cuts[1]],[x,d-cuts[2]],[x-cuts[2],d],[-x+cuts[3],d],[-x,d-cuts[3]],[-x,-d+cuts[0]]];
  const point=([u,v],inset,y)=>{u*=1-inset/x;v*=1-inset/d;return [u*(widths[0]+(widths[1]-widths[0])*(v/depth+.5))/w,y,v];};
  const top=outline.map(q=>point(q,b*.7,h-rand()*b*.12)),shoulder=outline.map(q=>point(q,0,h-b)),lower=outline.map(q=>point(q,b*.12,-h+b*.35)),bottom=outline.map(q=>point(q,b*.3,-h));
  const tri=(a,c,e,out)=>{let normal=vec.norm(vec.cross(vec.sub(c,a),vec.sub(e,a)));if(vec.dot(normal,out)<0){[c,e]=[e,c];normal=normal.map(v=>-v);}const k=p.length/3;for(const q of [a,c,e]){p.push(...q);n.push(...normal);}idx.push(k,k+1,k+2);};
  for(let i=0;i<8;i++){const j=(i+1)%8,out=[outline[i][0]+outline[j][0],0,outline[i][1]+outline[j][1]];
    tri([0,h,0],top[i],top[j],[0,1,0]);tri([0,-h,0],bottom[j],bottom[i],[0,-1,0]);
    for(const [a,c]of [[top,shoulder],[shoulder,lower],[lower,bottom]]){tri(a[i],c[i],c[j],out);tri(a[i],c[j],a[j],out);}
  }
  return geometry(p,n,idx);
}
// Broad leaf membrane, closed and outward-wound on both sides. No negative scale.
// Uses the production geometry(positions, normals, indices) helper.
function gillFin(side=1){
  side=side<0?-1:1;
  const p=[],n=[],idx=[],S=8,L=.66;
  const stations=[[0,0],[.12,.050],[.28,.08625],[.48,.100],[.69,.080],[.87,.04125],[1,0]];
  const center=t=>[side*L*t,.07*t*t,.009*Math.sin(Math.PI*t)];
  const add=(a,b,c)=>idx.push(...(side>0?[a,b,c]:[a,c,b]));
  p.push(...center(0));
  for(let i=1;i<stations.length-1;i++){
    const [t,w]=stations[i],c=center(t),h=.022*Math.pow(w/.10,.85);
    for(let j=0;j<S;j++){
      const a=j/S*Math.PI*2;
      p.push(c[0],c[1]+w*Math.cos(a),c[2]+h*Math.sin(a));
    }
  }
  const tip=p.length/3;p.push(...center(1));
  for(let j=0;j<S;j++)add(0,1+(j+1)%S,1+j);
  for(let r=0;r<4;r++)for(let j=0;j<S;j++){
    const a=1+r*S+j,an=1+r*S+(j+1)%S,b=a+S,bn=an+S;
    add(a,an,b);add(an,bn,b);
  }
  const last=1+4*S;
  for(let j=0;j<S;j++)add(last+j,last+(j+1)%S,tip);
  // Area-weighted vertex normals preserve the shallow convex lens.
  for(let i=0;i<p.length;i++)n.push(0);
  for(let i=0;i<idx.length;i+=3){
    const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
    const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2];
    const vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    for(const k of [a,b,c]){n[k]+=nx;n[k+1]+=ny;n[k+2]+=nz;}
  }
  for(let i=0;i<n.length;i+=3){const d=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=d;n[i+1]/=d;n[i+2]/=d;}
  const g=geometry(p,n,idx);
  // Optional paths, suitable for a thin tube rim and front-facing circuit trace.
  g.rim=stations.map(([t,w])=>{const c=center(t);return [c[0],c[1]+w,c[2]];})
    .concat(stations.slice(1,-1).reverse().map(([t,w])=>{const c=center(t);return [c[0],c[1]-w,c[2]];}));
  g.rim.push(g.rim[0].slice());
  g.centerline=stations.map(([t,w])=>{const c=center(t);return [c[0],c[1],c[2]+.022*Math.pow(w/.10,.85)+.004];});
  return g;
}

function waterDisk(segs=128){
  const p=[0,0,0],n=[0,1,0],idx=[];
  for(let i=0;i<=segs;i++){const angle=i/segs*TAU;p.push(Math.cos(angle),0,Math.sin(angle));n.push(0,1,0);}
  for(let i=0;i<segs;i++)idx.push(0,i+2,i+1);
  return geometry(p,n,idx);
}
function torus(major=1,minor=.1,segs=52,sides=8,arc=TAU){const p=[],n=[],idx=[];for(let i=0;i<=segs;i++){const a=i/segs*arc;for(let j=0;j<=sides;j++){const b=j/sides*TAU,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);p.push((major+minor*cb)*ca,minor*sb,(major+minor*cb)*sa);n.push(cb*ca,sb,cb*sa);}}for(let i=0;i<segs;i++)for(let j=0;j<sides;j++){let a=i*(sides+1)+j,b=a+sides+1;idx.push(a,a+1,b,b,a+1,b+1);}return geometry(p,n,idx);}
function tube(points,radius=.05,sides=8){const p=[],n=[],idx=[];for(let i=0;i<points.length;i++){const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],t=vec.norm(vec.sub(next,prev)),reference=Math.abs(t[1])>.94?[1,0,0]:[0,1,0],u=vec.norm(vec.cross(t,reference)),v=vec.cross(t,u);for(let j=0;j<=sides;j++){const a=j/sides*TAU,d=vec.add(vec.mul(u,Math.cos(a)),vec.mul(v,Math.sin(a)));p.push(...vec.add(points[i],vec.mul(d,radius)));n.push(...d);}}for(let i=0;i<points.length-1;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;idx.push(a,a+1,b,b,a+1,b+1);}return geometry(p,n,idx);}
function bezier(a,b,c,d,segments=28){return Array.from({length:segments+1},(_,i)=>{let t=i/segments,u=1-t;return a.map((_,j)=>u*u*u*a[j]+3*u*u*t*b[j]+3*u*t*t*c[j]+t*t*t*d[j]);});}
function annulus(inner,outer,height=.1,segs=120){
  const p=[],n=[],idx=[];
  const face=(points,normal)=>{const base=p.length/3;for(const point of points){p.push(...point);n.push(...normal);}idx.push(base,base+1,base+2,base,base+2,base+3);};
  for(let i=0;i<segs;i++){
    const a=i*TAU/segs,b=(i+1)*TAU/segs,mid=(a+b)/2,h=height/2;
    const point=(r,t,y)=>[Math.cos(t)*r,y,Math.sin(t)*r];
    face([point(inner,a,h),point(inner,b,h),point(outer,b,h),point(outer,a,h)],[0,1,0]);
    face([point(inner,a,-h),point(outer,a,-h),point(outer,b,-h),point(inner,b,-h)],[0,-1,0]);
    face([point(outer,a,-h),point(outer,a,h),point(outer,b,h),point(outer,b,-h)],[Math.cos(mid),0,Math.sin(mid)]);
    face([point(inner,a,-h),point(inner,b,-h),point(inner,b,h),point(inner,a,h)],[-Math.cos(mid),0,-Math.sin(mid)]);
  }
  return geometry(p,n,idx);
}
function islandGeometry(){const p=[],n=[],idx=[],s=96,levels=[[-.46,2.15],[-.33,2.48],[.04,2.72],[.27,2.65],[.38,2.5]];for(let j=0;j<levels.length;j++)for(let i=0;i<=s;i++){const a=i/s*TAU,[y,r]=levels[j],ripple=1+.035*Math.sin(a*3+.7)+.025*Math.cos(a*5);p.push(Math.cos(a)*r*ripple,y,Math.sin(a)*r*ripple*.83);const prev=levels[Math.max(0,j-1)],next=levels[Math.min(levels.length-1,j+1)],slope=-(next[1]-prev[1])/(next[0]-prev[0])*ripple;n.push(...vec.norm([Math.cos(a),slope,Math.sin(a)/.83]));}for(let j=0;j<levels.length-1;j++)for(let i=0;i<s;i++){const a=j*(s+1)+i,b=a+s+1;idx.push(a,b,a+1,b,b+1,a+1);}return geometry(p,n,idx);}
const VERTEX=`precision highp float;attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uModel;uniform mat4 uVP;uniform mat3 uNormal;uniform mediump float uOutline;varying mediump vec3 vNormal;varying mediump vec3 vWorld;varying mediump vec3 vLocal;void main(){vec4 w=uModel*vec4(aPosition,1.);vec3 n=normalize(uNormal*aNormal);w.xyz+=n*uOutline;vNormal=n;vWorld=w.xyz;vLocal=aPosition;gl_Position=uVP*w;}`;
const FRAGMENT=`
precision mediump float;
uniform vec3 uColor;
uniform vec3 uEye;
uniform vec3 uLight;
uniform vec4 uSurface; // night, alpha, glow, water region (0=solid, 1=lake, 2=basin)
uniform vec3 uEnvironment; // bounded current rotation, island rotation, bounded wave phase
uniform vec4 uRipples[8]; // island-local center x/z, age, strength
uniform float uOutline;
uniform float uShadow;
uniform vec4 uScan; // plane world y, active, hologram pass, time
uniform vec4 uScanBounds; // feet y, head y, band width, unused
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vLocal;
float boxDistance(vec2 point,vec2 halfSize){return length(max(abs(point)-halfSize,0.));}
vec3 lakeColor(){
  float c=cos(uEnvironment.y),s=sin(uEnvironment.y);
  // Undo the town transform. Currents and interaction centers share this frame.
  vec2 q=vec2(c*vWorld.x-s*vWorld.z,s*vWorld.x+c*vWorld.z);
  float drift=uEnvironment.x,dc=cos(drift),ds=sin(drift);
  vec2 current=vec2(dc*q.x-ds*q.y,ds*q.x+dc*q.y);
  float a=dot(current,vec2(1.65,.55))-uEnvironment.z;
  float b=dot(current,vec2(-.65,1.45))+uEnvironment.z*2.;
  vec2 slopeCurrent=cos(a)*vec2(1.65,.55)*.014+cos(b)*vec2(-.65,1.45)*.010;
  vec2 slope=vec2(dc*slopeCurrent.x+ds*slopeCurrent.y,-ds*slopeCurrent.x+dc*slopeCurrent.y);
  for(int i=0;i<8;i++){
    vec4 wave=uRipples[i];
    bool sameRegion=(uSurface.w>1.5&&length(wave.xy)<.6)||(uSurface.w<1.5&&length(wave.xy)>=.6);
    if(wave.z>=0.&&wave.z<2.8&&sameRegion){
      vec2 delta=q-wave.xy;float distance=length(delta);
      float radius=.035+wave.z*(.32+wave.w*.22),offset=distance-radius;
      float envelope=exp(-offset*offset/.024)*exp(-wave.z*.78)*wave.w;
      float derivative=(22.*cos(offset*22.)-offset/ .012*sin(offset*22.))*envelope*.026;
      slope+=delta/max(distance,.025)*derivative;
    }
  }
  vec3 localNormal=normalize(vec3(-slope.x,1.,-slope.y));
  vec3 normal=vec3(c*localNormal.x+s*localNormal.z,localNormal.y,-s*localNormal.x+c*localNormal.z);
  vec3 view=normalize(uEye-vWorld),reflection=reflect(-view,normal);
  // Broad sky reflections bend with the surface. No colored sine stripes.
  vec3 sky=mix(vec3(.10,.09,.22),vec3(.45,.43,.64),clamp(reflection.y*.70+.35,0.,1.));
  float cloud=exp(-pow((reflection.x+.25)*1.65,2.)-pow((reflection.z+.30)*.90,2.));
  sky=mix(sky,vec3(.64,.43,.59),cloud*.48);
  vec3 body=mix(uColor,vec3(.065,.10,.22),.30+uSurface.x*.18);
  float fresnel=.30+.50*pow(1.-max(dot(normal,view),0.),3.);
  vec3 color=mix(body,sky,fresnel);
  vec3 halfView=normalize(view+normalize(vec3(-.25,.80,-.55)));
  float glint=pow(max(dot(normal,halfView),0.),72.);
  color+=vec3(.55,.49,.70)*glint*.16;
  float radius=length(q),contact;
  if(uSurface.w>1.5){contact=min(.535-radius,radius-.26);}
  else{
    contact=min(2.94-radius,min(abs(radius-2.20),abs(radius-2.78)));
    for(int i=0;i<6;i++){
      float angle=float(i)*1.0471975512;
      vec2 radial=vec2(sin(angle),cos(angle)),tangent=vec2(cos(angle),-sin(angle));
      vec2 at=vec2(dot(q,tangent),dot(q,radial));
      contact=min(contact,boxDistance(at-vec2(0.,1.52),vec2(.59,.48)));
      contact=min(contact,boxDistance(at-vec2(0.,2.11),vec2(.20,.35)));
      float gardenAngle=angle+.5235987756;
      vec2 garden=vec2(dot(q,vec2(cos(gardenAngle),-sin(gardenAngle))),dot(q,vec2(sin(gardenAngle),cos(gardenAngle))));
      contact=min(contact,boxDistance(garden-vec2(0.,1.66),vec2(.20,.30)));
    }
  }
  // Dark water touching stone gives depth and contact without a bright halo.
  color*=.76+.24*smoothstep(0.,.16,max(contact,0.));
  return color;
}
void main(){
  if(uShadow>.5){float d=length(vLocal.xz);float alpha=(1.-smoothstep(.1,1.,d))*.18*uSurface.y;gl_FragColor=vec4(.075,.16,.125,alpha);return;}
  // Scan: a horizontal plane splits the character. The solid pass keeps what
  // is above the plane, the hologram pass keeps what is below it.
  float scanDelta=vWorld.y-uScan.x;
  if(uScan.y>.5){if(uScan.z<.5){if(scanDelta<0.)discard;}else if(scanDelta>=0.)discard;}
  if(uOutline>0.){gl_FragColor=vec4(mix(vec3(.09,.17,.145),vec3(.11,.19,.2),uSurface.x),1.);return;}
  if(uSurface.w>.5){gl_FragColor=vec4(lakeColor(),uSurface.y);return;}
  vec3 n=normalize(vNormal);float diffuse=max(dot(n,normalize(uLight)),0.),hemi=n.y*.5+.5;
  float ao=mix(.84,1.,smoothstep(.2,1.7,vWorld.y));
  vec3 lighting=mix(vec3(.63,.71,.64),vec3(.94,.94,.85),hemi)*.83+vec3(1.,.91,.72)*diffuse*.30;
  vec3 nightLight=mix(vec3(.34,.49,.54),vec3(.61,.74,.69),hemi)+vec3(.33,.40,.28)*diffuse;
  vec3 color=uColor*mix(lighting,nightLight,uSurface.x)*ao;
  vec3 halfView=normalize(normalize(uEye-vWorld)+normalize(uLight));color+=pow(max(dot(n,halfView),0.),42.)*.08;
  color=mix(color,uColor,uSurface.z);float alpha=uSurface.y;
  if(uScan.y>.5){
    float span=max(uScanBounds.y-uScanBounds.x,.001),h=(vWorld.y-uScanBounds.x)/span;
    float band=1.-smoothstep(0.,uScanBounds.z,abs(scanDelta));
    if(uScan.z>.5){
      vec3 view=normalize(uEye-vWorld);float rim=pow(1.-max(dot(n,view),0.),2.2);
      float stripes=.72+.28*step(.5,fract(h*60.+uScan.w*.05));
      color=mix(color,vec3(.88,.69,.80),.70)*stripes+vec3(.88,.69,.80)*rim*.55;
      alpha=alpha*(.30+.25*rim);
    }
    color+=vec3(.88,.69,.80)*band*1.4;alpha=max(alpha,band);
  }
  gl_FragColor=vec4(color,alpha);
}`;

export class World {
  constructor({canvas,onReady=()=>{},onMascotClick=()=>{},onInteraction=()=>{},onFrame=()=>{},onArrival=()=>{},onProjectClick=()=>{},onError}={}) {
    if(!canvas)throw new Error('World needs a canvas.');
    this.canvas=canvas;this.onReady=onReady;this.onMascotClick=onMascotClick;this.onInteraction=onInteraction;this.onFrame=onFrame;this.onArrival=onArrival;this.onProjectClick=onProjectClick;this.onError=onError;this.dirty=true;
    this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'high-performance',premultipliedAlpha:false});
    if(!this.gl)throw new Error('WebGL is unavailable.');
    this.reading=false;this.readingStarted=0;this.nodes=[];this.geometries=[];this.listeners=[];this.destroyed=false;this.motion=true;this.theme='day';this.night=0;this.time=0;this.waveTime=-1e9;this.view='home';this.azimuth=0;this.targetAzimuth=0;this.scrollAzimuth=0;this.orbitOffset=0;this.directTravel=null;this.elevation=.55;this.targetElevation=.55;this.zoom=1;this.targetZoom=1;this.focus=[0,1.72,0];this.lastTime=0;this.drag=null;this.visible=true;
    const gl=this.gl;const compile=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;};
    this.program=gl.createProgram();const vs=compile(gl.VERTEX_SHADER,VERTEX),fs=compile(gl.FRAGMENT_SHADER,FRAGMENT);gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
    this.loc={};for(const name of ['aPosition','aNormal'])this.loc[name]=gl.getAttribLocation(this.program,name);for(const name of ['uModel','uVP','uNormal','uOutline','uColor','uEye','uLight','uSurface','uEnvironment','uRipples[0]','uShadow','uScan','uScanBounds'])this.loc[name]=gl.getUniformLocation(this.program,name);
    this.geo={sphere:this.upload(sphere()),lowSphere:this.upload(sphere(16,10)),cylinder:this.upload(cylinder()),box:this.upload(box()),island:this.upload(islandGeometry()),waterDisk:this.upload(waterDisk())};
    this.build();this.batchIsland();this.bind();this.resize();
    const tick=(t)=>{if(this.destroyed)return;const dt=this.lastTime?Math.min((t-this.lastTime)/1000,.05):0;this.lastTime=t;const settling=Math.abs(this.azimuth-this.targetAzimuth)+Math.abs(this.elevation-this.targetElevation)+Math.abs(this.zoom-this.targetZoom)+Math.abs(this.night-(this.theme==='night'?1:0))>.0001;if(this.visible&&!this.reading&&(this.motion||this.dirty||settling)){if(this.motion)this.time+=dt;this.update(dt);this.render();this.dirty=false;}this.frame=requestAnimationFrame(tick);};this.frame=requestAnimationFrame(tick);
    requestAnimationFrame(()=>{if(!this.destroyed)this.onReady(this);});
  }
  upload(g){const gl=this.gl,o={count:g.indices.length,source:g};for(const [key,data]of [['position',g.positions],['normal',g.normals],['index',g.indices]]){o[key]=gl.createBuffer();gl.bindBuffer(key==='index'?gl.ELEMENT_ARRAY_BUFFER:gl.ARRAY_BUFFER,o[key]);gl.bufferData(key==='index'?gl.ELEMENT_ARRAY_BUFFER:gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);}this.geometries.push(o);return o;}
  group(p=[0,0,0],r=[0,0,0],s=[1,1,1],parent=null){const o={p:[...p],r:[...r],s:[...s],children:[],parent};(parent?parent.children:this.nodes).push(o);return o;}
  mesh(g,color,p=[0,0,0],s=[1,1,1],r=[0,0,0],parent=null,outline=false,extra={}){const o=this.group(p,r,s,parent);Object.assign(o,{g:typeof g==='string'?this.geo[g]:g,color:typeof color==='string'&&COLORS[color]?rgb(COLORS[color]):rgb(color),outline,...extra});return o;}
  ball(c,p,s,parent,outline=false){return this.mesh('sphere',c,p,s,[0,0,0],parent,outline);}
  cyl(c,p,s,parent,outline=false,r=[0,0,0]){return this.mesh('cylinder',c,p,s,r,parent,outline);}
  path(points,r,c,parent,outline=false){return this.mesh(this.upload(tube(points,r)),c,[0,0,0],[1,1,1],[0,0,0],parent,outline);}
  ring(major,minor,c,p,parent,r=[0,0,0],arc=TAU){return this.mesh(this.upload(torus(major,minor,48,8,arc)),c,p,[1,1,1],r,parent);}
  shadow(p,s,alpha=1){return this.mesh('cylinder','dark',p,[s[0],.001,s[1]],[0,0,0],null,false,{shadow:true,alpha});}
  batchIsland(){
    // Merge the architectural and garden pieces by material. The mascot and
    // drifting leaves remain articulated; the landscape costs a few draw calls.
    const batches=new Map(),keep=[];
    const flush=b=>{if(!b.p.length)return;const o={p:[0,0,0],r:[0,0,0],s:[1,1,1],children:[],g:this.upload(geometry(b.p,b.n,b.i)),color:b.color,outline:b.outline,glow:b.glow,water:b.water};keep.push(o);b.p=[];b.n=[];b.i=[];};
    const visit=(node,parent)=>{
      const m=multiply(parent,compose(node.p,node.r,node.s));
      if(node.g){
        const key=node.color.join(',')+'|'+!!node.outline+'|'+(node.glow||0)+'|'+(node.water||0);let b=batches.get(key);
        if(!b){b={p:[],n:[],i:[],color:node.color,outline:node.outline,glow:node.glow||0,water:node.water||0};batches.set(key,b);}
        const src=node.g.source;if(b.p.length/3+src.positions.length/3>60000)flush(b);
        const offset=b.p.length/3,nm=normalMatrix(m);
        for(let i=0;i<src.positions.length;i+=3){b.p.push(...transform(m,[src.positions[i],src.positions[i+1],src.positions[i+2]]));const a=src.normals[i],c=src.normals[i+1],d=src.normals[i+2];b.n.push(...vec.norm([nm[0]*a+nm[3]*c+nm[6]*d,nm[1]*a+nm[4]*c+nm[7]*d,nm[2]*a+nm[5]*c+nm[8]*d]));}
        for(const index of src.indices)b.i.push(index+offset);
      }
      for(const child of node.children)visit(child,m);
    };
    for(const node of this.island.children){if(node.dynamic||this.lilies.includes(node))keep.push(node);else visit(node,identity());}
    for(const b of batches.values())flush(b);this.island.children=keep;
  }
  build(){
    // AXO walks in the foreground while the lake city turns beneath his feet.
    this.island=this.group();this.lilies=[];this.smoke=[];this.ripples=[];this.flowers=[];this.roadBlocks=[];this.flowTime=0;this.flowerInteractions=0;this.waterInteractions=0;this.hoveredFlower=null;this.pointerLocal=null;
    this.flowerRoot=this.group([0,0,0],[0,0,0],[1,1,1],this.island);this.flowerRoot.dynamic=true;
    this.trackRadius=2.48;this.walkerBaseY=.648;this.travelDistance=0;this.scanProgress=1;this.scanActive=false;this.scanEnvelope=0;this.scanPlaneY=0;this.scanFeetY=0;this.scanHeadY=1;
    this.mesh('island','sand',[0,0,0],[1.16,1,1.40],[0,0,0],this.island);
    this.cyl('dark',[0,-.34,0],[2.76,.12,2.76],this.island);
    this.waterLevel=.490;this.basinWaterLevel=.684;
    this.cyl('darkAmethyst',[0,.35,0],[3.00,.12,3.00],this.island);
    this.cyl('lakeDepth',[0,.437,0],[2.94,.10,2.94],this.island);
    this.mesh(this.upload(annulus(2.94,3.00,.09)),'darkAmethyst',[0,.465,0],[1,1,1],[0,0,0],this.island);
    this.mesh('waterDisk','lakeSurface',[0,this.waterLevel,0],[2.94,1,2.94],[0,0,0],this.island,false,{water:1});
    this.mesh(this.upload(annulus(2.27,2.71,.13)),'darkAmethyst',[0,.54,0],[1,1,1],[0,0,0],this.island);
    // Hand-cut basalt paving: three staggered courses, real recessed joints,
    // chipped corners and sloping bevels catch the light as the city turns.
    for(let row=0;row<3;row++){
      const radius=2.34+row*.14,count=64,step=TAU/count,depth=.130;
      for(let i=0;i<count;i++){
        const a=(i+(row%2)*.5)*step,widths=[2*(radius-depth/2)*Math.tan(step/2)-.012,2*(radius+depth/2)*Math.tan(step/2)-.012];
        const color=i%17===row?'amethystSmoke':(i*7+row*11)%5===0?'darkAmethyst':'dustyGrape';
        const node=this.mesh(this.upload(stoneBlock(widths,depth,.056,.009,7301+row*919+i*37)),color,[Math.sin(a)*radius,.604+Math.sin(i*3.2+row)*.001,Math.cos(a)*radius],[1,1,1],[0,a,0],this.island);
        this.roadBlocks.push({node,row,angle:a,radius,kind:'paver'});
      }
    }
    // Raised, individually cut curb stones make the water-side causeway legible.
    for(const radius of [2.24,2.73])for(let i=0;i<64;i++){
      const a=(i+.25)*TAU/64,w=2*radius*Math.tan(PI/64)-.014;
      const node=this.mesh(this.upload(stoneBlock(w,.075,.075,.010,1201+i*19+Math.round(radius*100))),i%8===0?'lilac':'amethystSmoke',[Math.sin(a)*radius,.618,Math.cos(a)*radius],[1,1,1],[0,a,0],this.island);
      this.roadBlocks.push({node,row:-1,angle:a,radius,kind:'curb'});
    }
    for(let i=0;i<18;i++){
      const a=(i+.5)*TAU/18,r=2.82;
      this.cyl('darkAmethyst',[Math.sin(a)*r,.556,Math.cos(a)*r],[.044,.24,.044],this.island);
      this.ball('pinkOrchid',[Math.sin(a)*r,.691,Math.cos(a)*r],[.027,.024,.027],this.island).glow=.50;
    }
    this.scrollMode=true;this.travelEnabled=false;this.scrollProgress=0;this.worldRotation=0;this.manualRotationOffset=0;
    this.scrollOrder=['retail','rxp','slides','playbooks','adoption','learning'];
    const kinds={retail:'temple',rxp:'observatory',slides:'gallery',playbooks:'archive',adoption:'garden',learning:'academy'};
    const heights={retail:1.50,rxp:1.47,slides:1.38,playbooks:1.30,adoption:1.48,learning:1.42};
    this.scrollStops=this.scrollOrder.map((id,i)=>({id,progress:(i+1)/6,angle:(i+1)*TAU/6,rotation:-(i+1)*TAU/6}));
    this.scrollRotationAnchors=[{progress:0,rotation:0},...this.scrollStops.map(stop=>({id:stop.id,progress:stop.progress,rotation:stop.rotation}))];
    this.stops=new Map();this.points=[];this.landmarks=[];this.projectEffects=new Map();this.highlightedProject=null;
    for(const stop of this.scrollStops){
      const a=stop.angle,x=Math.sin(a)*1.52,z=Math.cos(a)*1.52;
      this.buildProject({id:stop.id,x,z,heading:a,kind:kinds[stop.id]});
      const door=[Math.sin(a)*this.trackRadius,Math.cos(a)*this.trackRadius];this.stops.set(stop.id,door);
      const localPosition=[x,.67+heights[stop.id],z];
      this.points.push({id:stop.id,localPosition,position:[...localPosition]});
      this.landmarks.push({id:stop.id,angle:a,progress:stop.progress,localPosition:[x,.63,z],doorPosition:[door[0],.635,door[1]],height:heights[stop.id]});
      // Short radial quays join every outward-facing workshop to the promenade.
      const quay=this.group([Math.sin(a)*2.11,.568,Math.cos(a)*2.11],[0,a,0],[1,1,1],this.island);
      this.mesh('box','darkAmethyst',[0,0,0],[.35,.11,.66],[0,0,0],quay);
      for(let row=0;row<2;row++)for(let i=0;i<5;i++)this.mesh(this.upload(stoneBlock(.148,.122,.045,.008,901+row*19+i*29)),'dustyGrape',[(row-.5)*.158,.044,-.25+i*.126],[1,1,1],[0,0,0],quay);
      for(const side of [-1,1]){
        this.cyl('darkAmethyst',[side*.19,.10,.12],[.018,.25,.018],quay);
        this.ball('pinkOrchid',[side*.19,.24,.12],[.032,.032,.032],quay).glow=.45;
      }
    }
    // Chinampas alternate with the six addresses. Their rectangular beds keep
    // the original planted-island character visible inside the circular canal.
    for(let row=0;row<6;row++){
      const a=(row+.5)*TAU/6,r=1.66,g=this.group([Math.sin(a)*r,.52,Math.cos(a)*r],[0,a,0],[1,1,1],this.island);
      this.mesh('box','sand',[0,0,0],[.38,.10,.58],[0,0,0],g);
      this.mesh('box','dark',[0,.058,0],[.31,.03,.51],[0,0,0],g);
      for(let i=0;i<2;i++){
        const radius=r-.13+i*.26;
        this.buildFlower([Math.sin(a)*radius,.594,Math.cos(a)*radius],1.0+(row%2)*.08,`chinampa-${row+1}-${i+1}`,i?'lilac':'pinkOrchid');
      }
      const rim=a+.11;
      this.reeds([Math.sin(rim)*2.83,.50,Math.cos(rim)*2.83],.42);
      this.lily([Math.sin(a)*1.94,.515,Math.cos(a)*1.94],.16,a,row%2===0);
    }
    // A low central water garden, with stone terraces rather than a seventh project.
    this.cyl('sand',[0,.53,0],[.80,.12,.80],this.island);
    this.cyl('cream',[0,.61,0],[.73,.055,.73],this.island);
    this.cyl('lakeDepth',[0,.645,0],[.56,.04,.56],this.island);
    this.mesh(this.upload(annulus(.535,.59,.07)),'darkAmethyst',[0,.67,0],[1,1,1],[0,0,0],this.island);
    this.mesh('waterDisk','lakeSurface',[0,this.basinWaterLevel,0],[.535,1,.535],[0,0,0],this.island,false,{water:2});
    this.cyl('sand',[0,.70,0],[.26,.10,.26],this.island);
    this.cyl('cream',[0,.78,0],[.19,.065,.19],this.island);
    for(let i=0;i<6;i++){
      const a=i*TAU/6;this.ball('pink',[Math.sin(a)*.10,.86,Math.cos(a)*.10],[.065,.08,.065],this.island);
    }
    this.ball('lilac',[0,.92,0],[.06,.06,.06],this.island);
    // Deliberately irregular underside and shoreline keep the town handcrafted.
    for(let i=0;i<14;i++){
      const a=i*TAU/14+.17;
      this.mesh('box',i%2?'sandDark':'sand',[Math.cos(a)*2.82,-.18,Math.sin(a)*2.82],[.30,.18+(i%3)*.06,.25],[0,-a,0],this.island);
    }
    this.buildWaterEffects();
    this.buildMascot();this.mascot.s=[.26,.26,.26];this.mascot.p=[0,this.walkerBaseY,this.trackRadius];this.mascot.r[1]=0;
    const markScan=(node)=>{node.scan=true;for(const child of node.children)markScan(child);};markScan(this.mascot);
    this.buildScanPlatform();
    this.mascotShadow=this.shadow([0,.64,this.trackRadius],[.22,.15],.9);
    this.points.push({id:'axo',position:[0,1.63,this.trackRadius]});
    this.orb=this.group([-2.60,1.80,-.70]);this.ball('rose',[0,0,0],[.075,.075,.075],this.orb,true);this.ring(.14,.009,'lilac',[0,0,0],this.orb,[.35,0,.4]);
    this.sparkles=[];
    [[-2.70,1.22,.70],[1.90,2.20,-1.70],[2.80,1.06,-.40]].forEach((p,i)=>{
      const g=this.group(p,[0,0,.3+i]);this.mesh('box',i%2?'rose':'lilac',[0,0,0],[.016,.09,.016],[0,0,0],g);this.mesh('box',i%2?'rose':'lilac',[0,0,0],[.09,.016,.016],[0,0,0],g);this.sparkles.push(g);
    });
    this.walkPhase=0;this.walking=false;this.walkBlend=0;this.walkSpeed=0;this.walkDirection=1;this.facingTarget=0;this.facingMode='visitor';this.plantedLeg=0;this.lastWalkInput=-1e9;this.arrivalId=null;this.lastPassedProject=null;this.lastSettledProject=null;this.scrollDirection=1;this.scrollChapter=0;this.scrollLastChange=-1e9;this.scrollInitialized=false;
    this.setScrollProgress(0);
  }
  flowerForm(type){
    this.flowerForms??=new Map();if(this.flowerForms.has(type))return this.flowerForms.get(type);
    const blade=gillFin(1),round=this.geo.lowSphere.source;
    const part=(source,p,s,r=[0,0,0])=>({source,matrix:compose(p,r,s)});
    const petals=[],foliage=[],details=[];let lip=null,throat=null;
    if(type==='dahlia'){
      for(let i=0;i<8;i++){const a=i*TAU/8;petals.push(part(blade,[Math.cos(a)*.015,0,Math.sin(a)*.015],[.24,.37,.30],[PI/2,-a,0]));}
      for(const side of [-1,1])for(let row=0;row<2;row++)for(let lobe=0;lobe<3;lobe++)foliage.push(part(round,[side*(.035+lobe*.024),.095+row*.070-lobe*.012,(lobe-1)*.015],[.045,.012,.022],[0,side*.25,side*(.20+lobe*.18)]));
    }else if(type==='cosmos'){
      for(let i=0;i<8;i++){const a=i*TAU/8;petals.push(part(round,[Math.sin(a)*.066,.013,Math.cos(a)*.066],[.052,.027,.081],[.12,a,0]));}
      for(const side of [-1,1])for(let i=0;i<6;i++)foliage.push(part(round,[side*(.030+(i%3)*.014),.09+i*.035,(i%2?1:-1)*.012],[.045,.006,.010],[0,side*.3,side*(.35+i*.05)]));
    }else if(type==='tigridia'){
      for(let i=0;i<3;i++){
        const a=i*TAU/3+PI/2;petals.push(part(blade,[Math.cos(a)*.008,0,Math.sin(a)*.008],[.30,.90,.45],[PI/2,-a,0]));
        const b=a+PI/3;petals.push(part(blade,[Math.cos(b)*.006,.024,Math.sin(b)*.006],[.12,.38,.55],[PI/2,-b,0]));
        for(let j=0;j<4;j++){const radius=.045+j*.020,offset=(j%2?1:-1)*.022;details.push(part(round,[Math.cos(a)*radius-Math.sin(a)*offset,.018,Math.sin(a)*radius+Math.cos(a)*offset],[.009,.004,.012],[0,-a,0]));}
      }
      for(let i=-1;i<=1;i++)foliage.push(part(round,[i*.040,.13,-.015],[.014,.15,.014],[.10,0,i*-.23]));
    }else if(type==='laelia'){
      for(const [angle,length,width]of [[PI/2,.22,.20],[PI*5/4,.25,.22],[PI*7/4,.25,.22],[PI*5/6,.285,.58],[PI/6,.285,.58]])petals.push(part(blade,[0,angle<PI/2?.008:0,angle<PI?.005:-.012],[length,width,.34],[0,0,angle]));
      lip=this.upload(mergeParts([
        part(blade,[0,-.004,.030],[.16,.58,.65],[-.20,0,-PI/2]),
        part(round,[-.037,-.068,.055],[.033,.027,.018],[0,0,-.25]),part(round,[.037,-.068,.055],[.033,.027,.018],[0,0,.25]),
        part(round,[0,-.106,.067],[.046,.018,.020],[.20,0,0])
      ]));
      throat=this.upload(mergeParts([part(round,[0,-.031,.068],[.020,.037,.009]),part(round,[0,.009,.056],[.012,.023,.014])]));
      for(const side of [-1,1])foliage.push(part(blade,[0,.19,.010],[.34,.24,.40],[side*.10,side*-.20,side<0?PI-.22:.12]));
      foliage.push(part(round,[0,.19,0],[.024,.060,.022]));
    }else{
      for(let row=0;row<2;row++)for(let i=0;i<8;i++){const a=(i+row*.5)*TAU/8;petals.push(part(blade,[Math.cos(a)*.012,row*.026,Math.sin(a)*.012],[row?.13:.19,row?.32:.42,.36],[PI/2+row*.16,-a,0]));}
    }
    const form={petals:this.upload(mergeParts(petals)),foliage:foliage.length?this.upload(mergeParts(foliage)):null,details:details.length?this.upload(mergeParts(details)):null,lip,throat};
    this.flowerForms.set(type,form);return form;
  }
  buildFlower(position,scale,id,color){
    const type=['dahlia','cosmos','tigridia','laelia'][this.flowers.length%4],species=FLORA[type],shape=this.flowerForm(type);
    const yaw=type==='laelia'?Math.atan2(position[0],position[2]):this.flowers.length*.61;
    const node=this.group(position,[0,yaw,0],[scale,scale,scale],this.flowerRoot),height=species.height;
    if(type==='laelia'){
      this.path([[0,.018,-.025],[.012,.13,-.026],[-.025,.27,-.03]],.018,'dustyGrape',node);
      this.path([[.012,.13,-.026],[.095,.225,.015]],.014,'dustyGrape',node);
      this.path([[-.012,.24,-.01],[0,height,0]],.007,'jade',node);
    }else this.path(bezier([0,0,0],[.018,height*.35,0],[-.012,height*.75,0],[0,height,0],10),type==='cosmos'?.0065:.009,'jade',node);
    this.mesh(shape.foliage,'jade',[0,0,0],[1,1,1],[0,0,0],node);
    const crown=this.group([0,height,0],type==='laelia'?[-.30,0,0]:[0,0,0],[1,1,1],node);
    const petals=this.mesh(shape.petals,type==='cosmos'?'dustyGrape':type==='laelia'?'lilac':color,[0,0,0],[.94,1,.94],[0,0,0],crown);
    let center;
    if(type==='laelia'){
      this.mesh(shape.lip,'amethystSmoke',[0,0,0],[1,1,1],[0,0,0],petals);
      center=this.mesh(shape.throat,'pinkOrchid',[0,0,0],[1,1,1],[0,0,0],petals,false,{glow:.22});
    }else{
      center=this.mesh('lowSphere',type==='cosmos'?'pinkOrchid':'amethystSmoke',[0,type==='tigridia'?.031:.024,0],type==='tigridia'?[.045,.028,.045]:[.030,.019,.030],[0,0,0],crown,false,{glow:.22});
      if(shape.details)this.mesh(shape.details,'dustyGrape',[0,0,0],[1,1,1],[0,0,0],petals);
    }
    const hitAnchor=[0,height+(type==='laelia'?.005:.020),type==='laelia'?.025:0];
    this.flowers.push({id,type,speciesId:species.id,scientificName:species.scientificName,habitat:species.habitat,form:species.form,node,crown,petals,center,height,hitAnchor,localPosition:[...position],scale,bloom:.2,pulse:0,bend:[0,0],velocity:[0,0],index:this.flowers.length});
  }
  flowerWorldPosition(flower){
    const anchor=[...flower.hitAnchor];anchor[1]+=flower.crown.p[1]-flower.height;
    return this.localToWorld(transform(compose(flower.node.p,flower.node.r,flower.node.s),anchor));
  }
  getGardenState(){
    const species=Object.values(FLORA).map(item=>({...item,endemicTo:'Mexico',stylizedPalette:true,count:item.id===FLORA.nymphaea.id?this.lilies.length:this.flowers.filter(flower=>flower.speciesId===item.id).length}));
    return {species,terrestrialCount:this.flowers.length,waterlilyCount:this.lilies.length,bloomingWaterlilies:this.lilies.filter(lily=>lily.hasFlower).length};
  }
  buildWaterEffects(){
    // Interaction impulses shade the actual water plane; there are no floating
    // torus rings or bright stroke meshes above the canal surface.
    this.flowStrokes=[];this.ripplePool=[];this.waterRippleUniforms=new Float32Array(32);
    for(let i=0;i<8;i++)this.ripplePool.push({active:false,start:0,strength:0,radius:0,position:[0,0],region:'lake'});
  }
  worldToLocal(point){
    const c=Math.cos(this.island.r[1]),s=Math.sin(this.island.r[1]),x=point[0]-this.island.p[0],z=point[2]-this.island.p[2];
    return [c*x-s*z,point[1]-this.island.p[1],s*x+c*z];
  }
  localToWorld(point){return transform(compose(this.island.p,this.island.r,this.island.s),point);}
  screenPointAtY(clientX,clientY,y){
    if(!this.vp||!this.width||!this.height)return null;
    const rect=this.canvas.getBoundingClientRect(),nx=(clientX-rect.left)/this.width*2-1,ny=1-(clientY-rect.top)/this.height*2;
    const m=this.vp,px=nx-m[4]*y-m[12],py=ny-m[5]*y-m[13],det=m[0]*m[9]-m[8]*m[1];
    if(Math.abs(det)<.000001)return null;
    return [(px*m[9]-m[8]*py)/det,y,(m[0]*py-px*m[1])/det];
  }
  isWaterPoint(x,z){
    const radius=Math.hypot(x,z);if(radius>.285&&radius<.535)return true;if(radius<.85||radius>2.94||radius>2.20&&radius<2.78)return false;
    for(const landmark of this.landmarks){
      const c=Math.cos(landmark.angle),s=Math.sin(landmark.angle),radial=x*s+z*c,tangent=x*c-z*s;
      if(Math.abs(tangent)<.61&&Math.abs(radial-1.52)<.51)return false;
      if(Math.abs(tangent)<.22&&radial>1.73&&radial<2.49)return false;
      const a=landmark.angle-PI/6,gr=x*Math.sin(a)+z*Math.cos(a),gt=x*Math.cos(a)-z*Math.sin(a);
      if(Math.abs(gt)<.24&&Math.abs(gr-1.66)<.34)return false;
    }
    return true;
  }
  hitBuilding(clientX,clientY){
    const low=this.screenPointAtY(clientX,clientY,this.island.p[1]+.48),high=this.screenPointAtY(clientX,clientY,this.island.p[1]+3.1);
    if(!low||!high)return null;
    const start=this.worldToLocal(low),end=this.worldToLocal(high);let best=null;
    for(const landmark of this.landmarks){
      const c=Math.cos(landmark.angle),s=Math.sin(landmark.angle);
      const local=p=>{const x=p[0]-landmark.localPosition[0],z=p[2]-landmark.localPosition[2];return [c*x-s*z,p[1],s*x+c*z];};
      const a=local(start),b=local(end),direction=vec.sub(b,a),min=[-.58,.54,-.48],max=[.58,.67+landmark.height,.48];let enter=0,exit=1,hit=true;
      for(let axis=0;axis<3;axis++){
        if(Math.abs(direction[axis])<.000001){if(a[axis]<min[axis]||a[axis]>max[axis]){hit=false;break;}}
        else{let near=(min[axis]-a[axis])/direction[axis],far=(max[axis]-a[axis])/direction[axis];if(near>far)[near,far]=[far,near];enter=Math.max(enter,near);exit=Math.min(exit,far);if(enter>exit){hit=false;break;}}
      }
      if(hit&&(!best||exit>best.depth))best={type:'building',id:landmark.id,depth:exit};
    }
    return best;
  }
  pickEnvironment(clientX,clientY){
    if(!this.vp)return null;
    const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
    const mascot=this.project([0,this.mascot.p[1]+.34,this.trackRadius]);
    const actorRadius=Math.max(16,this.height/(this.cameraSpan||6.05)*.36);
    if(Math.hypot(x-mascot.x,y-mascot.y)<actorRadius)return {type:'mascot',id:'axo'};
    let closest=null;
    for(const flower of this.flowers){
      const world=this.flowerWorldPosition(flower),point=this.project(world),distance=Math.hypot(x-point.x,y-point.y);
      if(point.visible&&distance<26&&(!closest||distance<closest.distance))closest={type:'flower',id:flower.id,distance,flower,localPosition:[flower.localPosition[0],flower.localPosition[2]]};
    }
    const building=this.hitBuilding(clientX,clientY);
    if(closest&&(!building||closest.distance<11))return closest;
    if(building)return building;
    const atRoad=this.screenPointAtY(clientX,clientY,.64+this.island.p[1]);
    if(atRoad){const local=this.worldToLocal(atRoad),r=Math.hypot(local[0],local[2]);if(r>=2.20&&r<=2.79)return {type:'stone',localPosition:[local[0],local[2]]};}
    const atBasin=this.screenPointAtY(clientX,clientY,this.basinWaterLevel+this.island.p[1]);
    if(atBasin){const local=this.worldToLocal(atBasin),r=Math.hypot(local[0],local[2]);if(r>.285&&r<.535)return {type:'water',localPosition:[local[0],local[2]]};}
    const atWater=this.screenPointAtY(clientX,clientY,this.waterLevel+this.island.p[1]);
    if(atWater){const local=this.worldToLocal(atWater);if(this.isWaterPoint(local[0],local[2]))return {type:'water',localPosition:[local[0],local[2]]};}
    return closest;
  }
  hoverAt(clientX,clientY){
    const plane=this.screenPointAtY(clientX,clientY,.70+this.island.p[1]);this.pointerLocal=plane?this.worldToLocal(plane):null;
    const hit=this.pickEnvironment(clientX,clientY);this.hoveredFlower=hit?.type==='flower'?hit.id:null;
    this.canvas.style.cursor=hit?.type==='water'?'crosshair':hit&&hit.type!=='stone'?'pointer':'grab';this.dirty=true;
    if(!this.motion)this.updateEnvironment(0);return hit;
  }
  interactAt(clientX,clientY,{hover=false}={}){
    if(hover)return this.hoverAt(clientX,clientY);
    const hit=this.pickEnvironment(clientX,clientY);if(!hit)return null;
    if(hit.type==='flower'){
      const flower=hit.flower;flower.pulse=1;flower.velocity[1]+=1.5;this.flowerInteractions++;
      const angle=Math.atan2(flower.localPosition[0],flower.localPosition[2]);this.spawnRipple([Math.sin(angle)*2.11,Math.cos(angle)*2.11],.65);
      this.onInteraction('flower');
    }else if(hit.type==='water')this.rippleWater(hit.localPosition);
    else if(hit.type==='mascot'){this.wave();this.onMascotClick();this.onInteraction('mascot');}
    else if(hit.type==='building'){this.onProjectClick(hit.id);this.onInteraction('building');}
    this.updateEnvironment(0);this.dirty=true;return {type:hit.type,id:hit.id||null,localPosition:hit.localPosition};
  }
  spawnRipple(position,strength=1){
    if(!this.isWaterPoint(position[0],position[1]))return false;
    const ripple=this.ripplePool.find(item=>!item.active)||this.ripplePool.reduce((a,b)=>a.start<b.start?a:b);
    Object.assign(ripple,{active:true,start:this.time-(this.motion?0:.28),strength:clamp(strength,.2,1),position:[...position],radius:.035,region:Math.hypot(...position)<.6?'basin':'lake'});
    this.waterInteractions++;
    // The same impulse rocks nearby stems, linking flowers and their canals.
    for(const flower of this.flowers){const distance=Math.hypot(flower.localPosition[0]-position[0],flower.localPosition[2]-position[1]);if(distance<1.0){flower.pulse=Math.max(flower.pulse,(1-distance)*.7);flower.velocity[0]+=(1-distance)*.55;}}
    this.dirty=true;return true;
  }
  rippleWater(position){
    let point=position;
    if(!point){const local=this.worldToLocal([-.90,this.waterLevel+this.island.p[1],2.70]);point=[local[0],local[2]];}
    else if(point.length===3)point=[point[0],point[2]];
    if(!Array.isArray(point)||!point.every(Number.isFinite))return false;
    const success=this.spawnRipple(point,1);if(success){this.updateEnvironment(0);this.onInteraction('water');}return success;
  }
  bloomFlowers(){
    for(const flower of this.flowers){flower.pulse=1;flower.velocity[1]+=(flower.index%2?1:-1)*.7;}
    for(let i=0;i<6;i++){const a=(i+.5)*TAU/6;this.spawnRipple([Math.sin(a)*2.11,Math.cos(a)*2.11],.45);}
    this.flowerInteractions++;this.updateEnvironment(0);this.dirty=true;this.onInteraction('flowers');return this.flowers.length;
  }
  updateEnvironment(dt){
    this.flowTime=this.time;
    for(const stroke of this.flowStrokes)stroke.node.r[1]=stroke.base+(stroke.channel==='outer'?this.time*.12:((this.time*.075+stroke.index*.09)%1)*.22);
    for(const flower of this.flowers){
      let targetX=0,targetZ=0,hover=flower.id===this.hoveredFlower?1:0;
      if(this.pointerLocal){const dx=flower.localPosition[0]-this.pointerLocal[0],dz=flower.localPosition[2]-this.pointerLocal[2],distance=Math.hypot(dx,dz);if(distance<.68){const force=(1-distance/.68)*.36;targetX=dz/Math.max(distance,.05)*force;targetZ=-dx/Math.max(distance,.05)*force;hover=Math.max(hover,(1-distance/.68)*.7);}}
      targetX+=hover*.16;targetZ+=hover*.12;
      if(this.motion){
        flower.pulse=Math.max(0,flower.pulse-dt*.35);
        for(let axis=0;axis<2;axis++){const target=(axis?targetZ:targetX)+Math.sin(this.time*1.2+flower.index)*.018;flower.velocity[axis]+=(target-flower.bend[axis])*dt*42;flower.velocity[axis]*=Math.exp(-dt*7);flower.bend[axis]+=flower.velocity[axis]*dt;}
        flower.bloom+=(.18+hover*.70+flower.pulse*.80-flower.bloom)*(1-Math.exp(-dt*7));
      }else{flower.bend=[targetX,targetZ];flower.bloom=.18+hover*.70+flower.pulse*.80;}
      flower.node.r[0]=flower.bend[0];flower.node.r[2]=flower.bend[1];
      const bloom=clamp(flower.bloom,0,1.35);flower.petals.s=flower.type==='laelia'?[.78+bloom*.65,.94+bloom*.12,.90+bloom*.15]:[.78+bloom*.75,1-bloom*.40,.78+bloom*.75];flower.petals.glow=clamp(.08+hover*.28+flower.pulse*.42,0,.80);flower.crown.p[1]=flower.height+bloom*.045;flower.crown.r[1]=Math.sin(this.time*.8+flower.index)*.05;flower.center.glow=clamp(.28+hover*.32+flower.pulse*.38,0,.96);
    }
    for(const ripple of this.ripplePool){
      if(!ripple.active)continue;const age=this.time-ripple.start;
      if(age>2.8){ripple.active=false;continue;}
      ripple.radius=.035+age*(.32+ripple.strength*.22);
    }
  }

  getEnvironmentState(){
    return {stoneCount:this.roadBlocks.length,flowTime:this.flowTime,flowDirection:'clockwise',flowerInteractions:this.flowerInteractions,waterInteractions:this.waterInteractions,hoveredFlower:this.hoveredFlower,activeRipples:this.ripplePool.filter(item=>item.active).length,ripples:this.ripplePool.filter(item=>item.active).map(item=>({position:[...item.position],radius:item.radius,age:this.time-item.start})),garden:this.getGardenState(),lilies:this.lilies.map(lily=>({speciesId:lily.speciesId,scientificName:lily.scientificName,habitat:lily.habitat,hasFlower:lily.hasFlower,worldPosition:this.localToWorld(lily.p)})),flowers:this.flowers.map(flower=>({id:flower.id,speciesId:flower.speciesId,scientificName:flower.scientificName,habitat:flower.habitat,form:flower.form,hitAnchor:[...flower.hitAnchor],position:[...flower.localPosition],worldPosition:this.flowerWorldPosition(flower),bend:[...flower.bend],bloom:flower.bloom,pulse:flower.pulse}))};
  }
  buildProject({id,x,z,kind,color,heading=0}){
    color={retail:'pinkOrchid',rxp:'amethystSmoke',slides:'pinkOrchid',playbooks:'lilac',adoption:'lilac',learning:'pinkOrchid'}[id];
    const g=this.group([x,.63,z],[0,heading,0],[1,1,1],this.island);
    // Sunken dark footings give every workshop a crisp, dollhouse silhouette.
    this.mesh('box','darkAmethyst',[0,-.062,0],[1.15,.15,.91],[0,0,0],g);
    this.mesh('box','amethystSmoke',[0,.015,0],[1.13,.055,.89],[0,0,0],g);
    const tier=(w,h,d,y,c='dustyGrape')=>{
      this.mesh('box',c,[0,y+h*.5,0],[w,h,d],[0,0,0],g);
      this.mesh('box','lilac',[0,y+h-.012,0],[w+.025,.025,d+.025],[0,0,0],g);
    };
    const stairs=(height,steps=5,width=.26,front=.52)=>{
      for(let i=0;i<steps;i++)this.mesh('box',i%2?'lilac':'dustyGrape',[0,(i+.5)*height/steps,front-i*.055],[width,height/steps,.12],[0,0,0],g);
    };
    const door=(y,h,width=.15,front=.255)=>{
      this.mesh('box','darkAmethyst',[0,y+h*.5,front],[width,h,.02],[0,0,0],g);
      this.mesh('box',color,[0,y+h*.5,front+.013],[width*.26,h*.57,.008],[0,0,0],g);
    };
    const window=(wx,y,front=.255)=>{
      this.mesh('box','darkAmethyst',[wx,y,front],[.14,.17,.022],[0,0,0],g);
      this.mesh('box','pinkOrchid',[wx,y,front+.013],[.075,.10,.009],[0,0,0],g);
    };
    if(kind==='temple'){
      tier(1.02,.16,.77,.04);tier(.82,.17,.61,.20);tier(.64,.16,.46,.37);
      stairs(.51,7,.24,.53);
      for(const side of [-1,1]){
        const sx=side*.18;
        this.mesh('box','dustyGrape',[sx,.78,-.035],[.29,.47,.34],[0,0,0],g);
        this.mesh('box','darkAmethyst',[sx,.76,.14],[.12,.25,.02],[0,0,0],g);
        this.mesh('box',side<0?'amethystSmoke':'pinkOrchid',[sx,1.035,-.035],[.35,.08,.40],[0,0,0],g);
        this.mesh('box','lilac',[sx,1.13,-.04],[.19,.13,.26],[0,0,0],g);
        this.mesh('box',side<0?'amethystSmoke':'pinkOrchid',[sx,1.22,-.04],[.25,.05,.31],[0,0,0],g);
        this.mesh('box','pinkOrchid',[sx,.78,.156],[.024,.13,.01],[0,0,0],g);
      }
      this.cyl('darkAmethyst',[-.18,1.35,-.04],[.009,.22,.009],g);
      this.ball('pinkOrchid',[-.18,1.48,-.04],[.035,.035,.035],g);
    }else if(kind==='gallery'){
      tier(1.01,.14,.76,.04);tier(.88,.14,.64,.18,'pinkOrchid');
      this.mesh('box','dustyGrape',[0,.59,-.07],[.76,.53,.42],[0,0,0],g);
      this.mesh('box','darkAmethyst',[0,.62,.154],[.59,.33,.028],[0,0,0],g);
      this.mesh('box','pinkOrchid',[0,.62,.172],[.49,.24,.012],[0,0,0],g);
      // A presentation inside the gallery, drawn in simple geometric strokes.
      this.mesh('box','lilac',[-.10,.685,.184],[.21,.022,.007],[0,0,0],g);
      for(let i=0;i<3;i++)this.mesh('box','lilac',[-.16+i*.13,.58,.184],[.075,.026+i*.034,.007],[0,0,0],g);
      this.mesh('box','pinkOrchid',[0,.885,-.06],[.9,.09,.57],[0,0,0],g);
      this.mesh('box','lilac',[0,.969,-.10],[.65,.075,.39],[0,0,0],g);
      this.mesh('box','pinkOrchid',[0,1.025,-.10],[.72,.038,.44],[0,0,0],g);
      stairs(.30,4,.32,.52);
      for(const side of [-1,1])this.cyl('pinkOrchid',[side*.37,.56,.19],[.025,.44,.025],g);
    }else if(kind==='observatory'){
      tier(1.01,.14,.78,.04);tier(.82,.14,.63,.18);
      this.cyl('dustyGrape',[0,.53,-.025],[.33,.43,.28],g);
      this.cyl('darkAmethyst',[0,.76,-.025],[.35,.045,.30],g);
      this.ball('amethystSmoke',[0,.77,-.025],[.335,.27,.285],g);
      this.cyl('pinkOrchid',[0,.785,-.025],[.348,.025,.298],g);
      // A real angled telescope with an open dark aperture.
      const telescope=this.group([.05,1.05,-.04],[.72,0,-.37],[1,1,1],g);
      this.cyl('darkAmethyst',[0,.06,0],[.040,.30,.040],telescope);
      this.cyl('lilac',[0,.20,0],[.10,.37,.10],telescope);
      this.cyl('amethystSmoke',[0,.39,0],[.14,.065,.14],telescope);
      this.cyl('darkAmethyst',[0,.425,0],[.10,.012,.10],telescope);
      this.cyl('pinkOrchid',[0,.432,0],[.075,.012,.075],telescope);
      door(.32,.27,.15,.26);stairs(.30,4,.27,.53);
      this.mesh('box','amethystSmoke',[-.43,.40,-.01],[.11,.36,.15],[0,0,0],g);
    }else if(kind==='archive'){
      tier(1.01,.15,.77,.04);tier(.87,.10,.65,.19);
      this.mesh('box','dustyGrape',[0,.52,-.03],[.75,.47,.46],[0,0,0],g);
      // Recessed book shelves and an offset entry give this a library character.
      for(const side of [-1,1]){
        const sx=side*.25;
        this.mesh('box','darkAmethyst',[sx,.56,.207],[.18,.26,.019],[0,0,0],g);
        for(let i=0;i<4;i++)this.mesh('box',i%2?'pinkOrchid':'lilac',[sx-.062+i*.041,.56,.222],[.027,.18+(i%2)*.035,.022],[0,0,(i-2)*.04],g);
      }
      door(.29,.29,.14,.208);
      this.mesh('box','dustyGrape',[0,.79,-.03],[.88,.095,.57],[0,0,0],g);
      this.mesh('box','lilac',[0,.87,-.07],[.61,.08,.39],[0,0,0],g);
      // An open book crowning the roof.
      for(const side of [-1,1])this.mesh('box','lilac',[side*.12,.985,-.06],[.27,.045,.24],[0,0,side*.21],g);
      this.mesh('box','pinkOrchid',[0,.963,-.06],[.018,.09,.25],[0,0,0],g);
      stairs(.28,4,.24,.53);
    }else if(kind==='garden'){
      tier(1.02,.13,.78,.04);tier(.87,.10,.65,.17,'amethystSmoke');
      // Light, open-sided greenhouse and six growing adoption shoots.
      this.mesh('box','darkAmethyst',[0,.30,-.03],[.72,.07,.48],[0,0,0],g);
      for(const sx of [-.31,.31])for(const sz of [-.20,.18])this.cyl('lilac',[sx,.58,sz],[.027,.55,.027],g);
      this.mesh('box','amethystSmoke',[0,.86,-.015],[.84,.075,.62],[0,0,0],g);
      this.mesh('box','lilac',[0,.93,-.04],[.60,.075,.42],[0,0,0],g);
      this.mesh('box','amethystSmoke',[0,.994,-.04],[.66,.045,.48],[0,0,0],g);
      for(const sx of [-.21,0,.21])for(const sz of [-.13,.09]){
        this.cyl('dustyGrape',[sx,.37,sz],[.065,.10,.06],g);
        this.path([[sx,.42,sz],[sx,.67,sz]],.012,'darkAmethyst',g);
        this.ball('lime',[sx-.045,.51,sz],[.065,.027,.04],g);
        this.ball('jade',[sx+.045,.59,sz],[.068,.03,.04],g);
        this.ball('pinkOrchid',[sx,.705,sz],[.036,.04,.036],g);
      }
      stairs(.26,4,.28,.53);
    }else{
      tier(1.02,.14,.78,.04);tier(.84,.14,.62,.18);
      this.mesh('box','dustyGrape',[0,.58,-.04],[.70,.51,.44],[0,0,0],g);
      door(.32,.31,.18,.19);window(-.24,.65,.19);window(.24,.65,.19);
      this.mesh('box','pinkOrchid',[0,.86,-.04],[.83,.085,.58],[0,0,0],g);
      this.mesh('box','lilac',[0,.96,-.065],[.59,.12,.39],[0,0,0],g);
      this.mesh('box','pinkOrchid',[0,1.045,-.065],[.66,.05,.44],[0,0,0],g);
      // A copper knowledge beacon crowns the academy.
      this.cyl('pinkOrchid',[0,1.15,-.065],[.018,.18,.018],g);
      this.ball('pinkOrchid',[0,1.27,-.065],[.071,.071,.071],g);
      this.ring(.10,.009,'lilac',[0,1.27,-.065],g,[PI/2,0,0]);
      stairs(.30,4,.27,.53);
    }
    const effect=this.buildProjectEffect(id,x,z,heading);
    // Small rectangular door plaque and paired mooring bollards at every address.
    this.mesh('box',color,[.43,.14,.33],[.12,.15,.025],[0,0,0],g);
    this.mesh('box','pinkOrchid',[.43,.15,.347],[.055,.017,.008],[0,0,0],g);
    for(const side of [-1,1]){
      this.cyl('darkAmethyst',[side*.48,.10,.39],[.018,.15,.018],g);
      effect.lights.push(this.ball('pinkOrchid',[side*.48,.18,.39],[.026,.026,.026],effect.root));
    }
  }
  buildProjectEffect(id,x,z,heading){
    const root=this.group([x,.63,z],[0,heading,0],[1,1,1],this.island);root.dynamic=true;
    const kind={retail:'welcome',rxp:'signal',slides:'slide',playbooks:'page',adoption:'growth',learning:'beacon'}[id];
    const effect={id,kind,root,lights:[],start:-1e9,duration:id==='slides'?2.4:id==='playbooks'?1.8:2.2,activationCount:0};
    const pack=(parts,color,parent)=>this.mesh(this.upload(mergeParts(parts.map(([p,s,r=[0,0,0]])=>({source:this.geo.box.source,matrix:compose(p,r,s)})))),color,[0,0,0],[1,1,1],[0,0,0],parent);
    if(id==='slides'){
      effect.hinge=this.group([0,1.056,.10],[0,0,0],[1,1,1],root);
      this.mesh('box','dustyGrape',[0,.010,-.185],[.58,.028,.37],[0,0,0],effect.hinge);
      this.mesh('box','pinkOrchid',[0,.026,-.185],[.50,.004,.30],[0,0,0],effect.hinge);
      const strokes=[[[ -.06,.031,-.29],[.28,.003,.019]]];
      for(let i=0;i<3;i++){const length=.055+i*.038;strokes.push([[-.15+i*.15,.031,-.07-length*.5],[.075,.003,length]]);}
      pack(strokes,'dustyGrape',effect.hinge);
    }else if(id==='playbooks'){
      effect.leaf=this.group([0,.995,-.06],[0,0,.21],[1,1,1],root);
      this.mesh('box','pinkOrchid',[.13,0,0],[.26,.012,.226],[0,0,0],effect.leaf);
      const ink=[];for(const y of [-.009,.009])for(const z of [-.065,-.018,.029,.076])ink.push([[.14,y,z],[.17,.002,.009]]);
      pack(ink,'dustyGrape',effect.leaf);
    }else if(id==='adoption'){
      effect.bars=[.14,.23,.34].map((height,i)=>{
        const rest=.045+i*.014,node=this.mesh('box',i===1?'lilac':'pinkOrchid',[-.20+i*.20,1.026+rest*.5,-.04],[.115,rest,.14],[0,0,0],root);
        return {node,rest,height,base:1.026};
      });
    }
    const roof={retail:1.46,rxp:1.43,slides:1.17,playbooks:1.11,adoption:1.44,learning:1.37}[id];
    effect.beacon=this.ball('pinkOrchid',[0,roof,-.04],[.045,.045,.045],root);effect.beacon.visible=false;effect.beacon.glow=.65;
    this.projectEffects.set(id,effect);return effect;
  }
  activateProject(id){
    const effect=this.projectEffects.get(id);if(!effect)return;
    effect.start=this.time;effect.activationCount++;this.updateProjectEffects();this.dirty=true;
  }
  highlightProject(id){
    if(id!==null&&!this.projectEffects.has(id))return false;
    this.highlightedProject=id;this.updateProjectEffects();this.dirty=true;return true;
  }
  updateProjectEffects(){
    const current=this.getArrivalState().currentProject;
    for(const effect of this.projectEffects.values()){
      const settled=current===effect.id,highlighted=this.highlightedProject===effect.id;
      const age=Math.max(0,this.time-effect.start),progress=settled?(this.motion?clamp(age/effect.duration,0,1):1):0;
      const eased=progress*progress*(3-2*progress),pulse=this.motion?Math.sin(this.time*3.5)*.10:0;
      effect.progress=progress;effect.settled=settled;effect.highlighted=highlighted;
      effect.strength=settled?(this.motion?Math.sin(progress*PI):.65):0;
      for(const light of effect.lights){light.glow=highlighted?.75+pulse:settled?.52:.05;const size=.026*(highlighted?1.65+pulse:settled?1.2:1);light.s=[size,size,size];}
      effect.beacon.visible=highlighted||settled;effect.beacon.glow=highlighted?.82:.58;
      const beaconSize=.045*(highlighted?1.3+pulse:1+effect.strength*.45);effect.beacon.s=[beaconSize,beaconSize,beaconSize];
      if(effect.hinge)effect.hinge.r[0]=settled?(this.motion?Math.sin(progress*PI)*.88:.65):0;
      if(effect.leaf)effect.leaf.r[2]=.21+(settled?eased*(PI-.42):0);
      if(effect.bars)effect.bars.forEach((bar,i)=>{const grow=settled?(this.motion?clamp((age-i*.16)/1.05,0,1):1):0,t=grow*grow*(3-2*grow),height=bar.rest+(bar.height-bar.rest)*t;bar.node.s[1]=height;bar.node.p[1]=bar.base+height*.5;});
    }
  }
  getProjectEffectState(id){
    const read=effect=>({id:effect.id,kind:effect.kind,settled:!!effect.settled,highlighted:!!effect.highlighted,progress:effect.progress||0,strength:effect.strength||0,activationCount:effect.activationCount});
    return id?(this.projectEffects.has(id)?read(this.projectEffects.get(id)):null):[...this.projectEffects.values()].map(read);
  }
  buildScanPlatform(){
    // Hologram projector under AXO: a disc, three rings and a soft cone of light.
    // Alpha scales with the scan envelope, so the lake scene is untouched outside the scan.
    this.scanPlatform=this.group([0,this.walkerBaseY,this.trackRadius]);this.scanPlatform.visible=false;
    const node=(mesh,alpha)=>{mesh.baseAlpha=alpha;mesh.alpha=alpha;mesh.glow=1;return mesh;};
    node(this.mesh('cylinder','lilac',[0,.004,0],[.46,.004,.46],[0,0,0],this.scanPlatform),.30);
    for(const [major,alpha]of [[.38,.55],[.46,.40],[.54,.28]])node(this.ring(major,.006,'pinkOrchid',[0,.012,0],this.scanPlatform),alpha);
    this.scanConeGeometry=this.upload(cylinder(48,.22,.44,1));
    this.scanCone=node(this.mesh(this.scanConeGeometry,'pinkOrchid',[0,.34,0],[1,.68,1],[0,0,0],this.scanPlatform),.13);
  }
  setScanProgress(progress){
    const numeric=Number(progress),next=clamp(Number.isNaN(numeric)?1:numeric,0,1);
    if(next===this.scanProgress&&this.scanActive===(next<1))return this.getScanState();
    this.scanProgress=next;this.syncScan(true);if(!this.motion)this.scanCamera=this.scanActive?Math.min(1,this.scanEnvelope*1.6):0;this.dirty=true;return this.getScanState();
  }
  syncScan(snap=false){
    // Local heights of AXO's feet and the top of his head, scaled by the mascot node.
    const base=this.mascot.p[1],scale=this.mascot.s[1];
    this.scanFeetY=base-.05*scale;this.scanHeadY=base+2.40*scale;
    const margin=(this.scanHeadY-this.scanFeetY)*.10;
    const target=this.scanHeadY+margin-this.scanProgress*(this.scanHeadY-this.scanFeetY+margin*2);
    this.scanPlaneY=snap||!this.motion?target:this.scanPlaneY+(target-this.scanPlaneY)*.35;
    const p=this.scanProgress;
    this.scanActive=p<1;
    const envelope=p>=1?0:Math.min(1,(1-p)/.10);
    this.scanEnvelope=envelope;
    if(this.scanPlatform){
      this.scanPlatform.visible=envelope>0;this.scanPlatform.p=[0,this.scanFeetY+.002,this.trackRadius];
      const pulse=.8+.2*(.5+.5*Math.sin(this.time*TAU/2));
      for(const child of this.scanPlatform.children)child.alpha=child.baseAlpha*envelope*(child===this.scanCone?pulse:1);
    }
  }
  getScanState(){
    const at=(y)=>this.project([0,y,this.trackRadius]);
    const scale=this.mascot.s[1],base=this.mascot.p[1];
    return {progress:this.scanProgress,active:this.scanActive,planeY:this.scanPlaneY,plane:at(this.scanPlaneY),head:at(base+2.0*scale),chest:at(base+.95*scale),hip:at(base+.40*scale),feet:at(this.scanFeetY),halfWidth:Math.abs(this.project([.95*scale,this.scanPlaneY,this.trackRadius]).x-at(this.scanPlaneY).x)};
  }
  buildMascot(){
    this.mascot=this.group([0,.64,.20]);
    const m=this.mascot;
    const shell=(color,position,scale,parent)=>{const node=this.ball(color,position,scale,parent,true);node.outlineWidth=.006;return node;};
    const signal=(points,parent,radius=.018)=>{const node=this.path(points,radius,'signal',parent);node.glow=.82;return node;};
    this.characterProject=null;this.characterExpression='friendly';this.arrivalPhase='visitor';this.destinationTime=-1e9;
    this.legs=[];this.arms=[];this.elbows=[];this.gills=[];this.eyes=[];this.eyeHighlights=[];
    const finSources={};for(const side of [-1,1]){const source=gillFin(side);finSources[side]={source,uploaded:this.upload(source)};}
    // A flexible membrane tail follows the hips rather than swinging like a limb.
    this.tail=this.group([-.05,.48,-.23],[0,0,0],[1,1,1],m);
    this.path(bezier([0,0,0],[-.24,-.09,-.22],[-.58,-.16,-.47],[-.96,.02,-.55],18),.09,'lilac',this.tail);
    const tailFin=this.group([-.50,-.09,-.39],[0,-.48,-.12],[1.28,2.55,1.7],this.tail),tailShape=finSources[-1];
    this.mesh(tailShape.uploaded,'pinkOrchid',[0,0,0],[1,1,1],[0,0,0],tailFin,false,{alpha:.68});
    this.path(tailShape.source.rim,.015,'lilac',tailFin);
    this.path(tailShape.source.centerline,.010,'amethystSmoke',tailFin);
    for(const side of [-1,1]){
      const leg=this.group([side*.24,.43,.02],[0,0,0],[1,1,1],m);this.legs.push(leg);
      this.ball('darkAmethyst',[0,-.12,0],[.106,.25,.115],leg);
      shell('lilac',[0,-.075,.008],[.16,.17,.15],leg);
      this.cyl('amethystSmoke',[0,-.185,0],[.122,.09,.122],leg,false,[0,0,PI/2]);
      this.ball('pinkOrchid',[side*.123,-.185,0],[.038,.072,.072],leg);
      // Preserve the sole and boot dimensions used by the planted-foot solver.
      this.ball('darkAmethyst',[side*.02,-.385,.17],[.29,.085,.40],leg);
      shell('pinkOrchid',[side*.02,-.31,.18],[.285,.17,.39],leg);
      this.ball('lilac',[0,-.29,.46],[.16,.045,.10],leg);
      this.path([[side*.02-.10,-.277,.507],[side*.02+.10,-.277,.507]],.012,'amethystSmoke',leg);
    }
    shell('lilac',[0,.86,0],[.48,.52,.35],m);
    this.ball('pinkOrchid',[0,.95,-.11],[.44,.38,.26],m);
    this.cyl('darkAmethyst',[0,1.30,0],[.175,.17,.175],m);
    this.ring(.185,.027,'amethystSmoke',[0,1.33,0],m);
    // Prebuilt glyphs switch only when AXO physically reaches a destination.
    this.chest=this.group([0,.88,.30],[0,0,0],[1,1,1],m);
    shell('pinkOrchid',[0,0,0],[.335,.285,.085],this.chest);
    this.ball('darkAmethyst',[0,.005,.066],[.284,.227,.039],this.chest);
    this.chestIcons=new Map();
    const icon=(id)=>{const group=this.group([0,.005,.112],[0,0,0],[1,1,1],this.chest);group.visible=id===null;this.chestIcons.set(id,group);return group;};
    const line=(points,parent)=>signal(points.map(([x,y])=>[x,y,0]),parent);
    line([[-.19,0],[-.10,0],[-.055,.105],[.015,-.10],[.065,.035],[.12,.035],[.19,.035]],icon(null));
    let glyph=icon('retail');line([[-.17,-.055],[-.17,.10],[.17,.10],[.17,-.055],[.025,-.055],[-.06,-.125],[-.06,-.055],[-.17,-.055]],glyph);line([[-.095,.035],[.095,.035]],glyph);
    glyph=icon('rxp');line([[-.15,-.09],[.15,.09]],glyph);line([[-.15,.09],[.15,-.09]],glyph);for(const [x,y]of [[-.15,-.09],[.15,.09],[-.15,.09],[.15,-.09]])this.ball('signal',[x,y,0],[.038,.038,.018],glyph).glow=.82;
    glyph=icon('slides');line([[-.17,-.10],[-.17,.07],[.10,.07],[.10,-.10],[-.17,-.10]],glyph);line([[-.10,.13],[.17,.13],[.17,-.04]],glyph);line([[-.10,-.025],[.035,-.025]],glyph);
    glyph=icon('playbooks');line([[-.19,-.075],[-.19,.11],[-.025,.07],[0,.025],[.025,.07],[.19,.11],[.19,-.075],[.025,-.11],[0,-.14],[-.025,-.11],[-.19,-.075]],glyph);line([[0,-.14],[0,.025]],glyph);
    glyph=icon('adoption');for(let i=0;i<3;i++)line([[-.15+i*.14,-.12],[-.15+i*.14,-.035+i*.065]],glyph);line([[-.19,.025],[.12,.14],[.065,.15],[.12,.14],[.095,.075]],glyph);
    glyph=icon('learning');line([[-.18,.035],[0,.13],[.18,.035],[0,-.06],[-.18,.035]],glyph);line([[-.105,-.015],[-.105,-.095],[0,-.15],[.105,-.095],[.105,-.015]],glyph);
    this.ball('amethystSmoke',[0,.50,.29],[.18,.045,.035],m);
    for(const side of [-1,1]){
      this.ball('darkAmethyst',[side*.43,1.04,0],[.135,.135,.135],m);
      const arm=this.group([side*.44,1.03,0],[0,0,side*-.04],[1,1,1],m);
      shell('pinkOrchid',[side*.10,-.115,0],[.145,.19,.14],arm);
      const elbow=this.group([side*.17,-.27,.02],[.13,0,0],[1,1,1],arm);this.elbows.push(elbow);
      this.ball('darkAmethyst',[0,0,0],[.09,.09,.09],elbow);
      this.ball('amethystSmoke',[side*.078,0,0],[.03,.07,.07],elbow);
      shell('lilac',[side*.035,-.105,.055],[.105,.15,.10],elbow);
      this.cyl('darkAmethyst',[side*.055,-.195,.10],[.072,.07,.072],elbow);
      shell('pinkOrchid',[side*.065,-.26,.115],[.125,.135,.115],elbow);
      this.ball('lilac',[-side*.035,-.25,.19],[.060,.070,.058],elbow);
      this.arms.push(arm);if(side===1)this.waveArm=arm;
    }
    this.head=this.group([0,1.77,.005],[0,0,0],[1,1,1],m);
    shell('pinkOrchid',[0,0,0],[.73,.57,.49],this.head);
    this.ball('lilac',[0,.045,-.19],[.69,.48,.32],this.head);
    const seam=Array.from({length:17},(_,i)=>{const x=(i/16-.5)*.90,y=.33+.055*(1-(x/.45)**2);return [x,y,.49*Math.sqrt(1-(x/.73)**2-(y/.57)**2)+.008];});
    this.path(seam,.012,'amethystSmoke',this.head);
    // Broad translucent membranes have a mechanical root, a fine rim and a
    // sparse branching circuit. Their roots flex independently with each step.
    for(const side of [-1,1])for(let i=0;i<3;i++){
      const spread=[.72,.02,-.67][i]*side;
      const fin=this.group([side*.615,.07-i*.055,-.025],[0,-side*.08,spread],[1,1.55,1],this.head);
      fin.baseRotation=[...fin.r];fin.side=side;fin.index=i;this.gills.push(fin);
      const shape=finSources[side];
      this.mesh(shape.uploaded,'pinkOrchid',[0,0,0],[1,1,1],[0,0,0],fin,false,{alpha:.72,glow:.25});
      this.path(shape.source.rim,.017,'lilac',fin).glow=.20;
      this.path(shape.source.centerline,.011,'pinkOrchid',fin).glow=.45;
      const branch=[];for(const sign of [-1,1]){branch.push({source:tube([[side*.23,.025,.027],[side*.31,sign*.058+.03,.024],[side*.39,sign*.071+.03,.020]],.009,6),matrix:identity()});}
      this.mesh(this.upload(mergeParts(branch)),'pinkOrchid',[0,0,0],[1,1,1],[0,0,0],fin,false,{glow:.35});
      this.ball('amethystSmoke',[side*.015,0,.016],[.075,.070,.048],fin);
      this.ball('pinkOrchid',[side*.025,0,.053],[.034,.034,.016],fin);
    }
    // Separate eye sockets leave the pink helmet visible between luminous eyes.
    this.face=this.group([0,-.015,.439],[0,0,0],[1,1,1],this.head);
    for(const side of [-1,1]){
      this.ball('darkAmethyst',[side*.255,.075,0],[.157,.174,.073],this.face);
      const eye=this.ball('signal',[side*.255,.075,.073],[.100,.121,.025],this.face);eye.glow=.92;eye.restHeight=.121;this.eyes.push(eye);
      const highlight=this.ball('pinkOrchid',[side*.255-.026,.113,.098],[.025,.028,.009],this.face);highlight.glow=.78;this.eyeHighlights.push(highlight);
      this.ball('lilac',[side*.445,-.105,-.031],[.077,.030,.018],this.face);
    }
    this.mouth=this.group([0,-.175,.015],[0,0,0],[1,1,1],this.face);
    const smile=bezier([-.125,.020,.036],[-.06,-.004,.042],[.06,-.004,.042],[.125,.020,.036],8)
      .concat(bezier([.125,.020,.036],[.085,-.091,.045],[-.085,-.091,.045],[-.125,.020,.036],12).slice(1));
    const positions=[0,-.024,.045],normals=[0,0,1],indices=[];
    for(const point of smile){positions.push(...point);normals.push(0,0,1);}
    for(let i=0;i<smile.length-1;i++)indices.push(0,i+2,i+1);
    this.mesh(this.upload(geometry(positions,normals,indices)),'darkAmethyst',[0,0,0],[1,1,1],[0,0,0],this.mouth);
    this.ball('lilac',[0,-.042,.047],[.063,.016,.006],this.mouth);
    this.path(smile,.009,'dustyGrape',this.mouth);
  }
  reeds(position,scale=1){const g=this.group(position,[0,0,0],[scale,scale,scale],this.island);for(let i=0;i<5;i++){const angle=i*2.3,x=Math.cos(angle)*.16,z=Math.sin(angle)*.12,h=.5+(i%3)*.12;this.path(bezier([x,0,z],[x,.2,z],[x*1.5,h*.7,z*1.5],[x*2.0,h,z*1.5]),.017,'dark',g);if(i%2===0)this.ball('lime',[x*1.8,h*.75,z*1.5],[.053,.18,.021],g);else this.ball('pinkOrchid',[x*2,h+.03,z*1.5],[.032,.11,.032],g);}}
  lily(position,scale,rotation,flower){
    const g=this.group(position,[0,rotation,0],[1,1,1],this.island);
    Object.assign(g,{speciesId:FLORA.nymphaea.id,scientificName:FLORA.nymphaea.scientificName,habitat:FLORA.nymphaea.habitat,hasFlower:!!flower});
    this.cyl('green',[0,-.006,0],[scale,.025,scale*.77],g);this.cyl('lime',[0,.012,0],[scale*.95,.017,scale*.74],g);
    this.path([[0,.025,0],[scale*.6,.025,scale*.20]],.008,'green',g);
    this.mesh('box','water',[scale*.73,.035,scale*.37],[scale*.7,.025,scale*.22],[0,-.5,0],g);
    if(flower){
      const f=this.group([-.055,.045,-.025],[0,.3,0],[1,1,1],g),shape=this.flowerForm('nymphaea');
      this.mesh(shape.petals,'pinkOrchid',[0,.025,0],[1,1,1],[0,0,0],f,false,{glow:.12});
      this.ball('lilac',[0,.066,0],[.030,.024,.030],f);g.bloom=f;
    }
    this.lilies.push(g);
  }
  bind(){
    const canvas=this.canvas;canvas.style.touchAction='pan-y';
    const listen=(el,type,fn,options)=>{el.addEventListener(type,fn,options);this.listeners.push(()=>el.removeEventListener(type,fn,options));};
    listen(canvas,'pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;this.drag={x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,moved:0,pointerType:e.pointerType||'mouse'};canvas.setPointerCapture?.(e.pointerId);});
    listen(canvas,'pointermove',e=>{
      if(!this.drag){if(e.pointerType!=='touch')this.hoverAt(e.clientX,e.clientY);return;}
      const dx=e.clientX-this.drag.px,dy=e.clientY-this.drag.py;this.drag.px=e.clientX;this.drag.py=e.clientY;this.drag.moved+=Math.abs(dx)+Math.abs(dy);
      if(this.drag.moved>7){
        if(this.drag.pointerType==='touch'&&Math.abs(e.clientY-this.drag.y)>Math.abs(e.clientX-this.drag.x)*1.2)return;
        canvas.style.cursor='grabbing';this.hoveredFlower=null;this.pointerLocal=null;if(Math.abs(dx)>.01)this.orbit(-dx*.007);
      }
    });
    const end=e=>{if(!this.drag)return;const moved=this.drag.moved;this.drag=null;canvas.style.cursor='grab';if(moved<9&&e.type!=='pointercancel'){const hit=this.interactAt(e.clientX,e.clientY);if(hit)e.axoWorldHandled=true;}};
    listen(canvas,'pointerup',end);listen(canvas,'pointercancel',end);
    listen(canvas,'pointerleave',()=>{if(!this.drag){this.hoveredFlower=null;this.pointerLocal=null;canvas.style.cursor='grab';this.dirty=true;}});
    listen(window,'resize',()=>this.resize());listen(document,'visibilitychange',()=>{this.visible=!document.hidden;this.dirty=true;});
    listen(canvas,'webglcontextlost',e=>{e.preventDefault();this.visible=false;this.onError?.(new Error('The 3D canvas needs to be reloaded.'));});
    this.observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>this.resize()):null;this.observer?.observe(canvas);canvas.style.cursor='grab';
  }
  resize(){if(this.destroyed)return;const rect=this.canvas.getBoundingClientRect();this.width=rect.width||640;this.height=rect.height||640;const dpr=Math.min(window.devicePixelRatio||1,2);const w=Math.round(this.width*dpr),h=Math.round(this.height*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);this.camera();this.dirty=true;}
  camera(){const aspect=this.width/this.height,w=this.scanCamera||0,zoom=this.zoom*(1+w*(aspect<.8?1.1:1.7)),span=Math.max(6.05,6.75/aspect)/zoom,half=span*.5;this.cameraSpan=span;
    const axoFocus=[0,this.mascot?this.mascot.p[1]+.22:1.72,this.trackRadius*1.02],focus=[this.focus[0]+(axoFocus[0]-this.focus[0])*w,this.focus[1]+(axoFocus[1]-this.focus[1])*w,this.focus[2]+(axoFocus[2]-this.focus[2])*w];
    this.eye=[Math.sin(this.azimuth)*10*Math.cos(this.elevation)+focus[0],Math.sin(this.elevation)*10+focus[1],Math.cos(this.azimuth)*10*Math.cos(this.elevation)+focus[2]];this.vp=multiply(orthographic(-half*aspect,half*aspect,-half,half,.1,40),lookAt(this.eye,focus));}
  update(dt){
    if(this.reading)return;
    if(this.directTravel&&this.motion)this.updateDirectTravel(dt);
    if(this.scanActive||this.scanEnvelope>0)this.syncScan();
    const ease=1-Math.exp(-dt*6);this.scanCamera=(this.scanCamera||0)+((this.scanActive?Math.min(1,this.scanEnvelope*1.6):0)-(this.scanCamera||0))*(this.motion?ease:1);this.azimuth+=(this.targetAzimuth-this.azimuth)*ease;this.elevation+=(this.targetElevation-this.elevation)*ease;this.zoom+=(this.targetZoom-this.zoom)*ease;this.night+=((this.theme==='night'?1:0)-this.night)*ease;
    const t=this.time;
    if(this.motion){
      this.island.p[1]=Math.sin(t*.65)*.012;
      this.updateWalk(dt);
      // Foreground position stays anchored; only AXO's walking pose follows travel.
      this.mascot.p[0]=0;this.mascot.p[2]=this.trackRadius;
      this.mascot.p[1]=this.walkerBaseY+this.island.p[1]+this.hipBob+Math.sin(t*1.6)*.002;
      this.applyScrollPose();
      this.updateCharacter();
      const age=(performance.now()-this.waveTime)/1000,wave=age<2.4?Math.sin(Math.min(age/.45,1)*PI/2)*Math.min((2.4-age)/.4,1):0;
      this.waveArm.r[2]+=wave*(2.5+Math.sin(age*13)*.22);this.waveArm.r[0]+=wave*.15;
      this.mascotShadow.p=[0,.64+this.island.p[1],this.trackRadius];
      this.orb.p[1]=1.80+Math.sin(t*1.3)*.06;this.orb.r[1]=t*.2;this.orb.r[2]=Math.sin(t*.6)*.2;
      this.lilies.forEach((g,i)=>g.p[1]=.515+Math.sin(t*.9+i)*.004);this.sparkles.forEach((g,i)=>g.r[1]=t*.18+i);
    }
    this.updateEnvironment(this.motion?dt:0);this.updateProjectEffects();this.updateWorldPoints();this.camera();
  }
  updateWorldPoints(){
    const model=compose(this.island.p,this.island.r,this.island.s);
    for(const point of this.points){
      if(point.localPosition)point.position=transform(model,point.localPosition);
      else if(point.id==='axo')point.position=[0,this.mascot.p[1]+.80,this.trackRadius];
    }
  }
  getWorldStop(id){
    const stop=this.landmarks.find(item=>item.id===id);return stop?transform(compose(this.island.p,this.island.r,this.island.s),stop.doorPosition):null;
  }
  render(){
    if(this.reading)return;
    const gl=this.gl;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.loc.uVP,false,this.vp);gl.uniform3fv(this.loc.uEye,this.eye);gl.uniform3fv(this.loc.uLight,[-3,7,5]);gl.uniform3fv(this.loc.uEnvironment,[(this.time*.035)%TAU,this.island.r[1]%TAU,(this.time*.24)%TAU]);
    for(let i=0;i<8;i++){const ripple=this.ripplePool[i],offset=i*4;this.waterRippleUniforms[offset]=ripple.position[0];this.waterRippleUniforms[offset+1]=ripple.position[1];this.waterRippleUniforms[offset+2]=ripple.active?this.time-ripple.start:-10;this.waterRippleUniforms[offset+3]=ripple.active?ripple.strength:0;}
    gl.uniform4fv(this.loc['uRipples[0]'],this.waterRippleUniforms);
    const shadows=[],opaque=[],transparent=[],hologram=[];const collect=(node,parent)=>{if(node.visible===false)return;const model=multiply(parent,compose(node.p,node.r,node.s));if(node.g){(node.shadow?shadows:node.alpha!==undefined&&node.alpha<.999?transparent:opaque).push([node,model]);if(node.scan&&this.scanActive)hologram.push([node,model]);}for(const child of node.children)collect(child,model);};for(const n of this.nodes)collect(n,identity());
    const draw=(node,model,outline=0,scanPass=0)=>{const g=node.g;gl.bindBuffer(gl.ARRAY_BUFFER,g.position);gl.enableVertexAttribArray(this.loc.aPosition);gl.vertexAttribPointer(this.loc.aPosition,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,g.normal);gl.enableVertexAttribArray(this.loc.aNormal);gl.vertexAttribPointer(this.loc.aNormal,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,g.index);gl.uniformMatrix4fv(this.loc.uModel,false,model);gl.uniformMatrix3fv(this.loc.uNormal,false,normalMatrix(model));gl.uniform3fv(this.loc.uColor,node.color);gl.uniform1f(this.loc.uOutline,outline);gl.uniform4fv(this.loc.uSurface,[this.night,node.alpha??1,node.glow??0,node.water||0]);gl.uniform1f(this.loc.uShadow,node.shadow?1:0);gl.uniform4fv(this.loc.uScan,[this.scanPlaneY,node.scan&&this.scanActive?1:0,scanPass,this.time]);gl.uniform4fv(this.loc.uScanBounds,[this.scanFeetY,this.scanHeadY,(this.scanHeadY-this.scanFeetY)*.035,0]);gl.drawElements(gl.TRIANGLES,g.count,gl.UNSIGNED_SHORT,0);};
    gl.disable(gl.BLEND);for(const [node,model]of opaque){if(node.outline){gl.cullFace(gl.FRONT);draw(node,model,node.outlineWidth??.012);gl.cullFace(gl.BACK);}draw(node,model);}
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);for(const [node,model]of shadows)draw(node,model);for(const [node,model]of transparent)draw(node,model);gl.disable(gl.CULL_FACE);for(const [node,model]of hologram)draw(node,model,0,1);gl.enable(gl.CULL_FACE);gl.depthMask(true);gl.disable(gl.BLEND);this.onFrame(this);
  }
  setScrollProgress(progress){
    const numeric=Number(progress),next=clamp(Number.isNaN(numeric)?0:numeric,0,1);
    if(this.directTravel){
      if(Math.abs(next-this.directTravel.progress)<.00025)return this.getScrollState();
      this.directTravel=null;
    }
    const previous=this.scrollProgress,delta=next-previous,changed=next!==previous;
    this.scrollProgress=next;this.scrollChapter=Math.max(0,Math.min(5,Math.ceil(next*6)-1));
    if(changed)this.scrollDirection=Math.sign(delta);
    const previousRotation=this.worldRotation,rotation=-TAU*next+this.manualRotationOffset;
    const distance=-(rotation-this.worldRotation)*this.trackRadius;this.travelDistance+=distance;
    this.worldRotation=rotation;this.island.r[1]=rotation;
    this.walkPhase=this.travelDistance/.12;if(changed)this.noteWalk(distance);else this.walking=false;
    if(changed)this.scrollLastChange=performance.now();
    this.applyScrollPose();this.updateWorldPoints();this.dirty=true;
    if(changed){
      const crossed=this.crossedProjects(previousRotation,rotation);
      if(crossed.length)this.commitProjectDisplay(crossed[crossed.length-1].id);
      if(!this.motion){const front=this.findFrontProject();if(front)this.enterDestination(front);else{this.facingMode='rest';this.arrivalPhase='rest';}this.mascot.r[1]=this.facingTarget;this.updateCharacter();}
    }
    return this.getScrollState();
  }
  noteWalk(distance){
    if(Math.abs(distance)<.0000001)return;
    const now=performance.now(),elapsed=clamp((now-this.lastWalkInput)/1000,.016,.12);
    this.walkDirection=Math.sign(distance);this.walkSpeedTarget=clamp(Math.abs(distance)/elapsed,.18,1.6);this.lastWalkInput=now;this.hasTravelled=true;
    if(this.findFrontProject()!==this.lastSettledProject)this.lastSettledProject=null;
    this.arrivalId=null;this.walking=this.motion;this.facingMode='travelling';this.arrivalPhase='travelling';this.facingTarget=this.walkDirection>0?PI/2:-PI/2;
    if(!this.motion)this.mascot.r[1]=this.facingTarget;
  }
  findFrontProject(){
    let nearest=null,distance=1e9;
    for(const landmark of this.landmarks){const angle=Math.abs(Math.atan2(Math.sin(landmark.angle+this.worldRotation),Math.cos(landmark.angle+this.worldRotation)));if(angle<distance){nearest=landmark.id;distance=angle;}}
    return distance<.055?nearest:null;
  }
  updateWalk(dt){
    const idle=(performance.now()-this.lastWalkInput)/1000;
    if(!this.directTravel&&idle>.13){
      this.walking=false;
      const front=this.hasTravelled?this.findFrontProject():null;
      if(front)this.enterDestination(front);
      else if(this.hasTravelled){this.facingMode='rest';this.arrivalPhase='rest';}
    }
    if(this.facingMode==='arrived'){this.arrivalPhase=this.motion&&this.time-this.destinationTime<1.15?'glance':'visitor';this.facingTarget=this.arrivalPhase==='glance'?PI:0;}
    const energy=this.walking?clamp((this.walkSpeedTarget||.6)/.8,.4,1):0;
    this.walkBlend+=(energy-this.walkBlend)*(1-Math.exp(-dt*(this.walking?7:10)));
    this.walkSpeed+=((this.walking?this.walkSpeedTarget||0:0)-this.walkSpeed)*(1-Math.exp(-dt*8));
    const turn=Math.atan2(Math.sin(this.facingTarget-this.mascot.r[1]),Math.cos(this.facingTarget-this.mascot.r[1]));
    this.mascot.r[1]+=turn*(1-Math.exp(-dt*(this.facingMode==='arrived'?5.5:8)));
  }
  applyScrollPose(){
    const blend=this.motion?this.walkBlend||0:0,phase=this.walkPhase||0;
    this.footLift=[];
    for(let i=0;i<this.legs.length;i++){
      const leg=this.legs[i],step=Math.sin(phase+i*PI),angle=step*.40*blend,lift=Math.max(0,-step)*.105*blend;
      leg.r[0]=angle;leg.p[2]=.02-step*.035*blend;
      // Keep the stance boot on the slab; the other foot clears it on the swing.
      const c=Math.cos(angle),s=Math.sin(angle);
      const boot=-.31*c-.18*s-Math.hypot(.17*c,.39*s);
      const sole=-.385*c-.17*s-Math.hypot(.085*c,.40*s);
      leg.p[1]=-.05+lift-Math.min(boot,sole);this.footLift.push(lift*.26);
      const arm=this.arms[i];arm.r[0]=-step*.30*blend;arm.r[1]=0;arm.r[2]=(i?-.04:.04)+Math.cos(phase+i*PI)*.035*blend;
      this.elbows[i].r[0]=.13+Math.max(0,step)*.20*blend;
    }
    this.plantedLeg=Math.sin(phase)>=0?0:1;
    this.hipBob=(1-Math.cos(phase*2))*.0035*blend;
    this.mascot.r[0]=.025*blend+Math.sin(phase*2)*.010*blend;this.mascot.r[2]=Math.cos(phase)*.017*blend;
  }
  crossedProjects(start,end){
    if(Math.abs(end-start)<1e-9)return [];
    const low=Math.min(start,end),high=Math.max(start,end),crossings=[];
    for(const landmark of this.landmarks){
      const base=-landmark.angle;
      for(let turn=Math.ceil((low-base)/TAU-1e-9);turn<=Math.floor((high-base)/TAU+1e-9);turn++){
        const rotation=base+turn*TAU;
        if(Math.abs(rotation-start)>1e-8&&rotation>=low-1e-8&&rotation<=high+1e-8)crossings.push({id:landmark.id,rotation});
      }
    }
    return crossings.sort((a,b)=>(a.rotation-b.rotation)*Math.sign(end-start));
  }
  commitProjectDisplay(id){
    if(!this.chestIcons.has(id))return;
    this.characterProject=id;this.lastPassedProject=id;
    for(const [project,node]of this.chestIcons)node.visible=project===id;
  }
  getArrivalState(){
    const front=this.hasTravelled?this.findFrontProject():null;
    const settled=!this.directTravel&&!this.walking&&this.facingMode==='arrived'&&front===this.arrivalFacingId;
    const status=!this.hasTravelled&&!this.directTravel?'intro':this.directTravel||this.walking?'travelling':settled?'at':'between';
    let targetProject=this.directTravel?.id||null;
    if(!targetProject&&this.hasTravelled){
      if(front)targetProject=front;
      else{
        let nearest=Infinity;
        for(const landmark of this.landmarks){
          const angle=landmark.angle+this.worldRotation;
          const distance=((this.walkDirection>0?angle:-angle)%TAU+TAU)%TAU;
          if(distance<nearest){nearest=distance;targetProject=landmark.id;}
        }
      }
    }
    return {status,currentProject:settled?front:null,lastPassedProject:this.lastPassedProject||null,targetProject,settled};
  }
  getJourneySnapshot(){return this.getScrollState();}
  restoreJourney(snapshot,{announce=false}={}){
    const saved=snapshot?.journey||snapshot;
    if(!saved||!Number.isFinite(saved.progress)||saved.progress<0||saved.progress>1||!Number.isFinite(saved.worldRotation)||!Number.isFinite(saved.manualRotationOffset))return false;
    const character=snapshot.character||saved.character,walk=saved.walk||{},arrival=saved.arrival||character?.arrival||{};
    const trip=saved.trip,tripFields=['progress','chapter','elapsed','duration','startRotation','endRotation','canonicalRotation'];
    if(trip&&(!this.scrollOrder.includes(trip.id)||!tripFields.every(key=>Number.isFinite(trip[key]))||trip.duration<=0||trip.elapsed<0||trip.elapsed>trip.duration))return false;
    this.directTravel=trip?Object.fromEntries(['id',...tripFields].map(key=>[key,trip[key]])):null;this.scrollProgress=saved.progress;this.scrollChapter=Math.max(0,Math.min(5,Math.ceil(saved.progress*6)-1));
    this.worldRotation=saved.worldRotation;this.manualRotationOffset=saved.manualRotationOffset;this.island.r[1]=saved.worldRotation;
    this.walkDirection=walk.direction===-1?-1:1;this.scrollDirection=saved.direction===-1?-1:1;this.walking=!!trip&&this.motion;this.walkBlend=trip&&Number.isFinite(walk.blend)?clamp(walk.blend,0,1):0;this.walkSpeed=trip&&Number.isFinite(walk.speed)?clamp(walk.speed,0,1.6):0;this.walkSpeedTarget=this.walkSpeed;
    this.hasTravelled=arrival.status?arrival.status!=='intro':saved.progress!==0||saved.manualRotationOffset!==0;
    if(Number.isFinite(walk.phase)){this.walkPhase=walk.phase;this.travelDistance=walk.phase*.12;}
    const project=character?.projectId??arrival.lastPassedProject??null;
    this.characterProject=null;this.lastPassedProject=null;for(const [id,node]of this.chestIcons)node.visible=id===null;
    if(this.scrollOrder.includes(project))this.commitProjectDisplay(project);
    const current=this.scrollOrder.includes(arrival.currentProject)&&this.findFrontProject()===arrival.currentProject?arrival.currentProject:null;
    this.arrivalId=current;this.arrivalFacingId=current;this.lastSettledProject=current;this.facingMode=trip?'travelling':current?'arrived':this.hasTravelled?'rest':'visitor';this.arrivalPhase=trip?'travelling':current||!this.hasTravelled?'visitor':'rest';
    this.destinationTime=this.time-1.15;this.lastWalkInput=performance.now()-(trip?0:1000);
    this.facingTarget=Number.isFinite(walk.targetFacing)?walk.targetFacing:0;this.mascot.r[1]=Number.isFinite(walk.facing)?walk.facing:this.facingTarget;
    if(current){const effect=this.projectEffects.get(current);effect.start=this.time-effect.duration;}
    this.applyScrollPose();this.updateCharacter();this.updateProjectEffects();this.updateWorldPoints();this.dirty=true;
    if(announce&&current)this.onArrival(current);
    return this.getScrollState();
  }
  setReading(reading){
    const next=!!reading;if(next===this.reading)return;
    const now=performance.now();
    if(next)this.readingStarted=now;
    else{
      const pause=Math.max(0,now-this.readingStarted);
      this.lastWalkInput+=pause;this.scrollLastChange+=pause;this.waveTime+=pause;this.lastTime=0;this.dirty=true;
    }
    this.reading=next;
  }
  enterDestination(id){
    const fresh=this.lastSettledProject!==id;
    if(fresh){this.destinationTime=this.time;this.lastSettledProject=id;this.commitProjectDisplay(id);}
    this.arrivalFacingId=id;
    this.arrivalId=id;this.facingMode='arrived';this.arrivalPhase=this.motion&&this.time-this.destinationTime<1.15?'glance':'visitor';
    this.facingTarget=this.arrivalPhase==='glance'?PI:0;
    if(!this.motion)this.mascot.r[1]=this.facingTarget;
    if(fresh){this.activateProject(id);this.onArrival(id);}
  }
  updateCharacter(){
    const t=this.time,blend=this.motion?this.walkBlend:0,phase=this.walkPhase;
    this.characterExpression=this.walking||blend>.12?'focused':this.arrivalPhase==='glance'?'curious':'friendly';
    this.head.r[2]=-this.mascot.r[2]*.72+(this.motion?Math.sin(t*.68)*.012:0);
    this.head.r[0]=-this.mascot.r[0]*.65+(this.arrivalPhase==='glance'?.035:-.012);
    this.head.r[1]=this.motion?Math.sin(t*.43)*.018:0;
    this.tail.r[1]=this.motion?Math.sin(t*1.8)*.035+Math.sin(phase-.6)*blend*.06:0;
    this.tail.r[2]=this.motion?Math.sin(t*1.4)*.018+Math.cos(phase)*blend*.025:0;
    for(const fin of this.gills){
      const flex=this.motion?Math.sin(t*1.6+fin.index*.6)*.022+Math.sin(phase+fin.index*.55)*blend*.065:0;
      fin.r[1]=fin.baseRotation[1]+fin.side*flex;fin.r[2]=fin.baseRotation[2]+fin.side*flex*.5;
    }
    const cycle=t%5.6,blink=this.motion&&cycle>4.9&&cycle<5.08?clamp(Math.abs(cycle-4.99)/.09,.06,1):1;
    this.eyes.forEach((eye,i)=>{eye.s[1]=eye.restHeight*blink*(this.characterExpression==='focused'?.88:1);eye.r[2]=(i?-.06:.06)*(this.characterExpression==='friendly'?1:0);this.eyeHighlights[i].visible=blink>.4;});
    this.mouth.s[0]=this.characterExpression==='friendly'?1.12:1;
    this.mouth.s[1]=this.characterExpression==='friendly'?1.08:.72;
  }
  getCharacterState(){
    return {projectId:this.characterProject,targetProject:this.getArrivalState().targetProject,arrival:this.getArrivalState(),expression:this.characterExpression,settlePhase:this.arrivalPhase,display:this.characterProject||'intro',shellPalette:['#231942','#5e548e','#9f86c0','#be95c4','#e0b1cb'],gillFlex:this.gills.map(fin=>fin.r[1]-fin.baseRotation[1]),tailRotation:[...this.tail.r],eyeLight:'#8deafa'};
  }
  getWalkState(){
    return {mode:this.facingMode,walking:this.walking,direction:this.walkDirection,facing:this.mascot.r[1],targetFacing:this.facingTarget,blend:this.walkBlend,speed:this.walkSpeed,phase:this.walkPhase,plantedLeg:this.plantedLeg,footLift:[...(this.footLift||[0,0])],bodyBob:this.hipBob||0,arrivedProject:this.getArrivalState().currentProject,settlePhase:this.arrivalPhase};
  }
  getScrollState(){
    return {progress:this.scrollProgress,reading:this.reading,chapter:this.scrollChapter,activeProject:this.scrollOrder[this.scrollChapter],arrivedProject:this.getArrivalState().currentProject,arrival:this.getArrivalState(),character:this.getCharacterState(),walking:this.walking,direction:this.scrollDirection,position:[...this.mascot.p],frontPosition:[0,this.walkerBaseY,this.trackRadius],worldRotation:this.worldRotation,manualRotationOffset:this.manualRotationOffset,azimuth:this.azimuth,baseAzimuth:0,transitioning:!!this.directTravel,trip:this.directTravel?{...this.directTravel}:null,destination:this.directTravel?.id||null,walk:this.getWalkState()};
  }
  beginDirectTravel(id,{animate=true}={}){
    const stop=this.scrollStops.find(item=>item.id===id);if(!stop)return false;
    const startRotation=this.worldRotation,canonicalRotation=stop.rotation;this.manualRotationOffset=0;
    const arc=Math.atan2(Math.sin(canonicalRotation-startRotation),Math.cos(canonicalRotation-startRotation));
    this.directTravel={id,progress:stop.progress,chapter:this.scrollOrder.indexOf(id),elapsed:0,duration:clamp(.95+Math.abs(arc)*.20,1.1,1.60),startRotation,endRotation:startRotation+arc,canonicalRotation};
    this.hasTravelled=true;this.scrollDirection=Math.sign(stop.progress-this.scrollProgress)||1;this.scrollProgress=stop.progress;this.scrollChapter=this.scrollOrder.indexOf(id);this.arrivalId=null;this.scrollLastChange=performance.now();this.dirty=true;
    this.noteWalk(-arc*this.trackRadius);
    if(!animate||!this.motion||Math.abs(arc)<.00001)this.finishDirectTravel();
    return true;
  }
  updateDirectTravel(dt){
    const trip=this.directTravel;if(!trip)return;
    trip.elapsed=Math.min(trip.duration,trip.elapsed+dt);
    const fraction=trip.elapsed/trip.duration,eased=fraction*fraction*(3-2*fraction);
    const rotation=trip.startRotation+(trip.endRotation-trip.startRotation)*eased;
    const distance=-(rotation-this.worldRotation)*this.trackRadius;this.travelDistance+=distance;
    this.worldRotation=rotation;this.island.r[1]=rotation;this.walkPhase=this.travelDistance/.12;this.noteWalk(distance);
    if(fraction>=1)this.finishDirectTravel();
  }
  finishDirectTravel(){
    const trip=this.directTravel;if(!trip)return;
    this.directTravel=null;this.worldRotation=trip.canonicalRotation;this.island.r[1]=this.worldRotation;
    this.walking=false;this.enterDestination(trip.id);if(!this.motion)this.updateCharacter();this.scrollLastChange=performance.now();this.arrivalId=trip.id;this.applyScrollPose();this.updateWorldPoints();this.dirty=true;
  }
  travelTo(id,options={}){
    if(options.animate)return this.beginDirectTravel(id,options);
    const stop=this.scrollStops.find(item=>item.id===id);if(!stop)return false;
    this.setScrollProgress(stop.progress);return true;
  }
  // Retained for older integrations. Page progress always controls the route.
  setTravelEnabled(enabled){this.travelEnabled=!!enabled;this.dirty=true;}
  setTheme(theme){this.theme=theme==='night'?'night':'day';this.dirty=true;}
  setMotion(enabled){this.motion=!!enabled;if(!enabled){if(this.directTravel)this.finishDirectTravel();this.waveTime=-1e9;this.walking=false;this.walkBlend=0;this.walkSpeed=0;const front=this.hasTravelled?this.findFrontProject():null;if(front)this.enterDestination(front);this.mascot.r[1]=this.facingTarget;this.applyScrollPose();this.updateCharacter();}this.dirty=true;}
  setView(view){this.view=view;const views={home:[0,1],work:[-.35,1.07],about:[.17,1.12]},v=views[view]||views.home;this.orbit(v[0]-this.manualRotationOffset);this.targetZoom=v[1];this.dirty=true;this.onInteraction('view');}
  orbit(delta){
    if(this.directTravel){this.directTravel=null;this.manualRotationOffset=this.worldRotation+TAU*this.scrollProgress;}
    const previousRotation=this.worldRotation;this.manualRotationOffset+=delta;this.worldRotation+=delta;this.island.r[1]=this.worldRotation;
    this.travelDistance-=delta*this.trackRadius;this.walkPhase=this.travelDistance/.12;this.noteWalk(-delta*this.trackRadius);
    const crossed=this.crossedProjects(previousRotation,this.worldRotation);if(crossed.length)this.commitProjectDisplay(crossed[crossed.length-1].id);
    this.scrollLastChange=performance.now();this.applyScrollPose();this.updateWorldPoints();this.dirty=true;this.onInteraction('orbit');
  }
  wave(){if(this.motion)this.waveTime=performance.now();if(!this.walking&&!this.directTravel){this.facingTarget=0;this.arrivalPhase='visitor';this.destinationTime=this.time-1.15;if(!this.motion)this.mascot.r[1]=0;}this.dirty=true;}
  project(x,y,z){const p=Array.isArray(x)?x:[x,y,z],v=transform(this.vp,p);return {x:(v[0]*.5+.5)*this.width,y:(-.5*v[1]+.5)*this.height,visible:Math.abs(v[0])<1&&Math.abs(v[1])<1&&Math.abs(v[2])<1};}
  destroy(){this.destroyed=true;cancelAnimationFrame(this.frame);this.observer?.disconnect();this.listeners.forEach(fn=>fn());for(const g of this.geometries)for(const key of ['position','normal','index'])this.gl.deleteBuffer(g[key]);this.gl.deleteProgram(this.program);}
}
