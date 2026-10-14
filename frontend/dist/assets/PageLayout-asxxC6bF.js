const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-BDF8GGvP.js","assets/index-CVZBez9y.css"])))=>i.map(i=>d[i]);
import{P as G,u as U,r as m,l as A,y,E as T,R as re,m as O,M as Y,z as X,o as c,c as M,b as s,j as l,n as I,A as Z,t as z,e as V,F as W,k as le,p as E,s as K,i as ie,q as j,d as L,w as D,T as ce,f as F,v as N,Q as ue,_ as de,S as pe}from"./index-BDF8GGvP.js";import{c as n,U as ee}from"./utensils-crossed-D006UtbA.js";import{_ as J}from"./_plugin-vue_export-helper-DlAUqK2U.js";const ye=G("inventory",()=>{const _=U(),t=m([]),h=m([]),k=m(!1);function i(){var e;return(e=_.currentBusiness)==null?void 0:e.id}const b=A(()=>t.value.filter(e=>!e.noStock&&e.stock<=(e.minStock||0))),$=A(()=>[...new Set(t.value.map(e=>e.category).filter(Boolean))]),R=A(()=>[...new Set(h.value.map(e=>e.category).filter(Boolean))]);async function d(){if(i()){k.value=!0;try{const e=await y.get(`/api/${i()}/inventory`);t.value=e.data}finally{k.value=!1}}}async function u(){if(!i())return;const e=await y.get(`/api/${i()}/recipes`);h.value=e.data}async function v(e){const a=await y.post(`/api/${i()}/inventory`,e);return t.value.push(a.data),a.data}async function o(e,a){const r=await y.put(`/api/${i()}/inventory/${e}`,a),w=t.value.findIndex(S=>S.id===e);return w!==-1&&(t.value[w]=r.data),r.data}async function x(e){await y.delete(`/api/${i()}/inventory/${e}`),t.value=t.value.filter(a=>a.id!==e)}async function C(e,a,r){const w=await y.patch(`/api/${i()}/inventory/${e}/adjust`,{adjustment:a,reason:r}),S=t.value.findIndex(p=>p.id===e);return S!==-1&&(t.value[S]=w.data),w.data}async function P(e){const a=await y.post(`/api/${i()}/inventory/count`,{items:e});return Array.isArray(a.data.inventory)&&(t.value=a.data.inventory),a.data}async function q(){const e=await y.post(`/api/${i()}/inventory/min-stock-zero`);return await d(),e.data}async function B(e){const a=await y.post(`/api/${i()}/recipes`,e);return h.value.push(a.data),a.data}async function g(e,a){const r=await y.put(`/api/${i()}/recipes/${e}`,a),w=h.value.findIndex(S=>S.id===e);return w!==-1&&(h.value[w]=r.data),r.data}async function f(e){await y.delete(`/api/${i()}/recipes/${e}`),h.value=h.value.filter(a=>a.id!==e)}return{items:t,recipes:h,loading:k,lowStockItems:b,categories:$,recipeCategories:R,fetchInventory:d,fetchRecipes:u,createItem:v,updateItem:o,deleteItem:x,adjustStock:C,countInventory:P,zeroMinStock:q,createRecipe:B,updateRecipe:g,deleteRecipe:f}}),he=G("payroll",()=>{const _=U(),t=m([]),h=m([]),k=m({dia:5e4,medio:25e3,hora:6250}),i=m({}),b=m([]),$=m(!1),R=A(()=>t.value.filter(a=>a.status==="pendiente").length);function d(){var a;return(a=_.currentBusiness)==null?void 0:a.id}async function u(a={}){if(d()){$.value=!0;try{const r=await y.get(`/api/${d()}/payroll`,{params:a});t.value=r.data.entries||[],h.value=r.data.payments||[],r.data.rates&&(k.value=r.data.rates),i.value=r.data.employeeRates||{}}finally{$.value=!1}}}async function v(){if(d())try{const a=await y.get(`/api/${d()}/users`);b.value=a.data||[]}catch{b.value=[]}}function o(a){return i.value[a]||k.value}async function x(a){const r=await y.put(`/api/${d()}/payroll/employee-rate`,a);return i.value=r.data||{},r.data}async function C(){if(!d())return;const a=await y.get(`/api/${d()}/payroll/rates`);k.value=a.data}async function P(a){const r=await y.put(`/api/${d()}/payroll/rates`,a);return k.value=r.data,r.data}async function q(a){return(await y.post(`/api/${d()}/payroll`,a)).data}async function B(a,r){return(await y.put(`/api/${d()}/payroll/${a}`,r)).data}async function g(a){await y.delete(`/api/${d()}/payroll/${a}`)}async function f(a){return(await y.post(`/api/${d()}/payroll/approve`,{ids:a})).data}async function e(a){return(await y.post(`/api/${d()}/payroll/pay`,a)).data}return{entries:t,payments:h,rates:k,employeeRates:i,users:b,loading:$,pendingCount:R,fetch:u,fetchRates:C,saveRates:P,fetchUsers:v,ratesFor:o,saveEmployeeRate:x,createEntry:q,updateEntry:B,deleteEntry:g,approve:f,pay:e}}),ae=G("business",()=>{const _=U(),t=m(null),h=m(!1),k=A(()=>{var o;return((o=t.value)==null?void 0:o.usesRecipes)!==!1});T(()=>{var o;return(o=_.currentBusiness)==null?void 0:o.id},o=>{t.value=null,o&&b()},{immediate:!0});function i(){var o;return`/api/${(o=_.currentBusiness)==null?void 0:o.id}`}async function b(){h.value=!0;try{const o=await y.get(`${i()}/profile`);t.value=o.data}finally{h.value=!1}}async function $(o){const x=await y.put(`${i()}/profile`,o);return t.value=x.data,x.data}async function R(){return(await y.get(`${i()}/users`)).data}async function d(o){return(await y.post(`${i()}/users`,o)).data}async function u(o,x){return(await y.put(`${i()}/users/${o}`,x)).data}async function v(o){return(await y.delete(`${i()}/users/${o}`)).data}return{profile:t,loading:h,usesRecipes:k,fetchProfile:b,updateProfile:$,fetchUsers:R,createUser:d,updateUser:u,deleteUser:v}}),H=m(!1);function te(){function _(){H.value=!H.value}function t(){H.value=!1}return{isMenuOpen:H,toggleMenu:_,closeMenu:t}}/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ve=n("arrow-left-right",[["path",{d:"M8 3 4 7l4 4",key:"9rb6wj"}],["path",{d:"M4 7h16",key:"6tx8e3"}],["path",{d:"m16 21 4-4-4-4",key:"siv7j2"}],["path",{d:"M20 17H4",key:"h6l3hr"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fe=n("beer",[["path",{d:"M17 11h1a3 3 0 0 1 0 6h-1",key:"1yp76v"}],["path",{d:"M9 12v6",key:"1u1cab"}],["path",{d:"M13 12v6",key:"1sugkk"}],["path",{d:"M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z",key:"1510fo"}],["path",{d:"M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8",key:"19jb7n"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ke=n("book-open",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const me=n("briefcase",[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const se=n("building-2",[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const be=n("calendar-clock",[["path",{d:"M16 14v2.2l1.6 1",key:"fo4ql5"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",key:"1osxxc"}],["path",{d:"M3 10h5",key:"r794hk"}],["path",{d:"M8 2v4",key:"1cmpym"}],["circle",{cx:"16",cy:"16",r:"6",key:"qoo3c4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ge=n("chart-column",[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const we=n("chevron-down",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Me=n("chevron-left",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _e=n("chevron-right",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $e=n("clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xe=n("coffee",[["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M14 2v2",key:"6buw04"}],["path",{d:"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",key:"pwadti"}],["path",{d:"M6 2v2",key:"colzsn"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ce=n("croissant",[["path",{d:"M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487",key:"14kkz9"}],["path",{d:"M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132",key:"1g7v07"}],["path",{d:"M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42",key:"ratg6b"}],["path",{d:"M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14",key:"4454f0"}],["path",{d:"M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676",key:"qmemie"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ze=n("crosshair",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"22",x2:"18",y1:"12",y2:"12",key:"l9bcsi"}],["line",{x1:"6",x2:"2",y1:"12",y2:"12",key:"13hhkx"}],["line",{x1:"12",x2:"12",y1:"6",y2:"2",key:"10w3f3"}],["line",{x1:"12",x2:"12",y1:"22",y2:"18",key:"15g9kq"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Se=n("dumbbell",[["path",{d:"M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z",key:"9m4mmf"}],["path",{d:"m2.5 21.5 1.4-1.4",key:"17g3f0"}],["path",{d:"m20.1 3.9 1.4-1.4",key:"1qn309"}],["path",{d:"M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z",key:"1t2c92"}],["path",{d:"m9.6 14.4 4.8-4.8",key:"6umqxw"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const je=n("history",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ie=n("hotel",[["path",{d:"M10 22v-6.57",key:"1wmca3"}],["path",{d:"M12 11h.01",key:"z322tv"}],["path",{d:"M12 7h.01",key:"1ivr5q"}],["path",{d:"M14 15.43V22",key:"1q2vjd"}],["path",{d:"M15 16a5 5 0 0 0-6 0",key:"o9wqvi"}],["path",{d:"M16 11h.01",key:"xkw8gn"}],["path",{d:"M16 7h.01",key:"1kdx03"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 7h.01",key:"1vti4s"}],["rect",{x:"4",y:"2",width:"16",height:"20",rx:"2",key:"1uxh74"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ve=n("key-round",[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",key:"1s6t7t"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor",key:"w0ekpg"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Re=n("layout-dashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ae=n("log-out",[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Be=n("menu",[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pe=n("moon",[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qe=n("package",[["path",{d:"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",key:"1a0edw"}],["path",{d:"M12 22V12",key:"d0xqtd"}],["polyline",{points:"3.29 7 12 12 20.71 7",key:"ousv84"}],["path",{d:"m7.5 4.27 9 5.15",key:"1c824w"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Le=n("piggy-bank",[["path",{d:"M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z",key:"1piglc"}],["path",{d:"M16 10h.01",key:"1m94wz"}],["path",{d:"M2 8v1a2 2 0 0 0 2 2h1",key:"1env43"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ee=n("receipt",[["path",{d:"M12 17V7",key:"pyj7ub"}],["path",{d:"M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8",key:"1elt7d"}],["path",{d:"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",key:"ycz6yz"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ne=n("settings",[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ue=n("shopping-cart",[["circle",{cx:"8",cy:"21",r:"1",key:"jimo8o"}],["circle",{cx:"19",cy:"21",r:"1",key:"13723u"}],["path",{d:"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",key:"9zh506"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oe=n("store",[["path",{d:"M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5",key:"slp6dd"}],["path",{d:"M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244",key:"o0xfot"}],["path",{d:"M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05",key:"wn3emo"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const He=n("sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const De=n("truck",[["path",{d:"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",key:"wrbu53"}],["path",{d:"M15 18H9",key:"1lyqi6"}],["path",{d:"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",key:"lysw3i"}],["circle",{cx:"17",cy:"18",r:"2",key:"332jqn"}],["circle",{cx:"7",cy:"18",r:"2",key:"19iecd"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fe=n("utensils",[["path",{d:"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",key:"cjf0a3"}],["path",{d:"M7 2v20",key:"1473qp"}],["path",{d:"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",key:"j28e5"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ne=n("wallet",[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Te=n("wine",[["path",{d:"M8 22h8",key:"rmew8v"}],["path",{d:"M7 10h10",key:"1101jm"}],["path",{d:"M12 15v7",key:"t2xh3l"}],["path",{d:"M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z",key:"10ffi3"}]]),Q=[{key:"store",label:"Tienda",icon:oe},{key:"utensils",label:"Restaurante",icon:Fe},{key:"beer",label:"Bar",icon:fe},{key:"wine",label:"Licorería",icon:Te},{key:"coffee",label:"Café",icon:xe},{key:"crosshair",label:"Campo de tiro",icon:ze},{key:"croissant",label:"Panadería",icon:Ce},{key:"dumbbell",label:"Gimnasio",icon:Se},{key:"hotel",label:"Hotel",icon:Ie},{key:"briefcase",label:"Otro negocio",icon:me}],Da="store";function Oe(_){return(Q.find(t=>t.key===_)||Q[0]).icon}const We={class:"sidebar-header"},Ge={class:"sidebar-logo"},Je=["src"],Ze={key:1,class:"logo-icon-wrap"},Ke={key:2,class:"logo-text"},Qe=["title"],Ye={class:"sidebar-nav"},Xe={class:"nav-icon"},ea={key:0,class:"nav-label"},aa={key:1,class:"nav-badge"},ta={key:0,class:"sidebar-footer"},sa={class:"user-pill"},na={class:"user-avatar-sm"},oa={class:"user-info"},ra={class:"user-name-sm"},la={class:"user-role-sm"},ia={__name:"SideMenu",setup(_){const t=U(),h=ae(),k=A(()=>{var g;return Oe((g=h.profile)==null?void 0:g.icon)}),i=ye(),b=he(),$=re(),{isMenuOpen:R,closeMenu:d}=te(),u=m(!1),v=m(!1),o=[{path:"/dashboard",label:"Dashboard",icon:Re,roles:["superadmin","admin","cajero"]},{path:"/tables",label:"Registrar Venta",icon:ee,roles:["superadmin","admin","cajero"]},{path:"/inventory",label:"Inventario",icon:qe,roles:["superadmin","admin","cajero"]},{path:"/recipes",label:"Recetas / Menú",icon:ke,roles:["superadmin","admin"]},{path:"/purchases",label:"Salidas",icon:Ue,roles:["superadmin","admin"]},{path:"/suppliers",label:"Directorio de pagos",icon:De,roles:["superadmin","admin"]},{path:"/reports",label:"Reportes",icon:ge,roles:["superadmin","admin"]},{path:"/finance",label:"Finanzas",icon:Le,roles:["superadmin","admin"]},{path:"/payroll",label:"Nómina",icon:be,roles:["superadmin","admin","cajero"]},{path:"/shifts",label:"Turnos de Caja",icon:$e,roles:["superadmin","admin","cajero"]},{path:"/debtors",label:"Deudas",icon:Ne,roles:["superadmin","admin","cajero"]},{path:"/invoices",label:"Facturas",icon:Ee,roles:["superadmin","admin","cajero"]},{path:"/audit",label:"Bitácora",icon:je,roles:["superadmin","admin"]},{path:"/admin/setup",label:"Configuración",icon:ne,roles:["superadmin","admin"]},{path:"/admin/franchises",label:"Franquicias",icon:se,roles:["superadmin"]}],x=A(()=>{var f;const g=(f=t.user)==null?void 0:f.role;return o.filter(e=>e.roles.includes(g)).filter(e=>e.path!=="/recipes"||h.usesRecipes).map(e=>({...e,badge:e.path==="/inventory"?i.lowStockItems.length:e.path==="/payroll"&&t.isAdmin?b.pendingCount:0}))}),C=A(()=>{var f,e;return{superadmin:"Super Admin",admin:"Administrador",cajero:"Cajero"}[(f=t.user)==null?void 0:f.role]||((e=t.user)==null?void 0:e.role)}),P=A(()=>{var f,e;return(((f=t.user)==null?void 0:f.name)||((e=t.user)==null?void 0:e.username)||"U").charAt(0).toUpperCase()});function q(g){return $.path===g||$.path.startsWith(g+"/")}function B(){v.value=window.innerWidth<768,u.value=v.value}return T(R,g=>{v.value&&(u.value=!g)}),T(()=>$.path,()=>{v.value&&d()}),O(()=>{B(),window.addEventListener("resize",B),t.isAdmin&&b.fetch().catch(()=>{})}),Y(()=>window.removeEventListener("resize",B)),(g,f)=>{var a,r,w,S;const e=X("router-link");return c(),M(W,null,[s("aside",{class:K(["sidebar",{collapsed:u.value}])},[s("div",We,[s("div",Ge,[(a=l(h).profile)!=null&&a.logo?(c(),M("img",{key:0,src:l(h).profile.logo,class:"logo-img",alt:"logo"},null,8,Je)):(c(),M("div",Ze,[(c(),I(Z(k.value),{size:20,color:"#1a0a00"}))])),u.value?V("",!0):(c(),M("span",Ke,z(((r=l(h).profile)==null?void 0:r.name)||"facJp"),1))]),s("button",{class:"collapse-btn",onClick:f[0]||(f[0]=p=>u.value=!u.value),title:u.value?"Expandir":"Colapsar"},[u.value?(c(),I(l(_e),{key:1,size:16})):(c(),I(l(Me),{key:0,size:16}))],8,Qe)]),s("nav",Ye,[(c(!0),M(W,null,le(x.value,p=>(c(),I(e,{key:p.path,to:p.path,class:K(["nav-item",{active:q(p.path)}]),title:u.value?p.label:""},{default:E(()=>[s("span",Xe,[(c(),I(Z(p.icon),{size:18}))]),u.value?V("",!0):(c(),M("span",ea,z(p.label),1)),p.badge&&p.badge>0&&!u.value?(c(),M("span",aa,z(p.badge),1)):V("",!0)]),_:2},1032,["to","class","title"]))),128))]),u.value?V("",!0):(c(),M("div",ta,[s("div",sa,[s("div",na,z(P.value),1),s("div",oa,[s("span",ra,z(((w=l(t).user)==null?void 0:w.name)||((S=l(t).user)==null?void 0:S.username)),1),s("span",la,z(C.value),1)])])]))],2),!u.value&&v.value?(c(),M("div",{key:0,class:"sidebar-overlay",onClick:f[1]||(f[1]=(...p)=>l(d)&&l(d)(...p))})):V("",!0)],64)}}},ca=J(ia,[["__scopeId","data-v-8d6d93de"]]),ua={class:"navbar"},da={class:"navbar-left"},pa={class:"navbar-title"},ya={class:"navbar-right"},ha={key:0,class:"biz-name"},va=["src"],fa=["title"],ka={class:"user-avatar"},ma={class:"user-name"},ba={class:"modal",style:{"max-width":"400px"}},ga={class:"modal-body"},wa={class:"form-group"},Ma={class:"form-group"},_a={class:"form-group"},$a={key:0,class:"field-error"},xa={class:"modal-footer"},Ca=["disabled"],za={__name:"NavBar",props:{title:{type:String,default:"facJp"}},setup(_){const t=U(),h=ae(),k=ie(),{toggleMenu:i}=te(),b=m(!1),$=m(null),R=m(!1),d=m(!1),u=m(""),v=m({current:"",newPass:"",confirm:""});function o(){R.value=!1,u.value="",v.value={current:"",newPass:"",confirm:""}}async function x(){var f,e;if(u.value="",!v.value.current||!v.value.newPass){u.value="Completa todos los campos";return}if(v.value.newPass!==v.value.confirm){u.value="Las contraseñas no coinciden";return}if(v.value.newPass.length<6){u.value="La contraseña debe tener al menos 6 caracteres";return}d.value=!0;try{await(await de(async()=>{const{default:r}=await import("./index-BDF8GGvP.js").then(w=>w.U);return{default:r}},__vite__mapDeps([0,1]))).default.post("/api/auth/change-password",{currentPassword:v.value.current,newPassword:v.value.newPass}),o(),alert("Contraseña cambiada correctamente")}catch(a){u.value=((e=(f=a.response)==null?void 0:f.data)==null?void 0:e.error)||"Error al cambiar la contraseña"}finally{d.value=!1}}const C=m(document.documentElement.classList.contains("dark"));function P(){C.value=!C.value,document.documentElement.classList.toggle("dark",C.value),localStorage.setItem("facjp_dark",C.value?"1":"0")}O(()=>{localStorage.getItem("facjp_dark")==="1"&&(C.value=!0,document.documentElement.classList.add("dark"))});const q=A(()=>{var e,a;return(((e=t.user)==null?void 0:e.name)||((a=t.user)==null?void 0:a.username)||"U").charAt(0).toUpperCase()});function B(){t.logout(),k.push("/login")}function g(f){$.value&&!$.value.contains(f.target)&&(b.value=!1)}return O(()=>document.addEventListener("click",g)),Y(()=>document.removeEventListener("click",g)),(f,e)=>{var r,w,S;const a=X("router-link");return c(),M(W,null,[s("header",ua,[s("div",da,[s("button",{class:"menu-toggle",onClick:e[0]||(e[0]=(...p)=>l(i)&&l(i)(...p)),"aria-label":"Menú"},[j(l(Be),{size:20})]),s("h2",pa,z(_.title),1)]),s("div",ya,[l(t).currentBusiness?(c(),M("span",ha,[(r=l(h).profile)!=null&&r.logo?(c(),M("img",{key:0,src:l(h).profile.logo,class:"biz-logo",alt:"logo"},null,8,va)):(c(),I(l(oe),{key:1,size:14,class:"biz-icon"})),L(" "+z(l(t).currentBusiness.name),1)])):V("",!0),s("button",{class:"icon-btn",onClick:P,title:C.value?"Modo claro":"Modo oscuro"},[C.value?(c(),I(l(He),{key:0,size:17})):(c(),I(l(Pe),{key:1,size:17}))],8,fa),s("div",{class:"user-menu",onClick:e[6]||(e[6]=D(p=>b.value=!b.value,["stop"])),ref_key:"menuRef",ref:$},[s("div",ka,z(q.value),1),s("span",ma,z(((w=l(t).user)==null?void 0:w.name)||((S=l(t).user)==null?void 0:S.username)),1),j(l(we),{size:12,class:"arrow"}),j(ce,{name:"fade"},{default:E(()=>[b.value?(c(),M("div",{key:0,class:"dropdown-menu",onClick:e[5]||(e[5]=D(()=>{},["stop"]))},[l(t).isAdmin?(c(),I(a,{key:0,to:"/admin/setup",class:"dropdown-item",onClick:e[1]||(e[1]=p=>b.value=!1)},{default:E(()=>[j(l(ne),{size:15}),e[10]||(e[10]=L(" Configuración ",-1))]),_:1})):V("",!0),l(t).isSuperAdmin?(c(),I(a,{key:1,to:"/admin/franchises",class:"dropdown-item",onClick:e[2]||(e[2]=p=>b.value=!1)},{default:E(()=>[j(l(se),{size:15}),e[11]||(e[11]=L(" Franquicias ",-1))]),_:1})):V("",!0),l(t).businesses.length>1?(c(),I(a,{key:2,to:"/select-business",class:"dropdown-item",onClick:e[3]||(e[3]=p=>b.value=!1)},{default:E(()=>[j(l(ve),{size:15}),e[12]||(e[12]=L(" Cambiar negocio ",-1))]),_:1})):V("",!0),s("button",{class:"dropdown-item",onClick:e[4]||(e[4]=p=>{R.value=!0,b.value=!1})},[j(l(Ve),{size:15}),e[13]||(e[13]=L(" Cambiar contraseña ",-1))]),e[15]||(e[15]=s("div",{class:"dropdown-divider"},null,-1)),s("button",{class:"dropdown-item danger",onClick:B},[j(l(Ae),{size:15}),e[14]||(e[14]=L(" Cerrar sesión ",-1))])])):V("",!0)]),_:1})],512)])]),(c(),I(ue,{to:"body"},[R.value?(c(),M("div",{key:0,class:"modal-overlay",onClick:D(o,["self"])},[s("div",ba,[s("div",{class:"modal-header"},[e[16]||(e[16]=s("h3",{class:"modal-title"},"Cambiar contraseña",-1)),s("button",{class:"btn-close",onClick:o},"×")]),s("div",ga,[s("div",wa,[e[17]||(e[17]=s("label",{class:"form-label"},"Contraseña actual",-1)),F(s("input",{"onUpdate:modelValue":e[7]||(e[7]=p=>v.value.current=p),type:"password",class:"form-control"},null,512),[[N,v.value.current]])]),s("div",Ma,[e[18]||(e[18]=s("label",{class:"form-label"},"Nueva contraseña",-1)),F(s("input",{"onUpdate:modelValue":e[8]||(e[8]=p=>v.value.newPass=p),type:"password",class:"form-control"},null,512),[[N,v.value.newPass]])]),s("div",_a,[e[19]||(e[19]=s("label",{class:"form-label"},"Confirmar nueva contraseña",-1)),F(s("input",{"onUpdate:modelValue":e[9]||(e[9]=p=>v.value.confirm=p),type:"password",class:"form-control"},null,512),[[N,v.value.confirm]])]),u.value?(c(),M("p",$a,z(u.value),1)):V("",!0)]),s("div",xa,[s("button",{class:"btn btn-outline",onClick:o},"Cancelar"),s("button",{class:"btn btn-primary",onClick:x,disabled:d.value},z(d.value?"Guardando...":"Guardar"),9,Ca)])])])):V("",!0)]))],64)}}},Sa=J(za,[["__scopeId","data-v-d47873fe"]]),ja={class:"app-footer"},Ia={class:"footer-brand"},Va={class:"footer-logo"},Ra={class:"footer-copy"},Aa={__name:"AppFooter",setup(_){const t=new Date().getFullYear();return(h,k)=>(c(),M("footer",ja,[s("div",Ia,[s("div",Va,[j(l(ee),{size:12})]),k[0]||(k[0]=s("span",{class:"footer-name"},"facJp",-1)),k[1]||(k[1]=s("span",{class:"footer-sep"},"·",-1)),k[2]||(k[2]=s("span",{class:"footer-tagline"},"Gestión para bares y restaurantes",-1))]),s("div",Ra," © "+z(l(t))+" · Todos los derechos reservados ",1)]))}},Ba=J(Aa,[["__scopeId","data-v-734b035f"]]),Pa={class:"app-layout"},qa={class:"main-content"},La={class:"content-area"},Fa={__name:"PageLayout",props:{title:{type:String,default:"facJp"}},setup(_){return(t,h)=>(c(),M("div",Pa,[j(ca),s("div",qa,[j(Sa,{title:_.title},null,8,["title"]),s("div",La,[pe(t.$slots,"default")]),j(Ba)])]))}};export{Q as B,ge as C,Da as D,Ae as L,qe as P,Ee as R,Ne as W,Fa as _,ae as a,he as b,$e as c,Oe as d,ye as u};
