(()=>{"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"₹"+(Number(n||0)/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
function download(invoice){
 const data=invoice.snapshot||{},q=data.quote||{},seller=data.seller||{},lines=Array.isArray(q.lines)?q.lines:[];
 const name=String(invoice.invoice_number||"SRC-BILL").replace(/[^A-Z0-9_-]/gi,"");
 const items=lines.map(l=>'<tr><td>'+esc(l.name)+'</td><td>'+Number(l.quantity||0)+'</td><td>'+money(l.unitPricePaise)+'</td><td>'+money(l.discountPaise)+'</td><td>'+money((l.taxes||[]).reduce((s,x)=>s+Number(x.amountPaise||0),0))+'</td><td>'+money(l.totalPaise)+'</td></tr>').join("");
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(name)+'</title><style>body{font:14px Arial,sans-serif;color:#173552;max-width:940px;margin:35px auto;padding:15px}h1{color:#0b4676}table{width:100%;border-collapse:collapse;margin-top:26px}th,td{border-bottom:1px solid #d8e4ee;padding:13px;text-align:left}th{background:#eff5fb}.meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:20px}.note{background:#fff3e5;border-left:4px solid #e97930;padding:14px;margin-top:22px}button{padding:12px 16px;background:#11699f;border:0;color:white;border-radius:8px;cursor:pointer}@media print{button{display:none}body{margin:0}}</style></head><body>'+
 '<h1>'+esc(seller.seller_name||"SRC Enterprises")+'</h1><div class="meta"><div><strong>Billing reference:</strong> '+esc(name)+'<p>Order: '+esc(data.orderId||"")+'</p><p>Payment reference: '+esc(data.paymentReference||"")+'</p></div><div><strong>Document type:</strong> '+esc(invoice.kind||"DRAFT")+'<p>Created: '+esc(new Date(invoice.generated_at||Date.now()).toLocaleString("en-IN"))+'</p><p>Seller GSTIN: '+esc(seller.seller_gstin||"Not configured")+'</p></div></div>'+
 '<table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Discount</th><th>Tax</th><th>Line total</th></tr></thead><tbody>'+items+'</tbody></table>'+
 '<div style="text-align:right;margin-top:22px"><p>Subtotal: '+money(q.subtotalPaise)+'</p><p>Dynamic adjustment: '+money(q.dynamicAdjustmentPaise)+'</p><p>Discount: -'+money(q.discountPaise)+'</p><p>Tax total: '+money(q.taxPaise)+'</p><h2>Total: '+money(q.totalPaise||data.amountPaise)+'</h2></div>'+
 '<div class="note"><strong>DRAFT BILL · NOT A TAX INVOICE.</strong> Tax treatment and legal invoice details require seller verification and accountant approval. This is a record of the captured order price and does not represent a new payment request.</div>'+
 '<p><button onclick="window.print()">Print / Save as PDF</button></p></body></html>';
 const blob=new Blob([html],{type:"text/html;charset=utf-8"}),url=URL.createObjectURL(blob);
 const link=document.createElement("a");link.href=url;link.download=name+".html";document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),120000);
}
window.SRCReceipt={download};
})();