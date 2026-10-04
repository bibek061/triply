const fs = require('node:fs');
const path = require('node:path');
async function main(){
  const source='https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
  const response=await fetch(source,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Country catalog request failed: ${response.status}`);
  const raw=await response.json();
  const currencySource='https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/currencyData.json';
  const currencyResponse=await fetch(currencySource,{signal:AbortSignal.timeout(30000)});
  if(!currencyResponse.ok)throw new Error('Currency mapping request failed');
  const regions=(await currencyResponse.json()).supplemental.currencyData.region;
  const today=new Date().toISOString().slice(0,10);
  const names=new Intl.DisplayNames(['en'],{type:'currency'});
  const countries=raw.map(c=>({code:c.cca2,name:c.name.common,officialName:c.name.official,region:c.region,capital:c.capital?.[0]||'',currencies:(regions[c.cca2]||[]).flatMap(row=>Object.entries(row).filter(([,period])=>period._tender!=='false'&&(!period._from||period._from<=today)&&(!period._to||period._to>=today)).map(([code])=>({code,name:names.of(code),symbol:c.currencies?.[code]?.symbol||code}))),lat:c.latlng?.[0],lon:c.latlng?.[1]})).sort((a,b)=>a.name.localeCompare(b.name));
  if(countries.length<240||!countries.some(c=>c.code==='NP'))throw new Error('Incomplete country catalog');
  fs.mkdirSync(path.join(__dirname,'../data'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'../data/countries.json'),JSON.stringify({source,currencySource,retrievedAt:new Date().toISOString(),countries},null,2)+'\n');
  console.log(`Saved ${countries.length} countries and territories; ${new Set(countries.flatMap(c=>c.currencies.map(x=>x.code))).size} currency codes.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
