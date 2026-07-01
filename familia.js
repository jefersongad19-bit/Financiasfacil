/* ═══════════════════════════════════════════════════════════════
   FAMÍLIA AO VIVO — Firestore. Reaproveita a conexão e o LOGIN do
   acesso.js (window.FFReady): identidade = e-mail logado (não anônimo).
   Compartilha só os totais do mês entre os membros.
   ═══════════════════════════════════════════════════════════════ */

(function(){
  const LSK = 'ff2_fam';
  let _fb = null;      // { app, auth, db, uid, api }
  let _unsub = null;   // cancelador do onSnapshot
  let _membros = [];   // cache dos membros

  function _cfgOk(){ return !!window.FFReady; }
  function getState(){ try{ return JSON.parse(localStorage.getItem(LSK)) || null; }catch(e){ return null; } }
  function setState(s){ try{ if(s) localStorage.setItem(LSK, JSON.stringify(s)); else localStorage.removeItem(LSK); }catch(e){} }

  // Resumo do mês atual a partir do DB local (só totais — nada detalhado sai do aparelho)
  function meuResumo(){
    const d = new Date(), y = d.getFullYear(), m = d.getMonth();
    const r = DB.resumoMes(y, m) || {};
    const st = getState() || {};
    const sobrou = (r.saldoReal !== undefined) ? r.saldoReal : ((r.entradas||0) - (r.totalSaidasPagas||0));
    return {
      nome: st.nome || DB.getConfig().nome || 'Você',
      entrou: r.entradas || 0,
      saiu: r.totalSaidasPagas || 0,
      sobrou: sobrou,
      mes: y + '-' + String(m+1).padStart(2,'0'),
      atualizadoEm: Date.now()
    };
  }

  async function initFb(){
    if(_fb) return _fb;
    const ff = await window.FFReady;   // login + Firebase já prontos no acesso.js
    _fb = { app: ff.app, auth: ff.auth, db: ff.db, uid: ff.uid, api: ff.api };
    return _fb;
  }

  function gerarCodigo(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0,O,1,I
    let c = '';
    for(let i=0;i<4;i++) c += chars[Math.floor(Math.random()*chars.length)];
    return 'FAM-' + c;
  }

  async function pushMeu(){
    if(!_cfgOk()) return;
    const st = getState(); if(!st || !st.code) return;
    const fb = await initFb();
    const { doc, setDoc } = fb.api;
    await setDoc(doc(fb.db, 'familias', st.code, 'membros', fb.uid), meuResumo(), { merge: true });
  }

  function subscribe(code){
    if(_unsub){ try{ _unsub(); }catch(e){} _unsub = null; }
    initFb().then(fb=>{
      const { collection, onSnapshot } = fb.api;
      _unsub = onSnapshot(collection(fb.db, 'familias', code, 'membros'), snap=>{
        _membros = [];
        snap.forEach(d=>{ _membros.push(Object.assign({ uid: d.id }, d.data())); });
        render();
      }, err=>{ console.warn('[familia] snapshot', err); });
    }).catch(e=>console.warn('[familia] init', e));
  }

  // ===== API pública (chamada pelos botões) =====
  window.famCriar = async function(){
    const nome = (document.getElementById('famNome')||{}).value;
    const n = (nome||'').trim();
    if(!n){ showToast('Digite seu nome'); return; }
    if(!_cfgOk()){ showToast('⚠️ Firebase ainda não configurado'); return; }
    showToast('Criando família…');
    try{
      const fb = await initFb();
      const code = gerarCodigo();
      const { doc, setDoc } = fb.api;
      await setDoc(doc(fb.db, 'familias', code), { criadoEm: Date.now(), criador: fb.uid });
      setState({ code: code, nome: n });
      await pushMeu();
      subscribe(code);
      showToast('✅ Família criada!');
      render();
    }catch(e){ console.warn(e); showToast('❌ Erro ao criar — confira a config'); }
  };

  window.famEntrar = async function(){
    const n = ((document.getElementById('famNome')||{}).value||'').trim();
    let code = ((document.getElementById('famCodeIn')||{}).value||'').trim().toUpperCase();
    if(!n){ showToast('Digite seu nome'); return; }
    if(!code){ showToast('Digite o código'); return; }
    if(!_cfgOk()){ showToast('⚠️ Firebase ainda não configurado'); return; }
    if(code.indexOf('FAM-') !== 0) code = 'FAM-' + code.replace(/^FAM-?/,'');
    showToast('Entrando…');
    try{
      const fb = await initFb();
      const { doc, getDoc } = fb.api;
      const snap = await getDoc(doc(fb.db, 'familias', code));
      if(!snap.exists()){ showToast('❌ Código não encontrado'); return; }
      setState({ code: code, nome: n });
      await pushMeu();
      subscribe(code);
      showToast('✅ Entrou na família!');
      render();
    }catch(e){ console.warn(e); showToast('❌ Erro ao entrar'); }
  };

  window.famSair = async function(){
    if(!confirm('Sair da família?')) return;
    const st = getState();
    try{
      if(st && st.code && _cfgOk()){
        const fb = await initFb();
        const { doc, deleteDoc } = fb.api;
        await deleteDoc(doc(fb.db, 'familias', st.code, 'membros', fb.uid));
      }
    }catch(e){ console.warn(e); }
    if(_unsub){ try{ _unsub(); }catch(e){} _unsub = null; }
    _membros = [];
    setState(null);
    showToast('Você saiu da família');
    render();
  };

  window.famCopiarCodigo = function(){
    const st = getState(); if(!st) return;
    if(navigator.clipboard){ navigator.clipboard.writeText(st.code).then(()=>showToast('📋 Código copiado!')).catch(()=>showToast(st.code)); }
    else showToast(st.code);
  };

  window.famEnviarCodigo = function(){
    const st = getState(); if(!st) return;
    const txt = 'Entra na nossa família no FinançasFácil 👨‍👩‍👧\nCódigo: ' + st.code;
    if(navigator.share){ navigator.share({ title:'FinançasFácil — Família', text: txt }).catch(()=>{}); }
    else if(navigator.clipboard){ navigator.clipboard.writeText(txt); showToast('📋 Copiado!'); }
  };

  // Chamado depois de cada lançamento salvo (no app.js)
  window.famSyncMeu = function(){ pushMeu().catch(()=>{}); };

  // ===== RENDER (injeta em #famPainel, substitui o antigo) =====
  function render(){
    const el = document.getElementById('famPainel');
    if(!el) return;
    const st = getState();

    if(!_cfgOk()){
      el.innerHTML = '<div style="margin:0 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:18px;font-size:13px;color:var(--text2);line-height:1.6">⚙️ <b style="color:var(--text)">Família quase pronta.</b> Falta colar a config do Firebase no topo do arquivo <b>familia.js</b> pra ativar a sincronização ao vivo.</div>';
      return;
    }

    if(!st || !st.code){
      const nomeAtual = (st && st.nome) || DB.getConfig().nome || '';
      el.innerHTML =
        '<div style="margin:0 14px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:18px">'+
          '<label style="display:block;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--text2);margin-bottom:7px">Seu nome</label>'+
          '<input id="famNome" class="inp" value="'+nomeAtual.replace(/"/g,'&quot;')+'" placeholder="Como você aparece pra família"/>'+
          '<button class="btnp full" style="margin-top:10px" onclick="famCriar()">+ Criar família</button>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:12px;margin:16px 14px;color:var(--text3);font-size:12px;font-weight:700"><div style="height:1px;flex:1;background:var(--border)"></div>ou entrar<div style="height:1px;flex:1;background:var(--border)"></div></div>'+
        '<div style="margin:0 14px 80px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:18px">'+
          '<label style="display:block;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--text2);margin-bottom:7px">Código da família</label>'+
          '<input id="famCodeIn" class="inp" placeholder="FAM-XXXX" style="text-transform:uppercase;font-family:var(--mono);letter-spacing:2px"/>'+
          '<button class="btnp full" style="margin-top:10px;background:var(--surface2);color:var(--text)" onclick="famEntrar()">Entrar com código</button>'+
        '</div>';
      return;
    }

    // Conectado
    const tot = _membros.reduce(function(s,m){ return s + (m.sobrou||0); }, 0);
    const cards = _membros.length ? _membros.map(function(m){
      const meu = _fb && m.uid === _fb.uid;
      return '<div class="fam-member-card-v2 '+(meu?'me':'other')+'" style="margin-bottom:11px">'+
        '<div class="fam-mv2-head">'+
          '<div class="fam-mv2-avatar" style="background:linear-gradient(135deg,#3ddc84,#22d3ee)">'+((m.nome||'?').charAt(0).toUpperCase())+'</div>'+
          '<div class="fam-mv2-info">'+
            '<div class="fam-mv2-name">'+(m.nome||'—')+'<span class="fam-mv2-badge '+(meu?'me':'other')+'">'+(meu?'Você':'Familiar')+'</span></div>'+
            '<div class="fam-mv2-sub">🟢 ao vivo</div>'+
          '</div>'+
        '</div>'+
        '<div class="fam-mv2-grid">'+
          '<div class="fam-mv2-box"><label>Entrou</label><span style="color:var(--green)">'+DB.fmtShort(m.entrou||0)+'</span></div>'+
          '<div class="fam-mv2-box"><label>Saiu</label><span style="color:var(--red)">'+DB.fmtShort(m.saiu||0)+'</span></div>'+
          '<div class="fam-mv2-box"><label>Sobrou</label><span style="color:'+((m.sobrou||0)>=0?'var(--green)':'var(--red)')+'">'+DB.fmtShort(m.sobrou||0)+'</span></div>'+
        '</div>'+
      '</div>';
    }).join('') : '<div style="text-align:center;color:var(--text3);font-size:13px;padding:20px">Aguardando membros…</div>';

    el.innerHTML =
      '<div style="margin:0 14px 14px;background:linear-gradient(135deg,#0e2233,#0a1626);border:1px solid var(--border2);border-radius:var(--r);padding:18px;text-align:center">'+
        '<div style="font-size:12px;color:var(--text2);font-weight:600;margin-bottom:8px">Código da família</div>'+
        '<div style="font-family:var(--mono);font-size:28px;font-weight:800;letter-spacing:4px;background:linear-gradient(135deg,#3ddc84,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px">'+st.code+'</div>'+
        '<div style="font-size:11px;color:var(--text3);margin-bottom:14px">Compartilhe com a família</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
          '<button class="btnp" style="background:var(--surface2);color:var(--text);padding:11px" onclick="famCopiarCodigo()">📋 Copiar</button>'+
          '<button class="btnp" style="padding:11px" onclick="famEnviarCodigo()">↗ Enviar</button>'+
        '</div>'+
      '</div>'+
      '<div class="fam-consolidated"><div class="fam-cons-row"><span class="fam-cons-lbl" style="font-weight:800">Saldo familiar do mês</span><span class="fam-cons-val" style="color:'+(tot>=0?'var(--green)':'var(--red)')+';font-size:20px">'+DB.fmt(tot)+'</span></div></div>'+
      '<div style="margin:0 14px 12px;background:var(--bg3);border:1px dashed var(--border2);border-radius:12px;padding:11px 13px;font-size:11.5px;color:var(--text2);line-height:1.5">🔒 Só os <b style="color:var(--text)">totais do mês</b> são compartilhados. Seus lançamentos ficam privados no aparelho.</div>'+
      '<div style="margin:0 14px 14px">'+cards+'</div>'+
      '<button onclick="famSair()" style="display:block;width:calc(100% - 28px);margin:0 14px 80px;background:none;border:none;color:var(--text3);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;padding:10px">Sair da família</button>';
  }

  // substitui o renderFamilia antigo e religa a escuta ao abrir o app
  window.renderFamilia = render;
  document.addEventListener('DOMContentLoaded', function(){
    const st = getState();
    if(st && st.code && window.FFReady){ window.FFReady.then(function(){ subscribe(st.code); pushMeu().catch(function(){}); }); }
  });
})();
