function chargerPanier(){
  const ids = JSON.parse(localStorage.getItem('panier')||'[]');
  return chargerProduits().then(list=>{
    const counts = {};
    ids.forEach(i=>counts[i] = (counts[i]||0)+1);
    return Object.keys(counts).map(id=>{
      const p = list.find(x=>x.id===Number(id));
      return {...p, quantite: counts[id]};
    });
  });
}

if(document.getElementById('panier')){
  chargerPanier().then(items=>{
    const cont = document.getElementById('panier');
    if(items.length===0){cont.innerHTML='<p>Panier vide</p>';return}
    cont.innerHTML = items.map(it=>`
      <div class="produit">
        <img src="${it.image}" alt="${it.nom}" style="width:80px">
        <strong>${it.nom}</strong>
        <p>Quantité: ${it.quantite}</p>
        <p>Prix: ${(it.prix/100).toFixed(0)} XPF</p>
      </div>
    `).join('');
  });
}
