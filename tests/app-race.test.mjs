import test from 'node:test';
import assert from 'node:assert/strict';

test('投票成功后，旧轮询响应不能抹掉已确认的答案', async()=>{
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const makeElement=()=>({textContent:'',hidden:false,disabled:false,style:{},dataset:{},classList:{toggle(){}},addEventListener(name,fn){this[name]=fn;}});
  const elements=new Map();
  const buttons=['A','B'].map(choice=>Object.assign(makeElement(),{dataset:{choice}}));
  const requests=[];let poll;
  const saved={fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  globalThis.document={body:{classList:{contains:()=>false}},hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,makeElement());return elements.get(id);},querySelectorAll:()=>buttons,addEventListener(){}};
  globalThis.window={addEventListener(){}};
  globalThis.localStorage={getItem:()=> '11111111-1111-4111-8111-111111111111',setItem(){}};
  globalThis.setInterval=fn=>{poll=fn;return 1;};
  globalThis.fetch=()=>new Promise(resolve=>requests.push(data=>resolve(Response.json(data))));
  try {
    await import('../app.js');
    const before={round_id:1,is_open:true,a:0,b:0,my_choice:null};
    requests.shift()(before);await tick();
    poll(); // slow poll starts before vote
    const slow=requests.shift();
    const submit=buttons[1].click();
    requests.shift()({choice:'B'});await tick();
    slow(before);await tick();await tick();
    assert.match(elements.get('message').textContent,/已提交 B/);
    assert.equal(buttons[1].disabled,true);
    if(requests.length){requests.shift()({...before,b:1,my_choice:'B'});await tick();}
    await submit;
  } finally {
    globalThis.fetch=saved.fetch;globalThis.setInterval=saved.setInterval;
  }
});
