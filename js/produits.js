async function chargerProduits(){
  const res = await fetch('data/produits.json', { cache: 'no-store' });
  if(!res.ok) throw new Error('Impossible de charger les produits');
  return await res.json();
}
function formatPrixCentimesXpf(x){ return (x/100).toFixed(0) + ' XPF'; }

function addToCart(id){
  const panier = JSON.parse(localStorage.getItem('panier') || '[]');
  panier.push(id);
  localStorage.setItem('panier', JSON.stringify(panier));
}

if(document.getElementById('produits')){
  chargerProduits().then(list=>{
    const cont = document.getElementById('produits');
    cont.innerHTML = '';
    list.slice(0, 12).forEach(p=>{
      const d = document.createElement('div');
      d.className = 'produit';
      d.innerHTML = `
        <img src="${p.image}" alt="${p.nom}">
        <h3>${p.nom}</h3>
        <p><strong>${formatPrixCentimesXpf(p.prix)}</strong></p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-id="${p.id}" type="button">Ajouter</button>
          <a class="btn" href="produit.html?id=${p.id}">Voir</a>
        </div>
      `;
      cont.appendChild(d);
    });

    cont.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-id]');
      if(!btn) return;
      const id = Number(btn.dataset.id);
      addToCart(id);
      alert('Produit ajouté au panier');
    });
  }).catch(err=>{
    document.getElementById('produits').innerHTML = '<p>Erreur de chargement des produits.</p>';
    console.error(err);
  });
}

if(document.getElementById('fiche')){
  const params = new URLSearchParams(location.search);
  const id = Number(params.get('id'));
  chargerProduits().then(list=>{
    const p = list.find(x=>x.id===id);
    const c = document.getElementById('fiche');
    if(!p){ c.innerHTML = '<p>Produit non trouvé.</p>'; return; }
    c.innerHTML = `
      <div><img src="${p.image}" alt="${p.nom}" style="max-width:100%"></div>
      <div>
        <h2>${p.nom}</h2>
        <p><strong>${formatPrixCentimesXpf(p.prix)}</strong></p>
        <p>${p.description || ''}</p>
        <button id="add" class="btn primary" type="button">Ajouter au panier</button>
      </div>
    `;
    document.getElementById('add').addEventListener('click', ()=>{
      addToCart(p.id);
      alert('Ajouté au panier');
    });
  }).catch(err=>{
    document.getElementById('fiche').innerHTML = '<p>Erreur de chargement.</p>';
    console.error(err);
  });
}
