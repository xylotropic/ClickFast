// Local image evidence only. These helpers never select or dispatch an action.
export const normalizeVisualText=s=>String(s).normalize('NFC').toLocaleLowerCase('en-US').replace(/\s+/g,'');
export function validVisualRow(r){
 return r&&typeof r.text==='string'&&r.text.trim().length>0&&r.text.length<=2000&&
  ['confidence','x','y','width','height'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k]))&&
  r.confidence>=0&&r.confidence<=1&&r.x>=0&&r.y>=0&&r.width>0&&r.height>0&&r.x+r.width<=1.001&&r.y+r.height<=1.001;
}
export function matchingVisualRows(rows,label){
 const target=normalizeVisualText(label),found=[];
 for(const row of rows.filter(validVisualRow)){
  if(row.confidence<.8)continue;
  if(normalizeVisualText(row.text)===target){found.push(row);continue;}
  if(!Array.isArray(row.words)||row.words.length>100||row.words.some(w=>!validVisualRow(w)||w.confidence<.8))continue;
  for(let start=0;start<row.words.length;start++){
   let text='';
   for(let end=start;end<row.words.length;end++){
    text+=normalizeVisualText(row.words[end].text);
    if(!target.startsWith(text))break;
    if(text===target){
     const words=row.words.slice(start,end+1),x=Math.min(...words.map(w=>w.x)),y=Math.min(...words.map(w=>w.y));
     found.push({text:words.map(w=>w.text).join(' '),confidence:Math.min(row.confidence,...words.map(w=>w.confidence)),x,y,width:Math.max(...words.map(w=>w.x+w.width))-x,height:Math.max(...words.map(w=>w.y+w.height))-y});break;
    }
   }
  }
 }
 return found;
}
export function textMovement(before,after){
 const content=lines=>lines.filter(x=>x.confidence>=.5&&x.text.trim().length>=8&&1-x.y-x.height/2>.16&&1-x.y-x.height/2<.88).map(x=>[normalizeVisualText(x.text),1-x.y-x.height/2]);
 const a=content(before),b=content(after),unique=(rows,text)=>rows.filter(r=>r[0]===text).length===1;
 const shifts=a.filter(([text])=>unique(a,text)&&unique(b,text)).map(([text,y])=>({text,delta:b.find(r=>r[0]===text)[1]-y})).filter(r=>Math.abs(r.delta)>=.025);
 const coherent=shifts.find(anchor=>shifts.filter(r=>Math.sign(r.delta)===Math.sign(anchor.delta)&&Math.abs(r.delta-anchor.delta)<=.02).length>=2);
 return {before_rows:a.length,after_rows:b.length,moved_anchors:shifts.length,verified:Boolean(coherent),method:'At least two unique body-text anchors move together by at least 2.5% of the frame',...(!coherent?{reason:'No coherent text movement; changed video pixels or replaced text alone require visual review'}:{direction:coherent.delta>0?'down':'up'})};
}
