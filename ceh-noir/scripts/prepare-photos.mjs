// Deterministic clipping only. Pixels inside the mask remain the source photograph.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const source = path.join(root, 'source-images');
const output = path.join(root, 'assets', 'dishes');
await fs.mkdir(output, { recursive: true });
const photos = [
  {name:'oatmeal-cheese', file:'05-cheese-porridge.png', path:'M 185 814 C 160 540 401 283 799 266 C 1215 244 1517 425 1586 718 C 1637 936 1461 1200 1117 1303 C 788 1405 399 1290 247 1082 C 205 1015 181 911 185 814 Z', crop:{left:155,top:245,width:1465,height:1130}},
  {name:'oatmeal', file:'04-oatmeal.png', path:'M 185 814 C 160 540 401 283 799 266 C 1215 244 1517 425 1586 718 C 1637 936 1461 1200 1117 1303 C 788 1405 399 1290 247 1082 C 205 1015 181 911 185 814 Z', crop:{left:155,top:245,width:1465,height:1130}},
  {name:'carbonara', file:'02-carbonara.png', path:'M 167 763 C 131 548 304 325 637 262 C 989 192 1363 270 1528 501 C 1640 679 1564 936 1339 1093 C 1100 1245 725 1230 451 1118 C 270 1047 179 922 167 763 Z', crop:{left:135,top:225,width:1490,height:1025}},
  {name:'croissant-salmon', file:'09-croissant.png', path:'M 496 332 C 507 305 537 307 570 301 C 701 279 815 278 941 271 L 1171 251 C 1209 250 1228 274 1233 309 C 1258 355 1254 405 1267 440 C 1281 486 1275 535 1284 584 C 1296 647 1282 690 1297 744 C 1310 795 1292 831 1302 865 C 1315 915 1297 955 1265 966 C 1235 975 1188 955 1150 947 C 1048 937 961 906 880 893 C 766 879 691 851 627 823 C 575 800 541 783 533 744 C 520 690 520 641 507 586 C 485 546 493 511 502 486 C 492 450 479 420 493 384 C 490 363 490 349 496 332 Z', crop:{left:460,top:230,width:870,height:770}},
  {name:'rice-berry', file:'07-berry.png', path:'M 185 814 C 160 540 401 283 799 266 C 1215 244 1517 425 1586 718 C 1637 936 1461 1200 1117 1303 C 788 1405 399 1290 247 1082 C 205 1015 181 911 185 814 Z', crop:{left:155,top:245,width:1465,height:1130}},
  {name:'syrniki', file:'08-syrniki.png', path:'M 170 852 C 127 601 349 359 715 312 C 1071 266 1473 395 1588 635 C 1685 838 1575 1085 1346 1200 C 1008 1367 492 1252 288 1065 C 220 1002 181 925 170 852 Z', crop:{left:135,top:285,width:1515,height:1035}},
  {name:'pasta-chicken', file:'01-pasta.png', path:'M 238 763 C 198 554 359 326 661 262 C 989 192 1352 265 1500 501 C 1612 679 1532 936 1307 1093 C 1088 1245 725 1230 482 1118 C 328 1047 250 922 238 763 Z', crop:{left:210,top:225,width:1370,height:1025}},
  {name:'nicoise', file:'10-salad.png', path:'M 159 805 C 124 550 325 333 684 268 C 690 205 789 205 817 252 C 1130 218 1465 315 1576 566 C 1670 778 1563 1058 1343 1172 C 1088 1305 721 1306 450 1190 C 255 1106 170 962 159 805 Z', crop:{left:130,top:200,width:1500,height:1125}}
];
for (const photo of photos) {
  const input = await sharp(path.join(source, photo.file)).png().toBuffer();
  const { width, height } = await sharp(input).metadata();
  const factor = width / 1760;
  const crop = Object.fromEntries(Object.entries(photo.crop).map(([key, value]) => [key, Math.round(value * factor)]));
  const mask = Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 1760 ${height / factor}" xmlns="http://www.w3.org/2000/svg"><path d="${photo.path}" fill="white"/></svg>`);
  let clipped = await sharp(input).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
  if (photo.name === 'croissant-salmon') {
    // Flood only the neutral background connected to the mask boundary.
    // Golden food pixels and isolated highlights are not altered.
    const {data,info} = await sharp(clipped).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const visited = new Uint8Array(info.width*info.height), queue = new Int32Array(info.width*info.height);
    let head=0,tail=0;
    const eligible = (p) => { const i=p*4; const min=Math.min(data[i],data[i+1],data[i+2]),max=Math.max(data[i],data[i+1],data[i+2]); return data[i+3]===0 || min>155 && max-min<55; };
    const offer = p => { if(p<0 || p>=visited.length || visited[p] || !eligible(p)) return; visited[p]=1; queue[tail++]=p; };
    for(let x=0;x<info.width;x++){offer(x);offer((info.height-1)*info.width+x);}
    for(let y=0;y<info.height;y++){offer(y*info.width);offer(y*info.width+info.width-1);}
    while(head<tail){const p=queue[head++];data[p*4+3]=0;if(p%info.width)offer(p-1);if(p%info.width<info.width-1)offer(p+1);offer(p-info.width);offer(p+info.width);}
    clipped=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  }
  await sharp(clipped).extract(crop).resize({width:1200,withoutEnlargement:true}).webp({quality:90,alphaQuality:100}).toFile(path.join(output,photo.name+'.webp'));
  console.log(photo.name);
}
const {data,info} = await sharp(path.join(source,'15-logo.png')).resize({width:320}).removeAlpha().raw().toBuffer({resolveWithObject:true});
const logo = Buffer.alloc(info.width*info.height*4);
for(let pixel=0;pixel<info.width*info.height;pixel++) { const brightness=data[pixel*info.channels]; logo[pixel*4]=220;logo[pixel*4+1]=227;logo[pixel*4+2]=189;logo[pixel*4+3]=255-brightness; }
await sharp(logo,{raw:{width:info.width,height:info.height,channels:4}}).trim().png().toFile(path.join(root,'assets','brand-mark.png'));
