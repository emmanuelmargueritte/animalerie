async function chargerProduits(){
  const res = await fetch('data/produits.json', { cache: 'no-store' });
  return await res.json();
}
function formatPrixCentimesXpf(x){ return (x/100).toFixed(0) + ' XPF'; }

function getCartIds(){
  return JSON.parse(localStorage.getItem('panier') || '[]');
}

function groupCounts(ids){
  const counts = {};
  ids.forEach(id => counts[id] = (counts[id]||0) + 1);
  return counts;
}

if(document.getElementById('panier')){
  Promise.all([chargerProduits()]).then(([produits])=>{
    const ids = getCartIds();
    const counts = groupCounts(ids);
    const items = Object.keys(counts).map(k=>{
      const p = produits.find(x=>x.id === Number(k));
      return { ...p, quantite: counts[k] };
    }).filter(Boolean);

    const cont = document.getElementById('panier');
    if(items.length === 0){
      cont.innerHTML = '<p>Panier vide.</p>';
      return;
    }
    let total = 0;
    cont.innerHTML = items.map(it=>{
      total += it.prix * it.quantite;
      return `
        <div class="produit">
          <img src="${it.image}" alt="${it.nom}" style="width:90px">
          <h3 style="margin:8px 0 0">${it.nom}</h3>
          <p>Quantité: <strong>${it.quantite}</strong></p>
          <p>Prix unitaire: ${formatPrixCentimesXpf(it.prix)}</p>
        </div>
      `;
    }).join('') + `<p><strong>Total: ${formatPrixCentimesXpf(total)}</strong></p>`;
  }).catch(err=>{
    document.getElementById('panier').innerHTML = '<p>Erreur de chargement du panier.</p>';
    console.error(err);
  });
}
