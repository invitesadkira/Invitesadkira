// QR Code generator — pure JS, no external dependencies, no CDN, no API calls
// Based on the QR Code Model 2 algorithm. Exposes window.QRCode.toDataURL() and .toCanvas()
(function(g){'use strict';
// GF(256) arithmetic
var EXP=new Uint8Array(512),LOG=new Uint8Array(256);
(function(){var x=1;for(var i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x=x*2^(x>=128?0x11d:0);}for(var i=255;i<512;i++)EXP[i]=EXP[i-255];})();
function gm(a,b){return a&&b?EXP[LOG[a]+LOG[b]]:0;}
function gp(d){var p=[1];for(var i=0;i<d;i++){var r=[1,EXP[i]],res=[];for(var j=0;j<=i+1;j++)res[j]=0;for(var j=0;j<p.length;j++)for(var k=0;k<r.length;k++)res[j+k]^=gm(p[j],r[k]);p=res;}return p;}
function rs(data,ec){var gen=gp(ec),res=data.concat(new Array(ec).fill(0));for(var i=0;i<data.length;i++){var c=res[i];if(c)for(var j=0;j<gen.length;j++)res[i+j]^=gm(gen[j],c);}return res.slice(data.length);}

// Version capacity (bytes, EC=M)
var VCAP=[0,16,28,44,64,86,108,124,154,182,216,254];
// EC codewords per block [total_ec, blocks, ec_per_block]
var VEC=[[0,0,0],[10,1,10],[16,1,16],[26,1,26],[18,2,18],[24,2,24],[16,4,16],[18,4,18],[22,4,22],[22,5,22],[26,6,26],[30,6,30]];
// Alignment positions
var ALIGN=[[],[],[],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54]];

function bestVer(len){for(var v=1;v<=11;v++)if(len<=VCAP[v])return v;return 11;}

function encode(text){
  var bytes=[];for(var i=0;i<text.length;i++){var c=text.charCodeAt(i);if(c>127){bytes.push(0xEF,0xBB,0xBF);bytes=[];var tb=unescape(encodeURIComponent(text));for(var j=0;j<tb.length;j++)bytes.push(tb.charCodeAt(j));break;}else bytes.push(c);}
  var ver=bestVer(bytes.length),cap=VCAP[ver];
  var bits=[];function pushB(v,n){for(var i=n-1;i>=0;i--)bits.push((v>>i)&1);}
  pushB(4,4);pushB(bytes.length,ver<10?8:16);
  for(var i=0;i<bytes.length;i++)pushB(bytes[i],8);
  pushB(0,Math.min(4,cap*8-bits.length));
  while(bits.length%8)bits.push(0);
  var pads=[0xEC,0x11],pi=0;while(bits.length<cap*8)pushB(pads[pi++%2],8);
  var data=[];for(var i=0;i<bits.length;i+=8){var b=0;for(var j=0;j<8;j++)b=(b<<1)|bits[i+j];data.push(b);}
  var ecInfo=VEC[ver],ecPerBlock=ecInfo[2],nBlocks=ecInfo[1];
  var blockLen=Math.floor(data.length/nBlocks),extra=data.length%nBlocks;
  var blocks=[],ecBlocks=[];
  for(var i=0,pos=0;i<nBlocks;i++){var bl=blockLen+(i>=nBlocks-extra?1:0);blocks.push(data.slice(pos,pos+bl));ecBlocks.push(rs(data.slice(pos,pos+bl),ecPerBlock));pos+=bl;}
  var final_data=[];
  var maxLen=blocks[blocks.length-1].length;
  for(var i=0;i<maxLen;i++)for(var j=0;j<blocks.length;j++)if(i<blocks[j].length)final_data.push(blocks[j][i]);
  for(var i=0;i<ecPerBlock;i++)for(var j=0;j<ecBlocks.length;j++)final_data.push(ecBlocks[j][i]);
  final_data.push(0);
  var fbits=[];for(var i=0;i<final_data.length;i++)for(var b=7;b>=0;b--)fbits.push((final_data[i]>>b)&1);
  return{ver:ver,bits:fbits};
}

function makeMatrix(ver,bits){
  var sz=ver*4+17,M=[];
  for(var i=0;i<sz;i++){M.push(new Array(sz).fill(-1));}
  function setFinder(r,c){for(var i=0;i<7;i++)for(var j=0;j<7;j++){var v=(i==0||i==6||j==0||j==6)?1:(i>=2&&i<=4&&j>=2&&j<=4?1:0);M[r+i][c+j]=v;}for(var i=-1;i<=7;i++){if(r+i>=0&&r+i<sz){if(c-1>=0)M[r+i][c-1]=0;if(c+7<sz)M[r+i][c+7]=0;}if(c+i>=0&&c+i<sz){if(r-1>=0)M[r-1][c+i]=0;if(r+7<sz)M[r+7][c+i]=0;}}}
  setFinder(0,0);setFinder(0,sz-7);setFinder(sz-7,0);
  for(var i=8;i<sz-8;i++){M[6][i]=i%2==0?1:0;M[i][6]=i%2==0?1:0;}
  M[sz-8][8]=1;
  var aligns=ALIGN[ver];
  for(var a=0;a<aligns.length;a++)for(var b=0;b<aligns.length;b++){var r=aligns[a],c=aligns[b];if(M[r][c]!=-1)continue;for(var i=-2;i<=2;i++)for(var j=-2;j<=2;j++){var v=(Math.abs(i)==2||Math.abs(j)==2)?1:(i==0&&j==0?1:0);M[r+i][c+j]=v;}}
  var used=[];for(var i=0;i<sz;i++)used.push(new Array(sz).fill(false));
  for(var i=0;i<sz;i++)for(var j=0;j<sz;j++)if(M[i][j]!=-1)used[i][j]=true;
  for(var i=0;i<8;i++){used[i][8]=true;used[8][i]=true;used[sz-1-i][8]=true;used[8][sz-8+i]=true;}
  used[8][8]=true;
  var bi=0,col=sz-1,row=sz-1,up=true;
  while(col>0){if(col==6)col--;
    for(var count=0;count<sz*2&&bi<bits.length;count++){var r=row,c=col-(count%2==0?0:1);if(!used[r][c]){M[r][c]=bits[bi++];if(count%2==1){if(up)row--;else row++;if(row<0){row=0;up=false;col-=2;row=0;}else if(row>=sz){row=sz-1;up=true;col-=2;row=sz-1;}}}if(up&&count%2==1&&row<0){row=0;up=false;col-=2;}else if(!up&&count%2==1&&row>=sz){row=sz-1;up=true;col-=2;}}
    break;}
  // Place data
  var bi2=0,cx=sz-1,up2=true,row2=sz-1;
  while(cx>0){if(cx==6)cx--;
    for(var dy=0;dy<sz;dy++){var r2=up2?sz-1-dy:dy;for(var dx=0;dx<2;dx++){var cc=cx-dx;if(!used[r2][cc]&&bi2<bits.length){M[r2][cc]=bits[bi2++];}}}
    cx-=2;up2=!up2;}
  // Apply mask 0: (r+c)%2==0
  for(var r=0;r<sz;r++)for(var c=0;c<sz;c++)if(!used[r][c]&&M[r][c]!=-1&&(r+c)%2==0)M[r][c]^=1;
  // Format info (mask 0, EC=M → pattern 101010000010010)
  var fmt=[1,0,1,0,1,0,0,0,0,0,1,0,0,1,0];
  var fpos=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  for(var i=0;i<15;i++){M[fpos[i][0]][fpos[i][1]]=fmt[i];M[sz-1-i<sz?sz-1-i:0][8]=(i<7?fmt[14-i]:0);M[8][sz-8+i]=(i<8?fmt[i]:0);}
  return M;
}

function drawMatrix(M,canvas,size){
  var sz=M.length,mod=Math.floor(size/sz);
  canvas.width=canvas.height=sz*mod;
  var ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#000';
  for(var r=0;r<sz;r++)for(var c=0;c<sz;c++)if(M[r][c])ctx.fillRect(c*mod,r*mod,mod,mod);
}

g.QRCode={
  toDataURL:function(text,opts){
    return new Promise(function(resolve,reject){
      try{var enc=encode(text),M=makeMatrix(enc.ver,enc.bits);var cv=document.createElement('canvas');drawMatrix(M,cv,(opts&&opts.width)||256);resolve(cv.toDataURL('image/png'));}
      catch(e){reject(e);}
    });
  },
  toCanvas:function(canvas,text,opts){
    return new Promise(function(resolve,reject){
      try{var enc=encode(text),M=makeMatrix(enc.ver,enc.bits);drawMatrix(M,canvas,(opts&&opts.width)||200);resolve();}
      catch(e){reject(e);}
    });
  }
};
})(window);
