import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const page=readFileSync('index.html','utf8');
for(const x of ['SRC Enterprises','id="categories"','id="catalogue"','id="demos"','function renderDashboard','function safeUrl','https://srcenterprises.in/']) {
 assert(page.includes(x), 'Missing '+x);
}
assert(!/api\.razorpay\.com|checkout\.razorpay\.com|new Razorpay\(/.test(page),'Fireworks payment functionality must remain disabled');
assert(page.includes('does not accept online orders'),'Public disclosure missing');
console.log('SRC static smoke checks passed (7 feature markers + payment guardrail).');
