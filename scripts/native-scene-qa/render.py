"""Native surfaceless EGL replay of World.render packets; not a browser test."""
import ctypes as C
import json
import sys
import tempfile
import os
import re
os.environ.setdefault('MESA_GLES_VERSION_OVERRIDE', '2.0')
from pathlib import Path
from PIL import Image

ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(tempfile.gettempdir())/'axo-native-scene-qa'
pack=json.loads((ROOT/'packets.json').read_text())
width,height=pack['width'],pack['height']
supersample=2
render_width,render_height=width*supersample,height*supersample
egl=C.CDLL('libEGL.so.1')
egl.eglGetProcAddress.argtypes=[C.c_char_p];egl.eglGetProcAddress.restype=C.c_void_p
getplatform=C.CFUNCTYPE(C.c_void_p,C.c_uint,C.c_void_p,C.POINTER(C.c_int))(egl.eglGetProcAddress(b'eglGetPlatformDisplayEXT'))
display=getplatform(0x31DD,None,None)
def eglfn(name,result,*arguments):
 fn=getattr(egl,name);fn.argtypes=list(arguments);fn.restype=result;return fn
initialize=eglfn('eglInitialize',C.c_uint,C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_int))
major,minor=C.c_int(),C.c_int()
assert initialize(display,C.byref(major),C.byref(minor)), 'eglInitialize failed'
choose=eglfn('eglChooseConfig',C.c_uint,C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_void_p),C.c_int,C.POINTER(C.c_int))
config=C.c_void_p();count=C.c_int()
base=[0x3033,1,0x3040,4,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24]
samples=0
for sample_attributes in [[0x3032,0,0x3031,0]]:
 attrs=(C.c_int*(len(base+sample_attributes)+1))(*(base+sample_attributes+[0x3038]))
 assert choose(display,attrs,C.byref(config),1,C.byref(count)), 'eglChooseConfig failed'
 if count.value:break
 samples=0
assert count.value, 'No ES2 RGBA8 depth24 pbuffer configuration'
assert eglfn('eglBindAPI',C.c_uint,C.c_uint)(0x30A0), 'eglBindAPI failed'
context_attrs=(C.c_int*3)(0x3098,2,0x3038)
context=eglfn('eglCreateContext',C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_int))(display,config,None,context_attrs)
assert context, 'eglCreateContext failed'
surface_attrs=(C.c_int*5)(0x3057,render_width,0x3056,render_height,0x3038)
surface=eglfn('eglCreatePbufferSurface',C.c_void_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_int))(display,config,surface_attrs)
assert surface, 'eglCreatePbufferSurface failed'
assert eglfn('eglMakeCurrent',C.c_uint,C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p)(display,surface,surface,context), 'eglMakeCurrent failed'

def glfn(name,result,*arguments):
 address=egl.eglGetProcAddress(name.encode())
 assert address, name+' unavailable'
 return C.CFUNCTYPE(result,*arguments)(address)
uint=C.c_uint; integer=C.c_int; boolean=C.c_ubyte; floating=C.c_float; pointer=C.c_void_p
getstring=glfn('glGetString',C.c_char_p,uint)
create_shader=glfn('glCreateShader',uint,uint)
shader_source=glfn('glShaderSource',None,uint,integer,C.POINTER(C.c_char_p),C.POINTER(integer))
compile_shader=glfn('glCompileShader',None,uint)
shader_iv=glfn('glGetShaderiv',None,uint,uint,C.POINTER(integer))
shader_log=glfn('glGetShaderInfoLog',None,uint,integer,C.POINTER(integer),C.c_char_p)
create_program=glfn('glCreateProgram',uint)
attach_shader=glfn('glAttachShader',None,uint,uint)
link_program=glfn('glLinkProgram',None,uint)
program_iv=glfn('glGetProgramiv',None,uint,uint,C.POINTER(integer))
program_log=glfn('glGetProgramInfoLog',None,uint,integer,C.POINTER(integer),C.c_char_p)
program=create_program()
for item in pack['shaders']:
 shader=create_shader(item['type']);text=item['source'].encode();strings=(C.c_char_p*1)(text)
 shader_source(shader,1,strings,None);compile_shader(shader)
 success=integer();shader_iv(shader,0x8B81,C.byref(success))
 if not success.value:
  log=C.create_string_buffer(8192);shader_log(shader,8192,None,log);raise RuntimeError(log.value.decode())
 attach_shader(program,shader)
link_program(program);success=integer();program_iv(program,0x8B82,C.byref(success))
if not success.value:
 log=C.create_string_buffer(8192);program_log(program,8192,None,log);raise RuntimeError(log.value.decode())
glfn('glUseProgram',None,uint)(program)

gen_buffers=glfn('glGenBuffers',None,integer,C.POINTER(uint));bind_buffer=glfn('glBindBuffer',None,uint,uint)
buffer_data=glfn('glBufferData',None,uint,C.c_ssize_t,pointer,uint)
gpu_buffers={}
for key,item in pack['buffers'].items():
 ident=uint();gen_buffers(1,C.byref(ident));gpu_buffers[int(key)]=ident.value
 element=item['type']=='Uint16Array';target=0x8893 if element else 0x8892
 array=((C.c_ushort if element else floating)*len(item['data']))(*item['data'])
 bind_buffer(target,ident);buffer_data(target,C.sizeof(array),array,0x88E4)
