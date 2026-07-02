import{P as $,u as m,r as p,y as r}from"./index-BQUd4TRk.js";import{R as l,W as L}from"./PageLayout-cXYaQe6Z.js";import{c as d}from"./utensils-crossed-BInSkGK0.js";const z=$("sales",()=>{const a=m(),o=p([]),u=p(!1);function n(){var e;return(e=a.currentBusiness)==null?void 0:e.id}async function y(e={}){if(n()){u.value=!0;try{const t=await r.get(`/api/${n()}/sales`,{params:e});return o.value=t.data,t.data}finally{u.value=!1}}}async function g(e){const t=await r.post(`/api/${n()}/sales`,e);return o.value.unshift(t.data.sale),t.data}async function w(e,t){const s=await r.put(`/api/${n()}/sales/${e}`,t),c=o.value.findIndex(i=>i.id===e);return c!==-1&&(o.value[c]=s.data.sale),s.data}async function h(e){return(await r.get(`/api/${n()}/sales/${e}`)).data}async function x(){return(await r.get(`/api/${n()}/invoices`)).data}function v(e){return`/api/${n()}/invoices/${e}/pdf?token=${a.token}`}async function b(e,t){a.token;const s=new URLSearchParams;e&&s.append("from",e),t&&s.append("to",t);const c=await r.get(`/api/${n()}/reports/export/excel?${s}`,{responseType:"blob"}),i=window.URL.createObjectURL(new Blob([c.data])),f=document.createElement("a");f.href=i,f.download=`reporte-ventas-${Date.now()}.xlsx`,f.click(),window.URL.revokeObjectURL(i)}async function k(e={}){return(await r.get(`/api/${n()}/reports/sales`,{params:e})).data}return{sales:o,loading:u,fetchSales:y,createSale:g,updateInvoice:w,getSale:h,fetchInvoices:x,getPdfUrl:v,exportExcel:b,fetchReports:k}});/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=d("banknote",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R=d("credit-card",[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=d("smartphone",[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]]),j={efectivo:"Efectivo",transferencia:"Transferencia",tarjeta:"Tarjeta",pago_fiado:"Pago de fiado"},B={efectivo:"badge-success",transferencia:"badge-info",tarjeta:"badge-warning",pago_fiado:"badge-purple"},C={efectivo:S,transferencia:I,tarjeta:R,pago_fiado:L};function A(a){return a?j[a.toLowerCase()]||a:"—"}function M(a){return a&&B[a.toLowerCase()]||"badge-default"}function O(a){return a?C[a.toLowerCase()]||l:l}export{A as a,M as b,O as p,z as u};
