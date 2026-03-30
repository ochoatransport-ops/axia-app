import React, { useState, useMemo, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';


// hooks imported above

window.storage = {
  get: (key) => {
    try {
      const v = localStorage.getItem(key);
      return Promise.resolve(v ? {key, value: v} : null);
    } catch(e) { return Promise.resolve(null); }
  },
  set: (key, value) => {
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, str);
      return Promise.resolve({key, value: str});
    } catch(e) { return Promise.resolve(null); }
  },
  delete: (key) => {
    try { localStorage.removeItem(key); return Promise.resolve({key, deleted:true}); }
    catch(e) { return Promise.resolve(null); }
  },
  list: (prefix) => {
    try {
      const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix));
      return Promise.resolve({keys});
    } catch(e) { return Promise.resolve({keys:[]}); }
  }
}



const C = {
  bg:"#f5f5f4", surface:"#ffffff", card:"#ffffff",
  border:"#e7e5e4", border2:"#d6d3d1",
  accent:"#1c1917", accent2:"#44403c", accent3:"#78716c",
  text:"#1c1917", textMid:"#44403c", textDim:"#a8a29e",
  green:"#16a34a", red:"#dc2626", yellow:"#d97706", blue:"#2563eb",
  font:"'Outfit',sans-serif",
};

const CLIENTES_INIT = [];
const PROVEEDORES_INIT = [];
const VENDEDORES_INIT = [];
const PEDIDOS_INIT = [];

const ABONOS_PROV_INIT = [];
const ABONOS_CLI_INIT = [];
const STATUS_OPTS = ["","PAGADO","PAGADO TRANSFERENCIA","PENDIENTE","ABONO PARCIAL"];
const TABS = ["📦 Pedidos","🏭 Proveedores","👥 Clientes","📊 Resumen","💵 Flujo de Efectivo","🏪 Bodega"];
const gColor=v=>v>0?"#16a34a":v<0?"#dc2626":"#9ca3af";
const sColor=v=>v>0?"#dc2626":v<0?"#16a34a":"#9ca3af";
const fmt = v => new Intl.NumberFormat("es-MX",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0);

const inp={width:"100%",background:"#ffffff",border:"1px solid #e7e5e4",borderRadius:8,padding:"9px 12px",fontSize:13,fontFamily:"'Outfit',sans-serif",color:"#1c1917",outline:"none"}
const btnP={background:"#1c1917",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:600};

const sstyle = s => {
  if (!s) return {bg:"#f1f1f1",c:"#aaaaaa",label:"—"};
  if (s==="N/A") return {bg:"#e0e7ff",c:"#4338ca",label:"N/A"};
  if (s.includes("PAGADO")) return {bg:"#dcfce7",c:"#15803d",label:s};
  if (s==="ABONO PARCIAL") return {bg:"#fef9c3",c:"#a16207",label:s};
  if (s==="PENDIENTE") return {bg:"#fee2e2",c:"#b91c1c",label:s};
  return {bg:"#f1f1f1",c:"#555555",label:s};
};

