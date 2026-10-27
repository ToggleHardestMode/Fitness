// Human-readable dietary reference values for healthy adult men around ages 31–50.
// Singapore HealthHub RDA and Canada/US DRI (RDA or AI), reviewed 2026-10-27.
// Values from different jurisdictions are NOT unit conversions of each other.
export const VITAMIN_REFERENCES=Object.freeze([
 {id:'A',name:'Vitamin A',sg:'750 µg RE',intl:'900 µg RAE',sgKind:'SG RDA',intlKind:'RDA',note:'SG retinol equivalents (RE) and international retinol activity equivalents (RAE) are not generally interchangeable for carotenoid-containing food.'},
 {id:'B1',name:'Thiamin (B1)',sg:'1.16 mg',intl:'1.2 mg',sgKind:'SG RDA',intlKind:'RDA'},
 {id:'B2',name:'Riboflavin (B2)',sg:'1.74 mg',intl:'1.3 mg',sgKind:'SG RDA',intlKind:'RDA'},
 {id:'B3',name:'Niacin (B3)',sg:'19.1 mg NE',intl:'16 mg NE',sgKind:'SG RDA',intlKind:'RDA',note:'NE = niacin equivalents, not simply milligrams of ingested tryptophan.'},
 {id:'B5',name:'Pantothenic acid (B5)',sg:null,intl:'5 mg',sgKind:null,intlKind:'AI'},
 {id:'B6',name:'Vitamin B6',sg:'1.3 mg',intl:'1.3 mg',sgKind:'SG RDA',intlKind:'RDA'},
 {id:'B7',name:'Biotin (B7)',sg:null,intl:'30 µg',sgKind:null,intlKind:'AI'},
 {id:'B9',name:'Folate (B9)',sg:'400 µg folic acid',intl:'400 µg DFE',sgKind:'SG RDA table',intlKind:'RDA',note:'Singapore table specifies folic acid (µg); North American reference specifies dietary folate equivalents (µg DFE). These are NOT automatically equal ingredient amounts.'},
 {id:'B12',name:'Vitamin B12',sg:'2.4 µg',intl:'2.4 µg',sgKind:'SG RDA',intlKind:'RDA'},
 {id:'C',name:'Vitamin C',sg:'105 mg',intl:'90 mg',sgKind:'SG RDA',intlKind:'RDA'},
 {id:'D',name:'Vitamin D',sg:'2.5 µg (100 IU)',intl:'15 µg (600 IU)',sgKind:'SG RDA',intlKind:'RDA',note:'1 µg vitamin D = 40 IU exactly. International/US 15 µg reference assumes minimal sun exposure; Singapore reference is 2.5 µg in its published table.'},
 {id:'E',name:'Vitamin E',sg:null,intl:'15 mg alpha-tocopherol',sgKind:null,intlKind:'RDA',note:'IU conversion depends on natural vs synthetic alpha-tocopherol formulation.'},
 {id:'K',name:'Vitamin K',sg:null,intl:'120 µg',sgKind:null,intlKind:'AI'}
]);
export function referencesFor(standard='sg'){
 if(!['sg','international'].includes(standard))throw Error('Choose Singapore or international reference.');
 return VITAMIN_REFERENCES.map(v=>({
  id:v.id,name:v.name,amount:standard==='sg'?(v.sg??v.intl):v.intl,
  provenance:standard==='sg'&&v.sg?v.sgKind:(standard==='sg'?'International fallback · '+v.intlKind:'International · '+v.intlKind),
  note:v.note??''
 }));
}
export const CONVERSION_LABELS=Object.freeze({
 'mg-to-mcg':'mg → µg (all vitamins, mass only)',
 'mcg-to-mg':'µg → mg (all vitamins, mass only)',
 'd-mcg-to-iu':'Vitamin D · µg → IU',
 'd-iu-to-mcg':'Vitamin D · IU → µg',
 'a-retinol-iu-to-rae':'Vitamin A · retinol IU → µg RAE',
 'a-food-beta-iu-to-rae':'Vitamin A · dietary beta-carotene IU → µg RAE',
 'e-natural-iu-to-mg':'Vitamin E · natural IU → mg alpha-tocopherol',
 'e-synthetic-iu-to-mg':'Vitamin E · synthetic IU → mg alpha-tocopherol',
 'folic-acid-with-food-to-dfe':'Folic acid with food · µg → µg DFE',
 'food-folate-to-dfe':'Natural food folate · µg → µg DFE'
});
export function convertVitaminUnits(value,method){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000000)throw Error('Enter a nonnegative finite amount up to 1,000,000.');
 const conversions={
  'mg-to-mcg':[1000,'µg'],'mcg-to-mg':[0.001,'mg'],
  'd-mcg-to-iu':[40,'IU vitamin D'],'d-iu-to-mcg':[1/40,'µg vitamin D'],
  'a-retinol-iu-to-rae':[0.3,'µg RAE (retinol only)'],
  'a-food-beta-iu-to-rae':[0.05,'µg RAE (dietary beta-carotene only)'],
  'e-natural-iu-to-mg':[0.67,'mg alpha-tocopherol (natural)'],
  'e-synthetic-iu-to-mg':[0.45,'mg alpha-tocopherol (synthetic)'],
  'folic-acid-with-food-to-dfe':[1/0.6,'µg DFE (fortified/supplemental folic acid taken with food)'],
  'food-folate-to-dfe':[1,'µg DFE (natural food folate)']
 };
 const selected=conversions[method];if(!selected)throw Error('Unknown or unsafe conversion.');
 return {amount:value*selected[0],unit:selected[1]};
}
