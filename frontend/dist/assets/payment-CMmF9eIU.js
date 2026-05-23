import{P as v,u as m,r as p,x as r}from"./index-DrkwUN6I.js";import{R as d,W as L}from"./PageLayout-Nwb3x7h0.js";import{c as u}from"./utensils-crossed-t5g-1vJs.js";const P=v("sales",()=>{const a=m(),s=p([]),o=p(!1);function n(){var e;return(e=a.currentBusiness)==null?void 0:e.id}async function l(e={}){if(n()){o.value=!0;try{const t=await r.get(`/api/${n()}/sales`,{params:e});return s.value=t.data,t.data}finally{o.value=!1}}}async function y(e){const t=await r.post(`/api/${n()}/sales`,e);return s.value.unshift(t.data.sale),t.data}async function g(e){return(await r.get(`/api/${n()}/sales/${e}`)).data}async function h(){return(await r.get(`/api/${n()}/invoices`)).data}function w(e){return`/api/${n()}/invoices/${e}/pdf?token=${a.token}`}async function x(e,t){a.token;const c=new URLSearchParams;e&&c.append("from",e),t&&c.append("to",t);const k=await r.get(`/api/${n()}/reports/export/excel?${c}`,{responseType:"blob"}),f=window.URL.createObjectURL(new Blob([k.data])),i=document.createElement("a");i.href=f,i.download=`reporte-ventas-${Date.now()}.xlsx`,i.click(),window.URL.revokeObjectURL(f)}async function b(e={}){return(await r.get(`/api/${n()}/reports/sales`,{params:e})).data}return{sales:s,loading:o,fetchSales:l,createSale:y,getSale:g,fetchInvoices:h,getPdfUrl:w,exportExcel:x,fetchReports:b}});/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=u("banknote",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=u("credit-card",[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R=u("smartphone",[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]]),j={efectivo:"Efectivo",transferencia:"Transferencia",tarjeta:"Tarjeta",pago_fiado:"Pago de fiado"},B={efectivo:"badge-success",transferencia:"badge-info",tarjeta:"badge-warning",pago_fiado:"badge-purple"},C={efectivo:S,transferencia:R,tarjeta:$,pago_fiado:L};function z(a){return a?j[a.toLowerCase()]||a:"—"}function A(a){return a&&B[a.toLowerCase()]||"badge-default"}function M(a){return a?C[a.toLowerCase()]||d:d}export{z as a,A as b,M as p,P as u};