function exportCSV(pedidos,abonosProv,abonosCli) {
  const esc = v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const rows=[
    ["AXIA Distribution & Supply — Reporte"],
    [`Generado: ${new Date().toLocaleString("es-MX")}`],[""],
    ["#","VENDEDOR","PROVEEDOR","CLIENTE","MERCANCÍA","CANTIDAD","COSTO UNIT","COSTO TOTAL","PRECIO VENTA","TOTAL VENTA","GANANCIA","CLIENTE PAGÓ","YO RECIBÍ","PAGUÉ PROVEEDOR"],
    ...pedidos.map(p=>{const ct=p.costo+(p.otroCosto||0);return[p.id,p.vendedor||"—",p.proveedor,p.cliente,p.mercancia,p.cant,p.unitario,ct,p.precioPublico,p.total,(p.total-ct),p.clientePago||"—",p.recibido||"—",p.pagadoProveedor||"—"];}),
    [""],["ABONOS A PROVEEDORES"],["PROVEEDOR","FECHA","MONTO","NOTA"],
    ...abonosProv.map(a=>[a.proveedor,a.fecha,a.monto,a.nota]),
    [""],["PAGOS DE CLIENTES"],["CLIENTE","FECHA","MONTO","NOTA"],
    ...abonosCli.map(a=>[a.cliente,a.fecha,a.monto,a.nota]),
  ];
  const blob=new Blob(["\uFEFF"+rows.map(r=>r.map(esc).join(",")).join("\n")],{type:"text/csv;charset=utf-8;"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`AXIA_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ── Shared mini-modal for adding a single name (proveedor, cliente, vendedor) ──
function AddNombreModal({title, placeholder, onSave, onClose}){
  const [val,setVal]=useState("");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:16,width:"min(420px,92vw)",padding:28,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,fontFamily:"'Outfit',sans-serif",fontSize:17,color:C.text}}>{title}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.textDim,lineHeight:1}}>✕</button>
        </div>
        <input
          value={val}
          onChange={e=>setVal(e.target.value.toUpperCase())}
          placeholder={placeholder}
          autoFocus
          style={{...inp,marginBottom:16}}
          onKeyDown={e=>{ if(e.key==="Enter" && val.trim()) { onSave(val.trim()); }}}
        />
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,fontFamily:"'Outfit',sans-serif",cursor:"pointer",fontSize:14}}>Cancelar</button>
          <button
            onClick={()=>{ if(val.trim()) onSave(val.trim()); }}
            style={{...btnP,flex:2,padding:"10px 0",fontSize:14}}
          >Agregar</button>
        </div>
      </div>
    </div>
  );
}

function Modal({title,onClose,children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#ffffff",border:"1px solid #e7e5e4",borderRadius:16,width:"min(600px,95vw)",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px",borderBottom:"1px solid #f5f5f4",position:"sticky",top:0,background:"#ffffff",borderRadius:"16px 16px 0 0",zIndex:1}}>
          <div style={{fontFamily:"'Outfit',sans-serif",fontSize:16,fontWeight:700,color:"#1c1917"}}>{title}</div>
          <button onClick={onClose} style={{background:"#f5f5f4",border:"1px solid #e7e5e4",borderRadius:8,color:"#78716c",fontSize:16,cursor:"pointer",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}> ✕</button>
        </div>
        <div style={{padding:"20px 24px"}}>{children}</div>
      </div>
    </div>
  );
}

function Field({label,children}){
  return(
    <div style={{marginBottom:13}}>
      <label style={{display:"block",color:C.textDim,fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4,fontFamily:"'Outfit',sans-serif"}}>{label}</label>
      {children}
    </div>
  );
}
function Combo({value,onChange,options,placeholder}){
  const [q,setQ]=React.useState("");
  const [open,setOpen]=React.useState(false);
  const ref=React.useRef();
  React.useEffect(()=>{
    const fn=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",fn);
    return()=>document.removeEventListener("mousedown",fn);
  },[]);
  const filtered=options.filter(o=>o.toLowerCase().includes(q.toLowerCase()));
  return(
    <div ref={ref} style={{position:"relative"}}>
      <input
        value={open?q:(value||"")}
        onChange={e=>{setQ(e.target.value);setOpen(true);}}
        onFocus={()=>{setQ("");setOpen(true);}}
        placeholder={placeholder||"Buscar…"}
        style={{...inp,width:"100%",boxSizing:"border-box"}}
      />
      {open&&filtered.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",zIndex:9999,maxHeight:180,overflowY:"auto"}}>
          {filtered.map(o=>(
            <div key={o} onMouseDown={()=>{onChange(o);setQ("");setOpen(false);}}
              style={{padding:"8px 12px",cursor:"pointer",fontSize:13,color:C.text,background:o===value?"#f4f4f5":"#fff"}}
              onMouseEnter={e=>e.currentTarget.style.background="#f4f4f5"}
              onMouseLeave={e=>e.currentTarget.style.background=o===value?"#f4f4f5":"#fff"}
            >{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
function DistribuirPagosModal({nombre,pedidos,abonosCli,setPedidos,onClose,fmt,C,inp,btnP}){
  // Load existing assignments from pedidos (montoAsignado field)
  const init=()=>{
    const a={};
    pedidos.filter(p=>p.cliente===nombre&&p.montoAsignado>0).forEach(p=>{a[p.id]=p.montoAsignado;});
    return a;
  };
  const [asignaciones,setAsignaciones]=React.useState(init);

  const todos=pedidos.filter(p=>p.cliente===nombre&&!p.esBodega).sort((a,b)=>a.id-b.id);
  const pendientes=todos.filter(p=>p.clientePago!=="PAGADO"&&p.clientePago!=="PAGADO TRANSFERENCIA");
  const pagados=todos.filter(p=>p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA");
  const totalAbonado=abonosCli.filter(a=>a.cliente===nombre).reduce((s,a)=>s+a.monto,0);
  const totalAsignado=Object.values(asignaciones).reduce((s,v)=>s+(Number(v)||0),0);
  const saldoLibre=totalAbonado-totalAsignado;

  const aplicarTodo=()=>{
    let restante=totalAbonado;
    const nuevoAsig={};
    for(const p of todos){
      if(restante<=0) break;
      const asignar=Math.min(restante,p.total||0);
      nuevoAsig[p.id]=asignar;
      restante-=asignar;
    }
    setAsignaciones(nuevoAsig);
  };

  const guardar=()=>{
    setPedidos(prev=>prev.map(p=>{
      if(p.cliente!==nombre||p.esBodega) return p;
      const asig=Number(asignaciones[p.id])||0;
      const estado=asig<=0?"PENDIENTE":asig>=(p.total||0)?"PAGADO":"ABONO PARCIAL";
      return {...p,clientePago:estado,montoAsignado:asig};
    }));
    onClose();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:500,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:520,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"18px 22px",background:"linear-gradient(135deg,#09090b,#27272a)",borderRadius:"16px 16px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#fff",fontFamily:"'Outfit',sans-serif"}}>💸 Distribuir pagos — {nombre}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:2}}>Edita o borra asignaciones de pago</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,padding:"5px 11px",cursor:"pointer",color:"#fff",fontSize:15}}>✕</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:C.border}}>
          {[
            {l:"Total abonado",v:fmt(totalAbonado),c:C.green},
            {l:"Asignado",v:fmt(totalAsignado),c:C.textMid},
            {l:"Saldo libre",v:fmt(saldoLibre),c:saldoLibre>=0?C.blue:C.red},
          ].map(s=>(
            <div key={s.l} style={{background:"#fff",padding:"12px",textAlign:"center"}}>
              <div style={{fontSize:10,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>{s.l}</div>
              <div style={{fontSize:16,fontWeight:800,color:s.c,fontFamily:"'Outfit',sans-serif"}}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{padding:"18px 22px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.06em"}}>Todos los pedidos ({todos.length})</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={aplicarTodo} style={{fontSize:11,color:C.blue,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>⚡ Auto</button>
              <button onClick={()=>setAsignaciones({})} style={{fontSize:11,color:C.red,background:"#fff0f0",border:"1px solid #fecaca",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>✕ Limpiar todo</button>
            </div>
          </div>

          {todos.length===0&&(
            <div style={{padding:"20px",textAlign:"center",color:C.textDim,fontSize:13}}>Sin pedidos registrados</div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"45vh",overflowY:"auto",marginBottom:14}}>
            {todos.map(p=>{
              const asig=Number(asignaciones[p.id])||0;
              const cubierto=asig>=(p.total||0);
              const parcial=asig>0&&!cubierto;
              const esPagadoExt=p.clientePago==="PAGADO TRANSFERENCIA";
              return(
                <div key={p.id} style={{borderRadius:10,border:`1.5px solid ${cubierto?"#86efac":parcial?"#fde68a":C.border}`,background:cubierto?"#f0fdf4":parcial?"#fffbeb":"#fafafa",padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:C.text}}>Folio #{p.id} — {p.mercancia}</div>
                      <div style={{fontSize:11,color:C.textDim}}>{p.fecha} · {fmt(p.total||0)}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      {cubierto&&<div style={{fontSize:11,color:C.green,fontWeight:700}}>✓ Pagado</div>}
                      {parcial&&<div style={{fontSize:11,color:"#92400e",fontWeight:700}}>Parcial {fmt(asig)}</div>}
                      {!asig&&!esPagadoExt&&<div style={{fontSize:11,color:C.textDim}}>Sin asignar</div>}
                      {esPagadoExt&&<div style={{fontSize:11,color:C.blue,fontWeight:700}}>Transferencia</div>}
                    </div>
                  </div>
                  {!esPagadoExt&&(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <input type="number" value={asig||""} onChange={e=>setAsignaciones(prev=>({...prev,[p.id]:e.target.value}))} placeholder="Monto..." style={{...inp,flex:1,fontSize:12,padding:"5px 10px"}}/>
                      <button onClick={()=>setAsignaciones(prev=>({...prev,[p.id]:p.total||0}))} style={{fontSize:11,color:C.green,background:"#f0fdf4",border:"1px solid #86efac",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>Todo</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {saldoLibre>0&&totalAsignado>0&&(
            <div style={{padding:"10px 12px",background:"#eff6ff",borderRadius:8,border:"1px solid #bfdbfe",fontSize:12,color:"#1d4ed8",marginBottom:12}}>
              💰 Sobran <strong>{fmt(saldoLibre)}</strong> — quedarán como saldo a favor.
            </div>
          )}
          {saldoLibre<0&&(
            <div style={{padding:"10px 12px",background:"#fff1f2",borderRadius:8,border:"1px solid #fecdd3",fontSize:12,color:C.red,marginBottom:12}}>
              ⚠️ Estás asignando {fmt(Math.abs(saldoLibre))} más de lo disponible.
            </div>
          )}

          <div style={{display:"flex",gap:10}}>
            <button onClick={onClose} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,cursor:"pointer"}}>Cancelar</button>
            <button onClick={guardar} disabled={saldoLibre<0} style={{...btnP,flex:2,padding:"10px 0",fontSize:14,opacity:saldoLibre<0?0.5:1}}>Guardar cambios</button>
          </div>
        </div>
      </div>
    </div>
  );
}


function EstadoCuentaModal({nombre,pedidos,abonosCli,flujo,onClose,fmt,C,inp,btnP,periodo,periodoAnio,periodoMes,periodoSem,setPedidos}){
  const [pdfPeriodo,setPdfPeriodo]=React.useState(periodo||"todo");
  const [pdfAnio,setPdfAnio]=React.useState(periodoAnio||new Date().getFullYear().toString());
  const [pdfMes,setPdfMes]=React.useState(periodoMes||(new Date().getMonth()+1).toString().padStart(2,"0"));
  const [showPdfOpts,setShowPdfOpts]=React.useState(false);
  const [pdfMostrarSinDistribuir,setPdfMostrarSinDistribuir]=React.useState(true);

  const enPeriodoPdf=(fecha)=>{
    if(!fecha||pdfPeriodo==="todo") return true;
    if(pdfPeriodo==="anio") return fecha.startsWith(pdfAnio);
    if(pdfPeriodo==="mes") return fecha.startsWith(pdfAnio+"-"+pdfMes);
    return true;
  };

  const allPedidos=pedidos.filter(p=>p.cliente===nombre&&!p.esBodega).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const allAbonos=abonosCli.filter(a=>a.cliente===nombre).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const misPedidos=allPedidos.filter(p=>enPeriodoPdf(p.fecha));
  const misAbonos=allAbonos.filter(a=>enPeriodoPdf(a.fecha));
  const totalPedidos=misPedidos.reduce((s,p)=>s+(p.total||0),0);
  const totalAbonado=misAbonos.reduce((s,a)=>s+a.monto,0);
  const saldo=totalPedidos-totalAbonado;
  const pendientes=misPedidos.filter(p=>p.clientePago!=="PAGADO"&&p.clientePago!=="PAGADO TRANSFERENCIA");
  const pagados=misPedidos.filter(p=>p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA");

  const nombreMesPdf={"01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio","07":"Julio","08":"Agosto","09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre"};
  const añosPdf=[...new Set([...allPedidos,...allAbonos].map(x=>x.fecha?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
  const mesesPdf=["01","02","03","04","05","06","07","08","09","10","11","12"];

  const descargarPDF=()=>{
    const periodoLabel=pdfPeriodo==="todo"?"Historial completo":pdfPeriodo==="anio"?`Año ${pdfAnio}`:`${nombreMesPdf[pdfMes]} ${pdfAnio}`;
    const fechaDoc=new Date().toLocaleDateString("es-MX",{year:"numeric",month:"long",day:"numeric"});
    const fmtMXN=(n)=>"$"+Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});

    const totalAsignadoEnPedidos=allPedidos.filter(p=>enPeriodoPdf(p.fecha)).reduce((s,p)=>s+(p.montoAsignado||0),0);
    const saldoSinDistribuir=Math.max(0,totalAbonado-totalAsignadoEnPedidos);
    const totalPendiente=totalPedidos-totalAbonado;
    const pct=totalPedidos>0?Math.round((totalAbonado/totalPedidos)*100):0;

    const pedidosRows=misPedidos.map(p=>{
      const isPagado=p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA";
      const isParcial=p.clientePago==="ABONO PARCIAL";
      const asig=p.montoAsignado||0;
      const resta=(p.total||0)-asig;
      let estadoBadge,restaTxt;
      if(isPagado){
        estadoBadge=`<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">✓ Liquidado</span>`;
        restaTxt="—";
      } else if(isParcial){
        estadoBadge=`<span style="background:#fef9c3;color:#854d0e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">Parcial</span>`;
        restaTxt=`<span style="color:#dc2626;font-weight:700">${fmtMXN(resta)}</span>`;
      } else {
        estadoBadge=`<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">Pendiente</span>`;
        restaTxt=`<span style="color:#dc2626;font-weight:700">${fmtMXN(p.total||0)}</span>`;
      }
      return `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 12px;font-size:12px;color:#64748b">${p.fecha}</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:600">${p.mercancia}</td>
        <td style="padding:10px 12px;font-size:12px;text-align:right;color:#64748b">${p.cant||"—"}</td>
        <td style="padding:10px 12px;font-size:12px;text-align:right;color:#64748b">${p.precioPublico?fmtMXN(p.precioPublico):"—"}</td>
        <td style="padding:10px 12px;font-size:12px;text-align:right">${fmtMXN(p.total)}</td>
        <td style="padding:10px 12px;font-size:12px;text-align:right;color:#15803d">${asig>0?fmtMXN(asig):"—"}</td>
        <td style="padding:10px 12px;text-align:right">${restaTxt}</td>
        <td style="padding:10px 12px">${estadoBadge}</td>
      </tr>`;
    }).join("");

    const abonosRows=misAbonos.map(a=>`<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:10px 12px;font-size:12px;color:#64748b">${a.fecha}</td>
      <td style="padding:10px 12px;font-size:13px">${a.nota||"—"}</td>
      <td style="padding:10px 12px;font-size:14px;font-weight:800;color:#15803d;text-align:right">+${fmtMXN(a.monto)}</td>
    </tr>`).join("");

    const html=`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;background:#fff}
  .page{max-width:820px;margin:0 auto;padding:40px 48px}
  .brand{font-size:11px;font-weight:800;letter-spacing:.15em;color:#94a3b8;text-transform:uppercase;margin-bottom:20px}
  .top-header{padding-bottom:28px;border-bottom:3px solid #0f172a;margin-bottom:28px}
  .client-name{font-size:32px;font-weight:900;line-height:1;color:#0f172a;margin-bottom:4px}
  .doc-meta{font-size:12px;color:#64748b;margin-bottom:24px}

  .balance-hero{background:#0f172a;border-radius:16px;padding:28px 32px;display:flex;justify-content:space-between;align-items:center;margin-bottom:0}
  .balance-col{display:flex;flex-direction:column;gap:4px}
  .balance-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b}
  .balance-label.light{color:#94a3b8}
  .balance-amount{font-size:26px;font-weight:900;line-height:1}
  .balance-divider{width:1px;background:#334155;align-self:stretch}
  .balance-vs{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;flex:1;padding:0 32px}
  .vs-bar-wrap{width:100%;background:#1e293b;border-radius:99px;height:10px;overflow:hidden}
  .vs-bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#22c55e,#16a34a);transition:width .3s}
  .vs-pct{font-size:13px;font-weight:700;color:#94a3b8}

  .deuda-box{margin-top:20px;border:2px solid #dc2626;border-radius:12px;padding:20px 28px;display:flex;justify-content:space-between;align-items:center;background:#fff9f9}
  .deuda-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#dc2626;margin-bottom:6px}
  .deuda-amount{font-size:40px;font-weight:900;color:#dc2626;line-height:1}
  .deuda-note{font-size:12px;color:#64748b;max-width:220px;text-align:right;line-height:1.5}

  .notice{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin:24px 0;display:flex;align-items:center;gap:12px}
  .notice-text{font-size:12px;color:#78350f;line-height:1.5}
  .notice-amount{font-size:14px;font-weight:800;color:#92400e}
  .section-title{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
  table{width:100%;border-collapse:collapse}
  th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;padding:8px 12px;text-align:left;background:#f8fafc;border-bottom:1px solid #e2e8f0}
  th.r{text-align:right}
  .footer{margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head><body><div class="page">



  <div class="top-header">
    <div class="client-name">${nombre}</div>
    <div class="doc-meta">Estado de cuenta &nbsp;·&nbsp; ${periodoLabel} &nbsp;·&nbsp; ${fechaDoc}</div>

    <div class="balance-hero">
      <div class="balance-col">
        <div class="balance-label light">Total en pedidos</div>
        <div class="balance-amount" style="color:#fff">${fmtMXN(totalPedidos)}</div>
      </div>
      <div class="balance-vs">
        <div class="vs-pct">${pct}% pagado</div>
        <div class="vs-bar-wrap"><div class="vs-bar-fill" style="width:${Math.min(pct,100)}%"></div></div>
      </div>
      <div class="balance-col" style="text-align:right">
        <div class="balance-label light">Total abonado</div>
        <div class="balance-amount" style="color:#4ade80">${fmtMXN(totalAbonado)}</div>
      </div>
    </div>

    <div class="deuda-box">
      <div>
        <div class="deuda-label">Saldo pendiente por pagar</div>
        <div class="deuda-amount">${fmtMXN(totalPendiente)}</div>
      </div>
      <div class="deuda-note">Diferencia entre lo comprado y lo pagado hasta la fecha.</div>
    </div>
  </div>

  ${(saldoSinDistribuir>0&&pdfMostrarSinDistribuir)?`<div class="notice">
    <div style="font-size:20px">💰</div>
    <div class="notice-text">Hay pagos recibidos aún no aplicados a pedidos específicos.<br>
    <span class="notice-amount">Saldo disponible sin distribuir: ${fmtMXN(saldoSinDistribuir)}</span></div>
  </div>`:""}

  ${misPedidos.length>0?`
  <div class="section-title">Detalle de pedidos</div>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Mercancía</th><th class="r">Cant.</th><th class="r">Precio unit.</th>
      <th class="r">Total</th><th class="r">Abonado</th><th class="r">Resta</th><th>Estado</th>
    </tr></thead>
    <tbody>${pedidosRows}</tbody>
  </table>`:""}

  ${misAbonos.length>0?`
  <div class="section-title">Pagos recibidos</div>
  <table>
    <thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Monto</th></tr></thead>
    <tbody>${abonosRows}</tbody>
    <tfoot><tr>
      <td colspan="2" style="padding:12px;font-size:12px;font-weight:700;color:#64748b;text-align:right;border-top:2px solid #e2e8f0">Total abonado:</td>
      <td style="padding:12px;font-size:16px;font-weight:900;color:#15803d;text-align:right;border-top:2px solid #e2e8f0">${fmtMXN(totalAbonado)}</td>
    </tr></tfoot>
  </table>`:""}

  <div class="footer">
    <span>AXIA Distribution &amp; Supply — Documento confidencial</span>
    <span>Generado el ${fechaDoc}</span>
  </div>
</div></body></html>`;

    const win=window.open("","_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(()=>win.print(),600);
    setShowPdfOpts(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:500,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:640,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
        {/* Header */}
        <div style={{padding:"20px 24px",background:"linear-gradient(135deg,#09090b,#27272a)",borderRadius:"16px 16px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#fff",fontFamily:"'Outfit',sans-serif"}}>{nombre}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:2}}>Estado de cuenta</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setShowPdfOpts(p=>!p)} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600}}>📄 PDF</button>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#fff",fontSize:16}}>✕</button>
          </div>
        </div>

        {/* PDF options panel */}
        {showPdfOpts&&(
          <div style={{padding:"14px 20px",background:"#eff6ff",borderBottom:"1px solid #bfdbfe",display:"flex",flexWrap:"wrap",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,fontWeight:600,color:"#1d4ed8",flexShrink:0}}>📅 Periodo del reporte:</span>
            {["todo","anio","mes"].map(op=>(
              <button key={op} onClick={()=>setPdfPeriodo(op)} style={{padding:"4px 12px",borderRadius:20,border:`1px solid ${pdfPeriodo===op?"#1d4ed8":"#bfdbfe"}`,background:pdfPeriodo===op?"#1d4ed8":"#fff",color:pdfPeriodo===op?"#fff":"#1d4ed8",fontSize:12,cursor:"pointer",fontWeight:pdfPeriodo===op?600:400}}>
                {op==="todo"?"Historial completo":op==="anio"?"Por año":"Por mes"}
              </button>
            ))}
            {(pdfPeriodo==="anio"||pdfPeriodo==="mes")&&(
              <select value={pdfAnio} onChange={e=>setPdfAnio(e.target.value)} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #bfdbfe",fontSize:12,color:"#1d4ed8",background:"#fff",cursor:"pointer"}}>
                {(añosPdf.length>0?añosPdf:[new Date().getFullYear().toString()]).map(a=>(<option key={a} value={a}>{a}</option>))}
              </select>
            )}
            {pdfPeriodo==="mes"&&(
              <select value={pdfMes} onChange={e=>setPdfMes(e.target.value)} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #bfdbfe",fontSize:12,color:"#1d4ed8",background:"#fff",cursor:"pointer"}}>
                {mesesPdf.map(m=>(<option key={m} value={m}>{nombreMesPdf[m]}</option>))}
              </select>
            )}
            <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#1d4ed8",cursor:"pointer",userSelect:"none"}}>
                <input type="checkbox" checked={pdfMostrarSinDistribuir} onChange={e=>setPdfMostrarSinDistribuir(e.target.checked)} style={{cursor:"pointer"}}/>
                Mostrar saldo sin distribuir
              </label>
              <button onClick={descargarPDF} style={{padding:"6px 16px",background:"#1d4ed8",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>⬇ Descargar / Imprimir</button>
            </div>
          </div>
        )}

        {/* Resumen */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:C.border}}>
          {[
            {l:"Total pedidos",v:fmt(totalPedidos),c:C.text},
            {l:"Total abonado",v:fmt(totalAbonado),c:C.green},
            {l:"Saldo pendiente",v:fmt(saldo),c:saldo>0?C.red:C.green},
          ].map(s=>(
            <div key={s.l} style={{background:"#fff",padding:"16px",textAlign:"center"}}>
              <div style={{fontSize:10,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{s.l}</div>
              <div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:"'Outfit',sans-serif"}}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{padding:"20px 24px",maxHeight:"60vh",overflowY:"auto"}}>
          {/* Pedidos pendientes */}
          {pendientes.length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:C.red,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>⏳ Pedidos pendientes de pago ({pendientes.length})</div>
              {pendientes.map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"#fff5f5",borderRadius:8,marginBottom:6,border:"1px solid #fecaca"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>#{p.id} — {p.mercancia}</div>
                    <div style={{fontSize:11,color:C.textDim}}>{p.fecha} · {p.cant} uds · {fmt(p.unitario)}/u</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.red}}>{fmt(p.total||0)}</div>
                    <div style={{fontSize:10,color:C.textDim}}>{p.clientePago||"Sin pago"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Abonos */}
          {misAbonos.length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>💰 Pagos registrados ({misAbonos.length})</div>
              {misAbonos.map(a=>(
                <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"#f0fdf4",borderRadius:8,marginBottom:6,border:"1px solid #bbf7d0"}}>
                  <div>
                    <div style={{fontSize:13,color:C.text}}>{a.fecha}</div>
                    {a.nota&&<div style={{fontSize:11,color:C.textDim}}>{a.nota}</div>}
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:C.green}}>+{fmt(a.monto)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pedidos pagados */}
          {pagados.length>0&&(
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>✅ Pedidos pagados ({pagados.length})</div>
              {pagados.map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"#f9fafb",borderRadius:8,marginBottom:6,border:`1px solid ${C.border}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.textMid}}>#{p.id} — {p.mercancia}</div>
                    <div style={{fontSize:11,color:C.textDim}}>{p.fecha} · {p.clientePago}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.green}}>{fmt(p.total||0)}</div>
                    <button onClick={()=>{if(!confirm("¿Marcar como pendiente de pago?"))return;setPedidos(prev=>prev.map(x=>x.id===p.id?{...x,clientePago:"PENDIENTE",montoAsignado:0}:x));}} style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#c2410c",fontWeight:600,whiteSpace:"nowrap"}}>↩ Revertir</button>
                  </div>
                </div>
              ))}
            </div>
          )}}

          {misPedidos.length===0&&misAbonos.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:"#a1a1aa"}}>Sin movimientos registrados</div>
          )}
        </div>
      </div>
    </div>
  );
}




function EstadoCuentaProveedorModal({nombre,pedidos,abonosProv,onClose,fmt,C,inp,btnP}){
  const [pdfPeriodo,setPdfPeriodo]=React.useState("todo");
  const [pdfAnio,setPdfAnio]=React.useState(new Date().getFullYear().toString());
  const [pdfMes,setPdfMes]=React.useState((new Date().getMonth()+1).toString().padStart(2,"0"));

  const enP=(fecha)=>{
    if(!fecha||pdfPeriodo==="todo") return true;
    if(pdfPeriodo==="anio") return fecha.startsWith(pdfAnio);
    if(pdfPeriodo==="mes") return fecha.startsWith(pdfAnio+"-"+pdfMes);
    return true;
  };

  const misPedidos=pedidos.filter(p=>p.proveedor===nombre&&!p.esBodega&&enP(p.fecha)).sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  const misAbonos=abonosProv.filter(a=>a.proveedor===nombre&&enP(a.fecha)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const totalComprado=misPedidos.reduce((s,p)=>s+(p.costo+(p.otroCosto||0)),0);
  const totalAbonado=misAbonos.reduce((s,a)=>s+a.monto,0);
  const saldo=totalComprado-totalAbonado;

  const nombreMes={"01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio","07":"Julio","08":"Agosto","09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre"};
  const años=[...new Set([...misPedidos,...misAbonos].map(x=>x.fecha?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);

  const descargarPDF=()=>{
    const fechaDoc=new Date().toLocaleDateString("es-MX",{year:"numeric",month:"long",day:"numeric"});
    const periodoLabel=pdfPeriodo==="todo"?"Historial completo":pdfPeriodo==="anio"?`Año ${pdfAnio}`:`${nombreMes[pdfMes]} ${pdfAnio}`;
    const rowsPed=misPedidos.map(p=>`
      <tr>
        <td>${p.fecha||"—"}</td>
        <td>${p.mercancia}</td>
        <td style="text-align:center">${p.cant}</td>
        <td style="text-align:right">${fmt(p.costo+(p.otroCosto||0))}</td>
        <td style="text-align:center;color:${p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA"?"#16a34a":"#dc2626"}">${p.clientePago||"Pendiente"}</td>
      </tr>`).join("");
    const rowsAb=misAbonos.map(a=>`
      <tr>
        <td>${a.fecha}</td>
        <td>${a.nota||"—"}</td>
        <td style="text-align:right;color:#16a34a;font-weight:700">${fmt(a.monto)}</td>
      </tr>`).join("");
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1c1917;padding:40px;font-size:13px}
      h1{font-size:22px;font-weight:800;letter-spacing:-0.5px}
      .hero{display:flex;justify-content:space-between;align-items:flex-start;margin:24px 0;padding:20px;background:#f5f5f4;border-radius:12px}
      .stat{text-align:right}.stat .label{font-size:10px;color:#a8a29e;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.stat .value{font-size:22px;font-weight:800}
      .stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px}
      .stat-box{padding:14px;border-radius:10px;border:1px solid #e7e5e4}
      .stat-box .l{font-size:10px;color:#a8a29e;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
      .stat-box .v{font-size:18px;font-weight:800}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}
      th{font-size:10px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:.06em;padding:8px;border-bottom:2px solid #e7e5e4;text-align:left}
      td{padding:8px;border-bottom:1px solid #f5f5f4;font-size:12px}
      h2{font-size:13px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
    </style></head><body>
      <h1>${nombre}</h1>
      <div style="color:#a8a29e;font-size:12px;margin-top:4px">Estado de cuenta proveedor · ${periodoLabel} · ${fechaDoc}</div>
      <div class="hero">
        <div>
          <div style="font-size:11px;color:#a8a29e;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Total comprado</div>
          <div style="font-size:28px;font-weight:800;color:#92400e">${fmt(totalComprado)}</div>
        </div>
        <div class="stat">
          <div class="label">Saldo pendiente</div>
          <div class="value" style="color:${saldo>0?"#dc2626":"#16a34a"}">${fmt(saldo)}</div>
        </div>
      </div>
      <div class="stats">
        <div class="stat-box"><div class="l">Total comprado</div><div class="v" style="color:#92400e">${fmt(totalComprado)}</div></div>
        <div class="stat-box"><div class="l">Total abonado</div><div class="v" style="color:#16a34a">${fmt(totalAbonado)}</div></div>
        <div class="stat-box" style="background:${saldo>0?"#fff1f2":"#f0fdf4"}"><div class="l">${saldo>0?"Por pagar":"Al corriente"}</div><div class="v" style="color:${saldo>0?"#dc2626":"#16a34a"}">${fmt(Math.abs(saldo))}</div></div>
      </div>
      <h2>Pedidos (${misPedidos.length})</h2>
      <table><thead><tr><th>Fecha</th><th>Mercancía</th><th style="text-align:center">Cant.</th><th style="text-align:right">Costo</th><th style="text-align:center">Estado cliente</th></tr></thead><tbody>${rowsPed}</tbody>
        <tfoot><tr><td colspan="3"><strong>TOTAL</strong></td><td style="text-align:right;font-weight:800">${fmt(totalComprado)}</td><td></td></tr></tfoot>
      </table>
      <h2>Pagos realizados (${misAbonos.length})</h2>
      <table><thead><tr><th>Fecha</th><th>Nota</th><th style="text-align:right">Monto</th></tr></thead><tbody>${rowsAb}</tbody>
        <tfoot><tr><td colspan="2"><strong>TOTAL ABONADO</strong></td><td style="text-align:right;font-weight:800;color:#16a34a">${fmt(totalAbonado)}</td></tr></tfoot>
      </table>
    </body></html>`;
    const win=window.open("","_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(()=>{win.print();},400);
  };

  return(
    <Modal title={`Estado de cuenta — ${nombre}`} onClose={onClose}>
      {/* Periodo filter */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {[["todo","Todo"],["anio","Por año"],["mes","Por mes"]].map(([k,l])=>(
          <button key={k} onClick={()=>setPdfPeriodo(k)} style={{padding:"6px 14px",borderRadius:8,border:"1px solid #e7e5e4",background:pdfPeriodo===k?"#1c1917":"#f5f5f4",color:pdfPeriodo===k?"#fff":"#44403c",fontSize:12,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:pdfPeriodo===k?600:400}}>{l}</button>
        ))}
        {pdfPeriodo!=="todo"&&(
          <select value={pdfAnio} onChange={e=>setPdfAnio(e.target.value)} style={{...inp,width:"auto",fontSize:12}}>
            {(años.length?años:[new Date().getFullYear().toString()]).map(a=><option key={a}>{a}</option>)}
          </select>
        )}
        {pdfPeriodo==="mes"&&(
          <select value={pdfMes} onChange={e=>setPdfMes(e.target.value)} style={{...inp,width:"auto",fontSize:12}}>
            {["01","02","03","04","05","06","07","08","09","10","11","12"].map(m=><option key={m} value={m}>{nombreMes[m]}</option>)}
          </select>
        )}
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        <div style={{background:"#fff7ed",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#92400e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,fontFamily:"'Outfit',sans-serif"}}>Total comprado</div>
          <div style={{fontSize:18,fontWeight:800,color:"#92400e",fontFamily:"'Outfit',sans-serif"}}>{fmt(totalComprado)}</div>
        </div>
        <div style={{background:"#f0fdf4",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#166534",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,fontFamily:"'Outfit',sans-serif"}}>Total abonado</div>
          <div style={{fontSize:18,fontWeight:800,color:"#16a34a",fontFamily:"'Outfit',sans-serif"}}>{fmt(totalAbonado)}</div>
        </div>
        <div style={{background:saldo>0?"#fff1f2":"#f0fdf4",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:saldo>0?"#9f1239":"#166534",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,fontFamily:"'Outfit',sans-serif"}}>{saldo>0?"Por pagar":"Al corriente"}</div>
          <div style={{fontSize:18,fontWeight:800,color:saldo>0?"#dc2626":"#16a34a",fontFamily:"'Outfit',sans-serif"}}>{fmt(Math.abs(saldo))}</div>
        </div>
      </div>

      {/* Pedidos table */}
      <div style={{fontSize:11,fontWeight:600,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:"'Outfit',sans-serif"}}>Pedidos ({misPedidos.length})</div>
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20}}>
        <thead>
          <tr style={{borderBottom:"1px solid #e7e5e4"}}>
            {["Fecha","Mercancía","Cant.","Costo","Estado cliente"].map(h=>(
              <th key={h} style={{fontSize:10,fontWeight:600,color:"#a8a29e",textAlign:"left",padding:"0 8px 8px 0",textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:"'Outfit',sans-serif"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {misPedidos.map(p=>(
            <tr key={p.id} style={{borderTop:"1px solid #f5f5f4"}}>
              <td style={{padding:"8px 8px 8px 0",fontSize:12,color:"#a8a29e"}}>{p.fecha}</td>
              <td style={{padding:"8px 8px 8px 0",fontSize:13,fontWeight:500,color:"#1c1917",fontFamily:"'Outfit',sans-serif"}}>{p.mercancia}</td>
              <td style={{padding:"8px 8px 8px 0",fontSize:12,color:"#78716c"}}>{p.cant}</td>
              <td style={{padding:"8px 8px 8px 0",fontSize:12,fontWeight:600,color:"#1c1917"}}>{fmt(p.costo+(p.otroCosto||0))}</td>
              <td style={{padding:"8px 0"}}>
                <span style={{background:p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA"?"#dcfce7":p.clientePago==="ABONO PARCIAL"?"#fef3c7":"#fee2e2",color:p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA"?"#166534":p.clientePago==="ABONO PARCIAL"?"#92400e":"#b91c1c",fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,fontFamily:"'Outfit',sans-serif"}}>{p.clientePago||"Pendiente"}</span>
              </td>
            </tr>
          ))}
          <tr style={{borderTop:"2px solid #e7e5e4"}}>
            <td colSpan={3} style={{padding:"8px 0",fontSize:12,fontWeight:700,color:"#1c1917",fontFamily:"'Outfit',sans-serif"}}>TOTAL</td>
            <td style={{padding:"8px 0",fontSize:14,fontWeight:800,color:"#92400e",fontFamily:"'Outfit',sans-serif"}}>{fmt(totalComprado)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      {/* Abonos */}
      <div style={{fontSize:11,fontWeight:600,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:"'Outfit',sans-serif"}}>Pagos realizados ({misAbonos.length})</div>
      {misAbonos.map(a=>(
        <div key={a.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderTop:"1px solid #f5f5f4"}}>
          <span style={{fontSize:13,color:"#44403c",fontFamily:"'Outfit',sans-serif"}}>{a.fecha}{a.nota?` · ${a.nota}`:""}</span>
          <span style={{fontSize:14,fontWeight:700,color:"#16a34a",fontFamily:"'Outfit',sans-serif"}}>+{fmt(a.monto)}</span>
        </div>
      ))}

      {/* Actions */}
      <div style={{display:"flex",gap:10,marginTop:20,paddingTop:16,borderTop:"1px solid #f5f5f4"}}>
        <button onClick={descargarPDF} style={{...btnP,flex:1}}>🖨️ Imprimir / PDF</button>
        <button onClick={onClose} style={{flex:1,padding:"10px 0",background:"#f5f5f4",border:"1px solid #e7e5e4",borderRadius:10,color:"#44403c",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:500}}>Cerrar</button>
      </div>
    </Modal>
  );
}

function Axia(){
  const [tab,setTab]=useState(0);
  const [seccion,setSeccion]=useState(null);
  const [adminTab,setAdminTab]=useState('resumen');
  const [provOpenMap,setProvOpenMap]=useState({});
  const [modalEstadoProv,setModalEstadoProv]=useState(null);
  const [modalMerma,setModalMerma]=useState(null);
  const [bSort,setBSort]=useState('ultimoMod');
  const [provFiltro,setProvFiltro]=useState('todo');
  const [pedFiltro,setPedFiltro]=useState('todo');
      const [modalEstadoCli,setModalEstadoCli]=useState(null);
      const [editMerma,setEditMerma]=useState(null);
      const [modalDistribuir,setModalDistribuir]=useState(null);
      const [periodo,setPeriodo]=useState("todo");
      const [periodoAnio,setPeriodoAnio]=useState(new Date().getFullYear().toString());
      const [periodoMes,setPeriodoMes]=useState((new Date().getMonth()+1).toString().padStart(2,"0"));
      const [periodoSem,setPeriodoSem]=useState(()=>{
        const hoy=new Date();
        const lun=new Date(hoy);lun.setDate(hoy.getDate()-((hoy.getDay()+6)%7));
        return lun.toISOString().slice(0,10);
      });
      const [cliSearch,setCliSearch]=useState("");
      const [cliSort,setCliSort]=useState("ultimoMod");
      const [bodega,setBodegaR]=useState([]);
      const [modalBodega,setModalBodega]=useState(null);
      const [modalDist,setModalDist]=useState(null);
      const [bForm,setBForm]=useState({});
      const [dForm,setDForm]=useState({});
      const [bSearch,setBSearch]=useState("");
      const [bFiltProv,setBFiltProv]=useState("Todos");
      const [bFiltDist,setBFiltDist]=useState("Todos");
  const [pedidos,setPedR]       =useState(PEDIDOS_INIT);
  const [abonosProv,setApR]     =useState(ABONOS_PROV_INIT);
  const [abonosCli,setAcR]      =useState(ABONOS_CLI_INIT);
  const [flujo,setFlujoR]       =useState([]);
  const [clientes,setCliR]      =useState(CLIENTES_INIT);
  const [proveedores,setProvR]  =useState(PROVEEDORES_INIT);
  const [vendedores,setVendR]   =useState(VENDEDORES_INIT);
  const [nextFolio,setNextFolioR]=useState(1);
  const [loading,setLoading]    =useState(true);
  const [guardando,setGuardando]=useState(false);

  // ── modals ──
  const [modalPed,    setModalPed]    =useState(null);   // "new"|"edit"|null
  const [modalAP,     setModalAP]     =useState(null);   // proveedor name
  const [modalFlujo,  setModalFlujo]  =useState(false);
  const [flujoForm,   setFlujoForm]   =useState({});
  const [modalAC,     setModalAC]     =useState(null);   // cliente name
  const [modalProv,   setModalProv]   =useState(false);
  const [modalCli,    setModalCli]    =useState(false);
  const [modalVend,   setModalVend]   =useState(false);
  const [editProv,    setEditProv]    =useState(null);
  const [editCli,     setEditCli]     =useState(null);
  const [newNom,      setNewNom]      =useState("");

  // ── filters / form ──
  const [search,setSearch]=useState("");
  const [fProv,setFProv]  =useState("Todos");
  const [fCli,setFCli]    =useState("Todos");
  const [fVend,setFVend]  =useState("Todos");
  const [form,setFormR]   =useState({});
  const [aForm,setAForm]  =useState({});
  const sf=(k,v)=>setFormR(f=>({...f,[k]:v}));

  // ── storage ──
  useEffect(()=>{
    (async()=>{
      try{
        const keys=["axia-pedidos","axia-aprov","axia-acli","axia-clientes","axia-proveedores","axia-vendedores","axia-bodega"];
        const [rp,rap,rac,rc,rpv,rv,rbo]=await Promise.all(keys.map(k=>window.storage.get(k,true).catch(()=>null)));
        if(rp?.value)  setPedR(JSON.parse(rp.value));
        if(rap?.value) setApR(JSON.parse(rap.value));
        if(rac?.value) setAcR(JSON.parse(rac.value));
        if(rc?.value)  setCliR(JSON.parse(rc.value));
        if(rpv?.value) setProvR(JSON.parse(rpv.value));
        if(rv?.value)  setVendR(JSON.parse(rv.value));
        if(rbo?.value) setBodegaR(JSON.parse(rbo.value));
        const rfl = await window.storage.get("axia-flujo",true).catch(()=>null);
        if(rfl?.value) setFlujoR(JSON.parse(rfl.value));
        const rf = await window.storage.get("axia-folio",true).catch(()=>null);
        if(rf?.value) setNextFolioR(JSON.parse(rf.value));
      }catch(e){}
      setLoading(false);
    })();
  },[]);

  const save=useCallback(async(k,v)=>{
    setGuardando(true);
    try{await window.storage.set(k,JSON.stringify(v),true);}catch(e){}
    setTimeout(()=>setGuardando(false),900);
  },[]);

  const setPedidos    =fn=>setPedR(p=>{const n=typeof fn==="function"?fn(p):fn; save("axia-pedidos",n);      return n;});
  const setAbonosProv =fn=>setApR(p=>{const n=typeof fn==="function"?fn(p):fn;  save("axia-aprov",n);        return n;});
  const setAbonosCli  =fn=>setAcR(p=>{const n=typeof fn==="function"?fn(p):fn;  save("axia-acli",n);         return n;});
  const setClientes   =fn=>setCliR(p=>{const n=typeof fn==="function"?fn(p):fn; save("axia-clientes",n);     return n;});
  const setProveedores=fn=>setProvR(p=>{const n=typeof fn==="function"?fn(p):fn;save("axia-proveedores",n);  return n;});
  const setVendedores =fn=>setVendR(p=>{const n=typeof fn==="function"?fn(p):fn;save("axia-vendedores",n);   return n;});
  const setBodega=fn=>setBodegaR(p=>{const n=typeof fn==="function"?fn(p):fn;save("axia-bodega",n);return n;});
      const setFlujo      =fn=>setFlujoR(p=>{const n=typeof fn==="function"?fn(p):fn;save("axia-flujo",n);          return n;});
  const setNextFolio  =v=>{setNextFolioR(v);save("axia-folio",v);};

  // ── computed ──
  const pedFilt=useMemo(()=>pedidos.filter(p=>{
    const q=search.toLowerCase();
    return(!q||p.mercancia.toLowerCase().includes(q)||p.cliente.toLowerCase().includes(q)||p.proveedor.toLowerCase().includes(q))
      &&(fProv==="Todos"||p.proveedor===fProv)&&(fCli==="Todos"||p.cliente===fCli)&&(fVend==="Todos"||p.vendedor===fVend);
  }),[pedidos,search,fProv,fCli,fVend]);

  const disponibleDe=item=>(item.cant||0)-(item.distribuciones||[]).reduce((s,d)=>s+d.cant,0)-(item.mermas||[]).reduce((s,m)=>s+m.cant,0);
    const saldP=useMemo(()=>{
    const m={};
    pedidos.forEach(p=>{m[p.proveedor]=(m[p.proveedor]||0)+(p.costo+(p.otroCosto||0));});
    abonosProv.forEach(a=>{m[a.proveedor]=(m[a.proveedor]||0)-a.monto;});
    return m;
  },[pedidos,abonosProv]);


  // ── Filtro de periodo ──
  const getSemanasDisponibles=()=>{
    const todas=new Set();
    [...pedidos,...abonosCli,...abonosProv,...flujo,...bodega].forEach(item=>{
      const f=item.fecha;
      if(!f) return;
      const d=new Date(f+"T12:00:00");
      const lun=new Date(d);lun.setDate(d.getDate()-((d.getDay()+6)%7));
      todas.add(lun.toISOString().slice(0,10));
    });
    return [...todas].sort((a,b)=>b.localeCompare(a));
  };

  const enPeriodo=(fecha)=>{
    if(!fecha||periodo==="todo") return true;
    if(periodo==="anio") return fecha.startsWith(periodoAnio);
    if(periodo==="mes") return fecha.startsWith(periodoAnio+"-"+periodoMes);
    if(periodo==="sem"){
      const d=new Date(fecha+"T12:00:00");
      const lun=new Date(d);lun.setDate(d.getDate()-((d.getDay()+6)%7));
      return lun.toISOString().slice(0,10)===periodoSem;
    }
    return true;
  };

  const años=[...new Set([...pedidos,...abonosCli,...abonosProv,...flujo].map(x=>x.fecha?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
  const meses=["01","02","03","04","05","06","07","08","09","10","11","12"];
  const nombreMes={"01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio","07":"Julio","08":"Agosto","09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre"};

  const saldC=useMemo(()=>{
    const m={};
    pedidos.forEach(p=>{m[p.cliente]=(m[p.cliente]||0)+(p.total||0);});
    abonosCli.forEach(a=>{m[a.cliente]=(m[a.cliente]||0)-a.monto;});
    return m;
  },[pedidos,abonosCli]);

  const totG      =pedidos.reduce((s,p)=>s+(p.total-(p.costo+(p.otroCosto||0))),0);
  const totCobrar =Object.values(saldC).filter(v=>v>0).reduce((s,v)=>s+v,0);
  const totPagar  =Object.values(saldP).filter(v=>v>0).reduce((s,v)=>s+v,0);

  // ── pedido CRUD ──
  const openNew =()=>setFormR({vendedor:vendedores[0]||"",proveedor:proveedores[0]?.nombre||"",cliente:clientes[0]?.nombre||"",mercancia:"",cant:1,unitario:0,otroCosto:0,precioPublico:0,clientePago:"",recibido:"",pagadoProveedor:""});
  const openEdit=p=>setFormR({...p});
  const savePed =()=>{
    const p={...form,cant:Number(form.cant)||0,unitario:Number(form.unitario)||0,otroCosto:Number(form.otroCosto)||0,precioPublico:Number(form.precioPublico)||0};
    p.costo=p.cant*p.unitario; p.total=p.cant*p.precioPublico;
    if(modalPed==="new"){p.id=nextFolio;setPedidos(prev=>[...prev,p]);setNextFolio(nextFolio+1);}
    else setPedidos(prev=>prev.map(x=>x.id===p.id?p:x));
    setModalPed(null);
  };

  // ── proveedor CRUD ──
  const saveProv=nombre=>{
    if(editProv) setProveedores(prev=>prev.map(p=>p.id===editProv.id?{...p,nombre}:p));
    else setProveedores(prev=>[...prev,{id:`prov-${Date.now()}`,nombre}]);
    setModalProv(false); setEditProv(null); setNewNom("");
  };

  // ── cliente CRUD ──
  const saveCli=nombre=>{
    if(editCli) setClientes(prev=>prev.map(c=>c.id===editCli.id?{...c,nombre}:c));
    else setClientes(prev=>[...prev,{id:`cli-${Date.now()}`,nombre}]);
    setModalCli(false); setEditCli(null); setNewNom("");
  };

  // ── vendedor CRUD ──
  const saveVend=nombre=>{
    setVendedores(prev=>[...prev,nombre]);
    setModalVend(false);
  };

  // ── abonos ──
  const saveAP=()=>{
    const monto=Number(aForm.monto)||0;
    const fecha=aForm.fecha||new Date().toISOString().slice(0,10);
    setAbonosProv(p=>[...p,{id:`ap${Date.now()}`,proveedor:modalAP,monto,nota:aForm.nota||"",fecha}]);
    setFlujo(p=>[...p,{id:`fl${Date.now()}`,fecha,tipo:"EGRESO",categoria:"Pago proveedor",descripcion:`Pago a ${modalAP}${aForm.nota?` — ${aForm.nota}`:""}`,monto:-monto}]);
    setModalAP(null);
  };
  const saveAC=()=>{
    const monto=Number(aForm.monto)||0;
    const fecha=aForm.fecha||new Date().toISOString().slice(0,10);
    if(aForm._editId){
      // EDIT mode
      const oldAbono=abonosCli.find(a=>a.id===aForm._editId);
      setAbonosCli(p=>p.map(a=>a.id===aForm._editId?{...a,monto,nota:aForm.nota||"",fecha}:a));
      if(oldAbono?.flujoId){
        setFlujo(p=>p.map(f=>f.id===oldAbono.flujoId?{...f,monto,fecha,descripcion:`Pago de ${modalAC}${aForm.nota?` — ${aForm.nota}`:""}` }:f));
      }
      setModalAC(null);setAForm({});return;
    }
    const acId=`ac${Date.now()}`;
    const flId=`fl${acId}`;
    setAbonosCli(p=>[...p,{id:acId,cliente:modalAC,monto,nota:aForm.nota||"",fecha,flujoId:flId}]);
    setFlujo(p=>[...p,{id:flId,fecha,tipo:"INGRESO",categoria:"Cobro cliente",descripcion:`Pago de ${modalAC}${aForm.nota?` — ${aForm.nota}`:""}`,monto,abonoId:acId}]);
    setModalAC(null);
  };

  if(loading) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${C.accent},${C.accent3})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#fff",fontFamily:"'Outfit',sans-serif"}}>A</div>
      <div style={{fontFamily:"'Outfit',sans-serif",color:C.accent3,fontSize:16}}>Cargando AXIA...</div>
    </div>
  );

  const isPedOpen = modalPed !== null;

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Outfit',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;} select option{background:#fff;}`}</style>

      {guardando&&<div style={{position:"fixed",bottom:20,right:20,background:"#fff",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px",fontSize:13,color:C.accent3,zIndex:999,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>💾 Guardando...</div>}

      {/* HEADER */}
      <div style={{background:"#ffffff",borderBottom:"1px solid #e7e5e4",padding:"0 32px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
        <button onClick={()=>setSeccion(null)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:8,padding:0}}>
          <div style={{fontSize:15,fontWeight:700,color:"#1c1917",letterSpacing:"-0.3px",fontFamily:"'Outfit',sans-serif",lineHeight:1}}>AXIA</div>
          <div style={{fontSize:9,color:"#a8a29e",letterSpacing:"0.15em",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif"}}>Distribution & Supply</div>
        </button>
        <div style={{display:"flex",gap:2}}>
          {[
            {key:"Clientes",icon:"👥",t:2},
            {key:"Proveedores",icon:"🏭",t:1},
            {key:"Pedidos",icon:"📦",t:0},
            {key:"Bodega",icon:"🏪",t:5},
            {key:"Administracion",icon:"📊",t:3},
          ].map(s=>(
            <button key={s.key} onClick={()=>{setSeccion(s.key);setTab(s.t);}}
              style={{padding:"6px 14px",border:"none",borderRadius:8,background:seccion===s.key?"#1c1917":"transparent",color:seccion===s.key?"#fff":"#78716c",fontSize:12,fontWeight:seccion===s.key?600:400,cursor:"pointer",fontFamily:"'Outfit',sans-serif",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:14}}>{s.icon}</span>
              <span style={{display:"inline"}}>{s.key==="Administracion"?"Admin":s.key}</span>
            </button>
          ))}
        </div>
      </div>
{/* HOME / SECTION NAV */}
      {seccion===null?(
        <div style={{padding:"40px 32px",background:"#f5f5f4",minHeight:"calc(100vh - 56px)"}}>
          <div style={{maxWidth:600,margin:"0 auto"}}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:26,fontWeight:700,color:"#1c1917",letterSpacing:"-0.5px",marginBottom:4}}>Bienvenido</div>
            <div style={{fontSize:13,color:"#a8a29e",fontFamily:"'Outfit',sans-serif",marginBottom:24}}>{new Date().toLocaleDateString("es-MX",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:32}}>
              {[{v:fmt(totG),l:"Ganancia",c:"#16a34a"},{v:fmt(totCobrar),l:"Por cobrar",c:"#d97706"},{v:fmt(totPagar),l:"Por pagar",c:"#dc2626"}].map(s=>(
                <div key={s.l} style={{background:"#ffffff",border:"1px solid #e7e5e4",borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:10,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"'Outfit',sans-serif",marginBottom:6}}>{s.l}</div>
                  <div style={{fontSize:18,fontWeight:700,color:s.c,fontFamily:"'Outfit',sans-serif"}}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[
                {icon:"👥",title:"Clientes",desc:"Saldos, pagos y estados de cuenta",t0:2},
                {icon:"🏭",title:"Proveedores",desc:"Lo que debes y pagos realizados",t0:1},
                {icon:"📦",title:"Pedidos",desc:"Crear, editar y dar seguimiento",t0:0},
                {icon:"🏪",title:"Bodega",desc:"Inventario, entradas y distribuciones",t0:5},
                {icon:"📊",title:"Administracion",desc:"Flujo de efectivo, ganancias y resumen",t0:3},
              ].map((s,i)=>(
                <div key={i} onClick={()=>{setSeccion(s.title);setTab(s.t0);}}
                  style={{background:"#ffffff",border:"1px solid #e7e5e4",borderRadius:16,padding:"22px",cursor:"pointer"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#78716c";e.currentTarget.style.transform="translateY(-1px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e7e5e4";e.currentTarget.style.transform="none";}}>
                  <div style={{fontSize:28,marginBottom:12}}>{s.icon}</div>
                  <div style={{fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:600,color:"#1c1917",marginBottom:4}}>{s.title}</div>
                  <div style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:"#a8a29e",lineHeight:1.5}}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ):(
        <div style={{background:"#ffffff",borderBottom:"1px solid #e7e5e4",display:"flex",alignItems:"center",gap:4,padding:"0 32px",height:44}}>
          {seccion==="Administracion"&&[{i:3,t:"Resumen"},{i:4,t:"Flujo de Efectivo"}].map(({i,t})=>(
            <button key={i} onClick={()=>{setAdminTab(i===3?"resumen":"flujo");setTab(i);}} style={{padding:"0 16px",height:44,border:"none",background:"none",fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:tab===i?600:400,cursor:"pointer",color:tab===i?"#1c1917":"#a8a29e",borderBottom:tab===i?"2px solid #1c1917":"2px solid transparent"}}>{t}</button>
          ))}
          {seccion!=="Administracion"&&<div style={{padding:"0 16px",height:44,display:"flex",alignItems:"center",fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:600,color:"#1c1917",borderBottom:"2px solid #1c1917"}}>{seccion}</div>}
        </div>
      )}

      <div style={{padding:"28px 32px",display:seccion===null?"none":"block"}}>

        {/* ══ PEDIDOS ══ */}
        {tab===0&&(<>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:16,alignItems:"center"}}>
            <input placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,flex:"1 1 180px",maxWidth:260}}/>
            <select value={fProv} onChange={e=>setFProv(e.target.value)} style={{...inp,width:"auto"}}>
              <option value="Todos">Todos los proveedores</option>
              {proveedores.map(p=><option key={p.id}>{p.nombre}</option>)}
            </select>
            <select value={fCli} onChange={e=>setFCli(e.target.value)} style={{...inp,width:"auto"}}>
              <option value="Todos">Todos los clientes</option>
              {clientes.map(c=><option key={c.id}>{c.nombre}</option>)}
            </select>
            <select value={fVend} onChange={e=>setFVend(e.target.value)} style={{...inp,width:"auto"}}>
              <option value="Todos">Todos los vendedores</option>
              {vendedores.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
            <button onClick={()=>setModalVend(true)} style={{...inp,width:"auto",background:"#f4f4f5",border:`1px solid ${C.border}`,cursor:"pointer",fontSize:13,padding:"7px 12px"}}>+ Vendedor</button>
            <button onClick={()=>{openNew();setModalPed("new");}} style={{...btnP,marginLeft:"auto",padding:"9px 18px",fontSize:13}}>+ Nuevo pedido</button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:980,fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`}}>
                  {["#","Vendedor","Proveedor","Cliente","Mercancía","Cant","C.Unit","C.Total","P.Venta","T.Venta","Ganancia","Cliente pagó","Yo recibí","Pagué prov",""].map(h=>(
                    <th key={h} style={{padding:"10px",color:C.textDim,fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",textAlign:"left",fontWeight:600,whiteSpace:"nowrap",background:C.surface}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedFilt.map((p,i)=>{
                  const ct=p.costo+(p.otroCosto||0),g=p.total-ct;
                  const sc=sstyle(p.clientePago),sr=sstyle(p.recibido),sp=sstyle(p.pagadoProveedor);
                  return(
                    <tr key={p.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":"#fafafa"}} onMouseEnter={e=>e.currentTarget.style.background="#fdf4f5"} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#fafafa"}>
                      <td style={{padding:"10px",color:C.textDim,fontWeight:600}}>{p.id}</td>
                      <td style={{padding:"10px",color:C.accent,fontWeight:600}}>{p.vendedor||"—"}</td>
                      <td style={{padding:"10px",color:C.accent3}}>{p.proveedor}</td>
                      <td style={{padding:"10px",color:C.text,fontWeight:500}}>{p.cliente}</td>
                      <td style={{padding:"10px",color:C.textMid,maxWidth:140,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.mercancia}</td>
                      <td style={{padding:"10px",textAlign:"right",color:C.textDim}}>{p.cant?.toLocaleString()}</td>
                      <td style={{padding:"10px",textAlign:"right",color:C.textDim}}>{fmt(p.unitario)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:C.yellow,fontWeight:600}}>{fmt(ct)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:C.textDim}}>{fmt(p.precioPublico)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:C.blue,fontWeight:600}}>{fmt(p.total)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:gColor(g),fontWeight:700}}>{fmt(g)}</td>
                      <td style={{padding:"10px"}}><span style={{background:sc.bg,color:sc.c,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{sc.label}</span></td>
                      <td style={{padding:"10px"}}><span style={{background:sr.bg,color:sr.c,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{sr.label}</span></td>
                      <td style={{padding:"10px"}}><span style={{background:sp.bg,color:sp.c,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{sp.label}</span></td>
                      <td style={{padding:"10px"}}>
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={()=>{openEdit(p);setModalPed("edit");}} style={{background:"#f5f5f5",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✏️</button>
                          <button onClick={()=>setPedidos(prev=>prev.filter(x=>x.id!==p.id))} style={{background:"#fff0f0",border:`1px solid #fecaca`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12}}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pedFilt.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.textDim}}>No hay pedidos que coincidan.</div>}
          </div>
        </>)}

        {/* ══ PROVEEDORES ══ */}
        {tab===1&&(<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <div style={{fontSize:13,color:"#a8a29e",fontFamily:"'Outfit',sans-serif"}}>{proveedores.length} proveedores</div>
            <button onClick={()=>{setEditProv(null);setNewNom("");setModalProv(true);}} style={{...btnP,padding:"9px 20px",fontSize:13}}>+ Nuevo proveedor</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {proveedores.map(prov=>{
              const todosPedidos=pedidos.filter(p=>p.proveedor===prov.nombre&&!p.esBodega);
              const bItems=bodega.filter(b=>b.proveedor===prov.nombre);
              const pedFiltProv=provFiltro==="todo"?todosPedidos:provFiltro==="generado"?todosPedidos.filter(p=>!p.recibido||p.recibido===""||p.recibido==="PENDIENTE"):provFiltro==="entregado"?todosPedidos.filter(p=>p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA"):todosPedidos;
              const bFiltProv=provFiltro==="bodega"||provFiltro==="todo"?bItems:[];
              if(provFiltro!=="todo"&&pedFiltProv.length===0&&bFiltProv.length===0) return null;
              const saldo=saldP[prov.nombre]||0;
              const tC=todosPedidos.reduce((s,p)=>s+(p.costo+(p.otroCosto||0)),0);
              const tA=abonosProv.filter(a=>a.proveedor===prov.nombre).reduce((s,a)=>s+a.monto,0);
              const open=!!provOpenMap[prov.id];
              const toggleOpen=()=>setProvOpenMap(m=>({...m,[prov.id]:!m[prov.id]}));
              return(
                <div key={prov.id} style={{background:"#ffffff",border:"1px solid #e7e5e4",borderRadius:16,overflow:"hidden"}}>
                  <div style={{padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,cursor:"pointer"}} onClick={toggleOpen}>
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <div style={{width:44,height:44,borderRadius:12,background:"#1c1917",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff",fontFamily:"'Outfit',sans-serif",flexShrink:0}}>{prov.nombre[0]}</div>
                      <div>
                        <div style={{fontSize:16,fontWeight:700,color:"#1c1917",fontFamily:"'Outfit',sans-serif"}}>{prov.nombre}</div>
                        <div style={{fontSize:12,color:"#a8a29e",marginTop:2}}>{provFiltro==="bodega"?`${bFiltProv.length} en bodega`:`${pedFiltProv.length} pedidos`}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:16}}>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:11,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Saldo</div>
                        <div style={{fontSize:20,fontWeight:800,color:saldo>0?"#dc2626":"#16a34a",fontFamily:"'Outfit',sans-serif"}}>{fmt(saldo)}</div>
                      </div>
                      <div style={{fontSize:18,color:"#a8a29e",transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:"#f5f5f4"}}>
                    <div style={{background:"#fff7ed",padding:"12px 20px"}}><div style={{fontSize:10,color:"#92400e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontFamily:"'Outfit',sans-serif"}}>Total comprado</div><div style={{fontSize:17,fontWeight:800,color:"#92400e",fontFamily:"'Outfit',sans-serif"}}>{fmt(tC)}</div></div>
                    <div style={{background:"#f0fdf4",padding:"12px 20px"}}><div style={{fontSize:10,color:"#166534",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontFamily:"'Outfit',sans-serif"}}>Total abonado</div><div style={{fontSize:17,fontWeight:800,color:"#16a34a",fontFamily:"'Outfit',sans-serif"}}>{fmt(tA)}</div></div>
                    <div style={{background:saldo>0?"#fff1f2":"#f0fdf4",padding:"12px 20px"}}><div style={{fontSize:10,color:saldo>0?"#9f1239":"#166534",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontFamily:"'Outfit',sans-serif"}}>{saldo>0?"Por pagar":"Al corriente"}</div><div style={{fontSize:17,fontWeight:800,color:saldo>0?"#dc2626":"#16a34a",fontFamily:"'Outfit',sans-serif"}}>{fmt(Math.abs(saldo))}</div></div>
                  </div>
                  {open&&(
                    <div>
                      {pedFiltProv.length>0&&(
                        <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4"}}>
                          <div style={{fontSize:11,fontWeight:600,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:"'Outfit',sans-serif"}}>Pedidos</div>
                          <table style={{width:"100%",borderCollapse:"collapse"}}>
                            <thead><tr>{["#","Mercancía","Cant.","Costo","Estado"].map(h=>(<th key={h} style={{fontSize:10,fontWeight:600,color:"#a8a29e",textAlign:"left",padding:"0 8px 8px 0",textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:"'Outfit',sans-serif"}}>{h}</th>))}</tr></thead>
                            <tbody>{pedFiltProv.map(p=>(<tr key={p.id} style={{borderTop:"1px solid #f5f5f4"}}><td style={{padding:"8px 8px 8px 0",fontSize:12,color:"#a8a29e"}}>#{p.id}</td><td style={{padding:"8px 8px 8px 0",fontSize:13,fontWeight:500,color:"#1c1917",fontFamily:"'Outfit',sans-serif"}}>{p.mercancia}</td><td style={{padding:"8px 8px 8px 0",fontSize:12,color:"#78716c"}}>{p.cant}</td><td style={{padding:"8px 8px 8px 0",fontSize:12,fontWeight:600,color:"#1c1917"}}>{fmt(p.costo+(p.otroCosto||0))}</td><td style={{padding:"8px 0"}}><span style={{background:p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA"?"#dcfce7":p.clientePago==="ABONO PARCIAL"?"#fef3c7":"#fee2e2",color:p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA"?"#166534":p.clientePago==="ABONO PARCIAL"?"#92400e":"#b91c1c",fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20}}>{p.clientePago||"Pendiente"}</span></td></tr>))}</tbody>
                          </table>
                        </div>
                      )}
                      {bFiltProv.length>0&&(
                        <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4"}}>
                          <div style={{fontSize:11,fontWeight:600,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:"'Outfit',sans-serif"}}>Entradas en bodega</div>
                          <table style={{width:"100%",borderCollapse:"collapse"}}>
                            <thead><tr>{["Mercancía","Fecha","Costo/u","Comprado","Dist.","Disponible"].map(h=>(<th key={h} style={{fontSize:10,fontWeight:600,color:"#a8a29e",textAlign:"left",padding:"0 8px 8px 0",textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:"'Outfit',sans-serif"}}>{h}</th>))}</tr></thead>
                            <tbody>{bFiltProv.map(b=>{const td=(b.distribuciones||[]).reduce((s,d)=>s+d.cant,0);const dsp=b.cant-td-(b.mermas||[]).reduce((s,m)=>s+m.cant,0);return(<tr key={b.id} style={{borderTop:"1px solid #f5f5f4"}}><td style={{padding:"8px 8px 8px 0",fontSize:13,fontWeight:500,color:"#1c1917",fontFamily:"'Outfit',sans-serif"}}>{b.mercancia}</td><td style={{padding:"8px 8px 8px 0",fontSize:12,color:"#a8a29e"}}>{b.fecha}</td><td style={{padding:"8px 8px 8px 0",fontSize:12,color:"#78716c"}}>{fmt(b.unitario)}</td><td style={{padding:"8px 8px 8px 0",fontSize:12,fontWeight:600,color:"#1c1917"}}>{b.cant}</td><td style={{padding:"8px 8px 8px 0",fontSize:12,fontWeight:600,color:"#16a34a"}}>{td}</td><td style={{padding:"8px 0",fontSize:12,fontWeight:700,color:dsp>0?"#d97706":"#a8a29e"}}>{dsp}</td></tr>);})}</tbody>
                          </table>
                        </div>
                      )}
                      {abonosProv.filter(a=>a.proveedor===prov.nombre).length>0&&(
                        <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4"}}>
                          <div style={{fontSize:11,fontWeight:600,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:"'Outfit',sans-serif"}}>Pagos realizados</div>
                          {abonosProv.filter(a=>a.proveedor===prov.nombre).sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(a=>(<div key={a.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"1px solid #f5f5f4"}}><span style={{fontSize:13,color:"#44403c",fontFamily:"'Outfit',sans-serif"}}>{a.fecha}{a.nota?` · ${a.nota}`:""}</span><span style={{fontSize:14,fontWeight:700,color:"#16a34a",fontFamily:"'Outfit',sans-serif"}}>+{fmt(a.monto)}</span></div>))}
                        </div>
                      )}
                      <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4",display:"flex",gap:10,flexWrap:"wrap"}}>
                        <button onClick={e=>{e.stopPropagation();setModalEstadoProv(prov.nombre);}} style={{padding:"9px 18px",background:"#f5f5f4",border:"1px solid #e7e5e4",borderRadius:10,color:"#44403c",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>📋 Estado de cuenta</button>
                        <button onClick={e=>{e.stopPropagation();setAForm({fecha:new Date().toISOString().slice(0,10)});setModalAP(prov.nombre);}} style={{padding:"9px 18px",background:"#1c1917",border:"none",borderRadius:10,color:"#fff",fontSize:13,cursor:"pointer",fontWeight:600,fontFamily:"'Outfit',sans-serif"}}>+ Registrar abono</button>
                        <button onClick={e=>{e.stopPropagation();setNewNom(prov.nombre);setEditProv(prov);setModalProv(true);}} style={{padding:"9px 18px",background:"#f5f5f4",border:"1px solid #e7e5e4",borderRadius:10,color:"#44403c",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>✏️</button>
                        <button onClick={e=>{e.stopPropagation();setProveedores(prev=>prev.filter(p=>p.id!==prov.id));}} style={{padding:"9px 18px",background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:10,color:"#e11d48",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>🗑</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>)}
        {tab===2&&(<>
          {/* Toolbar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:10,flex:1,minWidth:0}}>
              <input value={cliSearch} onChange={e=>setCliSearch(e.target.value)} placeholder="Buscar cliente..." style={{...inp,flex:1,maxWidth:260}}/>
              <select value={cliSort} onChange={e=>setCliSort(e.target.value)} style={{...inp,width:"auto"}}>
                <option value="ultimoMod">Último modificado</option>
                <option value="saldo">Mayor saldo</option>
                <option value="saldoAsc">Menor saldo</option>
                <option value="nombre">Nombre A–Z</option>
                <option value="nombreDesc">Nombre Z–A</option>
                <option value="pedidos">Más pedidos</option>
                <option value="monto">Mayor monto total</option>
              </select>
            </div>
            <button onClick={()=>{setEditCli(null);setNewNom("");setModalCli(true);}} style={{...btnP,padding:"9px 20px",fontSize:13,flexShrink:0}}>+ Nuevo cliente</button>
          </div>

          {/* Cards */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {(()=>{
              const q=cliSearch.toLowerCase();
              let lista=[...clientes].filter(c=>!q||c.nombre.toLowerCase().includes(q));
              if(cliSort==="ultimoMod") lista.sort((a,b)=>{const fechas=cli=>[...abonosCli.filter(x=>x.cliente===cli).map(x=>x.fecha),...pedidos.filter(x=>x.cliente===cli).map(x=>x.fecha)].filter(Boolean);const fa=fechas(a.nombre).sort().pop()||"0";const fb=fechas(b.nombre).sort().pop()||"0";return fb.localeCompare(fa);});
              else if(cliSort==="saldo") lista.sort((a,b)=>(saldC[b.nombre]||0)-(saldC[a.nombre]||0));
              else if(cliSort==="saldoAsc") lista.sort((a,b)=>(saldC[a.nombre]||0)-(saldC[b.nombre]||0));
              else if(cliSort==="nombre") lista.sort((a,b)=>a.nombre.localeCompare(b.nombre));
              else if(cliSort==="nombreDesc") lista.sort((a,b)=>b.nombre.localeCompare(a.nombre));
              else if(cliSort==="pedidos") lista.sort((a,b)=>pedidos.filter(p=>p.cliente===b.nombre).length-pedidos.filter(p=>p.cliente===a.nombre).length);
              else if(cliSort==="monto") lista.sort((a,b)=>pedidos.filter(p=>p.cliente===b.nombre).reduce((s,p)=>s+(p.total||0),0)-pedidos.filter(p=>p.cliente===a.nombre).reduce((s,p)=>s+(p.total||0),0));
              return lista;
            })().map(cli=>{
              const saldo=saldC[cli.nombre]||0;
              const pc=pedidos.filter(p=>p.cliente===cli.nombre&&!p.esBodega);
              const tV=pc.reduce((s,p)=>s+(p.total||0),0);
              const tA=abonosCli.filter(a=>a.cliente===cli.nombre).reduce((s,a)=>s+a.monto,0);
              const pendientes=pc.filter(p=>p.clientePago!=="PAGADO"&&p.clientePago!=="PAGADO TRANSFERENCIA");
              const pagados=pc.filter(p=>p.clientePago==="PAGADO"||p.clientePago==="PAGADO TRANSFERENCIA");
              const sp=tA-pagados.reduce((s,p)=>s+(p.total||0),0);
              const pct=tV>0?Math.min(100,Math.round((tA/tV)*100)):0;
              const initials=cli.nombre.split(" ").map(n=>n[0]).slice(0,2).join("");
              const open=!!provOpenMap["cli_"+cli.id];
              const toggleOpen=()=>setProvOpenMap(m=>({...m,["cli_"+cli.id]:!m["cli_"+cli.id]}));
              return(
                <div key={cli.id} style={{background:"#ffffff",border:"1px solid #e7e5e4",borderRadius:16,overflow:"hidden"}}>

                  {/* Header */}
                  <div style={{padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,cursor:"pointer"}} onClick={toggleOpen}>
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <div style={{width:44,height:44,borderRadius:12,background:"#1c1917",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",fontFamily:"'Outfit',sans-serif",flexShrink:0}}>{initials}</div>
                      <div>
                        <div style={{fontSize:16,fontWeight:700,color:"#1c1917",fontFamily:"'Outfit',sans-serif",letterSpacing:"-0.2px"}}>{cli.nombre}</div>
                        <div style={{fontSize:12,color:"#a8a29e",marginTop:2,fontFamily:"'Outfit',sans-serif"}}>{pc.length} pedidos · {pendientes.length} pendientes</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:16}}>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:11,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Saldo</div>
                        <div style={{fontSize:20,fontWeight:800,color:saldo>0?"#dc2626":saldo<0?"#16a34a":"#a8a29e",fontFamily:"'Outfit',sans-serif",letterSpacing:"-0.4px"}}>{fmt(saldo)}</div>
                      </div>
                      <div style={{fontSize:18,color:"#a8a29e",transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:"#f5f5f4"}}>
                    <div style={{background:"#fff7ed",padding:"12px 20px"}}>
                      <div style={{fontSize:10,color:"#92400e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontFamily:"'Outfit',sans-serif"}}>Total vendido</div>
                      <div style={{fontSize:17,fontWeight:800,color:"#92400e",fontFamily:"'Outfit',sans-serif"}}>{fmt(tV)}</div>
                    </div>
                    <div style={{background:"#f0fdf4",padding:"12px 20px"}}>
                      <div style={{fontSize:10,color:"#166534",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontFamily:"'Outfit',sans-serif"}}>Total recibido</div>
                      <div style={{fontSize:17,fontWeight:800,color:"#16a34a",fontFamily:"'Outfit',sans-serif"}}>{fmt(tA)}</div>
                    </div>
                    <div style={{background:saldo>0?"#fff1f2":"#f0fdf4",padding:"12px 20px"}}>
                      <div style={{fontSize:10,color:saldo>0?"#9f1239":"#166534",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,fontFamily:"'Outfit',sans-serif"}}>{saldo>0?"Por cobrar":"Al corriente"}</div>
                      <div style={{fontSize:17,fontWeight:800,color:saldo>0?"#dc2626":"#16a34a",fontFamily:"'Outfit',sans-serif"}}>{fmt(Math.abs(saldo))}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {tV>0&&(
                    <div style={{padding:"8px 24px",background:"#fafaf9",borderBottom:"1px solid #f5f5f4",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,height:5,background:"#e7e5e4",borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:pct>=100?"#16a34a":"#d97706",borderRadius:99}}/>
                      </div>
                      <span style={{fontSize:12,fontWeight:600,color:pct>=100?"#16a34a":"#d97706",fontFamily:"'Outfit',sans-serif",flexShrink:0}}>{pct}% pagado</span>
                    </div>
                  )}

                  {/* Expandible */}
                  {open&&(
                    <div>
                      {/* Pedidos pendientes */}
                      {pendientes.length>0&&(
                        <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4"}}>
                          <div style={{fontSize:11,fontWeight:600,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:"'Outfit',sans-serif"}}>Pedidos pendientes</div>
                          <table style={{width:"100%",borderCollapse:"collapse"}}>
                            <thead><tr>{["#","Mercancía","Cant.","Total","Abonado","Resta","Estado"].map(h=>(<th key={h} style={{fontSize:10,fontWeight:600,color:"#a8a29e",textAlign:"left",padding:"0 8px 8px 0",textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:"'Outfit',sans-serif"}}>{h}</th>))}</tr></thead>
                            <tbody>
                              {pendientes.map(p=>{
                                const asig=p.montoAsignado||0;
                                const resta=(p.total||0)-asig;
                                return(
                                  <tr key={p.id} style={{borderTop:"1px solid #f5f5f4"}}>
                                    <td style={{padding:"8px 8px 8px 0",fontSize:12,color:"#a8a29e"}}>#{p.id}</td>
                                    <td style={{padding:"8px 8px 8px 0",fontSize:13,fontWeight:500,color:"#1c1917",fontFamily:"'Outfit',sans-serif"}}>{p.mercancia}</td>
                                    <td style={{padding:"8px 8px 8px 0",fontSize:12,color:"#78716c"}}>{p.cant}</td>
                                    <td style={{padding:"8px 8px 8px 0",fontSize:12,fontWeight:600,color:"#1c1917"}}>{fmt(p.total)}</td>
                                    <td style={{padding:"8px 8px 8px 0",fontSize:12,color:"#16a34a",fontWeight:600}}>{asig>0?fmt(asig):"—"}</td>
                                    <td style={{padding:"8px 8px 8px 0",fontSize:12,fontWeight:700,color:"#dc2626"}}>{resta>0?fmt(resta):"—"}</td>
                                    <td style={{padding:"8px 0"}}><span style={{background:p.clientePago==="ABONO PARCIAL"?"#fef3c7":"#fee2e2",color:p.clientePago==="ABONO PARCIAL"?"#92400e":"#b91c1c",fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20}}>{p.clientePago||"Pendiente"}</span></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Pagos recibidos */}
                      {abonosCli.filter(a=>a.cliente===cli.nombre).length>0&&(
                        <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4"}}>
                          <div style={{fontSize:11,fontWeight:600,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:"'Outfit',sans-serif"}}>Pagos recibidos</div>
                          {abonosCli.filter(a=>a.cliente===cli.nombre).sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(a=>(
                            <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderTop:"1px solid #f5f5f4"}}>
                              <div>
                                <span style={{fontSize:13,color:"#1c1917",fontFamily:"'Outfit',sans-serif"}}>{a.fecha}</span>
                                {a.nota&&<span style={{fontSize:12,color:"#a8a29e",marginLeft:8}}>{a.nota}</span>}
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:14,fontWeight:700,color:"#16a34a",fontFamily:"'Outfit',sans-serif"}}>+{fmt(a.monto)}</span>
                                <button onClick={e=>{e.stopPropagation();setAForm({fecha:a.fecha,monto:a.monto,nota:a.nota||"",_editId:a.id});setModalAC(cli.nombre);}} style={{background:"#f5f5f4",border:"1px solid #e7e5e4",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#78716c"}}>✏️</button>
                                <button onClick={e=>{e.stopPropagation();if(!confirm("¿Eliminar este abono?"))return;const ab=abonosCli.find(x=>x.id===a.id);setAbonosCli(p=>p.filter(x=>x.id!==a.id));if(ab?.flujoId)setFlujo(p=>p.filter(f=>f.id!==ab.flujoId));}} style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#e11d48"}}>✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Acciones */}
                      <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4",display:"flex",gap:10,flexWrap:"wrap"}}>
                        <button onClick={e=>{e.stopPropagation();setModalEstadoCli(cli.nombre);}} style={{padding:"9px 18px",background:"#f5f5f4",border:"1px solid #e7e5e4",borderRadius:10,color:"#44403c",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>📋 Estado de cuenta</button>
                        <button onClick={e=>{e.stopPropagation();setAForm({fecha:new Date().toISOString().slice(0,10)});setModalAC(cli.nombre);}} style={{padding:"9px 18px",background:"#1c1917",border:"none",borderRadius:10,color:"#fff",fontSize:13,cursor:"pointer",fontWeight:600,fontFamily:"'Outfit',sans-serif"}}>+ Registrar pago</button>
                        {sp>0&&<button onClick={e=>{e.stopPropagation();setModalDistribuir(cli.nombre);}} style={{padding:"9px 18px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,color:"#1d4ed8",fontSize:13,cursor:"pointer",fontWeight:600,fontFamily:"'Outfit',sans-serif"}}>💸 Distribuir — {fmt(sp)}</button>}
                        <button onClick={e=>{e.stopPropagation();setNewNom(cli.nombre);setEditCli(cli);setModalCli(true);}} style={{padding:"9px 18px",background:"#f5f5f4",border:"1px solid #e7e5e4",borderRadius:10,color:"#44403c",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>✏️</button>
                        <button onClick={e=>{e.stopPropagation();setClientes(prev=>prev.filter(c=>c.id!==cli.id));}} style={{padding:"9px 18px",background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:10,color:"#e11d48",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>🗑</button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </>)}
        {tab===3&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:16,color:C.accent3,marginBottom:14}}>🏭 Debes a proveedores</div>
              {proveedores.map(prov=>{const s=saldP[prov.nombre]||0;return(
                <div key={prov.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:C.textMid,fontWeight:500}}>{prov.nombre}</span>
                  <span style={{fontWeight:700,color:s>0?C.red:C.green}}>{fmt(s)}</span>
                </div>
              );})}
              <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0"}}>
                <span style={{color:C.textDim,fontSize:13}}>TOTAL A PAGAR</span>
                <span style={{fontWeight:700,fontSize:18,color:C.red}}>{fmt(totPagar)}</span>
              </div>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:16,color:C.green,marginBottom:14}}>👥 Te deben los clientes</div>
              {clientes.filter(c=>saldC[c.nombre]&&saldC[c.nombre]!==0).sort((a,b)=>(saldC[b.nombre]||0)-(saldC[a.nombre]||0)).map(cli=>{const s=saldC[cli.nombre]||0;return(
                <div key={cli.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:C.textMid,fontSize:13}}>{cli.nombre}</span>
                  <span style={{fontWeight:700,fontSize:13,color:s>0?C.yellow:C.green}}>{fmt(s)}</span>
                </div>
              );})}
              <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0"}}>
                <span style={{color:C.textDim,fontSize:13}}>TOTAL A COBRAR</span>
                <span style={{fontWeight:700,fontSize:18,color:C.yellow}}>{fmt(totCobrar)}</span>
              </div>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20,gridColumn:"span 2"}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:16,color:C.textMid,marginBottom:14}}>📈 Ganancia por proveedor</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
                {proveedores.map(prov=>{const g=pedidos.filter(p=>p.proveedor===prov.nombre).reduce((s,p)=>s+(p.total-p.costo-(p.otroCosto||0)),0);return(
                  <div key={prov.id} style={{background:C.bg,borderRadius:10,padding:"14px 16px"}}>
                    <div style={{fontSize:12,color:C.textDim,marginBottom:4}}>{prov.nombre}</div>
                    <div style={{fontSize:20,fontWeight:700,color:g>=0?C.green:C.red}}>{fmt(g)}</div>
                  </div>
                );})}
                <div style={{background:`#fdf4f5`,border:`1px solid #f5c6c9`,borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:12,color:C.accent3,marginBottom:4,fontWeight:600}}>TOTAL NEGOCIO</div>
                  <div style={{fontSize:22,fontWeight:700,color:C.text}}>{fmt(totG)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ MODAL: PEDIDO ══ */}
      {isPedOpen&&(
        <Modal title={modalPed==="new"?"Nuevo pedido":"Editar pedido"} onClose={()=>setModalPed(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Proveedor"><Combo value={form.proveedor||""} onChange={v=>sf("proveedor",v)} options={proveedores.map(p=>p.nombre)} /></Field>
            <Field label="Cliente"><Combo value={form.cliente||""} onChange={v=>sf("cliente",v)} options={clientes.map(c=>c.nombre)} /></Field>
          </div>
          <Field label="Vendedor"><Combo value={form.vendedor||""} onChange={v=>sf("vendedor",v)} options={["— Sin asignar —",...vendedores]} /></Field>
          <Field label="Mercancía">
            <input value={form.mercancia||""} onChange={e=>sf("mercancia",e.target.value)} style={inp}/>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
            <Field label="Cantidad"><input type="number" value={form.cant||""} onChange={e=>sf("cant",e.target.value)} style={inp}/></Field>
            <Field label="Costo unit."><input type="number" value={form.unitario||""} onChange={e=>sf("unitario",e.target.value)} style={inp}/></Field>
            <Field label="Otro costo"><input type="number" value={form.otroCosto||""} onChange={e=>sf("otroCosto",e.target.value)} style={inp}/></Field>
          </div>
          <Field label="Precio de venta al cliente">
            <input type="number" value={form.precioPublico||""} onChange={e=>sf("precioPublico",e.target.value)} style={inp}/>
          </Field>
          <div style={{background:C.bg,borderRadius:9,padding:"12px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",fontSize:13}}>
            <span style={{color:C.textDim}}>Costo: <strong style={{color:C.yellow}}>{fmt((Number(form.cant)||0)*(Number(form.unitario)||0)+(Number(form.otroCosto)||0))}</strong></span>
            <span style={{color:C.textDim}}>Venta: <strong style={{color:C.blue}}>{fmt((Number(form.cant)||0)*(Number(form.precioPublico)||0))}</strong></span>
            <span style={{color:C.textDim}}>Ganancia: <strong style={{color:C.green}}>{fmt((Number(form.cant)||0)*(Number(form.precioPublico)||0)-(Number(form.cant)||0)*(Number(form.unitario)||0)-(Number(form.otroCosto)||0))}</strong></span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
            {[["¿Cliente pagó?","clientePago"],["¿Yo recibí?","recibido"],["¿Pagué proveedor?","pagadoProveedor"]].map(([label,key])=>(
              <Field key={key} label={label}>
                <select value={form[key]||""} onChange={e=>sf(key,e.target.value)} style={inp}>
                  {STATUS_OPTS.map(s=><option key={s} value={s}>{s||"—"}</option>)}
                </select>
              </Field>
            ))}
          </div>
          <div style={{display:"flex",gap:10,marginTop:6}}>
            <button onClick={()=>setModalPed(null)} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,fontFamily:"'Outfit',sans-serif",cursor:"pointer"}}>Cancelar</button>
            <button onClick={savePed} style={{...btnP,flex:2,padding:"10px 0",fontSize:14}}>Guardar pedido</button>
          </div>
        </Modal>
      )}

      {/* ══ BODEGA ══ */}
{tab===5&&(<>
          {/* Toolbar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:10,flex:1,minWidth:0}}>
              <input value={bSearch} onChange={e=>setBSearch(e.target.value)} placeholder="Buscar mercancía..." style={{...inp,flex:1,maxWidth:260}}/>
              <select value={bFiltProv} onChange={e=>setBFiltProv(e.target.value)} style={{...inp,width:"auto"}}>
                <option value="Todos">Todos los proveedores</option>
                {proveedores.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
              <select value={bFiltDist} onChange={e=>setBFiltDist(e.target.value)} style={{...inp,width:"auto"}}>
                <option value="Todos">Todo</option>
                <option value="Pendiente">Con disponible</option>
                <option value="Completo">Distribuido completo</option>
              </select>
              <select value={bSort||"ultimoMod"} onChange={e=>setBSort(e.target.value)} style={{...inp,width:"auto"}}>
                <option value="ultimoMod">Último modificado</option>
                <option value="nombre">Nombre A–Z</option>
                <option value="prov">Por proveedor</option>
                <option value="disponible">Mayor disponible</option>
              </select>
            </div>
            <button onClick={()=>{setBForm({fecha:new Date().toISOString().slice(0,10),proveedor:proveedores[0]?.nombre||""});setModalBodega("new");}} style={{...btnP,padding:"9px 20px",fontSize:13,flexShrink:0}}>+ Nueva entrada</button>
          </div>

          {/* Cards */}
          {bodega.length===0?(
            <div style={{textAlign:"center",padding:"60px 0",color:"#a8a29e",background:"#ffffff",borderRadius:16,border:"1px solid #e7e5e4"}}>
              <div style={{fontSize:36,marginBottom:12}}>🏪</div>
              <div style={{fontSize:15,fontWeight:600,color:"#1c1917",marginBottom:6,fontFamily:"'Outfit',sans-serif"}}>Bodega vacía</div>
              <div style={{fontSize:13,fontFamily:"'Outfit',sans-serif"}}>Registra compras grandes para distribuirlas entre clientes.</div>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[...bodega].filter(item=>{
                const dsp=disponibleDe(item);
                return(!bSearch||item.mercancia.toLowerCase().includes(bSearch.toLowerCase()))
                  &&(bFiltProv==="Todos"||item.proveedor===bFiltProv)
                  &&enPeriodo(item.fecha)
                  &&(bFiltDist==="Todos"||(bFiltDist==="Pendiente"&&dsp>0)||(bFiltDist==="Completo"&&dsp===0));
              }).sort((a,b)=>{
                if((bSort||"ultimoMod")==="ultimoMod") return (b.fecha||"0").localeCompare(a.fecha||"0");
                if(bSort==="nombre") return a.mercancia.localeCompare(b.mercancia);
                if(bSort==="prov") return a.proveedor.localeCompare(b.proveedor);
                if(bSort==="disponible") return disponibleDe(b)-disponibleDe(a);
                return 0;
              }).map(item=>{
                const td=(item.distribuciones||[]).reduce((s,d)=>s+d.cant,0);
                const tm=(item.mermas||[]).reduce((s,m)=>s+m.cant,0);
                const dsp=disponibleDe(item);
                const pct=item.cant>0?Math.round((td/item.cant)*100):0;
                const open=!!provOpenMap["bod_"+item.id];
                const toggleOpen=()=>setProvOpenMap(m=>({...m,["bod_"+item.id]:!m["bod_"+item.id]}));
                return(
                  <div key={item.id} style={{background:"#ffffff",border:"1px solid #e7e5e4",borderRadius:16,overflow:"hidden"}}>

                    {/* Header */}
                    <div style={{padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,cursor:"pointer"}} onClick={toggleOpen}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:16,fontWeight:700,color:"#1c1917",fontFamily:"'Outfit',sans-serif",letterSpacing:"-0.2px",marginBottom:3}}>{item.mercancia}</div>
                        <div style={{fontSize:12,color:"#a8a29e",fontFamily:"'Outfit',sans-serif"}}>{item.proveedor} · {item.fecha} · {fmt(item.unitario)}/u</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:16}}>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:11,color:"#a8a29e",marginBottom:1}}>Costo total</div>
                          <div style={{fontSize:18,fontWeight:800,color:"#92400e",fontFamily:"'Outfit',sans-serif"}}>{fmt(item.costoTotal)}</div>
                        </div>
                        <div style={{fontSize:18,color:"#a8a29e",transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:1,background:"#f5f5f4"}}>
                      {[
                        {l:"Comprado",v:item.cant,bg:"#fafaf9",c:"#1c1917"},
                        {l:"Distribuido",v:td,bg:"#f0fdf4",c:"#16a34a"},
                        {l:"Merma",v:tm,bg:"#fff7ed",c:"#d97706"},
                        {l:"Disponible",v:dsp,bg:dsp>0?"#fffbeb":"#f0fdf4",c:dsp>0?"#d97706":"#16a34a"},
                      ].map(s=>(
                        <div key={s.l} style={{background:s.bg,padding:"12px 16px",textAlign:"center"}}>
                          <div style={{fontSize:10,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,fontFamily:"'Outfit',sans-serif"}}>{s.l}</div>
                          <div style={{fontSize:20,fontWeight:800,color:s.c,fontFamily:"'Outfit',sans-serif"}}>{s.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Progress */}
                    <div style={{padding:"8px 24px",background:"#fafaf9",borderBottom:"1px solid #f5f5f4",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{flex:1,height:5,background:"#e7e5e4",borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:pct>=100?"#16a34a":"#d97706",borderRadius:99}}/>
                      </div>
                      <span style={{fontSize:12,fontWeight:600,color:pct>=100?"#16a34a":"#d97706",fontFamily:"'Outfit',sans-serif",flexShrink:0}}>{pct}% distribuido</span>
                    </div>

                    {/* Expandible */}
                    {open&&(
                      <div>
                        {/* Distribuciones */}
                        {(item.distribuciones||[]).length>0&&(
                          <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4"}}>
                            <div style={{fontSize:11,fontWeight:600,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:"'Outfit',sans-serif"}}>Distribuciones ({(item.distribuciones||[]).length})</div>
                            {(item.distribuciones||[]).map(d=>(
                              <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:"1px solid #f5f5f4"}}>
                                <div>
                                  <span style={{fontSize:13,fontWeight:500,color:"#1c1917",fontFamily:"'Outfit',sans-serif"}}>{d.cliente}</span>
                                  <span style={{fontSize:12,color:"#a8a29e",marginLeft:8}}>{d.cant} uds · {d.fecha}</span>
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontSize:13,fontWeight:700,color:"#2563eb",fontFamily:"'Outfit',sans-serif"}}>{fmt(d.total)}</span>
                                  <span style={{fontSize:11,color:"#a8a29e"}}>#{d.pedidoId}</span>
                                  <button onClick={e=>{e.stopPropagation();if(!confirm("¿Eliminar esta distribución?"))return;const newDists=(item.distribuciones||[]).filter(x=>x.id!==d.id);const pendientes=item.cant-newDists.reduce((s,x)=>s+x.cant,0);setBodega(p=>p.map(b=>b.id===item.id?{...b,distribuciones:newDists}:b));setPedidos(p=>{const sinEste=p.filter(x=>x.id!==d.pedidoId);const yaExisteProv=sinEste.find(x=>x.id===item.pedidoProvId);if(pendientes>0&&!yaExisteProv){return[...sinEste,{id:item.pedidoProvId,proveedor:item.proveedor,cliente:"BODEGA",mercancia:item.mercancia,cant:pendientes,unitario:item.unitario,otroCosto:0,precioPublico:0,costo:pendientes*item.unitario,total:0,fecha:item.fecha,vendedor:"",clientePago:"N/A",recibido:"N/A",pagadoProveedor:"",bodegaId:item.id,esBodega:true}];}else if(pendientes>0&&yaExisteProv){return sinEste.map(x=>x.id===item.pedidoProvId?{...x,cant:pendientes,costo:pendientes*item.unitario}:x);}return sinEste;});}} style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#e11d48"}}>✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Mermas */}
                        {(item.mermas||[]).length>0&&(
                          <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4"}}>
                            <div style={{fontSize:11,fontWeight:600,color:"#a8a29e",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:"'Outfit',sans-serif"}}>Mermas</div>
                            {(item.mermas||[]).map(m=>(
                              <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:"1px solid #f5f5f4"}}>
                                <div>
                                  <span style={{fontSize:13,fontWeight:500,color:"#1c1917",fontFamily:"'Outfit',sans-serif"}}>{m.tipo||"Merma"}</span>
                                  {m.nota&&<span style={{fontSize:12,color:"#a8a29e",marginLeft:8}}>{m.nota}</span>}
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontSize:13,fontWeight:700,color:"#d97706",fontFamily:"'Outfit',sans-serif"}}>{m.cant} uds</span>
                                  <button onClick={e=>{e.stopPropagation();setModalMerma({bodegaId:item.id,id:m.id,cant:m.cant,tipo:m.tipo,nota:m.nota||""});}} style={{background:"#f5f5f4",border:"1px solid #e7e5e4",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#78716c"}}>✏️</button>
                                  <button onClick={e=>{e.stopPropagation();setBodega(p=>p.map(b=>b.id===item.id?{...b,mermas:(b.mermas||[]).filter(x=>x.id!==m.id)}:b));}} style={{background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#e11d48"}}>✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Acciones */}
                        <div style={{padding:"14px 24px",borderTop:"1px solid #f5f5f4",display:"flex",gap:10,flexWrap:"wrap"}}>
                          <button onClick={e=>{e.stopPropagation();setBForm({fecha:item.fecha,proveedor:item.proveedor,mercancia:item.mercancia,cant:item.cant,unitario:item.unitario,notas:item.notas||"",_editId:item.id});setModalBodega("edit");}} style={{padding:"9px 18px",background:"#f5f5f4",border:"1px solid #e7e5e4",borderRadius:10,color:"#44403c",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>✏️ Editar</button>
                          {dsp>0&&<button onClick={e=>{e.stopPropagation();setModalDist(item.id);setDForm({fecha:new Date().toISOString().slice(0,10),cliente:clientes[0]?.nombre||""});}} style={{padding:"9px 18px",background:"#1c1917",border:"none",borderRadius:10,color:"#fff",fontSize:13,cursor:"pointer",fontWeight:600,fontFamily:"'Outfit',sans-serif"}}>+ Distribuir ({dsp} disp.)</button>}
                          <button onClick={e=>{e.stopPropagation();setModalMerma({bodegaId:item.id,id:null,cant:"",tipo:"",nota:""});}} style={{padding:"9px 18px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:10,color:"#92400e",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>+ Merma</button>
                          <button onClick={e=>{e.stopPropagation();if(!confirm("¿Eliminar?"))return;setBodega(p=>p.filter(b=>b.id!==item.id));setPedidos(p=>p.filter(x=>x.id!==item.pedidoProvId&&!(item.distribuciones||[]).find(d=>d.pedidoId===x.id)));}} style={{padding:"9px 18px",background:"#fff1f2",border:"1px solid #fecdd3",borderRadius:10,color:"#e11d48",fontSize:13,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>🗑</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>)}

        {modalEstadoProv&&<EstadoCuentaProveedorModal nombre={modalEstadoProv} pedidos={pedidos} abonosProv={abonosProv} onClose={()=>setModalEstadoProv(null)} fmt={fmt} C={C} inp={inp} btnP={btnP}/>}

      {modalDistribuir&&<DistribuirPagosModal nombre={modalDistribuir} pedidos={pedidos} abonosCli={abonosCli} setPedidos={setPedidos} onClose={()=>setModalDistribuir(null)} fmt={fmt} C={C} inp={inp} btnP={btnP}/>}

{modalEstadoCli&&<EstadoCuentaModal nombre={modalEstadoCli} pedidos={pedidos} abonosCli={abonosCli} flujo={flujo} onClose={()=>setModalEstadoCli(null)} fmt={fmt} C={C} inp={inp} btnP={btnP} periodo={periodo} periodoAnio={periodoAnio} periodoMes={periodoMes} periodoSem={periodoSem} setPedidos={setPedidos}/>}

{editMerma&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setEditMerma(null);}}>
          <div style={{background:"#fff",borderRadius:14,padding:24,width:"100%",maxWidth:340,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
            <div style={{fontFamily:"'Sora',sans-serif",fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>✏️ Editar merma</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,color:C.textDim,marginBottom:4}}>Cantidad</div>
              <input type="number" value={editMerma.cant} onChange={e=>setEditMerma(p=>({...p,cant:Number(e.target.value)}))} style={{...inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,color:C.textDim,marginBottom:4}}>Tipo</div>
              <select value={editMerma.tipo} onChange={e=>setEditMerma(p=>({...p,tipo:e.target.value}))} style={{...inp,width:"100%"}}>
                <option value="Daño">Daño</option>
                <option value="Robo">Robo</option>
                <option value="Vencimiento">Vencimiento</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:C.textDim,marginBottom:4}}>Nota</div>
              <input value={editMerma.nota} onChange={e=>setEditMerma(p=>({...p,nota:e.target.value}))} style={{...inp,width:"100%"}} placeholder="Opcional"/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditMerma(null)} style={{flex:1,padding:"9px 0",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",fontSize:13}}>Cancelar</button>
              <button onClick={()=>{
                if(!editMerma.cant||!editMerma.tipo)return;
                setBodega(p=>p.map(b=>b.id===editMerma.bodegaId?{...b,mermas:(b.mermas||[]).map(m=>m.id===editMerma.mermaId?{...m,cant:editMerma.cant,tipo:editMerma.tipo,nota:editMerma.nota}:m)}:b));
                setEditMerma(null);
              }} style={{flex:2,padding:"9px 0",background:C.accent,border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff"}}>Guardar</button>
            </div>
          </div>
        </div>
      )}

{/* ══ MINI-MODALS: agregar proveedor / cliente / vendedor ══
          Usan zIndex:400 para aparecer ENCIMA del modal de pedido */}
      {modalProv&&(
        <AddNombreModal
          title={editProv?"Editar proveedor":"Nuevo proveedor"}
          placeholder="Ej: NIKE WHOLESALE"
          onSave={saveProv}
          onClose={()=>{setModalProv(false);setEditProv(null);setNewNom("");}}
        />
      )}
      {modalCli&&(
        <AddNombreModal
          title={editCli?"Editar cliente":"Nuevo cliente"}
          placeholder="Ej: PEDRO RAMIREZ"
          onSave={saveCli}
          onClose={()=>{setModalCli(false);setEditCli(null);setNewNom("");}}
        />
      )}
      {modalVend&&(
        <AddNombreModal
          title="Nuevo vendedor"
          placeholder="Ej: CARLOS"
          onSave={saveVend}
          onClose={()=>setModalVend(false)}
        />
      )}

      {/* ══ MODAL: Abono Proveedor ══ */}
      {modalAP&&(
        <Modal title={`Abono a ${modalAP}`} onClose={()=>setModalAP(null)}>
          <Field label="Fecha"><input type="date" value={aForm.fecha||""} onChange={e=>setAForm(f=>({...f,fecha:e.target.value}))} style={inp}/></Field>
          <Field label="Monto"><input type="number" value={aForm.monto||""} onChange={e=>setAForm(f=>({...f,monto:e.target.value}))} style={inp}/></Field>
          <Field label="Nota"><input value={aForm.nota||""} onChange={e=>setAForm(f=>({...f,nota:e.target.value}))} style={inp}/></Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={()=>setModalAP(null)} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,cursor:"pointer"}}>Cancelar</button>
            <button onClick={saveAP} style={{...btnP,flex:2,padding:"10px 0",fontSize:14}}>Registrar abono</button>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: Pago Cliente ══ */}
      {modalAC&&(
        <Modal title={`Registrar pago de ${modalAC}`} onClose={()=>{setModalAC(null);setAForm({});}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Fecha"><input type="date" value={aForm.fecha||""} onChange={e=>setAForm(f=>({...f,fecha:e.target.value}))} style={inp}/></Field>
            <Field label="Monto recibido">
              <input type="number" value={aForm.monto||""} onChange={e=>setAForm(f=>({...f,monto:e.target.value}))} style={inp} placeholder="0.00"/>
            </Field>
          </div>
          <Field label="Nota"><input value={aForm.nota||""} onChange={e=>setAForm(f=>({...f,nota:e.target.value}))} style={inp} placeholder="Ej: transferencia, efectivo..."/></Field>
          <div style={{padding:"10px 12px",background:"#eff6ff",borderRadius:8,fontSize:12,color:"#1d4ed8",marginBottom:4}}>
            💡 El monto quedará como saldo a favor del cliente. Después puedes distribuirlo entre sus pedidos pendientes.
          </div>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={()=>{setModalAC(null);setAForm({});}} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,cursor:"pointer"}}>Cancelar</button>
            <button onClick={saveAC} style={{...btnP,flex:2,padding:"10px 0",fontSize:14}}>Registrar pago</button>
          </div>
        </Modal>
      )}

      {/* ══ TAB 4: FLUJO DE EFECTIVO ══ */}
      {tab===4&&(()=>{
        const saveFlujoEntry=()=>{
          const monto=Number(flujoForm.monto)||0;
          if(!monto||!flujoForm.descripcion) return;
          const esIngreso=flujoForm.tipo==="INGRESO";
          const montoFinal=esIngreso?monto:-monto;
          if(flujoForm._editId){
            setFlujo(p=>p.map(f=>f.id===flujoForm._editId?{...f,fecha:flujoForm.fecha||f.fecha,tipo:flujoForm.tipo,categoria:flujoForm.categoria||"Otro",descripcion:flujoForm.descripcion,monto:montoFinal}:f));
            if(flujoForm.abonoId){
              setAbonosCli(p=>p.map(a=>a.id===flujoForm.abonoId?{...a,monto:Math.abs(montoFinal),fecha:flujoForm.fecha||a.fecha,nota:flujoForm.descripcion.replace(/^Pago de [^—]+— ?/,"")}:a));
            }
          } else {
            setFlujo(p=>[...p,{id:`fl${Date.now()}`,fecha:flujoForm.fecha||new Date().toISOString().slice(0,10),tipo:flujoForm.tipo,categoria:flujoForm.categoria||"Otro",descripcion:flujoForm.descripcion,monto:montoFinal}]);
          }
          setModalFlujo(false);setFlujoForm({});
        };
        const TIPOS_CAT={
          INGRESO:["Cobro cliente","Inyección de capital","Otro ingreso"],
          EGRESO:["Pago proveedor","Gasto operativo","Retiro","Otro egreso"]
        };
        const cutoff=periodo==="anio"?periodoAnio:periodo==="mes"?periodoAnio+"-"+periodoMes:periodoSem;
        const saldoAnterior=periodo==="todo"?0:flujo.filter(m=>m.fecha&&m.fecha<cutoff&&!enPeriodo(m.fecha)).reduce((s,m)=>s+m.monto,0);
        const flujoFiltrado=[...flujo].filter(m=>enPeriodo(m.fecha));
        const sorted=[...flujoFiltrado].sort((a,b)=>a.fecha.localeCompare(b.fecha));
        let runSaldo=saldoAnterior;
        const rows=sorted.map(m=>{runSaldo+=m.monto;return{...m,saldoAcum:runSaldo};});
        const totalIngresos=flujoFiltrado.filter(m=>m.monto>0).reduce((s,m)=>s+m.monto,0);
        const totalEgresos=flujoFiltrado.filter(m=>m.monto<0).reduce((s,m)=>s+Math.abs(m.monto),0);
        const saldoActual=saldoAnterior+totalIngresos-totalEgresos;
        return(
          <>
            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
              {[
                {l:"Total ingresos",v:fmt(totalIngresos),c:C.green,icon:"📈"},
                {l:"Total egresos",v:fmt(totalEgresos),c:C.red,icon:"📉"},
                {l:"Saldo actual",v:fmt(saldoActual),c:saldoActual>=0?C.green:C.red,icon:"💵"},
              ].map(s=>(
                <div key={s.l} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                  <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
                  <div style={{fontSize:11,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{s.l}</div>
                  <div style={{fontSize:22,fontWeight:700,color:s.c,fontFamily:"'Sora',sans-serif"}}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <button onClick={()=>{setFlujoForm({tipo:"INGRESO",fecha:new Date().toISOString().slice(0,10)});setModalFlujo(true);}}
                style={{...btnP,padding:"9px 20px",fontSize:13,background:`linear-gradient(135deg,${C.green},#15803d)`}}>
                + Registrar ingreso
              </button>
              <button onClick={()=>{setFlujoForm({tipo:"EGRESO",fecha:new Date().toISOString().slice(0,10)});setModalFlujo(true);}}
                style={{...btnP,padding:"9px 20px",fontSize:13,background:`linear-gradient(135deg,${C.red},#b91c1c)`}}>
                − Registrar egreso
              </button>
            </div>

            {/* Table */}
            {rows.length===0?(
              <div style={{textAlign:"center",padding:"60px 0",color:C.textDim,background:"#fff",borderRadius:14,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:40,marginBottom:12}}>💵</div>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Sin movimientos aún</div>
                <div style={{fontSize:13}}>Los pagos a proveedores y cobros a clientes aparecerán aquí automáticamente.</div>
              </div>
            ):(
              <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{borderBottom:`2px solid ${C.border}`,background:"#fafafa"}}>
                      {["Fecha","Tipo","Categoría","Descripción","Monto","Saldo acumulado",""].map(h=>(
                        <th key={h} style={{padding:"11px 14px",color:C.textDim,fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",textAlign:h==="Monto"||h==="Saldo acumulado"?"right":"left",fontWeight:600}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodo!=="todo"&&saldoAnterior!==0&&(
                      <tr style={{background:"#eff6ff",borderBottom:`1px solid ${C.border}`}}>
                        <td colSpan={5} style={{padding:"8px 14px",fontSize:12,color:"#1d4ed8",fontWeight:600}}>📊 Saldo anterior al periodo: {fmt(saldoAnterior)}</td>
                        <td style={{padding:"8px 14px",textAlign:"right",fontWeight:700,color:"#1d4ed8"}}>{fmt(saldoAnterior)}</td>
                        <td/>
                      </tr>
                    )}
                    {rows.map((m,i)=>(
                      <tr key={m.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":"#fafafa"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#fdf4f5"}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#fafafa"}>
                        <td style={{padding:"11px 14px",color:C.textDim,whiteSpace:"nowrap"}}>{m.fecha}</td>
                        <td style={{padding:"11px 14px"}}>
                          <span style={{background:m.monto>0?"#dcfce7":"#fee2e2",color:m.monto>0?C.green:C.red,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>
                            {m.monto>0?"↑ INGRESO":"↓ EGRESO"}
                          </span>
                        </td>
                        <td style={{padding:"11px 14px",color:C.textMid,fontSize:12}}>{m.categoria}</td>
                        <td style={{padding:"11px 14px",color:C.text,maxWidth:220,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.descripcion}</td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontWeight:700,color:m.monto>0?C.green:C.red,whiteSpace:"nowrap"}}>{m.monto>0?"+":""}{fmt(m.monto)}</td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontWeight:700,color:m.saldoAcum>=0?C.blue:C.red,whiteSpace:"nowrap"}}>{fmt(m.saldoAcum)}</td>
                        <td style={{padding:"8px 10px"}}>
                          <div style={{display:"flex",gap:4}}>
                            <button onClick={()=>{setFlujoForm({...m,monto:Math.abs(m.monto),_editId:m.id});setModalFlujo(true);}} style={{background:"#f4f4f5",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 7px",cursor:"pointer",fontSize:11,color:C.textMid}}>✏️</button>
                            <button onClick={()=>{
                              if(!confirm("¿Eliminar este movimiento?"))return;
                              if(m.abonoId) setAbonosCli(p=>p.filter(a=>a.id!==m.abonoId));
                              setFlujo(p=>p.filter(x=>x.id!==m.id));
                            }} style={{background:"#fff0f0",border:"1px solid #fecaca",borderRadius:5,padding:"3px 7px",cursor:"pointer",fontSize:11,color:C.red}}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal nuevo movimiento */}
            {modalFlujo&&(
              <Modal title={flujoForm._editId?"Guardar cambios":flujoForm.tipo==="INGRESO"?"Registrar ingreso":"Registrar egreso"} onClose={()=>{setModalFlujo(false);setFlujoForm({});}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
                  <Field label="Tipo">
                    <select value={flujoForm.tipo||"INGRESO"} onChange={e=>setFlujoForm(f=>({...f,tipo:e.target.value,categoria:""}))} style={inp}>
                      <option value="INGRESO">↑ Ingreso</option>
                      <option value="EGRESO">↓ Egreso</option>
                    </select>
                  </Field>
                  <Field label="Fecha">
                    <input type="date" value={flujoForm.fecha||""} onChange={e=>setFlujoForm(f=>({...f,fecha:e.target.value}))} style={inp}/>
                  </Field>
                </div>
                <Field label="Categoría">
                  <select value={flujoForm.categoria||""} onChange={e=>setFlujoForm(f=>({...f,categoria:e.target.value}))} style={inp}>
                    <option value="">— Seleccionar —</option>
                    {(TIPOS_CAT[flujoForm.tipo||"INGRESO"]||[]).map(c=><option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Descripción">
                  <input value={flujoForm.descripcion||""} onChange={e=>setFlujoForm(f=>({...f,descripcion:e.target.value}))} placeholder="Ej: Inyección de capital inicial" style={inp}/>
                </Field>
                <Field label="Monto (USD)">
                  <input type="number" value={flujoForm.monto||""} onChange={e=>setFlujoForm(f=>({...f,monto:e.target.value}))} placeholder="0.00" style={inp}/>
                </Field>
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  <button onClick={()=>{setModalFlujo(false);setFlujoForm({});}} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancelar</button>
                  <button onClick={saveFlujoEntry} style={{...btnP,flex:2,padding:"10px 0",fontSize:14,background:flujoForm.tipo==="INGRESO"?`linear-gradient(135deg,${C.green},#15803d)`:`linear-gradient(135deg,${C.red},#b91c1c)`}}>
                    {flujoForm._editId?"Guardar cambios":flujoForm.tipo==="INGRESO"?"Registrar ingreso":"Registrar egreso"}
                  </button>
                </div>
              </Modal>
            )}
          </>
        );
      })()}


    

      {isPedOpen&&(
        <Modal title={modalPed==="new"?"Nuevo pedido":"Editar pedido"} onClose={()=>setModalPed(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Proveedor"><Combo value={form.proveedor||""} onChange={v=>sf("proveedor",v)} options={proveedores.map(p=>p.nombre)} /></Field>
            <Field label="Cliente"><Combo value={form.cliente||""} onChange={v=>sf("cliente",v)} options={clientes.map(c=>c.nombre)} /></Field>
          </div>
          <Field label="Vendedor"><Combo value={form.vendedor||""} onChange={v=>sf("vendedor",v)} options={["— Sin asignar —",...vendedores]} /></Field>
          <Field label="Mercancía">
            <input value={form.mercancia||""} onChange={e=>sf("mercancia",e.target.value)} style={inp}/>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
            <Field label="Cantidad"><input type="number" value={form.cant||""} onChange={e=>sf("cant",e.target.value)} style={inp}/></Field>
            <Field label="Costo unit."><input type="number" value={form.unitario||""} onChange={e=>sf("unitario",e.target.value)} style={inp}/></Field>
            <Field label="Otro costo"><input type="number" value={form.otroCosto||""} onChange={e=>sf("otroCosto",e.target.value)} style={inp}/></Field>
          </div>
          <Field label="Precio de venta al cliente">
            <input type="number" value={form.precioPublico||""} onChange={e=>sf("precioPublico",e.target.value)} style={inp}/>
          </Field>
          <div style={{background:C.bg,borderRadius:9,padding:"12px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",fontSize:13}}>
            <span style={{color:C.textDim}}>Costo: <strong style={{color:C.yellow}}>{fmt((Number(form.cant)||0)*(Number(form.unitario)||0)+(Number(form.otroCosto)||0))}</strong></span>
            <span style={{color:C.textDim}}>Venta: <strong style={{color:C.blue}}>{fmt((Number(form.cant)||0)*(Number(form.precioPublico)||0))}</strong></span>
            <span style={{color:C.textDim}}>Ganancia: <strong style={{color:C.green}}>{fmt((Number(form.cant)||0)*(Number(form.precioPublico)||0)-(Number(form.cant)||0)*(Number(form.unitario)||0)-(Number(form.otroCosto)||0))}</strong></span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
            {[["¿Cliente pagó?","clientePago"],["¿Yo recibí?","recibido"],["¿Pagué proveedor?","pagadoProveedor"]].map(([label,key])=>(
              <Field key={key} label={label}>
                <select value={form[key]||""} onChange={e=>sf(key,e.target.value)} style={inp}>
                  {STATUS_OPTS.map(s=><option key={s} value={s}>{s||"—"}</option>)}
                </select>
              </Field>
            ))}
          </div>
          <div style={{display:"flex",gap:10,marginTop:6}}>
            <button onClick={()=>setModalPed(null)} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>Cancelar</button>
            <button onClick={savePed} style={{...btnP,flex:2,padding:"10px 0",fontSize:14}}>Guardar pedido</button>
          </div>
        </Modal>
      )}



      {modalBodega&&(
  <Modal title={bForm._editId?"Editar entrada":"Nueva entrada de bodega"} onClose={()=>{setModalBodega(null);setBForm({});}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Field label="Fecha"><input type="date" value={bForm.fecha||""} onChange={e=>setBForm(f=>({...f,fecha:e.target.value}))} style={inp}/></Field>
      <Field label="Proveedor"><Combo value={bForm.proveedor||""} onChange={v=>setBForm(f=>({...f,proveedor:v}))} options={proveedores.map(p=>p.nombre)} /></Field>
    </div>
    <Field label="Mercancía"><input value={bForm.mercancia||""} onChange={e=>setBForm(f=>({...f,mercancia:e.target.value.toUpperCase()}))} style={inp} placeholder="Ej: GORRAS NEW BALANCE"/></Field>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
      <Field label="Cantidad"><input type="number" value={bForm.cant||""} onChange={e=>setBForm(f=>({...f,cant:e.target.value}))} style={inp}/></Field>
      <Field label="Costo unitario"><input type="number" value={bForm.unitario||""} onChange={e=>setBForm(f=>({...f,unitario:e.target.value}))} style={inp}/></Field>
    </div>
    {bForm.cant&&bForm.unitario&&(<div style={{padding:"10px 14px",background:C.bg,borderRadius:9,marginBottom:14,fontSize:13,display:"flex",justifyContent:"space-between"}}><span style={{color:C.textDim}}>Costo total:</span><strong style={{color:C.yellow}}>{fmt((Number(bForm.cant)||0)*(Number(bForm.unitario)||0))}</strong></div>)}
    <Field label="Notas (opcional)"><input value={bForm.notas||""} onChange={e=>setBForm(f=>({...f,notas:e.target.value}))} style={inp}/></Field>
    <div style={{display:"flex",gap:10,marginTop:8}}>
      <button onClick={()=>{setModalBodega(null);setBForm({});}} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancelar</button>
      <button onClick={()=>{
        const cant=Number(bForm.cant)||0,unitario=Number(bForm.unitario)||0;
        if(!bForm.mercancia||!cant||!bForm.proveedor)return;
        const fecha=bForm.fecha||new Date().toISOString().slice(0,10);
        if(bForm._editId){
          const existing=bodega.find(b=>b.id===bForm._editId);
          const pendientes=cant-(existing.distribuciones||[]).reduce((s,d)=>s+d.cant,0);
          setBodega(p=>p.map(b=>b.id===bForm._editId?{...b,fecha,proveedor:bForm.proveedor,mercancia:bForm.mercancia,cant,unitario,costoTotal:cant*unitario,notas:bForm.notas||""}:b));
          if(existing.pedidoProvId){
            if(pendientes<=0){setPedidos(p=>p.filter(x=>x.id!==existing.pedidoProvId));}
            else{setPedidos(p=>p.map(x=>x.id===existing.pedidoProvId?{...x,cant:pendientes,unitario,costo:pendientes*unitario,mercancia:bForm.mercancia,proveedor:bForm.proveedor,fecha}:x));}
          }
        } else {
          const boId=`bo${Date.now()}`;
          const pedId=nextFolio;
          setPedidos(prev=>[...prev,{id:pedId,proveedor:bForm.proveedor,cliente:"BODEGA",mercancia:bForm.mercancia,cant,unitario,otroCosto:0,precioPublico:0,costo:cant*unitario,total:0,fecha,vendedor:"",clientePago:"N/A",recibido:"N/A",pagadoProveedor:"",bodegaId:boId,esBodega:true}]);
          setNextFolio(pedId+1);
          setBodega(p=>[{id:boId,fecha,proveedor:bForm.proveedor,mercancia:bForm.mercancia,cant,unitario,costoTotal:cant*unitario,distribuciones:[],mermas:[],notas:bForm.notas||"",pedidoProvId:pedId},...p]);
        }
        setModalBodega(null);setBForm({});
      }} style={{...btnP,flex:2,padding:"10px 0",fontSize:14}}>{bForm._editId?"Guardar cambios":"Registrar entrada"}</button>
    </div>
  </Modal>
)}

{/* ══ MODAL: Distribuir ══ */}


      {modalDist&&(()=>{
  const item=bodega.find(b=>b.id===modalDist);
  if(!item)return null;
  const dsp=disponibleDe(item);
  return(
    <Modal title={`Distribuir: ${item.mercancia}`} onClose={()=>{setModalDist(null);setDForm({});}}>
      <div style={{padding:"10px 14px",background:C.bg,borderRadius:9,marginBottom:16,display:"flex",gap:16,fontSize:13}}>
        <span style={{color:C.textDim}}>Disponible: <strong style={{color:dsp>0?C.green:C.red}}>{dsp} uds</strong></span>
        <span style={{color:C.textDim}}>Costo unit: <strong style={{color:C.yellow}}>{fmt(item.unitario)}</strong></span>
      </div>
      <div style={{marginBottom:16,padding:14,border:`1px solid ${C.border}`,borderRadius:10}}>
        <div style={{fontWeight:700,color:C.accent3,fontSize:13,marginBottom:10}}>📦 Distribuir a cliente</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Fecha"><input type="date" value={dForm.fecha||""} onChange={e=>setDForm(f=>({...f,fecha:e.target.value}))} style={inp}/></Field>
          <Field label="Cliente"><Combo value={dForm.cliente||""} onChange={v=>setDForm(f=>({...f,cliente:v}))} options={clientes.map(c=>c.nombre)} /></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Cantidad"><input type="number" value={dForm.cant||""} onChange={e=>setDForm(f=>({...f,cant:e.target.value}))} style={inp} placeholder={`Máx ${dsp}`}/></Field>
          <Field label="Precio venta unit."><input type="number" value={dForm.precio||""} onChange={e=>setDForm(f=>({...f,precio:e.target.value}))} style={inp}/></Field>
        </div>
        {dForm.cant&&dForm.precio&&(<div style={{padding:"8px 12px",background:"#f0fdf4",borderRadius:8,fontSize:12,marginBottom:8,display:"flex",justifyContent:"space-between"}}><span>Total: <strong style={{color:C.green}}>{fmt((Number(dForm.cant)||0)*(Number(dForm.precio)||0))}</strong></span><span>Ganancia: <strong style={{color:gColor((Number(dForm.cant)||0)*(Number(dForm.precio)-item.unitario))}}>{fmt((Number(dForm.cant)||0)*(Number(dForm.precio)-item.unitario))}</strong></span></div>)}
        <Field label="Nota"><input value={dForm.nota||""} onChange={e=>setDForm(f=>({...f,nota:e.target.value}))} style={inp}/></Field>
        <button onClick={()=>{
          const cant=Number(dForm.cant)||0,precio=Number(dForm.precio)||0;
          if(!dForm.cliente||!cant)return;
          if(cant>dsp){alert(`Solo quedan ${dsp} unidades`);return;}
          const pedId=nextFolio;
          setPedidos(prev=>[...prev,{id:pedId,proveedor:item.proveedor,cliente:dForm.cliente,mercancia:item.mercancia,cant,unitario:item.unitario,otroCosto:0,precioPublico:precio,costo:cant*item.unitario,total:cant*precio,fecha:dForm.fecha||new Date().toISOString().slice(0,10),vendedor:"",clientePago:"",recibido:"",pagadoProveedor:"",bodegaId:item.id}]);
          setNextFolio(pedId+1);
          const distribuidasAntes=(item.distribuciones||[]).reduce((s,d)=>s+d.cant,0);
          const pendientes=item.cant-distribuidasAntes-cant;
          if(item.pedidoProvId){
            if(pendientes<=0){setPedidos(p=>p.filter(x=>x.id!==item.pedidoProvId));}
            else{setPedidos(p=>p.map(x=>x.id===item.pedidoProvId?{...x,cant:pendientes,costo:pendientes*item.unitario,total:0}:x));}
          }
          setBodega(p=>p.map(b=>b.id===modalDist?{...b,distribuciones:[...(b.distribuciones||[]),{id:`dist${Date.now()}`,pedidoId:pedId,cliente:dForm.cliente,cant,precio,total:cant*precio,fecha:dForm.fecha||new Date().toISOString().slice(0,10),nota:dForm.nota||""}]}:b));
          setModalDist(null);setDForm({});
        }} style={{...btnP,width:"100%",padding:"9px 0",fontSize:13,marginTop:4}}>Asignar a {dForm.cliente||"cliente"}</button>
      </div>
      <div style={{padding:14,border:`1px solid #fde68a`,borderRadius:10,background:"#fffbeb"}}>
        <div style={{fontWeight:700,color:C.yellow,fontSize:13,marginBottom:10}}>⚠️ Registrar merma</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Cantidad"><input type="number" value={dForm.cantMerma||""} onChange={e=>setDForm(f=>({...f,cantMerma:e.target.value}))} style={inp}/></Field>
          <Field label="Tipo"><select value={dForm.tipoMerma||""} onChange={e=>setDForm(f=>({...f,tipoMerma:e.target.value}))} style={inp}><option value="">Seleccionar...</option><option>Defecto / Dañado</option><option>Pérdida</option><option>Robo</option><option>Muestra gratis</option><option>Otro</option></select></Field>
        </div>
        <Field label="Nota"><input value={dForm.notaMerma||""} onChange={e=>setDForm(f=>({...f,notaMerma:e.target.value}))} style={inp}/></Field>
        <button onClick={()=>{
          const cant=Number(dForm.cantMerma)||0;
          if(!cant||!dForm.tipoMerma)return;
          if(cant>dsp){alert(`Solo quedan ${dsp} unidades`);return;}
          setBodega(p=>p.map(b=>b.id===modalDist?{...b,mermas:[...(b.mermas||[]),{id:`mrm${Date.now()}`,cant,tipo:dForm.tipoMerma,nota:dForm.notaMerma||"",fecha:new Date().toISOString().slice(0,10)}]}:b));
          setDForm(f=>({...f,cantMerma:"",tipoMerma:"",notaMerma:""}));
        }} style={{width:"100%",padding:"8px 0",background:C.yellow,border:"none",borderRadius:9,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginTop:4}}>Registrar merma</button>
      </div>
      <button onClick={()=>{setModalDist(null);setDForm({});}} style={{width:"100%",marginTop:12,padding:"9px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cerrar</button>
    </Modal>
  );
})()}

{modalEstadoProv&&<EstadoCuentaProveedorModal nombre={modalEstadoProv} pedidos={pedidos} abonosProv={abonosProv} onClose={()=>setModalEstadoProv(null)} fmt={fmt} C={C} inp={inp} btnP={btnP}/>}

      {modalDistribuir&&<DistribuirPagosModal nombre={modalDistribuir} pedidos={pedidos} abonosCli={abonosCli} setPedidos={setPedidos} onClose={()=>setModalDistribuir(null)} fmt={fmt} C={C} inp={inp} btnP={btnP}/>}

{modalEstadoCli&&<EstadoCuentaModal nombre={modalEstadoCli} pedidos={pedidos} abonosCli={abonosCli} flujo={flujo} onClose={()=>setModalEstadoCli(null)} fmt={fmt} C={C} inp={inp} btnP={btnP} periodo={periodo} periodoAnio={periodoAnio} periodoMes={periodoMes} periodoSem={periodoSem} setPedidos={setPedidos}/>}

{editMerma&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setEditMerma(null);}}>
          <div style={{background:"#fff",borderRadius:14,padding:24,width:"100%",maxWidth:340,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
            <div style={{fontFamily:"'Sora',sans-serif",fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>✏️ Editar merma</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,color:C.textDim,marginBottom:4}}>Cantidad</div>
              <input type="number" value={editMerma.cant} onChange={e=>setEditMerma(p=>({...p,cant:Number(e.target.value)}))} style={{...inp,width:"100%"}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,color:C.textDim,marginBottom:4}}>Tipo</div>
              <select value={editMerma.tipo} onChange={e=>setEditMerma(p=>({...p,tipo:e.target.value}))} style={{...inp,width:"100%"}}>
                <option value="Daño">Daño</option>
                <option value="Robo">Robo</option>
                <option value="Vencimiento">Vencimiento</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:C.textDim,marginBottom:4}}>Nota</div>
              <input value={editMerma.nota} onChange={e=>setEditMerma(p=>({...p,nota:e.target.value}))} style={{...inp,width:"100%"}} placeholder="Opcional"/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditMerma(null)} style={{flex:1,padding:"9px 0",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",fontSize:13}}>Cancelar</button>
              <button onClick={()=>{
                if(!editMerma.cant||!editMerma.tipo)return;
                setBodega(p=>p.map(b=>b.id===editMerma.bodegaId?{...b,mermas:(b.mermas||[]).map(m=>m.id===editMerma.mermaId?{...m,cant:editMerma.cant,tipo:editMerma.tipo,nota:editMerma.nota}:m)}:b));
                setEditMerma(null);
              }} style={{flex:2,padding:"9px 0",background:C.accent,border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff"}}>Guardar</button>
            </div>
          </div>
        </div>
      )}

{/* ══ MINI-MODALS: agregar proveedor / cliente / vendedor ══
          Usan zIndex:400 para aparecer ENCIMA del modal de pedido */}
      {modalProv&&(
        <AddNombreModal
          title={editProv?"Editar proveedor":"Nuevo proveedor"}
          placeholder="Ej: NIKE WHOLESALE"
          onSave={saveProv}
          onClose={()=>{setModalProv(false);setEditProv(null);setNewNom("");}}
        />
      )}
      {modalCli&&(
        <AddNombreModal
          title={editCli?"Editar cliente":"Nuevo cliente"}
          placeholder="Ej: PEDRO RAMIREZ"
          onSave={saveCli}
          onClose={()=>{setModalCli(false);setEditCli(null);setNewNom("");}}
        />
      )}
      {modalVend&&(
        <AddNombreModal
          title="Nuevo vendedor"
          placeholder="Ej: CARLOS"
          onSave={saveVend}
          onClose={()=>setModalVend(false)}
        />
      )}

      {/* ══ MODAL: Abono Proveedor ══ */}
      {editMerma&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setEditMerma(null);}}>
          <div style={{background:"#fff",borderRadius:14,padding:24,width:"100%",maxWidth:360,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:16,fontWeight:700,color:"#1c1917",marginBottom:16}}>{editMerma.mermaId?"✏️ Editar merma":"+ Nueva merma"}</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#a8a29e",marginBottom:4}}>Cantidad</div>
              <input type="number" value={editMerma.cant||""} onChange={e=>setEditMerma(p=>({...p,cant:Number(e.target.value)}))} style={{...inp}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#a8a29e",marginBottom:4}}>Tipo</div>
              <select value={editMerma.tipo||""} onChange={e=>setEditMerma(p=>({...p,tipo:e.target.value}))} style={{...inp}}>
                <option value="">— Seleccionar —</option>
                <option value="Daño">Daño</option>
                <option value="Robo">Robo</option>
                <option value="Vencimiento">Vencimiento</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"#a8a29e",marginBottom:4}}>Nota</div>
              <input value={editMerma.nota||""} onChange={e=>setEditMerma(p=>({...p,nota:e.target.value}))} style={{...inp}} placeholder="Opcional"/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditMerma(null)} style={{flex:1,padding:"10px 0",background:"transparent",border:"1px solid #e7e5e4",borderRadius:9,color:"#78716c",cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>Cancelar</button>
              <button onClick={()=>{
                const {bodegaId,mermaId,cant,tipo,nota}=editMerma;
                if(!cant||!tipo)return;
                if(mermaId){
                  setBodega(p=>p.map(b=>b.id===bodegaId?{...b,mermas:(b.mermas||[]).map(m=>m.id===mermaId?{...m,cant,tipo,nota}:m)}:b));
                } else {
                  const mid="m"+Date.now();
                  setBodega(p=>p.map(b=>b.id===bodegaId?{...b,mermas:[...(b.mermas||[]),{id:mid,cant,tipo,nota}]}:b));
                }
                setEditMerma(null);
              }} style={{flex:2,padding:"10px 0",background:"#1c1917",border:"none",borderRadius:9,color:"#fff",cursor:"pointer",fontWeight:600,fontFamily:"'Outfit',sans-serif"}}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      {modalEstadoProv&&<EstadoCuentaProveedorModal nombre={modalEstadoProv} pedidos={pedidos} abonosProv={abonosProv} onClose={()=>setModalEstadoProv(null)} fmt={fmt} C={C} inp={inp} btnP={btnP}/>}

      {modalDistribuir&&<DistribuirPagosModal nombre={modalDistribuir} pedidos={pedidos} abonosCli={abonosCli} setPedidos={setPedidos} onClose={()=>setModalDistribuir(null)} fmt={fmt} C={C} inp={inp} btnP={btnP}/>}
      {modalEstadoCli&&<EstadoCuentaModal nombre={modalEstadoCli} pedidos={pedidos} abonosCli={abonosCli} flujo={flujo} onClose={()=>setModalEstadoCli(null)} fmt={fmt} C={C} inp={inp} btnP={btnP} periodo={periodo} periodoAnio={periodoAnio} periodoMes={periodoMes} periodoSem={periodoSem} setPedidos={setPedidos}/>}
      {modalAP&&(
        <Modal title={`Abono a ${modalAP}`} onClose={()=>setModalAP(null)}>
          <Field label="Fecha"><input type="date" value={aForm.fecha||""} onChange={e=>setAForm(f=>({...f,fecha:e.target.value}))} style={inp}/></Field>
          <Field label="Monto"><input type="number" value={aForm.monto||""} onChange={e=>setAForm(f=>({...f,monto:e.target.value}))} style={inp}/></Field>
          <Field label="Nota"><input value={aForm.nota||""} onChange={e=>setAForm(f=>({...f,nota:e.target.value}))} style={inp}/></Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={()=>setModalAP(null)} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,cursor:"pointer"}}>Cancelar</button>
            <button onClick={saveAP} style={{...btnP,flex:2,padding:"10px 0",fontSize:14}}>Registrar abono</button>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: Pago Cliente ══ */}
      {modalAC&&(
        <Modal title={`Registrar pago de ${modalAC}`} onClose={()=>{setModalAC(null);setAForm({});}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Fecha"><input type="date" value={aForm.fecha||""} onChange={e=>setAForm(f=>({...f,fecha:e.target.value}))} style={inp}/></Field>
            <Field label="Monto recibido">
              <input type="number" value={aForm.monto||""} onChange={e=>setAForm(f=>({...f,monto:e.target.value}))} style={inp} placeholder="0.00"/>
            </Field>
          </div>
          <Field label="Nota"><input value={aForm.nota||""} onChange={e=>setAForm(f=>({...f,nota:e.target.value}))} style={inp} placeholder="Ej: transferencia, efectivo..."/></Field>
          <div style={{padding:"10px 12px",background:"#eff6ff",borderRadius:8,fontSize:12,color:"#1d4ed8",marginBottom:4}}>
            💡 El monto quedará como saldo a favor del cliente. Después puedes distribuirlo entre sus pedidos pendientes.
          </div>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={()=>{setModalAC(null);setAForm({});}} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,cursor:"pointer"}}>Cancelar</button>
            <button onClick={saveAC} style={{...btnP,flex:2,padding:"10px 0",fontSize:14}}>Registrar pago</button>
          </div>
        </Modal>
      )}

      {/* ══ TAB 4: FLUJO DE EFECTIVO ══ */}
      {tab===4&&(()=>{
        const saveFlujoEntry=()=>{
          const monto=Number(flujoForm.monto)||0;
          if(!monto||!flujoForm.descripcion) return;
          const esIngreso=flujoForm.tipo==="INGRESO";
          const montoFinal=esIngreso?monto:-monto;
          if(flujoForm._editId){
            setFlujo(p=>p.map(f=>f.id===flujoForm._editId?{...f,fecha:flujoForm.fecha||f.fecha,tipo:flujoForm.tipo,categoria:flujoForm.categoria||"Otro",descripcion:flujoForm.descripcion,monto:montoFinal}:f));
            if(flujoForm.abonoId){
              setAbonosCli(p=>p.map(a=>a.id===flujoForm.abonoId?{...a,monto:Math.abs(montoFinal),fecha:flujoForm.fecha||a.fecha,nota:flujoForm.descripcion.replace(/^Pago de [^—]+— ?/,"")}:a));
            }
          } else {
            setFlujo(p=>[...p,{id:`fl${Date.now()}`,fecha:flujoForm.fecha||new Date().toISOString().slice(0,10),tipo:flujoForm.tipo,categoria:flujoForm.categoria||"Otro",descripcion:flujoForm.descripcion,monto:montoFinal}]);
          }
          setModalFlujo(false);setFlujoForm({});
        };
        const TIPOS_CAT={
          INGRESO:["Cobro cliente","Inyección de capital","Otro ingreso"],
          EGRESO:["Pago proveedor","Gasto operativo","Retiro","Otro egreso"]
        };
        const cutoff=periodo==="anio"?periodoAnio:periodo==="mes"?periodoAnio+"-"+periodoMes:periodoSem;
        const saldoAnterior=periodo==="todo"?0:flujo.filter(m=>m.fecha&&m.fecha<cutoff&&!enPeriodo(m.fecha)).reduce((s,m)=>s+m.monto,0);
        const flujoFiltrado=[...flujo].filter(m=>enPeriodo(m.fecha));
        const sorted=[...flujoFiltrado].sort((a,b)=>a.fecha.localeCompare(b.fecha));
        let runSaldo=saldoAnterior;
        const rows=sorted.map(m=>{runSaldo+=m.monto;return{...m,saldoAcum:runSaldo};});
        const totalIngresos=flujoFiltrado.filter(m=>m.monto>0).reduce((s,m)=>s+m.monto,0);
        const totalEgresos=flujoFiltrado.filter(m=>m.monto<0).reduce((s,m)=>s+Math.abs(m.monto),0);
        const saldoActual=saldoAnterior+totalIngresos-totalEgresos;
        return(
          <>
            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
              {[
                {l:"Total ingresos",v:fmt(totalIngresos),c:C.green,icon:"📈"},
                {l:"Total egresos",v:fmt(totalEgresos),c:C.red,icon:"📉"},
                {l:"Saldo actual",v:fmt(saldoActual),c:saldoActual>=0?C.green:C.red,icon:"💵"},
              ].map(s=>(
                <div key={s.l} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                  <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
                  <div style={{fontSize:11,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{s.l}</div>
                  <div style={{fontSize:22,fontWeight:700,color:s.c,fontFamily:"'Sora',sans-serif"}}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <button onClick={()=>{setFlujoForm({tipo:"INGRESO",fecha:new Date().toISOString().slice(0,10)});setModalFlujo(true);}}
                style={{...btnP,padding:"9px 20px",fontSize:13,background:`linear-gradient(135deg,${C.green},#15803d)`}}>
                + Registrar ingreso
              </button>
              <button onClick={()=>{setFlujoForm({tipo:"EGRESO",fecha:new Date().toISOString().slice(0,10)});setModalFlujo(true);}}
                style={{...btnP,padding:"9px 20px",fontSize:13,background:`linear-gradient(135deg,${C.red},#b91c1c)`}}>
                − Registrar egreso
              </button>
            </div>

            {/* Table */}
            {rows.length===0?(
              <div style={{textAlign:"center",padding:"60px 0",color:C.textDim,background:"#fff",borderRadius:14,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:40,marginBottom:12}}>💵</div>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Sin movimientos aún</div>
                <div style={{fontSize:13}}>Los pagos a proveedores y cobros a clientes aparecerán aquí automáticamente.</div>
              </div>
            ):(
              <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{borderBottom:`2px solid ${C.border}`,background:"#fafafa"}}>
                      {["Fecha","Tipo","Categoría","Descripción","Monto","Saldo acumulado",""].map(h=>(
                        <th key={h} style={{padding:"11px 14px",color:C.textDim,fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",textAlign:h==="Monto"||h==="Saldo acumulado"?"right":"left",fontWeight:600}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodo!=="todo"&&saldoAnterior!==0&&(
                      <tr style={{background:"#eff6ff",borderBottom:`1px solid ${C.border}`}}>
                        <td colSpan={5} style={{padding:"8px 14px",fontSize:12,color:"#1d4ed8",fontWeight:600}}>📊 Saldo anterior al periodo: {fmt(saldoAnterior)}</td>
                        <td style={{padding:"8px 14px",textAlign:"right",fontWeight:700,color:"#1d4ed8"}}>{fmt(saldoAnterior)}</td>
                        <td/>
                      </tr>
                    )}
                    {rows.map((m,i)=>(
                      <tr key={m.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"#fff":"#fafafa"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#fdf4f5"}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#fafafa"}>
                        <td style={{padding:"11px 14px",color:C.textDim,whiteSpace:"nowrap"}}>{m.fecha}</td>
                        <td style={{padding:"11px 14px"}}>
                          <span style={{background:m.monto>0?"#dcfce7":"#fee2e2",color:m.monto>0?C.green:C.red,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>
                            {m.monto>0?"↑ INGRESO":"↓ EGRESO"}
                          </span>
                        </td>
                        <td style={{padding:"11px 14px",color:C.textMid,fontSize:12}}>{m.categoria}</td>
                        <td style={{padding:"11px 14px",color:C.text,maxWidth:220,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.descripcion}</td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontWeight:700,color:m.monto>0?C.green:C.red,whiteSpace:"nowrap"}}>{m.monto>0?"+":""}{fmt(m.monto)}</td>
                        <td style={{padding:"11px 14px",textAlign:"right",fontWeight:700,color:m.saldoAcum>=0?C.blue:C.red,whiteSpace:"nowrap"}}>{fmt(m.saldoAcum)}</td>
                        <td style={{padding:"8px 10px"}}>
                          <div style={{display:"flex",gap:4}}>
                            <button onClick={()=>{setFlujoForm({...m,monto:Math.abs(m.monto),_editId:m.id});setModalFlujo(true);}} style={{background:"#f4f4f5",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 7px",cursor:"pointer",fontSize:11,color:C.textMid}}>✏️</button>
                            <button onClick={()=>{
                              if(!confirm("¿Eliminar este movimiento?"))return;
                              if(m.abonoId) setAbonosCli(p=>p.filter(a=>a.id!==m.abonoId));
                              setFlujo(p=>p.filter(x=>x.id!==m.id));
                            }} style={{background:"#fff0f0",border:"1px solid #fecaca",borderRadius:5,padding:"3px 7px",cursor:"pointer",fontSize:11,color:C.red}}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal nuevo movimiento */}
            {modalFlujo&&(
              <Modal title={flujoForm._editId?"Guardar cambios":flujoForm.tipo==="INGRESO"?"Registrar ingreso":"Registrar egreso"} onClose={()=>{setModalFlujo(false);setFlujoForm({});}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
                  <Field label="Tipo">
                    <select value={flujoForm.tipo||"INGRESO"} onChange={e=>setFlujoForm(f=>({...f,tipo:e.target.value,categoria:""}))} style={inp}>
                      <option value="INGRESO">↑ Ingreso</option>
                      <option value="EGRESO">↓ Egreso</option>
                    </select>
                  </Field>
                  <Field label="Fecha">
                    <input type="date" value={flujoForm.fecha||""} onChange={e=>setFlujoForm(f=>({...f,fecha:e.target.value}))} style={inp}/>
                  </Field>
                </div>
                <Field label="Categoría">
                  <select value={flujoForm.categoria||""} onChange={e=>setFlujoForm(f=>({...f,categoria:e.target.value}))} style={inp}>
                    <option value="">— Seleccionar —</option>
                    {(TIPOS_CAT[flujoForm.tipo||"INGRESO"]||[]).map(c=><option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Descripción">
                  <input value={flujoForm.descripcion||""} onChange={e=>setFlujoForm(f=>({...f,descripcion:e.target.value}))} placeholder="Ej: Inyección de capital inicial" style={inp}/>
                </Field>
                <Field label="Monto (USD)">
                  <input type="number" value={flujoForm.monto||""} onChange={e=>setFlujoForm(f=>({...f,monto:e.target.value}))} placeholder="0.00" style={inp}/>
                </Field>
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  <button onClick={()=>{setModalFlujo(false);setFlujoForm({});}} style={{flex:1,padding:"10px 0",background:"transparent",border:`1px solid ${C.border2}`,borderRadius:9,color:C.textDim,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancelar</button>
                  <button onClick={saveFlujoEntry} style={{...btnP,flex:2,padding:"10px 0",fontSize:14,background:flujoForm.tipo==="INGRESO"?`linear-gradient(135deg,${C.green},#15803d)`:`linear-gradient(135deg,${C.red},#b91c1c)`}}>
                    {flujoForm._editId?"Guardar cambios":flujoForm.tipo==="INGRESO"?"Registrar ingreso":"Registrar egreso"}
                  </button>
                </div>
              </Modal>
            )}
          </>
        );
      })()}


    </div>
  );
}


export default Axia;
