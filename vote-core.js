export function summarize(state) {
  const a=Number(state.a), b=Number(state.b);
  if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0) throw Error('统计数据格式错误');
  const total=a+b;
  return {a,b,total,pa:total?a/total*100:0,pb:total?b/total*100:0};
}

export function createClient(config, fetcher=globalThis.fetch) {
  async function rpc(name, body) {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetcher(`${config.url}/rest/v1/rpc/${name}`,{
        method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},
        body:JSON.stringify(body),signal:controller.signal,cache:'no-store'
      });
      const result=await response.json();
      if(!response.ok) throw Error(result.message||`服务返回 ${response.status}`);
      if(!result||typeof result!=='object') throw Error('服务器返回的数据无效');
      return result;
    } catch(error) {
      if(error.name==='AbortError') throw Error('连接超时，请检查网络后重试');
      throw error;
    } finally {clearTimeout(timeout);}
  }
  return {
    state:device=>rpc('resolution_state',{p_device_id:device}),
    submit:(device,choice,round)=>rpc('resolution_submit',{p_device_id:device,p_choice:choice,p_round_id:round})
  };
}

export function createVoter(client,device) {
  return {
    pending:false,choice:null,
    async submit(choice,round) {
      if(!['A','B'].includes(choice)) throw Error('无效选项');
      if(this.pending) throw Error('正在提交，请稍候');
      this.pending=true;
      try {
        const result=await client.submit(device,choice,round);
        if(!['A','B'].includes(result.choice)) throw Error('服务器未确认投票，请重试');
        this.choice=result.choice;
        return result;
      } finally {this.pending=false;}
    }
  };
}
