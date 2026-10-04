'use strict';
// Integration reference: https://github.com/amadeus4dev/amadeus-node
function createProviders({fetchImpl=fetch,env=process.env}={}){
  let token,until=0;const configured=Boolean(env.AMADEUS_CLIENT_ID&&env.AMADEUS_CLIENT_SECRET);const production=env.AMADEUS_ENV==='production';const base=production?'https://api.amadeus.com':'https://test.api.amadeus.com';
  async function flights(q){
    if(!configured)return {status:'not_configured',offers:[],message:'Live fares are not connected yet. Compare provider websites below.'};
    if(!/^[A-Z]{3}$/.test(q.origin)||!/^[A-Z]{3}$/.test(q.destination))return {status:'needs_airport_codes',offers:[],message:'Enter 3-letter airport codes, such as KTM and DEL, for API fares.'};
    if(!token||Date.now()>until){const res=await fetchImpl(base+'/v1/security/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:env.AMADEUS_CLIENT_ID,client_secret:env.AMADEUS_CLIENT_SECRET}),signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('Travel API authentication failed');const b=await res.json();token=b.access_token;until=Date.now()+Math.max(0,b.expires_in-60)*1000;}
    const params=new URLSearchParams({originLocationCode:q.origin,destinationLocationCode:q.destination,departureDate:q.start,adults:String(q.adults),currencyCode:q.currency,max:'20'});
    const res=await fetchImpl(`${base}/v2/shopping/flight-offers?${params}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('Travel API could not return offers');const b=await res.json();
    return {status:production?'live':'sandbox',checkedAt:new Date().toISOString(),message:production?'Lowest totals among Amadeus results. Separate booking-site links do not guarantee these fares; recheck before purchase.':'Amadeus sandbox results are test prices, not bookable live fares.',offers:(b.data||[]).map(o=>({id:o.id,total:Number(o.price.grandTotal||o.price.total),currency:o.price.currency,airlines:o.validatingAirlineCodes,segments:o.itineraries.flatMap(i=>i.segments.map(s=>({from:s.departure.iataCode,to:s.arrival.iataCode,departure:s.departure.at,arrival:s.arrival.at,carrier:s.carrierCode})))})).filter(o=>Number.isFinite(o.total)&&o.currency===q.currency).sort((a,b)=>a.total-b.total)};
  }return {flights,configured,production};
}module.exports={createProviders};
