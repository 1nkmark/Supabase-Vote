import {config} from './config.js';
import {createClient,createVoter,summarize} from './vote-core.js';

const display=document.body.classList.contains('display');
const $=id=>document.getElementById(id);
const buttons=[...document.querySelectorAll('[data-choice]')];
const client=createClient(config);
let device=null,voter=null,state=null,loading=false,connected=false,blocked=false;

function status(text,error=false){$('connection').textContent=text;$('connection').classList.toggle('error',error);$('retry').hidden=!error;}
function lock(){for(const button of buttons){button.disabled=blocked||!connected||!state?.is_open||voter?.pending||Boolean(voter?.choice);button.classList.toggle('selected',button.dataset.choice===voter?.choice);}}
function render(data){
  const count=summarize(data);
  state=data;
  if(voter) voter.choice=data.my_choice;
  $('total').textContent=`${count.total} 人已答`;
  for(const choice of ['A','B']){
    const percent=choice==='A'?count.pa:count.pb;
    $('bar-'+choice).style.width=`${percent}%`;
    $('value-'+choice).textContent=`${count[choice.toLowerCase()]} · ${Math.round(percent)}%`;
  }
  if(display){$('round-label').textContent=`第 ${data.round_id} 轮 · ${data.is_open?'投票进行中':'投票已结束'}`;}
  else {
    $('results').hidden=!voter.choice;
    $('message').textContent=voter.choice?`已提交 ${voter.choice}「${voter.choice==='A'?'能':'不能'}」，感谢参与`:(data.is_open?'点击选项即可提交':'本轮投票已结束');
  }
}
async function refresh(){
  if(loading||voter?.pending||blocked)return;
  loading=true;
  try{
    const data=await client.state(device);
    render(data);connected=true;
    status(`已连接 · ${new Date().toLocaleTimeString('zh-CN',{hour12:false})} 更新`);
  }catch(error){
    connected=false;
    status(`连接失败，${state?'当前显示上次结果。':''}请检查网络或联系教师。`,true);
    if(!display&&!voter?.choice)$('message').textContent='暂时无法投票，请重新连接';
    console.warn('投票服务错误：',error.message);
  }finally{loading=false;lock();}
}
async function submit(choice){
  if(!state||!connected||voter.pending||voter.choice||!state.is_open)return;
  const task=voter.submit(choice,state.round_id);lock();$('message').textContent='正在提交，请稍候…';
  try{
    await task;
    $('message').textContent=`已提交 ${voter.choice}「${voter.choice==='A'?'能':'不能'}」，感谢参与`;
  }catch(error){
    $('message').textContent='暂未确认提交结果。请重试，重复请求不会重复计票。';
    status(error.message,true);
  }finally{lock();}
  await refresh();
}

if(!display){
  try{
    const key='resolution_vote_device_v1';
    device=localStorage.getItem(key);
    if(!device||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(device)){
      device=crypto.randomUUID();localStorage.setItem(key,device);
    }
    voter=createVoter(client,device);
    buttons.forEach(button=>button.addEventListener('click',()=>submit(button.dataset.choice)));
  }catch{
    blocked=true;
    $('message').textContent='浏览器无法保存投票标识，请允许网站存储，或用系统浏览器打开';
    status('当前浏览器无法参与投票',true);
  }
}else{
  const voteUrl=new URL('index.html',location.href).href;
  $('vote-link').href=voteUrl;
  if(globalThis.qrcode){
    const qr=globalThis.qrcode(0,'M');qr.addData(voteUrl);qr.make();
    const canvas=document.createElement('canvas');
    const cells=qr.getModuleCount(),scale=10;
    canvas.width=canvas.height=(cells+8)*scale;
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label','扫码打开学生投票页');
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
    for(let row=0;row<cells;row++)for(let col=0;col<cells;col++)if(qr.isDark(row,col))ctx.fillRect((col+4)*scale,(row+4)*scale,scale,scale);
    $('qrcode').append(canvas);
    $('download-qr').hidden=false;
    $('download-qr').addEventListener('click',()=>{
      const canvas=$('qrcode').querySelector('canvas');const image=$('qrcode').querySelector('img');
      const link=document.createElement('a');link.download='归结演绎推理-投票二维码.png';link.href=canvas?canvas.toDataURL('image/png'):image.src;link.click();
    });
  }else{$('qrcode').textContent='二维码未能加载，请使用下方投票链接';}
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{status('当前浏览器不支持全屏');}});
}
$('retry').addEventListener('click',()=>blocked?location.reload():refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('online',refresh);
window.addEventListener('offline',()=>{connected=false;status('网络已断开，正在等待恢复',true);lock();});
refresh();
setInterval(()=>{if(!document.hidden)refresh();},display?2000:4000);
