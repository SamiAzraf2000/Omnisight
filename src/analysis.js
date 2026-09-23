import Papa from 'papaparse';

export const taskNames = ['Clean Data','Visualize Data','Plot Results','Check Statistics','Intelligence Brief'];
export async function readDataset(file) {
  if(file.size>20*1024*1024) throw new Error('Please choose a dataset smaller than 20 MB.');
  const ext=file.name.split('.').pop().toLowerCase();
  let rows;
  if(ext==='csv') {
    const p=Papa.parse(await file.text(),{header:true,skipEmptyLines:'greedy',dynamicTyping:true});
    if(p.errors.length) throw new Error(`CSV could not be read: ${p.errors[0].message}`);
    rows=p.data;
  } else if(ext==='json') {
    const j=JSON.parse(await file.text()); rows=Array.isArray(j)?j:j.data;
  } else if(ext==='xlsx') {
    const XLSX=await import('xlsx'); const book=XLSX.read(await file.arrayBuffer());
    rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:null});
  } else if(ext==='parquet') {
    const {parquetReadObjects}=await import('hyparquet');
    rows=await parquetReadObjects({file:await file.arrayBuffer()});
  } else throw new Error('Choose a CSV, JSON, XLSX, or Parquet file.');
  if(!Array.isArray(rows)||!rows.length||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r))) throw new Error('The dataset must contain a nonempty array of row objects.');
  return rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='bigint'?Number(v):v])));
}
const quantile=(sorted,q)=>{const pos=(sorted.length-1)*q,base=Math.floor(pos);return sorted[base]+(sorted[base+1]===undefined?0:(sorted[base+1]-sorted[base])*(pos-base));};
export function analyzeRows(rows,task) {
  const fields=[...new Set(rows.flatMap(Object.keys))];
  let missing=0; const seen=new Set();
  const unique=rows.filter(row=>{fields.forEach(k=>{if(row[k]===null||row[k]===undefined||row[k]==='') missing++;});const key=JSON.stringify(fields.map(k=>row[k]??null));if(seen.has(key))return false;seen.add(key);return true;});
  const columns=fields.map(name=>{
    const values=unique.map(r=>r[name]).filter(v=>v!==null&&v!==undefined&&v!=='');
    const numeric=values.length>0&&values.every(v=>typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v)));
    if(!numeric)return{name,type:'text',missing:unique.length-values.length};
    const ns=values.map(Number).sort((a,b)=>a-b),mean=ns.reduce((a,b)=>a+b,0)/ns.length;
    const std=Math.sqrt(ns.reduce((s,n)=>s+(n-mean)**2,0)/ns.length),q1=quantile(ns,.25),q3=quantile(ns,.75);
    return{name,type:'numeric',missing:unique.length-values.length,count:ns.length,mean,std,min:ns[0],max:ns.at(-1),median:quantile(ns,.5),q1,q3};
  });
  const numeric=columns.filter(c=>c.type==='numeric');
  const anomalies=[];
  unique.forEach((row,i)=>numeric.forEach(c=>{const raw=row[c.name];if(raw==null||raw==='')return;const n=Number(raw);if(n<c.q1-1.5*(c.q3-c.q1)||n>c.q3+1.5*(c.q3-c.q1)||c.std>0&&Math.abs((n-c.mean)/c.std)>3) anomalies.push({row:i+1,column:c.name,value:n});}));
  const cleaned=unique.map(row=>Object.fromEntries(columns.map(c=>[c.name,row[c.name]==null||row[c.name]===''?(c.type==='numeric'?c.median:'Unknown'):(c.type==='numeric'?Number(row[c.name]):row[c.name])])));
  const stats={rows:rows.length,cleaned_rows:cleaned.length,columns:fields.length,missing,duplicates:rows.length-unique.length,numeric_columns:numeric.length,profiles:columns};
  const chartRows=cleaned.slice(0,10000),x=numeric[0]?.name,y=numeric[1]?.name,z=numeric[2]?.name;
  let chart;
  if(task==='Check Statistics'&&numeric.length) chart={data:numeric.map(c=>({type:'box',name:c.name,y:chartRows.map(r=>r[c.name]),marker:{color:'#38BDF8'}})),layout:{yaxis:{title:{text:'Value'}}}};
  else if(x&&y&&z&&task!=='Plot Results')chart={data:[{type:'scatter3d',mode:'markers',x:chartRows.map(r=>r[x]),y:chartRows.map(r=>r[y]),z:chartRows.map(r=>r[z]),marker:{size:2.5,color:chartRows.map(r=>r[z]),colorscale:[[0,'#12506a'],[.5,'#38BDF8'],[1,'#c6f2ff']],opacity:.8}}],layout:{scene:{xaxis:{title:{text:x}},yaxis:{title:{text:y}},zaxis:{title:{text:z}}}}};
  else if(x)chart={data:[{type:y?'scattergl':'histogram',mode:'markers',x:chartRows.map(r=>r[x]),...(y?{y:chartRows.map(r=>r[y])}:{}),marker:{color:'#38BDF8',size:5}}],layout:{xaxis:{title:{text:x}},yaxis:{title:{text:y||'Count'}}}};
  else {const counts={};cleaned.forEach(r=>{const s=String(r[fields[0]]);counts[s]=(counts[s]||0)+1;});const pairs=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20);chart={data:[{type:'bar',x:pairs.map(p=>p[0]),y:pairs.map(p=>p[1]),marker:{color:'#38BDF8'}}],layout:{}};}
  return{status:'success',stats,anomalies,cleaned,chart_json:chart,summary_source:'local',ai_summary:`Analyzed ${rows.length.toLocaleString()} records across ${fields.length} fields. Found ${missing.toLocaleString()} missing values and removed ${stats.duplicates.toLocaleString()} duplicate rows. Numeric gaps were filled with column medians; text gaps use “Unknown”. ${anomalies.length.toLocaleString()} values were flagged by IQR or Z-score screening. ${numeric.length?`The dataset contains ${numeric.length} numeric fields suitable for statistical comparison.`:'No numeric fields were detected; the chart shows category frequencies.'} Outlier flags are screening results, not confirmed errors.`};
}
export function makeSample(){return Array.from({length:2400},(_,i)=>{const a=i*2.3999632297,r=Math.sqrt(i/2400)*11;return{x:+(Math.cos(a)*r).toFixed(3),y:+(Math.sin(a)*r).toFixed(3),z:+(Math.sin(r*.8)*2.8+Math.cos(a*3)*.7+Math.sin(i*17.31)*.3).toFixed(3)};});}
