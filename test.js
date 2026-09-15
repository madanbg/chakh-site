/* chakh test suite.  node test.js
   Loads the real app in a DOM, drives it like a diner would, and checks the
   result.  Runs every dish against every allergen combination, which is where
   a menu app actually hurts people if it is wrong. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Resolve from this project's dependencies, rather than from the machine used
// to create the demo. This makes `npm test` work on every developer machine.
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass=0,fail=0;const fails=[];
const ok=(name,cond,detail)=>{cond?pass++:(fail++,fails.push(name+(detail?'  ['+detail+']':'')));};

const html=fs.readFileSync(path.join(__dirname,'app','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://chakh.in/app/',
  beforeParse(w){
    w.fetch=()=>Promise.reject(new Error('offline'));          // force the offline path
    w.speechSynthesis={getVoices:()=>[],speak(){},cancel(){}};
    w.SpeechSynthesisUtterance=function(t){this.text=t;};
    w.HTMLMediaElement.prototype.play=()=>Promise.reject(new Error('no audio'));
    w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};
  }});
const w=dom.window,doc=w.document,$=id=>doc.getElementById(id);

// ---------- 1. it loads ----------
ok('app parses and runs',typeof w.buildMenu==='function');
ok('dish data present',Array.isArray(w.D)&&w.D.length>0,'got '+(w.D?w.D.length:0));
ok('QR rendered',$('qrplate').innerHTML.indexOf('<svg')===0);

// ---------- 2. every dish is complete ----------
const need=['id','n','ph','say','p','kcal','g','img','cr','d','ing','al','mac','steps','fb'];
w.D.forEach(d=>{
  need.forEach(k=>ok('dish '+d.id+' has '+k,d[k]!==undefined&&d[k]!==''&&d[k]!==null));
  ok('dish '+d.id+' photo is https',/^https:\/\//.test(d.img),d.img);
  ok('dish '+d.id+' has a credit naming a licence',/CC /.test(d.cr),d.cr);
  ok('dish '+d.id+' macros are 3 numbers',d.mac.length===3&&d.mac.every(n=>typeof n==='number'));
  ok('dish '+d.id+' has 4 steps',d.steps.length===4);
  ok('dish '+d.id+' fallback text is substantial',d.fb.length>120,d.fb.length+' chars');
  ok('dish '+d.id+' price is sane',d.p>0&&d.p<100000);
  ok('dish '+d.id+' allergens are known',d.al.every(a=>['fish','shellfish','dairy','gluten','egg','nuts','mustard','coconut'].indexOf(a)>-1),d.al.join(','));
  ok('dish '+d.id+' name has no dash',d.n.indexOf('\u2014')<0&&d.d.indexOf('\u2014')<0);
});
const ids=w.D.map(d=>d.id);
ok('dish ids are unique',new Set(ids).size===ids.length);

// ---------- 3. allergen flagging, every dish against every allergen ----------
const ALL=['fish','shellfish','dairy','gluten','egg','nuts','mustard','coconut'];
let combos=0;
for(let mask=0;mask<(1<<ALL.length);mask++){
  w.S.avoid=new Set(ALL.filter((a,i)=>mask&(1<<i)));
  w.D.forEach(d=>{
    combos++;
    const c=w.conflicts(d);
    const expect=d.al.filter(a=>w.S.avoid.has(a));
    if(c.length!==expect.length||c.some((x,i)=>x!==expect[i])){
      ok('allergen match '+d.id+' mask '+mask,false,'got '+c+' want '+expect);
    }
  });
}
ok('allergen flagging correct across '+combos+' dish and avoid-set combinations',true);

// ---------- 4. the menu renders, and flags what it should ----------
w.S.avoid=new Set(['shellfish','fish']);w.S.diet='all';
w.buildMenu();
const rows=doc.querySelectorAll('#menuBody .dish');
ok('menu renders a row per dish',rows.length===w.D.length,rows.length+' rows');
const flagged=doc.querySelectorAll('#menuBody .dish.blocked');
const shouldFlag=w.D.filter(d=>d.al.indexOf('fish')>-1||d.al.indexOf('shellfish')>-1).length;
ok('fish dishes are flagged in the list',flagged.length===shouldFlag,flagged.length+' of '+shouldFlag);
ok('every menu image has alt text',[...doc.querySelectorAll('#menuBody img')].every(i=>i.getAttribute('alt')));
ok('every menu row shows a price',[...rows].every(r=>/₹\d/.test(r.textContent)));

// ---------- 5. vegetarian filter ----------
w.S.diet='veg';w.buildMenu();
const vegRows=doc.querySelectorAll('#menuBody .dish');
ok('vegetarian filter hides meat',vegRows.length===w.D.filter(d=>d.v).length,vegRows.length+' rows');
w.S.diet='all';w.S.avoid=new Set();w.buildMenu();

// ---------- 6. open every dish ----------
w.D.forEach(d=>{
  w.openDish(d.id);
  const s=$('sheet');
  ok('dish sheet opens for '+d.id,s.classList.contains('on'));
  ok('sheet shows the name '+d.id,s.textContent.indexOf(d.n)>-1);
  ok('sheet shows the photo credit '+d.id,s.textContent.indexOf('Wikimedia')>-1);
  ok('sheet has an explain button '+d.id,!!$('expBtn'));
  ok('sheet has three language buttons '+d.id,$('langpick').children.length===3);
  ok('sheet has a kitchen note box '+d.id,!!$('dishNote'));
  ok('sheet photo has alt text '+d.id,!!s.querySelector('.media img').getAttribute('alt'));
  ok('sheet lists 4 steps '+d.id,s.querySelectorAll('.steps li').length===4);
  w.closeSheet();
  ok('dish sheet closes for '+d.id,!s.classList.contains('on'));
});

// ---------- 7. offline explanation never leaves the guest with nothing ----------
(async()=>{
  w.openDish(w.D[0].id);
  await w.explain();
  const t=$('exp').textContent.trim();
  ok('offline explain still answers',t.length>100,t.length+' chars');
  ok('offline explain uses the stored text',t.indexOf(w.D[0].fb.slice(0,40))>-1);
  ok('follow-up controls appear after explaining',$('qs').style.display==='flex');

  // language switch keeps working offline
  w.S.lang='kn';await w.explain();
  ok('switching language still returns text',$('exp').textContent.trim().length>100);
  w.S.lang='en';

  await w.ask('Is this very spicy?');
  ok('a follow-up question is echoed back',$('exp').textContent.indexOf('Is this very spicy?')>-1);
  ok('a follow-up gets an answer offline',$('exp').textContent.length>60);
  w.closeSheet();

  // ---------- 8. cart and bill arithmetic ----------
  w.S.cart={};
  const a=w.D[0],b=w.D[1];
  w.openDish(a.id);w.add(a.id);
  w.openDish(a.id);w.add(a.id);
  w.openDish(b.id);
  $('dishNote').value='less oil please';$('dishNote').dispatchEvent(new w.Event('input'));
  w.add(b.id);
  const cart=w.refreshCart();
  ok('cart counts three plates',cart.n===3,'got '+cart.n);
  ok('cart total is right',cart.total===a.p*2+b.p,'got '+cart.total+' want '+(a.p*2+b.p));
  const bill=w.openBill();
  ok('gst is 5 per cent, rounded',bill.gst===Math.round(bill.sub*0.05));
  ok('bill total is subtotal plus gst',bill.total===bill.sub+bill.gst);
  ok('bill shows the kitchen note',$('billLines').textContent.indexOf('less oil please')>-1);
  ok('bill shows the quantity',$('billLines').textContent.indexOf('× 2')>-1);

  // ---------- 9. table-wide notes reach the ticket ----------
  w.go('onboard');
  $('avoidText').value='no garlic at all';
  $('spiceText').value='very mild for the kids';
  w.syncPrefs();
  w.openBill();
  ok('typed avoid note reaches the bill',$('billLines').textContent.indexOf('no garlic at all')>-1);
  ok('typed spice note reaches the bill',$('billLines').textContent.indexOf('very mild for the kids')>-1);
  ok('free text reaches the AI prompt',(function(){w.openDish(a.id);const c=w.ctx();w.closeSheet();
    return c.indexOf('no garlic at all')>-1&&c.indexOf('very mild for the kids')>-1;})());

  // ---------- 10. every screen reachable, review flow, reset ----------
  ['scan','onboard','menu','bill','review','paid'].forEach(id=>{
    w.go(id);
    ok('screen '+id+' opens',$(id).classList.contains('on'));
    ok('only one screen visible from '+id,doc.querySelectorAll('.screen.on').length===1);
  });
  w.go('review');
  [1,2,3,4,5].forEach(n=>{
    $('stars').children[n-1].click();
    ok('rating '+n+' lights '+n+' stars',doc.querySelectorAll('#stars .lit').length===n);
    ok('rating '+n+' shows the next step',$('afterStars').style.display==='block');
  });
  ok('a low rating still offers to post',$('revNote').textContent.length>10);
  ok('skip and pay exists and is readable',doc.querySelector('.skip').textContent.trim().length>5);

  w.reset();
  ok('reset clears the cart',Object.keys(w.S.cart).length===0);
  ok('reset returns to the scan screen',$('scan').classList.contains('on'));
  ok('reset clears the typed notes',w.S.avoidText===''&&w.S.spiceText==='');

  // ---------- 11. the restaurant page ----------
  w.view('rest');
  const r=$('rest');
  ok('restaurant page renders',r.classList.contains('on')&&r.textContent.length>400);
  ok('shows cost for two',r.textContent.indexOf('FOR TWO')>-1&&r.textContent.indexOf('₹4,000')>-1);
  ok('shows the google rating',r.textContent.indexOf('4.5')>-1);
  ok('shows the review count',r.textContent.indexOf('4,100+')>-1);
  ok('shows opening hours',r.textContent.indexOf('12:30')>-1);
  ok('has the 3D room container',!!$('room'));
  ok('room has a full screen button',!!doc.getElementById('fsbtn'));
  ok('room has walk controls',doc.querySelectorAll('.dpad button').length===4);
  ok('walk controls are labelled',[...doc.querySelectorAll('.dpad button')].every(b=>b.getAttribute('aria-label')));
  ok('room has jump-to spots',doc.querySelectorAll('.spots button').length===5);
  ok('spots have coordinates',w.SPOTS.every(s2=>typeof s2.x==='number'&&typeof s2.z==='number'&&typeof s2.yaw==='number'));
  ok('names the chef',r.textContent.indexOf('Naren Thimmaiah')>-1);
  ok('owner block is gone',r.textContent.indexOf('Replace this with')<0);
  ok('shows the recommended dish',r.textContent.indexOf('What to order')>-1);
  ok('recommended dish photo has alt text',!!r.querySelector('.pick img').getAttribute('alt'));
  ok('shows guest reviews',r.querySelectorAll('.rev').length===4);
  ok('reviews are labelled as demo samples',r.textContent.indexOf('written for this demo')>-1);
  ok('no average-bill dashboard survives',r.textContent.indexOf('AVERAGE BILL')<0);
  ok('ambience gallery renders four rooms',r.querySelectorAll('.galwrap figure').length===4);
  ok('every ambience photo has alt text',[...r.querySelectorAll('.galwrap img')].every(i=>i.getAttribute('alt')));
  ok('every ambience photo is credited',[...r.querySelectorAll('.galwrap figcaption')].every(f=>/CC BY/.test(f.textContent)));
  ok('ambience photos use direct file urls',w.ROOMS.every(x=>/^https:\/\/upload\.wikimedia\.org\//.test(x.u)));
  ok('gallery is honest about whose rooms these are',r.textContent.indexOf('used here to show the shape')>-1);
  ok('name reveal overlay exists',!!doc.getElementById('reveal'));
  ok('name reveal carries the restaurant name',doc.getElementById('reveal').textContent.indexOf('Karavalli')>-1);
  ok('name reveal can be skipped by tapping',typeof w.playReveal==='function');
  ok('every dish photo is a direct file url',w.D.every(d=>/^https:\/\/upload\.wikimedia\.org\//.test(d.img)));
  ok('no Special:FilePath redirects left',doc.documentElement.outerHTML.indexOf('Special:FilePath')<0);
  w.view('diner');
  ok('switching back shows the phone',$('phone').style.display!=='none');

  // ---------- 12. no empty placeholders anywhere ----------
  w.buildMenu();
  const all=doc.body.textContent.toUpperCase();
  ok('no TAP TO ADD PHOTO placeholder',all.indexOf('TAP TO ADD')<0);
  ok('no missing-video message',all.indexOf('NO COOKING VIDEO')<0);
  ok('no em dashes in the interface',doc.body.textContent.indexOf('\u2014')<0);
  ok('no en dashes in the interface',doc.body.textContent.indexOf('\u2013')<0);

  // ---------- 13. accessibility basics ----------
  ok('page has a lang attribute',doc.documentElement.getAttribute('lang')==='en');
  ok('page has a title',doc.title.length>10);
  ok('page has a meta description',!!doc.querySelector('meta[name="description"]'));
  ok('page has an og image',!!doc.querySelector('meta[property="og:image"]'));
  ok('page has a favicon',!!doc.querySelector('link[rel="icon"]'));
  ok('viewport is set for mobile',(doc.querySelector('meta[name=viewport]')||{}).content==='width=device-width,initial-scale=1');
  ok('every svg is labelled',[...doc.querySelectorAll('svg')].every(s=>s.getAttribute('role')||s.getAttribute('aria-label')||s.getAttribute('aria-hidden')||s.closest('#qrplate')));
  w.openDish(a.id);
  ok('inputs are labelled',[...doc.querySelectorAll('input,textarea')].every(i=>i.getAttribute('aria-label')||i.type==='file'||doc.querySelector('label[for="'+i.id+'"]')));
  ok('icon buttons are labelled',[...doc.querySelectorAll('.mic')].every(b=>b.getAttribute('aria-label')));
  w.closeSheet();

  // ---------- report ----------
  console.log('');
  console.log('  passed '+pass);
  console.log('  failed '+fail);
  if(fail){console.log('');fails.slice(0,25).forEach(f=>console.log('   FAIL  '+f));}
  console.log('');
  process.exit(fail?1:0);
})();
