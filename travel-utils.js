(function (root) {
  'use strict';
  // Illustrative conversion factors, not current market exchange rates.
  const nprPerUnit = Object.freeze({NPR:1, INR:1.6, USD:135});
  function formatMoney(amount, currency='USD') {
    const code=Object.hasOwn(nprPerUnit,currency)?currency:'USD';
    return new Intl.NumberFormat(code==='USD'?'en-US':'en-IN',{
      style:'currency',currency:code,currencyDisplay:code==='NPR'?'code':'symbol',
      minimumFractionDigits:code==='USD'?2:0,maximumFractionDigits:code==='USD'?2:0,
    }).format(amount/nprPerUnit[code]);
  }
  function bookingDestination(item, search) {
    if(item.type==='Hotels') {
      const query=new URLSearchParams({
        ss: item.express || ['h5','h7'].includes(item.id) ? `${item.city}, ${item.country}` : `${item.name}, ${item.city}`,
        checkin:search.start,checkout:search.end,group_adults:String(search.travelers),group_children:'0',no_rooms:'1',
        selected_currency:Object.hasOwn(nprPerUnit,search.currency)?search.currency:'USD',
      });
      return {name:'Booking.com',url:`https://www.booking.com/searchresults.html?${query}`,note:item.express?'Browse hotels in this area. This sample mystery rate is not a live Express Deal.':'We’ll request a hotel search with your dates and guests. Confirm the property, currency, and total price on Booking.com.'};
    }
    if(item.type==='Flights')return {name:'Expedia',url:'https://www.expedia.com/Flights',note:'Enter the route, departure date, and travelers shown below on Expedia to see available flights. Triply’s sample flight is not a live fare.'};
    if(item.type==='Cars')return {name:'Rentalcars.com',url:`https://www.rentalcars.com/us/country/${item.country==='India'?'in':'np'}/`,note:'Choose your pickup city, dates, and vehicle on Rentalcars.com. Local availability and the final price are set by the provider.'};
    return {name:'Expedia',url:'https://www.expedia.com/Vacation-Packages',note:'Build a flight-and-hotel package on Expedia using the trip details below. This sample bundle is not a confirmed provider offer.'};
  }
  const api={formatMoney,bookingDestination};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.TriplyTravel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
