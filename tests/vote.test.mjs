import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, createVoter, summarize } from '../vote-core.js';

test('零票不会出现 NaN；大于 1000 票的汇总不被截断', () => {
  assert.deepEqual(summarize({a:0,b:0}), {total:0,a:0,b:0,pa:0,pb:0});
  assert.deepEqual(summarize({a:1500,b:500}), {total:2000,a:1500,b:500,pa:75,pb:25});
});
test('无效统计不能伪装成零票', () => {
  assert.throws(()=>summarize({a:-1,b:2}));
  assert.throws(()=>summarize({a:'bad',b:2}));
});
test('网络错误不记录成功，恢复后允许重试', async () => {
  let fail=true;
  const voter=createVoter({submit:async()=>{if(fail)throw Error('offline');return {choice:'B'};}},'device');
  await assert.rejects(voter.submit('B',1),/offline/);
  assert.equal(voter.choice,null);
  assert.equal(voter.pending,false);
  fail=false;
  assert.equal((await voter.submit('B',1)).choice,'B');
});
test('快速重复点击只发出一次请求', async () => {
  let release,calls=0;
  const voter=createVoter({submit:()=>{calls++;return new Promise(r=>release=r);}},'device');
  const first=voter.submit('A',1);
  await assert.rejects(voter.submit('B',1),/正在提交/);
  release({choice:'A'});
  await first;
  assert.equal(calls,1);
});
test('以服务器保存的选项为准，不能把重试变成改票', async()=>{
  const voter=createVoter({submit:async()=>({choice:'A'})},'device');
  await voter.submit('B',1);
  assert.equal(voter.choice,'A');
});
test('非法选项不发送请求', async()=>{
  const voter=createVoter({submit:()=>assert.fail('must not submit')},'device');
  await assert.rejects(voter.submit('C',1),/选项/);
});
test('API 权限错误向调用方报告，不返回假成功', async()=>{
  const client=createClient({url:'https://example.supabase.co',key:'public'},async()=>new Response(JSON.stringify({message:'permission denied'}),{status:403}));
  await assert.rejects(client.state(null),/permission denied/);
});
test('请求携带轮次和设备标识，publishable key 不作为 JWT', async()=>{
  let request;
  const client=createClient({url:'https://example.supabase.co',key:'sb_publishable_test'},async(url,init)=>{
    request={url,...init};return Response.json({choice:'B'});
  });
  await client.submit('device','B',7);
  assert.equal(request.url,'https://example.supabase.co/rest/v1/rpc/resolution_submit');
  assert.deepEqual(JSON.parse(request.body),{p_device_id:'device',p_choice:'B',p_round_id:7});
  assert.equal(request.headers.apikey,'sb_publishable_test');
  assert.equal(request.headers.Authorization,undefined);
});
