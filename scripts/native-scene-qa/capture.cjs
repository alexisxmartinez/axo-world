const fs = require('node:fs');
const path = require('node:path');
const option=(name,fallback)=>{const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1];};
const outputDirectory=path.resolve(option('--out',path.join(require('node:os').tmpdir(),'axo-native-scene-qa')));fs.mkdirSync(outputDirectory,{recursive:true});
const sourcePath=path.resolve(option('--source',path.join(__dirname,'../../src/world.js')));
const rawSource=fs.readFileSync(sourcePath,'utf8');let source=rawSource;
if(sourcePath.endsWith('.html')){
 const module=source.match(/const \{ World \} = \(\(\) => \{\n([\s\S]*?)\nreturn \{ World \};\n\}\)\(\);/);
 if(!module)throw new Error('Cannot isolate the original World module.');
 source=module[1];
}
source=source.replace(/^export\s+/gm,'');
global.window={devicePixelRatio:1,addEventListener(){},removeEventListener(){}};
global.document={hidden:false,addEventListener(){},removeEventListener(){}};
global.requestAnimationFrame=()=>1;global.cancelAnimationFrame=()=>{};
const {World}=new Function(source+';return {World};')();
const constants={VERTEX_SHADER:0x8b31,FRAGMENT_SHADER:0x8b30,COMPILE_STATUS:0x8b81,LINK_STATUS:0x8b82,ARRAY_BUFFER:0x8892,ELEMENT_ARRAY_BUFFER:0x8893,STATIC_DRAW:0x88e4,FLOAT:0x1406,UNSIGNED_SHORT:0x1403,TRIANGLES:4,COLOR_BUFFER_BIT:0x4000,DEPTH_BUFFER_BIT:0x100,DEPTH_TEST:0xb71,LEQUAL:0x203,CULL_FACE:0xb44,BACK:0x405,FRONT:0x404,BLEND:0xbe2,SRC_ALPHA:0x302,ONE_MINUS_SRC_ALPHA:0x303};
const buffers={},shaders=[],uniforms={},bindings={},attributes={};let nextId=1,draws=[];
const drawState={blend:false,cull:constants.BACK,depthMask:true,enabled:[],depthFunc:constants.LEQUAL,blendFunc:[constants.SRC_ALPHA,constants.ONE_MINUS_SRC_ALPHA]};
const gl=new Proxy({...constants,
 createBuffer:()=>({id:nextId++}), bindBuffer:(target,buffer)=>{bindings[target]=buffer;},
 bufferData:(target,data)=>{buffers[bindings[target].id]={type:data.constructor.name,data:Array.from(data)};},
 createShader:(type)=>{const shader={type};shaders.push(shader);return shader;},shaderSource:(shader,text)=>{shader.source=text;},
 getShaderParameter:()=>true,getProgramParameter:()=>true,
 getUniformLocation:(_,name)=>name,getAttribLocation:(_,name)=>name,
 uniformMatrix4fv:(name,transpose,value)=>{uniforms[name]=Array.from(value);},uniformMatrix3fv:(name,transpose,value)=>{uniforms[name]=Array.from(value);},
 uniform3fv:(name,value)=>{uniforms[name]=Array.from(value);},uniform4fv:(name,value)=>{uniforms[name]=Array.from(value);},uniform1f:(name,value)=>{uniforms[name]=value;},
 vertexAttribPointer:(name,size,type,normalized,stride,offset)=>{attributes[name]={buffer:bindings[constants.ARRAY_BUFFER].id,size,type,normalized,stride,offset};},
 enable:(cap)=>{if(cap===constants.BLEND)drawState.blend=true;drawState.enabled=[...new Set([...drawState.enabled,cap])];},
 disable:(cap)=>{if(cap===constants.BLEND)drawState.blend=false;drawState.enabled=drawState.enabled.filter(v=>v!==cap);},
 cullFace:(face)=>{drawState.cull=face;},depthMask:(value)=>{drawState.depthMask=value;},depthFunc:(value)=>{drawState.depthFunc=value;},blendFunc:(src,dst)=>{drawState.blendFunc=[src,dst];},
 drawElements:(mode,count,type,offset)=>{draws.push({mode,count,type,offset,index:bindings[constants.ELEMENT_ARRAY_BUFFER].id,attributes:structuredClone(attributes),uniforms:structuredClone(uniforms),state:structuredClone(drawState)});}
},{get:(object,key)=>key in object?object[key]:String(key).startsWith('create')?()=>({}):()=>{}});
const canvas={width:0,height:0,style:{},getContext:()=>gl,getBoundingClientRect:()=>({left:0,top:0,width:1100,height:900}),addEventListener(){},removeEventListener(){}};
const world=new World({canvas});
const frames=[];
const samples=[{name:'front-t0',time:0,progress:0},{name:'front-t4',time:4,progress:0},
 {name:'ripple-before',time:4.5,progress:0},{name:'ripple-after',time:4.5,progress:0,ripple:true},
 ...Array.from({length:6},(_,i)=>({name:`stop-${i+1}`,time:4,progress:(i+1)/6}))];
for(const sample of samples){
 world.setMotion(false);world.setScrollProgress(sample.progress);
 for(const ripple of world.ripplePool||[])ripple.active=false;
 if(sample.ripple){world.time=sample.time-.5;world.motion=true;world.rippleWater();}
 world.time=sample.time;world.motion=true;world.update(.016);world.motion=false;
 const waterSamples=[];
 for(const radius of [2.80,2.86,2.91])for(let i=0;i<=180;i++){
  const angle=-Math.PI/2+i*Math.PI/180;
  const point=world.localToWorld([Math.sin(angle)*radius,world.waterLevel||.490,Math.cos(angle)*radius]);
  waterSamples.push(world.project(point));
 }
 draws=[];world.render();frames.push({...sample,draws,waterSamples,water:world.getEnvironmentState?.()});
}
const hash=(text)=>require('node:crypto').createHash('sha256').update(text).digest('hex');
const output={width:1100,height:900,shaders,buffers,frames,sourcePath,sourceHash:hash(rawSource),evaluatedSourceHash:hash(source),capturedAt:new Date().toISOString()};
fs.writeFileSync(path.join(outputDirectory,'packets.json'),JSON.stringify(output));
console.log(JSON.stringify({shaders:shaders.length,buffers:Object.keys(buffers).length,frames:frames.map(f=>({name:f.name,draws:f.draws.length})),bytes:fs.statSync(path.join(outputDirectory,'packets.json')).size}));
