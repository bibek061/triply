const test=require('node:test');
const assert=require('node:assert/strict');
const {formatMoney,bookingDestination}=require('./travel-utils');
const search={start:'2026-10-20',end:'2026-10-23',travelers:2,currency:'USD'};
test('USD conversion and unsupported currency fallback',()=>{
  assert.equal(formatMoney(13500,'USD'),'$100.00');
  assert.equal(formatMoney(13500,'bad'),'$100.00');
  assert.match(formatMoney(160,'INR'),/100/);
  assert.match(formatMoney(160,'NPR'),/160/);
});
test('hotel handoff includes encoded property, dates, guests and USD',()=>{
  const destination=bookingDestination({id:'h1',type:'Hotels',name:'Hotel A & B',city:'Pokhara',country:'Nepal'},search);
  const url=new URL(destination.url);
  assert.equal(url.origin,'https://www.booking.com');
  assert.equal(url.searchParams.get('ss'),'Hotel A & B, Pokhara');
  for(const [key,value] of Object.entries({checkin:search.start,checkout:search.end,group_adults:'2',selected_currency:'USD'}))assert.equal(url.searchParams.get(key),value);
});
test('fictional and mystery properties lead to area searches',()=>{
  for(const item of [{id:'h5'},{id:'h7'},{id:'h6',express:true}]) {
    const url=new URL(bookingDestination({...item,type:'Hotels',name:'Sample hotel',city:'Kathmandu',country:'Nepal'},search).url);
    assert.equal(url.searchParams.get('ss'),'Kathmandu, Nepal');
  }
});
test('all categories use HTTPS booking-provider destinations',()=>{
  for(const [type,expected] of [['Flights','www.expedia.com'],['Cars','www.rentalcars.com'],['Bundles','www.expedia.com']]) {
    const result=bookingDestination({type,country:'Nepal'},search);
    assert.equal(new URL(result.url).hostname,expected);
    assert.equal(new URL(result.url).protocol,'https:');
    assert.ok(result.note);
  }
});
