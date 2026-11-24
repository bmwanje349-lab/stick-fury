// verifies the player-death -> 'dead' screen flow
const fs=require('fs'),path=require('path'),vm=require('vm');
const noop=()=>{};
const ctxStub=new Proxy({}, {get:(t,k)=>(k in t?t[k]:(k==='createLinearGradient'?()=>({addColorStop:noop}):noop)),set:(t,k,v)=>{t[k]=v;return true}});
const el=()=>({style:{},classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,getContext:()=>ctxStub,getBoundingClientRect:()=>({left:0,top:0,width:960,height:540}),dataset:{},width:0,height:0});
global.window=global;global.innerWidth=960;global.innerHeight=540;global.addEventListener=noop;
global.document={getElementById:()=>el(),querySelectorAll:()=>[],documentElement:{},addEventListener:noop,hidden:false};
global.localStorage={getItem:()=>null,setItem:noop};global.requestAnimationFrame=noop;
const dir=path.join(__dirname,'..','www');
vm.runInThisContext(['data.js','game.js','logic.js','render.js'].map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n'));
const S=window.__SF;S.startLevel(1);
S.G.p.inv=0;
// walk into enemies without attacking until dead
let f=0;while(S.state==='play'&&f<60*120){const G=S.G,p=G.p;const t=G.enemies[0];S.setK('left',0);S.setK('right',t&&t.x>p.x?1:0);S.step(1/60);S.render();f++;}
console.log('state after dying:',S.state,'frames',f);
if(S.state!=='dead'){console.log('PROBLEM: death flow');process.exit(1)}
S.render();S.buttons.find(b=>b.label==='RETRY').fn();console.log('retry ->',S.state);
if(S.state!=='play')process.exit(1);
console.log('DEATH FLOW OK');
