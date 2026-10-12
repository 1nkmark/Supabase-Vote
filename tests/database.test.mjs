import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('真实 PostgreSQL：权限隔离、重复投票、结束和新轮次', async () => {
  const db=new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    const sql=await readFile(new URL('../supabase-setup.sql',import.meta.url),'utf8');
    await db.exec(sql);
    await db.exec(sql); // setup must preserve existing rounds
    const call=async(name,args=[]) => (await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,args)).rows[0].value;
    await db.exec('SET ROLE anon');
    assert.deepEqual(await call('resolution_state',[null]),{round_id:1,is_open:true,a:0,b:0,my_choice:null});
    await assert.rejects(db.query('SELECT * FROM public.resolution_votes'),/permission denied/);
    await assert.rejects(db.query('UPDATE public.resolution_rounds SET is_open=false'),/permission denied/);
    const id='11111111-1111-4111-8111-111111111111';
    await assert.rejects(call('resolution_submit',[id,'C',1]),/无效选项/);
    await assert.rejects(call('resolution_submit',[null,'B',1]),/设备标识/);
    assert.equal((await call('resolution_submit',[id,'B',1])).choice,'B');
    assert.equal((await call('resolution_submit',[id,'A',1])).choice,'B');
    assert.deepEqual(await call('resolution_state',[id]),{round_id:1,is_open:true,a:0,b:1,my_choice:'B'});
    assert.equal((await call('resolution_state',[null])).my_choice,null);
    await db.exec('RESET ROLE; UPDATE public.resolution_rounds SET is_open=false; SET ROLE anon;');
    await assert.rejects(call('resolution_submit',['22222222-2222-4222-8222-222222222222','A',1]),/结束/);
    assert.equal((await call('resolution_submit',[id,'B',1])).choice,'B');
    await db.exec('RESET ROLE; INSERT INTO public.resolution_rounds DEFAULT VALUES; SET ROLE anon;');
    await assert.rejects(call('resolution_submit',[id,'A',1]),/轮次/);
    assert.deepEqual(await call('resolution_state',[id]),{round_id:2,is_open:true,a:0,b:0,my_choice:null});
    assert.equal((await call('resolution_submit',[id,'A',2])).choice,'A');
    await db.exec("RESET ROLE; INSERT INTO public.resolution_votes(round_id,device_id,choice) SELECT 2, md5(n::text)::uuid, 'B' FROM generate_series(1,1500) n; SET ROLE anon;");
    assert.equal((await call('resolution_state',[null])).b,1500);
  } finally { await db.close(); }
});
