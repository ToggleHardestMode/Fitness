// Original catalogue labels, no HPB database rows. Licensed numeric values: USDA FDC CC0 ingredient records.
const names=[
  [
    "Chicken rice, steamed",
    "chicken rice,hainanese chicken rice,白鸡饭"
  ],
  [
    "Chicken rice, roasted",
    "roasted chicken rice,烧鸡饭"
  ],
  [
    "Chicken rice, extra rice",
    "chicken rice add rice"
  ],
  [
    "Cai png / economy rice",
    "cai png,cai fan,菜饭,经济饭,economy rice,mixed rice"
  ],
  [
    "Cai png, 2 vegetables 1 meat",
    "economy rice 2 veg 1 meat"
  ],
  [
    "Cai png, 1 vegetable 2 meat",
    "economy rice 1 veg 2 meat"
  ],
  [
    "Kopi peng siu dai",
    "kopi ice less sugar,kopi iced less sugar,咖啡冰少糖"
  ],
  [
    "Kopi peng",
    "iced kopi,ice kopi,咖啡冰"
  ],
  [
    "Kopi O kosong",
    "kopi o no sugar,black coffee"
  ],
  [
    "Kopi C siu dai",
    "evaporated milk coffee less sugar"
  ],
  [
    "Teh peng siu dai",
    "iced tea less sugar"
  ],
  [
    "Teh O kosong",
    "tea no sugar"
  ],
  [
    "Milo peng",
    "iced milo"
  ],
  [
    "Nasi lemak",
    "coconut rice"
  ],
  [
    "Nasi lemak, chicken wing set",
    "nasi lemak wing"
  ],
  [
    "Mee goreng",
    "fried noodles malay"
  ],
  [
    "Mee rebus",
    "noodles gravy"
  ],
  [
    "Mee siam",
    "rice vermicelli spicy"
  ],
  [
    "Laksa",
    "curry laksa"
  ],
  [
    "Fishball noodles, soup",
    "fish ball noodle soup"
  ],
  [
    "Fishball noodles, dry",
    "fish ball noodle dry"
  ],
  [
    "Bak chor mee, dry",
    "minced pork noodle,bcm"
  ],
  [
    "Bak chor mee, soup",
    "minced meat noodle soup"
  ],
  [
    "Wanton mee, dry",
    "wonton noodles dry"
  ],
  [
    "Wanton mee, soup",
    "wonton noodles soup"
  ],
  [
    "Char kway teow",
    "fried flat noodles,炒粿条"
  ],
  [
    "Hokkien mee",
    "fried prawn noodles"
  ],
  [
    "Carrot cake, black",
    "chai tow kway black"
  ],
  [
    "Carrot cake, white",
    "chai tow kway white"
  ],
  [
    "Roti prata, plain",
    "plain prata"
  ],
  [
    "Roti prata, egg",
    "egg prata"
  ],
  [
    "Thosai, plain",
    "dosa"
  ],
  [
    "Briyani, chicken",
    "chicken biryani"
  ],
  [
    "Briyani, mutton",
    "mutton biryani"
  ],
  [
    "Yong tau foo, soup",
    "ytf soup"
  ],
  [
    "Yong tau foo, dry",
    "ytf dry"
  ],
  [
    "Chicken cutlet, Western style",
    "western fried chicken cutlet"
  ],
  [
    "Fish and chips",
    "western fish chips"
  ],
  [
    "Kaya toast",
    "toast kaya"
  ],
  [
    "Soft-boiled eggs",
    "half boiled eggs"
  ],
  [
    "Ban mian, soup",
    "handmade noodle soup"
  ],
  [
    "Ice kacang",
    "ice kachang"
  ],
  [
    "Chendol",
    "cendol"
  ]
];

