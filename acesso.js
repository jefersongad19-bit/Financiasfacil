/* ═══════════════════════════════════════════════════════════════
   CONTROLE DE ACESSO — login e-mail/senha + trial 7 dias + allowed_users
   ───────────────────────────────────────────────────────────────
   Este módulo inicializa o Firebase (config única do app) e libera o
   restante do app só depois do login + verificação de acesso.
   O familia.js reaproveita esta mesma conexão via window.FFReady.
   ═══════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB2V9CtXXoeHJwF_GOLIqGhy8QW1e9751c",
  authDomain: "financasfacil-e0906.firebaseapp.com",
  projectId: "financasfacil-e0906",
  storageBucket: "financasfacil-e0906.firebasestorage.app",
  messagingSenderId: "1087421250808",
  appId: "1:1087421250808:web:b2fad002f43288d2ef4f0d"
};
const TRIAL_DIAS = 7;
const KIWIFY_URL = ""; // TODO: colar aqui o checkout do FinançasFácil quando a Kiwify estiver pronta

(function(){
  let _resolveReady;
  window.FFReady = new Promise(function(r){ _resolveReady = r; });
  let _fb = null;       // { app, auth, db, A:authMod, F:fsMod }
  let _modoCriar = false;

  // ───── Overlay (gate) ─────
  function injectGate(){
    if(document.getElementById('ffGate')) return;
    var d = document.createElement('div');
    d.id = 'ffGate';
    d.innerHTML =
      '<div class="ffg-card">'+
        // CHECK
        '<div class="ffg-scr" id="ffgCheck"><div class="ffg-spin"></div><p>Verificando acesso…</p></div>'+
        // LOGIN
        '<div class="ffg-scr" id="ffgLogin" style="display:none">'+
          '<div class="ffg-brand"><div class="ffg-logo"><svg width="38" height="38" viewBox="0 0 80 80"><path d="M24 48 Q40 22 56 48" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="40" cy="37" r="8" fill="white"/><rect x="27" y="55" width="26" height="5" rx="2.5" fill="white"/></svg></div><h1>FinançasFácil</h1><p id="ffgSub">Entre pra acessar suas finanças</p></div>'+
          '<input class="ffg-inp" id="ffEmail" type="email" placeholder="E-mail" autocomplete="email"/>'+
          '<input class="ffg-inp" id="ffSenha" type="password" placeholder="Senha" autocomplete="current-password"/>'+
          '<div id="ffgMsg" class="ffg-msg"></div>'+
          '<button class="ffg-btn ffg-g" id="ffBtn" onclick="ffEntrar()">Entrar</button>'+
          '<div class="ffg-links"><a id="ffLnkModo" onclick="ffToggleModo()">Criar conta</a><a onclick="ffEsqueci()">Esqueci a senha</a></div>'+
          '<div class="ffg-foot">Use o mesmo e-mail da sua compra</div>'+
        '</div>'+
        // BLOCK
        '<div class="ffg-scr" id="ffgBlock" style="display:none">'+
          '<div class="ffg-lock">🔒</div>'+
          '<h2 class="ffg-h2">Acesso ainda não liberado</h2>'+
          '<p class="ffg-lead">Não encontramos um acesso ativo pra <b id="ffgEmail"></b>. Garanta o seu e volte — a liberação é automática.</p>'+
          '<button class="ffg-btn ffg-g" onclick="ffComprar()">🛒 Quero o acesso</button>'+
          '<button class="ffg-btn ffg-s" onclick="ffReverificar()">Já paguei — verificar de novo</button>'+
          '<div class="ffg-links" style="justify-content:center"><a onclick="ffSair()">Sair / trocar e-mail</a></div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(d);
    injectCSS();
  }
  function injectCSS(){
    if(document.getElementById('ffGateCSS')) return;
    var s = document.createElement('style'); s.id='ffGateCSS';
    s.textContent =
      '#ffGate{position:fixed;inset:0;z-index:99999;background:var(--bg,#080e1a);display:flex;align-items:center;justify-content:center;padding:22px;font-family:var(--font,-apple-system,sans-serif)}'+
      '.ffg-card{width:100%;max-width:400px}'+
      '.ffg-scr{display:flex;flex-direction:column}'+
      '.ffg-brand{display:flex;flex-direction:column;align-items:center;gap:10px;margin:10px 0 24px}'+
      '.ffg-logo{width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,#3ddc84,#06b6d4);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(61,220,132,.35)}'+
      '.ffg-brand h1{font-size:22px;font-weight:800;background:linear-gradient(135deg,#3ddc84,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent}'+
      '.ffg-brand p{font-size:13px;color:var(--text3,#3d5a7a)}'+
      '.ffg-inp{width:100%;background:var(--bg3,#121e33);border:1px solid var(--border2,rgba(255,255,255,.12));border-radius:12px;padding:14px;color:var(--text,#eef4ff);font-family:inherit;font-size:15px;font-weight:600;outline:none;margin-bottom:11px}'+
      '.ffg-inp:focus{border-color:var(--cyan,#22d3ee)}'+
      '.ffg-btn{width:100%;border:none;border-radius:14px;padding:15px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;margin-top:7px}'+
      '.ffg-g{background:linear-gradient(135deg,#2bb56a,#22d3ee);color:#031018}'+
      '.ffg-s{background:var(--surface2,#1c2a45);border:1px solid var(--border2,rgba(255,255,255,.12));color:var(--text,#eef4ff)}'+
      '.ffg-links{display:flex;justify-content:space-between;margin-top:16px}'+
      '.ffg-links a{color:var(--cyan,#22d3ee);font-size:13px;font-weight:700;cursor:pointer}'+
      '.ffg-foot{text-align:center;font-size:11px;color:var(--text3,#3d5a7a);margin-top:22px}'+
      '.ffg-msg{font-size:13px;color:#ff6b6b;font-weight:600;min-height:18px;text-align:center;margin:2px 0}'+
      '.ffg-spin{width:46px;height:46px;border:4px solid var(--surface2,#1c2a45);border-top-color:#3ddc84;border-radius:50%;animation:ffgsp 1s linear infinite;margin:40px auto 18px}'+
      '@keyframes ffgsp{to{transform:rotate(360deg)}}'+
      '#ffgCheck{text-align:center}#ffgCheck p{color:var(--text2,#7a9bbf);font-weight:700}'+
      '.ffg-lock{width:78px;height:78px;border-radius:22px;background:var(--redb,rgba(255,107,107,.12));display:flex;align-items:center;justify-content:center;font-size:36px;margin:10px auto 0}'+
      '.ffg-h2{font-size:21px;font-weight:800;text-align:center;margin-top:16px;color:var(--text,#eef4ff)}'+
      '.ffg-lead{font-size:14px;color:var(--text2,#7a9bbf);text-align:center;margin:8px 0 20px;line-height:1.6}'+
      '.ffg-lead b{color:var(--text,#eef4ff)}'+
      '.ffg-trialbar{position:fixed;top:0;left:0;right:0;z-index:9000;background:linear-gradient(135deg,#2bb56a,#22d3ee);color:#031018;font-size:12.5px;font-weight:800;text-align:center;padding:7px 12px;display:flex;align-items:center;justify-content:center;gap:8px}'+
      '.ffg-trialbar button{background:rgba(3,16,24,.18);border:none;color:#031018;font-weight:800;font-size:11px;padding:3px 10px;border-radius:20px;cursor:pointer}';
    document.head.appendChild(s);
  }
  function tela(id){
    ['ffgCheck','ffgLogin','ffgBlock'].forEach(function(x){
      var el=document.getElementById(x); if(el) el.style.display = (x===id?'flex':'none');
    });
  }
  function ffMsg(m){ var el=document.getElementById('ffgMsg'); if(el) el.textContent=m||''; }
  function removeGate(){ var g=document.getElementById('ffGate'); if(g) g.remove(); }

  // ───── Firebase ─────
  async function initFb(){
    if(_fb) return _fb;
    var mods = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
    ]);
    var app = mods[0].initializeApp(FIREBASE_CONFIG);
    _fb = { app: app, auth: mods[1].getAuth(app), db: mods[2].getFirestore(app), A: mods[1], F: mods[2] };
    return _fb;
  }

  // ───── Verificação de acesso ─────
  async function verificar(user){
    var F = _fb.F, db = _fb.db;
    var email = (user.email||'').toLowerCase();
    // 1) Comprou? (allowed_users)
    try{
      var al = await F.getDoc(F.doc(db, 'allowed_users', email));
      if(al.exists()) return { ok:true, trial:false };
    }catch(e){ console.warn('[acesso] allowed_users', e); }
    // 2) Trial
    var inicio = null;
    try{
      var prof = await F.getDoc(F.doc(db, 'usuarios', user.uid));
      if(prof.exists() && prof.data().trialInicio){
        var t = prof.data().trialInicio;
        inicio = t.toMillis ? t.toMillis() : t;
      }
    }catch(e){ console.warn('[acesso] usuarios', e); }
    if(inicio == null){
      inicio = Date.now();
      try{ await F.setDoc(F.doc(db, 'usuarios', user.uid), { email: email, criadoEm: F.serverTimestamp(), trialInicio: F.serverTimestamp() }, { merge:true }); }catch(e){ console.warn('[acesso] criar perfil', e); }
    }
    var dias = Math.ceil((inicio + TRIAL_DIAS*86400000 - Date.now())/86400000);
    if(dias > 0) return { ok:true, trial:true, dias:dias };
    return { ok:false };
  }

  function liberar(user, info){
    _resolveReady({ app:_fb.app, auth:_fb.auth, db:_fb.db, api:_fb.F, uid:user.uid, email:(user.email||'').toLowerCase() });
    removeGate();
    if(info.trial) bannerTrial(info.dias);
  }
  function bannerTrial(dias){
    if(document.getElementById('ffTrialBar')) return;
    var b = document.createElement('div'); b.id='ffTrialBar'; b.className='ffg-trialbar';
    b.innerHTML = '🎁 Teste grátis — falta'+(dias===1?'':'m')+' '+dias+' dia'+(dias===1?'':'s')+' <button onclick="ffComprar()">Assinar</button>';
    document.body.appendChild(b);
  }

  // ───── API pública (botões) ─────
  window.ffToggleModo = function(){
    _modoCriar = !_modoCriar;
    var sub=document.getElementById('ffgSub'), btn=document.getElementById('ffBtn'), lnk=document.getElementById('ffLnkModo');
    if(sub) sub.textContent = _modoCriar ? 'Crie sua conta — 7 dias grátis' : 'Entre pra acessar suas finanças';
    if(btn) btn.textContent = _modoCriar ? 'Criar conta' : 'Entrar';
    if(lnk) lnk.textContent = _modoCriar ? 'Já tenho conta' : 'Criar conta';
    ffMsg('');
  };
  window.ffEntrar = async function(){
    var email = (document.getElementById('ffEmail').value||'').trim().toLowerCase();
    var senha = document.getElementById('ffSenha').value||'';
    if(!email || !senha){ ffMsg('Preencha e-mail e senha'); return; }
    if(senha.length < 6){ ffMsg('A senha precisa de ao menos 6 caracteres'); return; }
    ffMsg(''); tela('ffgCheck');
    try{
      if(_modoCriar) await _fb.A.createUserWithEmailAndPassword(_fb.auth, email, senha);
      else await _fb.A.signInWithEmailAndPassword(_fb.auth, email, senha);
      // onAuthStateChanged cuida do resto
    }catch(e){ tela('ffgLogin'); ffMsg(traduzErro(e)); }
  };
  window.ffEsqueci = async function(){
    var email = (document.getElementById('ffEmail').value||'').trim().toLowerCase();
    if(!email){ ffMsg('Digite o e-mail primeiro'); return; }
    try{ await _fb.A.sendPasswordResetEmail(_fb.auth, email); ffMsg('Link de redefinição enviado ✓'); }
    catch(e){ ffMsg(traduzErro(e)); }
  };
  window.ffSair = async function(){ try{ await _fb.A.signOut(_fb.auth); }catch(e){} tela('ffgLogin'); ffMsg(''); };
  window.ffReverificar = async function(){
    var u = _fb.auth.currentUser; if(!u){ tela('ffgLogin'); return; }
    tela('ffgCheck');
    var info = await verificar(u);
    if(info.ok) liberar(u, info); else { tela('ffgBlock'); var el=document.getElementById('ffgEmail'); if(el) el.textContent=(u.email||''); }
  };
  window.ffComprar = function(){
    if(KIWIFY_URL) window.open(KIWIFY_URL, '_blank');
    else alert('Checkout em breve! (link da Kiwify ainda não configurado)');
  };

  function traduzErro(e){
    var c = (e && e.code) || '';
    if(c.indexOf('invalid-credential')>=0 || c.indexOf('wrong-password')>=0) return 'E-mail ou senha incorretos';
    if(c.indexOf('user-not-found')>=0) return 'Conta não encontrada — toque em "Criar conta"';
    if(c.indexOf('email-already-in-use')>=0) return 'E-mail já cadastrado — faça login';
    if(c.indexOf('weak-password')>=0) return 'Senha muito fraca (mín. 6 caracteres)';
    if(c.indexOf('invalid-email')>=0) return 'E-mail inválido';
    if(c.indexOf('too-many-requests')>=0) return 'Muitas tentativas — aguarde um pouco';
    if(c.indexOf('network')>=0) return 'Sem conexão — tente de novo';
    return 'Erro: ' + (c || 'tente novamente');
  }

  // ───── Boot ─────
  function start(){
    injectGate(); tela('ffgCheck');
    initFb().then(function(fb){
      fb.A.onAuthStateChanged(fb.auth, async function(user){
        if(!user){ tela('ffgLogin'); return; }
        tela('ffgCheck');
        var info = await verificar(user);
        if(info.ok){ liberar(user, info); }
        else { tela('ffgBlock'); var el=document.getElementById('ffgEmail'); if(el) el.textContent=(user.email||''); }
      });
    }).catch(function(e){
      console.error('[acesso] Firebase falhou', e);
      injectGate(); tela('ffgLogin'); ffMsg('Falha ao conectar — recarregue a página');
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
