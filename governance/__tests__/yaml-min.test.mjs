import { parse } from '../engine/yaml-min.js';
let pass=0, fail=0;
function eq(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function t(name, text, expected){
  try {
    const got = parse(text);
    if (eq(got, expected)) { pass++; }
    else { fail++; console.log(`FAIL ${name}\n  expected: ${JSON.stringify(expected)}\n  got:      ${JSON.stringify(got)}`); }
  } catch(e){ fail++; console.log(`ERROR ${name}: ${e.message}`); }
}

t('scalars', `flow: test\nversion: 1\nactive: true\nempty: null`, {flow:'test',version:1,active:true,empty:null});
// Accented UTF-8 in a quoted string must round-trip intact — keep the accent here on purpose.
t('quoted string (accented UTF-8)', `msg: "olá mundo"\nmsg2: 'simple'`, {msg:'olá mundo',msg2:'simple'});
t('nested map', `a:\n  b: 1\n  c: 2`, {a:{b:1,c:2}});
t('scalar list', `items:\n  - one\n  - two`, {items:['one','two']});
t('list of maps', `steps:\n  - id: a\n    type: runs\n  - id: b\n    type: terminal`, {steps:[{id:'a',type:'runs'},{id:'b',type:'terminal'}]});
t('comment and blank', `# comment\nflow: x\n\nversion: 2`, {flow:'x',version:2});
t('literal block', `prompt: |\n  line 1\n  line 2\nother: end`, {prompt:'line 1\nline 2\n',other:'end'});
t('options list', `options:\n  - yes\n  - no`, {options:['yes','no']});
t('map with nested list', `step:\n  id: rev\n  expects:\n    - approved\n    - rejected`, {step:{id:'rev',expects:['approved','rejected']}});
t('negative num and float', `a: -5\nb: 1.5`, {a:-5,b:1.5});
t('doc marker', `---\nflow: y`, {flow:'y'});
t('on_result map', `on_result:\n  approved: gate\n  rejected: back`, {on_result:{approved:'gate',rejected:'back'}});
t('list of maps with nested input', `steps:\n  - id: a\n    type: agent\n    input:\n      x: "1"\n  - id: b\n    type: terminal`, {steps:[{id:'a',type:'agent',input:{x:'1'}},{id:'b',type:'terminal'}]});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
