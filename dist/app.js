'use strict';
const SUPABASE_URL = 'https://snhsevubbpepvzzvfday.supabase.co';
const SUPABASE_KEY = 'sb_publishable_srwmi7QNCUT-UGTsrdSGWA_tEpE692K';
const TABLE = 'knihio_books';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const statusLabels = {unread:'Nepřečtená', reading:'Právě čtu', read:'Přečtená', wishlist:'Chci si přečíst'};
const colors = ['#82715c','#a3795a','#727b65','#8e6960','#566f76','#af9367'];
let session = null, books = [], filter = 'all', editingId = null, authMode = 'login', dbReady = false, authReady = false;
let refreshPromise, toastTimer, lookupController, lookupSequence = 0, loadSequence = 0;
let detailId = null, detailBusy = false;
function readStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function store(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { throw new Error('Prohlížeč nemůže uložit data. Povolte místní úložiště nebo uvolněte místo.'); } }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safeURL(value) { try { const u=new URL(value); return u.protocol==='https:' ? u.href : ''; } catch { return ''; } }
function toast(message) { $('#toast').textContent=message; $('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',5000); }
function notice(message,error=false) { $('#connection-note').textContent=message;$('#connection-note').classList.toggle('error',error); }
function messageFor(error) {
  if (error.name==='AbortError' || error.name==='TimeoutError') return 'Požadavek trval příliš dlouho. Zkuste to prosím znovu.';
  if (error instanceof TypeError) return 'Spojení se nezdařilo. Zkontrolujte připojení k internetu.';
  const m=error.message||String(error);
  if (/Invalid login credentials/i.test(m)) return 'Nesprávný e-mail nebo heslo.';
  if (/Email not confirmed/i.test(m)) return 'Nejprve potvrďte svůj e-mail odkazem ze zprávy.';
  if (/rate limit|too many/i.test(m)) return 'Příliš mnoho pokusů. Počkejte chvíli a zkuste to znovu.';
  if (/PGRST205|relation .* does not exist|schema cache|permission denied/i.test(m)) return 'Databáze knih ještě není připravena. Spusťte setup.sql v Supabase SQL Editoru (odkaz v O Knihio).';
  if (/PGRST204|column .* does not exist|Could not find the .* column/i.test(m)) return 'Databáze potřebuje aktualizaci pro detail knihy. V Supabase SQL Editoru spusťte detail-migration.sql z balíčku aplikace.';
  return m;
}
async function request(path,{method='GET',body,token,prefer}={}) {
  const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json'};
  if(token) headers.Authorization='Bearer '+token;
  if(prefer) headers.Prefer=prefer;
  const response=await fetch(SUPABASE_URL+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const raw=await response.text(); let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
  if(!response.ok) {const error=new Error(data?.msg||data?.error_description||data?.message||'Služba není dostupná ('+response.status+').');error.status=response.status;throw error;}
  return data;
}
async function accessToken() {
  if(!session) throw new Error('Přihlaste se prosím znovu.');
  if((session.expires_at||0)*1000>Date.now()+60000) return session.access_token;
  if(!refreshPromise) refreshPromise=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}}).then(data=>{setSession(data);return data.access_token;}).finally(()=>refreshPromise=null);
  return refreshPromise;
}
function setSession(data) { const next={...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600)};store('knihio-session',next);session=next; }
async function db(path='',options={}) {return request('/rest/v1/'+TABLE+path,{...options,token:await accessToken()});}
function updateAccount() {
  $('#login-btn').textContent=session?'Odhlásit se ↗':'Přihlásit se ↗';
  const email=session?.user?.email;
  $('#user-name').textContent=email?.split('@')[0]||'Vaše knihovna';
  $('#user-detail').textContent=session?'Účet Supabase':'Místní ukázka';
  $('#avatar').textContent=(email||'K')[0].toUpperCase();
  $('#account-btn').setAttribute('aria-label',session?'Odhlásit se':'Přihlásit se');
}
async function loadBooks() {
  const sequence=++loadSequence;
  dbReady=false;
  if(!session){books=readStored('knihio-local-books',[]);notice('Knihy se ukládají do tohoto prohlížeče. Přihlaste se pro vlastní knihovnu dostupnou na více zařízeních.');}
  else {
    books=[];render();notice('Načítám vaši knihovnu…');
    try { const loaded=await db('?select=*&order=created_at.desc');if(sequence!==loadSequence)return;books=loaded;dbReady=true;notice('Vaše knihovna se bezpečně ukládá do vašeho účtu.');showImportAction(); }
    catch(error){if(sequence!==loadSequence)return;notice(messageFor(error),true);const help=document.createElement('button');help.className='button outline';help.textContent='Nastavení a nápověda';help.onclick=()=>$('#info-dialog').showModal();$('#connection-note').append(' ',help);}
  }
  render();updateAccount();syncDetailRoute();
}
function showImportAction() {
  if(!readStored('knihio-local-books',[]).length)return;
  notice('V tomto prohlížeči máte také místní knihy. Můžete je přidat do přihlášeného účtu.');
  const button=document.createElement('button');button.className='button outline';button.textContent='Importovat místní knihy';button.style.marginLeft='12px';
  button.onclick=async()=>{button.disabled=true;try{
    const local=readStored('knihio-local-books',[]);let count=0;
    for(const item of local){const {id,user_id,created_at,updated_at,...rest}=item;if(books.some(b=>b.id===id||(rest.isbn&&b.isbn===rest.isbn)))continue;const rows=await db('',{method:'POST',body:{...rest,id,user_id:session.user.id},prefer:'return=representation'});books.push(rows[0]);count++;}
    localStorage.removeItem('knihio-local-books');notice('Místní knihy byly převedeny do účtu.');render();toast('Importováno knih: '+count);
  }catch(error){toast(messageFor(error));button.disabled=false;}};
  $('#connection-note').append(button);
}
function render() {
  $('#stat-all').textContent=books.length;$('#nav-count').textContent=books.length;
  for(const s of ['reading','read','wishlist']) $('#stat-'+s).textContent=books.filter(b=>b.status===s).length;
  const q=$('#search').value.trim().toLocaleLowerCase('cs');
  let visible=books.filter(b=>(filter==='all'||b.status===filter)&&[b.title,b.author,b.illustrator,b.isbn,b.genre].some(v=>String(v||'').toLocaleLowerCase('cs').includes(q)));
  const sort=$('#sort').value;
  visible.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title,'cs'):sort==='author'?(a.author||'').localeCompare(b.author||'','cs'):sort==='rating'?(b.rating||0)-(a.rating||0):new Date(b.created_at)-new Date(a.created_at));
  $('#heading-count').textContent=visible.length;$('#empty').hidden=visible.length>0;
  $('#empty h3').textContent=q||filter!=='all'?'Na této poličce je zatím ticho.':'Tady začíná váš další příběh.';
  $('#empty p').textContent=q?'Zkuste jiné hledání nebo jiný filtr.':'Přidejte knihu pomocí ISBN nebo vyplňte její údaje ručně.';
  $('#books').innerHTML=visible.map(b=>{const cover=safeURL(b.cover_url);const color=colors[[...b.title].reduce((s,c)=>s+c.charCodeAt(0),0)%colors.length];return `<button class="book-card" data-book="${escapeHTML(b.id)}" aria-label="Otevřít knihu ${escapeHTML(b.title)}"><div class="cover"><div class="cover-fallback" style="--book-color:${color}" ${cover?'hidden':''}><small>${escapeHTML(b.author||'Moje knihovna')}</small><b>${escapeHTML(b.title)}</b><span>✧</span></div>${cover?`<img src="${escapeHTML(cover)}" alt="Obálka: ${escapeHTML(b.title)}" loading="lazy" referrerpolicy="no-referrer">`:''}<span class="card-status">${statusLabels[b.status]||statusLabels.unread}${b.owned?' · Vlastním':''}</span></div><h3>${escapeHTML(b.title)}</h3><p>${escapeHTML(b.author||'Autor neuveden')}</p><div class="rating" aria-label="Hodnocení ${Number(b.rating)||0} z 5">${'★'.repeat(Math.min(5,Math.max(0,Number(b.rating)||0)))}</div></button>`;}).join('');
  $$('#books img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;img.previousElementSibling.hidden=false;},{once:true}));
  $$('#books [data-book]').forEach(button=>button.onclick=()=>showBookDetail(button.dataset.book));
  $$('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter===filter));
  $$('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===filter));
  if(detailId){if(books.some(b=>b.id===detailId))showBookDetail(detailId,false);else closeBookDetail(false);}
}
function setFilter(value) {if(detailId)closeBookDetail();filter=value;$('#library-title').firstChild.textContent=({all:'Moje knihovna',reading:'Právě čtu',read:'Přečtené knihy',wishlist:'Chci si přečíst',unread:'Nepřečtené knihy'})[value]+' ';render();}
function personMarkup(name,bio,photo,role) {
  const url=safeURL(photo), initials=(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('');
  return `<section class="detail-person"><div class="person-picture"><span ${url?'hidden':''}>${escapeHTML(initials)}</span>${url?`<img src="${escapeHTML(url)}" alt="${escapeHTML(name)}" referrerpolicy="no-referrer">`:''}</div><div><div class="eyebrow">${role}</div><h2>${escapeHTML(name||'Neuvedeno')}</h2><p>${escapeHTML(bio||(name?'Informace můžete doplnit v úpravách knihy.':'Údaje zatím nejsou vyplněné.'))}</p></div></section>`;
}
function showBookDetail(id, navigate=true) {
  const b=books.find(item=>item.id===id);if(!b){closeBookDetail(false);return;}
  detailId=id;const cover=safeURL(b.cover_url), publisherLogo=safeURL(b.publisher_logo_url), rating=Math.min(5,Math.max(0,Number(b.rating)||0));
  $('.content').hidden=true;$('#book-detail').hidden=false;
  $('#book-detail').innerHTML=`<div class="detail-navigation"><button class="plain" id="detail-back">← Zpět do knihovny</button><button class="button outline" id="detail-edit">✎ Upravit knihu</button></div><article><header class="detail-hero"><div class="detail-hero-wave"></div><div class="eyebrow">PŘÍBĚH Z VAŠÍ POLIČKY</div><h1>${escapeHTML(b.title)}</h1><div class="detail-cover"><div class="cover-fallback" ${cover?'hidden':''}><small>${escapeHTML(b.author||'Knihio')}</small><b>${escapeHTML(b.title)}</b><span>✧</span></div>${cover?`<img src="${escapeHTML(cover)}" alt="Obálka knihy ${escapeHTML(b.title)}" referrerpolicy="no-referrer">`:''}</div><div class="publisher-badge">${publisherLogo?`<img src="${escapeHTML(publisherLogo)}" alt="Logo nakladatelství ${escapeHTML(b.publisher)}" referrerpolicy="no-referrer">`:''}<div><small>NAKLADATELSTVÍ</small><strong>${escapeHTML(b.publisher||'Neuvedeno')}</strong></div></div></header><div class="detail-body">${personMarkup(b.author,b.author_bio,b.author_photo_url,'AUTOR / AUTOŘI')}${personMarkup(b.illustrator,b.illustrator_bio,b.illustrator_photo_url,'ILUSTRÁTOR / ILUSTRÁTOŘI')}<section class="detail-rating" aria-label="Moje hodnocení ${rating} z 5"><div><div class="eyebrow">MOJE HODNOCENÍ</div><strong>${rating?rating.toFixed(1).replace('.',','):'—'}<small>/ 5</small></strong></div><div><span class="detail-stars" aria-hidden="true">${'★'.repeat(rating)}<span>${'☆'.repeat(5-rating)}</span></span><p>${rating?'Každý příběh zanechá svůj dojem.':'Knihu zatím nemáte ohodnocenou.'}</p></div></section><div class="detail-actions"><button class="button dark" id="detail-owned" ${b.owned?'disabled':''}>${b.owned?'✓ Mám ve své knihovně':'＋ Přidat do mé knihovny'}</button><button class="button outline" id="detail-read">${b.status==='read'?'↺ Označit jako nepřečtené':'✓ Označit jako přečtené'}</button></div><p id="detail-error" class="error" role="alert"></p><div class="detail-facts">${[['ISBN',b.isbn],['ROK VYDÁNÍ',b.year],['POČET STRAN',b.pages],['JAZYK',b.language],['ŽÁNR',b.genre],['STAV ČTENÍ',statusLabels[b.status]]].filter(([,v])=>v).map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHTML(v)}</dd></div>`).join('')}</div>${b.description?`<section class="detail-text"><h2>O knize</h2><p>${escapeHTML(b.description)}</p></section>`:''}${b.notes?`<section class="detail-text detail-notes"><div class="eyebrow">JEN PRO VÁS</div><h2>Moje poznámky</h2><p>${escapeHTML(b.notes)}</p></section>`:''}</div></article>`;
  $('#detail-back').onclick=()=>closeBookDetail();$('#detail-edit').onclick=()=>openBook(id);
  $('#detail-owned').onclick=()=>updateBookDetail({owned:true});
  $('#detail-read').onclick=()=>updateBookDetail({status:b.status==='read'?'unread':'read'});
  $$('#book-detail .person-picture img, #book-detail .detail-cover img').forEach(img=>img.onerror=()=>{img.hidden=true;img.previousElementSibling.hidden=false;});
  $$('#book-detail .publisher-badge img').forEach(img=>img.onerror=()=>{img.hidden=true;});
  if(navigate){history.pushState(null,'','#kniha='+encodeURIComponent(id));window.scrollTo({top:0,behavior:'instant'});$('#book-detail').focus({preventScroll:true});}
}
function closeBookDetail(navigate=true){detailId=null;$('#book-detail').hidden=true;$('.content').hidden=false;if(navigate){history.pushState(null,'',location.pathname+location.search);window.scrollTo({top:0,behavior:'instant'});}}
function syncDetailRoute(){const id=new URLSearchParams(location.hash.slice(1)).get('kniha');if(id)showBookDetail(id,false);else closeBookDetail(false);}
window.addEventListener('popstate',syncDetailRoute);
async function updateBookDetail(changes){
  if(detailBusy||!detailId)return;const id=detailId;const book=books.find(b=>b.id===id);if(!book)return;
  detailBusy=true;$('#detail-error').textContent='';$$('.detail-actions button').forEach(b=>b.disabled=true);
  try{const patch={...changes,updated_at:new Date().toISOString()};let saved={...book,...patch};if(session){const rows=await db('?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:patch,prefer:'return=representation'});if(!rows?.length)throw new Error('Změnu se nepodařilo uložit.');saved=rows[0];}const next=books.map(b=>b.id===id?saved:b);if(!session)store('knihio-local-books',next);books=next;render();if(detailId===id)showBookDetail(id,false);toast(changes.owned?'Kniha je ve vaší knihovně.':changes.status==='read'?'Další příběh dočtený.':'Kniha označena jako nepřečtená.');}
  catch(error){if(detailId===id){$('#detail-error').textContent=messageFor(error);$('#detail-owned').disabled=book.owned;$('#detail-read').disabled=false;}}
  finally{detailBusy=false;}
}
function openBook(id=null) {
  if(!authReady){toast('Dokončuji připojení…');return;}
  if(session&&!dbReady){toast('Nejprve připravte databázi podle odkazu O Knihio.');return;}
  lookupSequence++;lookupController?.abort();
  editingId=id;$('#book-form').reset();$('#lookup-isbn').value='';$('#lookup-status').textContent='Open Library · Google Books';$('#lookup-btn').disabled=false;$('#book-error').textContent='';
  $('#book-dialog-title').textContent=id?'Upravit knihu':'Přidat knihu';$('#delete-btn').hidden=!id;
  if(id){const b=books.find(b=>b.id===id);for(const [key,value] of Object.entries(b)){const field=$('#book-form').elements.namedItem(key);if(field)field.type==='checkbox'?field.checked=Boolean(value):field.value=value??'';}}
  $('#book-dialog').showModal();
}
function normalizeISBN(value){return value.replace(/[\s-]/g,'').toUpperCase();}
function validISBN(value){if(/^\d{13}$/.test(value))return [...value].reduce((sum,c,i)=>sum+Number(c)*(i%2?3:1),0)%10===0;if(/^\d{9}[\dX]$/.test(value))return [...value].reduce((sum,c,i)=>sum+(c==='X'?10:Number(c))*(10-i),0)%11===0;return false;}
async function fetchJSON(url,signal){const r=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});if(!r.ok)throw new Error('Katalog dočasně neodpovídá.');return r.json();}
async function lookupISBN(){
  const isbn=normalizeISBN($('#lookup-isbn').value);if(!validISBN(isbn)){$('#lookup-status').textContent='Zadejte platné ISBN-10 nebo ISBN-13 (včetně kontrolní číslice).';return;}
  lookupController?.abort();lookupController=new AbortController();const signal=lookupController.signal;const sequence=++lookupSequence;
  $('#lookup-btn').disabled=true;$('#lookup-status').textContent='Hledám v Open Library…';let found=null,source='',failed=false;
  try {
    try {const data=await fetchJSON('https://openlibrary.org/api/books?bibkeys=ISBN:'+isbn+'&format=json&jscmd=data',signal);const b=data['ISBN:'+isbn];if(b){found={title:b.title,author:(b.authors||[]).map(a=>a.name).join(', '),illustrator:(b.contributors||[]).filter(c=>/illustrat|ilustr/i.test(c.role||'')).map(c=>c.name).join(', '),publisher:(b.publishers||[]).map(p=>p.name).join(', '),year:b.publish_date,pages:b.number_of_pages,genre:(b.subjects||[]).slice(0,3).map(s=>s.name).join(', '),cover_url:b.cover?.large||b.cover?.medium||'',description:b.subtitle||''};source='Open Library';}}catch(e){if(signal.aborted)return;failed=true;}
    if(!found){if(sequence!==lookupSequence)return;$('#lookup-status').textContent='Hledám v Google Books…';try{const data=await fetchJSON('https://www.googleapis.com/books/v1/volumes?q=isbn:'+isbn+'&maxResults=5',signal);const b=data.items?.map(v=>v.volumeInfo).find(v=>(v.industryIdentifiers||[]).some(i=>normalizeISBN(i.identifier)===isbn));if(b){found={title:b.title,author:(b.authors||[]).join(', '),publisher:b.publisher,year:b.publishedDate,pages:b.pageCount,language:b.language,genre:(b.categories||[]).join(', '),cover_url:(b.imageLinks?.thumbnail||'').replace(/^http:/,'https:'),description:(b.description||'').replace(/<[^>]*>/g,'')};source='Google Books';}}catch(e){if(signal.aborted)return;failed=true;}}
    if(sequence!==lookupSequence)return;
    const form=$('#book-form');form.elements.isbn.value=isbn;
    if(found){for(const [key,value] of Object.entries(found))if(value)form.elements.namedItem(key).value=value;$('#lookup-status').textContent='Nalezeno v '+source+'. Zkontrolujte údaje a doplňte případně ilustrátora.';}
    else $('#lookup-status').textContent=failed?'Některý katalog není dostupný. Zkuste to později nebo údaje vyplňte ručně.':'Toto vydání se nepodařilo najít. ISBN jsme vyplnili, další údaje můžete doplnit ručně.';
  }finally{if(sequence===lookupSequence)$('#lookup-btn').disabled=false;}
}
$('#book-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget;$('#book-error').textContent='';const data=Object.fromEntries(new FormData(form));
  for(const key of Object.keys(data))if(typeof data[key]==='string')data[key]=data[key].trim();
  if(!data.title){$('#book-error').textContent='Vyplňte název knihy.';return;}
  data.isbn=normalizeISBN(data.isbn);if(data.isbn&&!validISBN(data.isbn)){$('#book-error').textContent='ISBN nemá správný formát nebo kontrolní číslici.';return;}
  if(data.cover_url&&!safeURL(data.cover_url)){$('#book-error').textContent='URL obálky musí začínat https://.';return;}
  for(const key of ['author_photo_url','illustrator_photo_url','publisher_logo_url'])if(data[key]&&!safeURL(data[key])){$('#book-error').textContent='Adresy fotografií a loga musí začínat https://.';return;}
  if(data.isbn&&books.some(b=>b.isbn===data.isbn&&b.id!==editingId)){$('#book-error').textContent='Knihu s tímto ISBN už v knihovně máte.';return;}
  data.owned=form.elements.owned.checked;data.pages=data.pages?Number(data.pages):null;data.rating=Number(data.rating);data.updated_at=new Date().toISOString();$('#save-btn').disabled=true;
  try{let next;
    if(session){const rows=await db(editingId?'?id=eq.'+encodeURIComponent(editingId):'',{method:editingId?'PATCH':'POST',body:{...data,user_id:session.user.id},prefer:'return=representation'});if(!rows?.length)throw new Error('Knihu se nepodařilo uložit. Obnovte knihovnu.');next=rows[0];}
    else next={...data,id:editingId||crypto.randomUUID(),created_at:editingId?books.find(b=>b.id===editingId).created_at:new Date().toISOString()};
    const nextBooks=editingId?books.map(b=>b.id===editingId?next:b):[next,...books];if(!session)store('knihio-local-books',nextBooks);books=nextBooks;render();$('#book-dialog').close();toast(editingId?'Změny uloženy.':'Kniha má své místo na poličce.');
  }catch(error){$('#book-error').textContent=messageFor(error);}finally{$('#save-btn').disabled=false;}
};
$('#delete-btn').onclick=async()=>{if(!editingId||!confirm('Opravdu smazat tuto knihu z vaší knihovny?'))return;$('#delete-btn').disabled=true;try{if(session){const rows=await db('?id=eq.'+encodeURIComponent(editingId),{method:'DELETE',prefer:'return=representation'});if(!rows?.length)throw new Error('Kniha nebyla smazána. Obnovte knihovnu.');}const next=books.filter(b=>b.id!==editingId);if(!session)store('knihio-local-books',next);books=next;render();$('#book-dialog').close();toast('Kniha byla odstraněna.');}catch(error){$('#book-error').textContent=messageFor(error);}finally{$('#delete-btn').disabled=false;}};
function configureAuth(mode='login') {authMode=mode;const recovery=mode==='recovery';$('#auth-title').textContent=recovery?'Nové heslo':mode==='signup'?'Vytvořit účet':'Přihlášení';$('#auth-submit').textContent=recovery?'Uložit nové heslo':mode==='signup'?'Zaregistrovat se':'Přihlásit se';$('#auth-toggle').textContent=mode==='signup'?'Máte účet? Přihlásit se':'Nemáte účet? Zaregistrovat se';$('#auth-toggle').hidden=recovery;$('#forgot-btn').hidden=recovery;$('#auth-form').elements.email.parentElement.hidden=recovery;$('#auth-form').elements.email.required=!recovery;$('#auth-form').elements.password.autocomplete=mode==='login'?'current-password':'new-password';$('#auth-message').textContent='';}
async function account(){if(!authReady)return;if(session){try{await request('/auth/v1/logout',{method:'POST',token:await accessToken()});}catch{}session=null;localStorage.removeItem('knihio-session');await loadBooks();}else{configureAuth();$('#auth-dialog').showModal();}}
$('#auth-toggle').onclick=()=>configureAuth(authMode==='login'?'signup':'login');
$('#auth-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;const email=form.elements.email.value.trim();const password=form.elements.password.value;$('#auth-submit').disabled=true;$('#auth-message').textContent='Připojuji…';try{
  if(authMode==='recovery'){await request('/auth/v1/user',{method:'PUT',token:await accessToken(),body:{password}});$('#auth-dialog').close();toast('Nové heslo bylo uloženo.');return;}
  const data=await request(authMode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  if(data.access_token){setSession(data);$('#auth-dialog').close();form.reset();await loadBooks();toast('Vítejte ve své knihovně.');}
  else{$('#auth-message').textContent='Pokud lze účet vytvořit, přijde vám potvrzovací e-mail. Otevřete odkaz a potom se přihlaste.';}
}catch(error){$('#auth-message').textContent=messageFor(error);}finally{$('#auth-submit').disabled=false;}};
$('#forgot-btn').onclick=async()=>{const email=$('#auth-form').elements.email;if(!email.value||!email.checkValidity()){email.reportValidity();return;}$('#forgot-btn').disabled=true;try{await request('/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{method:'POST',body:{email:email.value.trim()}});$('#auth-message').textContent='Pokud účet existuje, dorazí vám e-mail pro obnovení hesla.';}catch(error){$('#auth-message').textContent=messageFor(error);}finally{$('#forgot-btn').disabled=false;}};
for(const id of ['hero-add','add-btn','empty-add'])$('#'+id).onclick=()=>openBook();
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#book-dialog').addEventListener('close',()=>{lookupSequence++;lookupController?.abort();});
$$('[data-filter]').forEach(b=>b.onclick=()=>setFilter(b.dataset.filter));$$('[data-nav]').forEach(b=>b.onclick=()=>setFilter(b.dataset.nav));
$('#search').oninput=render;$('#sort').onchange=render;$('#lookup-btn').onclick=lookupISBN;
$('#lookup-isbn').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();lookupISBN();}};
$('#grid-view').onclick=()=>{$('#books').classList.remove('list');$('#grid-view').classList.add('selected');$('#list-view').classList.remove('selected');};
$('#list-view').onclick=()=>{$('#books').classList.add('list');$('#list-view').classList.add('selected');$('#grid-view').classList.remove('selected');};
$('#login-btn').onclick=account;$('#account-btn').onclick=account;$('#sources-btn').onclick=()=>$('#info-dialog').showModal();
const footerInfo=document.createElement('button');footerInfo.className='plain';footerInfo.textContent='O Knihio a nastavení';footerInfo.onclick=()=>$('#info-dialog').showModal();$('footer').append(footerInfo);
$('#export-btn').onclick=()=>{const blob=new Blob([JSON.stringify({application:'Knihio',exported_at:new Date().toISOString(),books},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='knihio-knihovna.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('storage',event=>{if(event.key==='knihio-local-books'&&!session){books=readStored(event.key,[]);render();}if(event.key==='knihio-session'){session=readStored('knihio-session',null);loadBooks();}});
async function init(){
  session=readStored('knihio-session',null);updateAccount();
  const hash=new URLSearchParams(location.hash.slice(1));let recovery=false;
  if(hash.get('access_token')){try{const user=await request('/auth/v1/user',{token:hash.get('access_token')});setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in'))||3600,user});recovery=hash.get('type')==='recovery';}catch(e){toast(messageFor(e));}history.replaceState(null,'',location.pathname+location.search);}
  if(hash.get('error_description')){toast(hash.get('error_description'));history.replaceState(null,'',location.pathname+location.search);}
  authReady=true;await loadBooks();if(recovery){configureAuth('recovery');$('#auth-dialog').showModal();}
}
init();
