// Single-process fallback for environments that disallow native build subprocesses.
import {rollup} from 'rollup';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import {transformAsync} from '@babel/core';
import jsx from '@babel/plugin-transform-react-jsx';
import fs from 'node:fs/promises';
await fs.mkdir('dist/assets',{recursive:true});
await fs.copyFile('src/style.css','dist/assets/style.css');
const bundle=await rollup({input:'src/main.jsx',plugins:[{name:'portable-source',transform:async(code,id)=>{if(id.endsWith('.css'))return{code:'',map:null};if(!id.includes('node_modules')){code=code.replaceAll('import.meta.env.VITE_API_URL',JSON.stringify(process.env.VITE_API_URL||''));}code=code.replaceAll('process.env.NODE_ENV','"production"');if(id.endsWith('.jsx'))return transformAsync(code,{plugins:[[jsx,{runtime:'automatic'}]],sourceMaps:false,babelrc:false,configFile:false});return{code,map:null};}},nodeResolve({browser:true,extensions:['.js','.jsx','.json'],exportConditions:['browser']}),commonjs()],onwarn(w,warn){if(w.code!=='CIRCULAR_DEPENDENCY'&&w.code!=='THIS_IS_UNDEFINED'&&w.code!=='MODULE_LEVEL_DIRECTIVE')warn(w);}});
await bundle.write({dir:'dist/assets',format:'es',entryFileNames:'app.js',chunkFileNames:'[name]-[hash].js'});
await fs.writeFile('dist/index.html',(await fs.readFile('index.html','utf8')).replace('<script type="module" src="/src/main.jsx"></script>','<link rel="stylesheet" href="/assets/style.css"><script type="module" src="/assets/app.js"></script>'));
await bundle.close();
console.log('Portable production build written to dist/.');