get_uniform=glfn('glGetUniformLocation',integer,uint,C.c_char_p);get_attribute=glfn('glGetAttribLocation',integer,uint,C.c_char_p)
locations={key:get_uniform(program,key.encode()) for key in pack['frames'][0]['draws'][0]['uniforms']}
attributes={key:get_attribute(program,key.encode()) for key in pack['frames'][0]['draws'][0]['attributes']}
uniform1=glfn('glUniform1f',None,integer,floating);uniform3=glfn('glUniform3fv',None,integer,integer,C.POINTER(floating));uniform4=glfn('glUniform4fv',None,integer,integer,C.POINTER(floating))
uniform4mat=glfn('glUniformMatrix4fv',None,integer,integer,boolean,C.POINTER(floating));uniform3mat=glfn('glUniformMatrix3fv',None,integer,integer,boolean,C.POINTER(floating))
enable=glfn('glEnable',None,uint);disable=glfn('glDisable',None,uint);cull=glfn('glCullFace',None,uint)
depth_func=glfn('glDepthFunc',None,uint);depth_mask=glfn('glDepthMask',None,boolean);blend_func=glfn('glBlendFunc',None,uint,uint)
enable_attribute=glfn('glEnableVertexAttribArray',None,uint);attribute_pointer=glfn('glVertexAttribPointer',None,uint,integer,uint,boolean,integer,pointer)
draw_elements=glfn('glDrawElements',None,uint,integer,uint,pointer);clear=glfn('glClear',None,uint)
clear_color=glfn('glClearColor',None,floating,floating,floating,floating);read_pixels=glfn('glReadPixels',None,integer,integer,integer,integer,uint,uint,pointer)
finish=glfn('glFinish',None);get_error=glfn('glGetError',uint)
glfn('glViewport',None,integer,integer,integer,integer)(0,0,render_width,render_height)
summary={'egl':f'{major.value}.{minor.value}','renderer':getstring(0x1F01).decode(),'version':getstring(0x1F02).decode(),'shadingLanguage':getstring(0x8B8C).decode(),'samples':samples,'supersample':supersample,'frames':[],'sourceCapture':pack['capturedAt'],'sourcePath':pack.get('sourcePath'),'sourceHash':pack.get('sourceHash')}
fragment=next(item['source'] for item in pack['shaders'] if item['type']==0x8B30)
declared_uniforms=re.findall(r'uniform\s+(?:(?:lowp|mediump|highp)\s+)?(float|vec[234]|mat[234])\s+\w+(?:\[(\d+)\])?\s*;',fragment)
summary['declaredFragmentUniformWorstCaseVectors']=sum((int(kind[-1]) if kind.startswith('mat') else 1)*int(count or 1) for kind,count in declared_uniforms)
fragment_limit=integer();glfn('glGetIntegerv',None,uint,C.POINTER(integer))(0x8DFD,C.byref(fragment_limit))
summary['driverMaxFragmentUniformVectors']=fragment_limit.value
for frame in pack['frames']:
 depth_mask(1);clear_color(0,0,0,0);clear(0x4000|0x100)
 for draw in frame['draws']:
  state=draw['state']
  for cap in [0xB71,0xB44,0xBE2]: (enable if cap in state['enabled'] else disable)(cap)
  cull(state['cull']);depth_func(state['depthFunc']);depth_mask(state['depthMask']);blend_func(*state['blendFunc'])
  for name,item in draw['attributes'].items():
   location=attributes[name];bind_buffer(0x8892,gpu_buffers[item['buffer']]);enable_attribute(location)
   attribute_pointer(location,item['size'],item['type'],item['normalized'],item['stride'],pointer(item['offset']))
  bind_buffer(0x8893,gpu_buffers[draw['index']])
  for name,value in draw['uniforms'].items():
   location=locations[name]
   if isinstance(value,list):
    array=(floating*len(value))(*value)
    if len(value) in [9,16]:(uniform4mat if len(value)==16 else uniform3mat)(location,1,0,array)
    elif len(value)%4==0:uniform4(location,len(value)//4,array)
    else:uniform3(location,len(value)//3,array)
   else:uniform1(location,value)
  draw_elements(draw['mode'],draw['count'],draw['type'],pointer(draw['offset']))
 finish();error=get_error();assert error==0,f'GL error {hex(error)} in {frame["name"]}'
 pixels=(C.c_ubyte*(render_width*render_height*4))();read_pixels(0,0,render_width,render_height,0x1908,0x1401,pixels)
 assert get_error()==0, 'glReadPixels failed'
 image=Image.frombytes('RGBA',(render_width,render_height),bytes(pixels)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).resize((width,height),Image.Resampling.LANCZOS)
 image.save(ROOT/(frame['name']+'-transparent.png'))
 background=Image.new('RGBA',(width,height),'#231942');background.alpha_composite(image)
 background.convert('RGB').save(ROOT/(frame['name']+'.png'))
 background.crop((250,390,850,800)).resize((1200,820),Image.Resampling.LANCZOS).convert('RGB').save(ROOT/(frame['name']+'-water.png'))
 background.crop((80,530,380,825)).resize((900,885),Image.Resampling.LANCZOS).convert('RGB').save(ROOT/(frame['name']+'-water-outer.png'))
 summary['frames'].append({'name':frame['name'],'draws':len(frame['draws']),'error':error})
(ROOT/'report.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
