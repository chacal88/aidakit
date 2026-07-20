import { parse } from '../engine/yaml-min.js';
let pass=0, fail=0;
function eq(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function t(name, text, expected){
  try {
    const got = parse(text);
    if (eq(got, expected)) { pass++; }
    else { fail++; console.log(`FAIL ${name}\n  esperado: ${JSON.stringify(expected)}\n  obtido:   ${JSON.stringify(got)}`); }
  } catch(e){ fail++; console.log(`ERRO ${name}: ${e.message}`); }
}
// Asserts that parsing `text` throws an Error whose message matches `re`.
function tThrows(name, text, re){
  try {
    const got = parse(text);
    fail++; console.log(`FAIL ${name}\n  esperava erro, obteve: ${JSON.stringify(got)}`);
  } catch(e){
    if (re.test(e.message)) { pass++; }
    else { fail++; console.log(`FAIL ${name}\n  erro não casou ${re}: ${e.message}`); }
  }
}

t('scalars', `flow: teste\nversion: 1\nativo: true\nvazio: null`, {flow:'teste',version:1,ativo:true,vazio:null});
t('quoted string', `msg: "olá mundo"\nmsg2: 'simples'`, {msg:'olá mundo',msg2:'simples'});
t('nested map', `a:\n  b: 1\n  c: 2`, {a:{b:1,c:2}});
t('scalar list', `items:\n  - um\n  - dois`, {items:['um','dois']});
t('list of maps', `steps:\n  - id: a\n    type: runs\n  - id: b\n    type: terminal`, {steps:[{id:'a',type:'runs'},{id:'b',type:'terminal'}]});
t('comment and blank', `# comentário\nflow: x\n\nversion: 2`, {flow:'x',version:2});
t('literal block', `prompt: |\n  linha 1\n  linha 2\noutro: fim`, {prompt:'linha 1\nlinha 2\n',outro:'fim'});
t('options list', `options:\n  - yes\n  - no`, {options:['yes','no']});
t('map with nested list', `step:\n  id: rev\n  expects:\n    - approved\n    - rejected`, {step:{id:'rev',expects:['approved','rejected']}});
t('negative num and float', `a: -5\nb: 1.5`, {a:-5,b:1.5});
t('doc marker', `---\nflow: y`, {flow:'y'});
t('on_result map', `on_result:\n  approved: gate\n  rejected: back`, {on_result:{approved:'gate',rejected:'back'}});
t('list of maps with nested input', `steps:\n  - id: a\n    type: agent\n    input:\n      x: "1"\n  - id: b\n    type: terminal`, {steps:[{id:'a',type:'agent',input:{x:'1'}},{id:'b',type:'terminal'}]});
// aidakit.config.yaml shape: block lists nested under maps (domains / review.matrix).
t('config block-lists (domains + matrix)', `domains:\n  by-path:\n    core:\n      - "src/core/**"\n      - "packages/*/src/**"\n  strictness:\n    - core\n    - web\nreview:\n  matrix:\n    contract:\n      - reviewer-security\n      - reviewer-architecture`, {domains:{'by-path':{core:['src/core/**','packages/*/src/**']},strictness:['core','web']},review:{matrix:{contract:['reviewer-security','reviewer-architecture']}}});
// Flow-style collections are out of scope: throw (with the line), never mis-read as a string.
tThrows('inline array throws', `strictness: [core, web]`, /line 1:.*flow-style/);
tThrows('inline map throws', `on_result: {approved: gate}`, /flow-style/);
// A bracketed value that is genuinely literal text stays legal when quoted.
t('quoted brackets stay literal', `label: "[core, web]"`, {label:'[core, web]'});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