export const US_SOURCE='USDA FoodData Central CC0 public-domain ingredient reference, not a Singapore hawker plate';
const references=[
  {id:'usda-169757',name:'White rice, cooked (100 g)',aliases:['rice, white, cooked','plain white rice','rice 100g'],source:'USDA FDC 169757 · CC0 · per 100 g',occasion:'meal',kcal:130,protein:2.7,carbs:28.2,fat:0.3},
  {id:'usda-171477',name:'Chicken breast, roasted skinless (100 g)',aliases:['roasted chicken breast','plain cooked chicken breast','chicken breast 100g'],source:'USDA FDC 171477 · CC0 · per 100 g',occasion:'meal',kcal:165,protein:31.02,carbs:0,fat:3.57},
  {id:'usda-171075',name:'Chicken breast, roasted with skin (100 g)',aliases:['roasted chicken skin','chicken with skin 100g'],source:'USDA FDC 171075 · CC0 · per 100 g',occasion:'meal',kcal:197,protein:29.8,carbs:0,fat:7.78}
];
export const SG_FOODS=Object.freeze([
  ...names.map(([name,aliases],i)=>Object.freeze({id:'sg-'+String(i+1).padStart(3,'0'),name,aliases:aliases.split(','),source:'Search name only · no licensed Singapore nutritional figure available',occasion:/^(Kopi|Teh|Milo)/.test(name)?'drink':'meal',kcal:null,protein:null,carbs:null,fat:null})),
  ...references.map(row=>Object.freeze(row))
]);
const normal=value=>String(value??'').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function lookupSgFoods(query,limit=10){
  if(!Number.isInteger(limit)||limit<1||limit>50)throw Error('Search limit out of range.');
  const terms=normal(query).split(' ').filter(Boolean);
  if(!terms.length)return SG_FOODS.slice(0,limit);
  return SG_FOODS.map(item=>{
    const name=normal(item.name),aliases=item.aliases.map(normal);
    return terms.every(term=>[name,...aliases].some(x=>x.includes(term)))?{item,rank:name.startsWith(terms.join(' '))?0:1}:null;
  }).filter(Boolean).sort((a,b)=>a.rank-b.rank).slice(0,limit).map(result=>result.item);
}
export function draftFromSgFood(item){
  if(!SG_FOODS.some(x=>x.id===item?.id))throw Error('Unknown food reference.');
  const name=item.source.startsWith('USDA')?item.name+' ['+item.source.split(' · ')[0]+']':item.name;
  return {name,occasion:item.occasion,servings:1,kcal:item.kcal,protein:item.protein,carbs:item.carbs,fat:item.fat,label:item.source};
}
export function initSgFoodLookup(){
  const byId=id=>document.getElementById(id),search=byId('sg-food-search'),results=byId('sg-food-results');
  if(!search||!results)return;
  function render(){
    results.replaceChildren();
    const choices=lookupSgFoods(search.value);
    if(!choices.length){
      const p=document.createElement('p');p.className='hint';
      p.textContent='No matching local food. Use custom entry below and leave unknown nutrition blank.';
      results.append(p);return;
    }
    for(const item of choices){
      const button=document.createElement('button');button.type='button';button.className='sg-food-option';
      const title=document.createElement('strong');title.textContent=item.name;
      const sub=document.createElement('span');sub.className='fd-detail';
      sub.textContent=item.kcal===null?'Nutrition unknown · enter your own estimate':item.kcal+' kcal per 100 g · USDA ingredient reference';
      button.append(title,sub);
      button.addEventListener('click',()=>{
        if(byId('fd-id').value&&!confirm('Discard the current edit and start a new food?'))return;
        const d=draftFromSgFood(item);
        byId('fd-id').value='';byId('fd-save').textContent='Save food';
        byId('fd-name').value=d.name;byId('fd-occasion').value=d.occasion;byId('fd-servings').value='1';
        for(const k of ['kcal','protein','carbs','fat'])byId('fd-'+k).value=d[k]===null?'':String(d[k]);
        byId('sg-food-source').textContent=d.label+(d.kcal===null?' · Fill in nutritional values if known.':' · Ingredient reference, not a completed dish. Review serving before saving.');
        byId('fd-form').scrollIntoView({behavior:'smooth',block:'start'});
      });
      results.append(button);
    }
  }
  search.addEventListener('input',render);render();
}
