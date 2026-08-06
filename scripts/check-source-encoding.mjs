import fs from "node:fs";
import path from "node:path";
const roots=["app","components","lib","prisma","scripts"];const extensions=new Set([".ts",".tsx",".js",".mjs",".css",".json",".prisma"]);let failed=false;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(extensions.has(path.extname(entry.name))){const data=fs.readFileSync(full);if(data.includes(0)){console.error(`NULL BYTE / UTF-16 SOURCE: ${full}`);failed=true;}try{new TextDecoder("utf-8",{fatal:true}).decode(data);}catch{console.error(`INVALID UTF-8: ${full}`);failed=true;}}}}
for(const root of roots)if(fs.existsSync(root))walk(root);for(const bad of ["ThemeMenu.tsx","TitanTheme.module.css"]){if(fs.existsSync(bad)){console.error(`MISPLACED ROOT FILE: ${bad}`);failed=true;}}if(failed)process.exit(1);console.log("Source encoding and placement checks passed.");
