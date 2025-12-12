async function chargerProduits(){
  const res = await fetch('/produits.json');
  const produits = await res.json();
  return produits;
}

function formatPrix(x){return (x/100).toFixed(0) + ' XPF'}

if(document.getElementById('produits')){
  chargerProduits().then(list=>{
    const cont = document.getElementById('produits');
    cont.innerHTML = '';
    list.forEach(p=>{
      const d = document.createElement('div'); d.className='produit';
      d.innerHTML = `
        <img src="${p.image}" alt="${p.nom}">
        <h3>${p.nom}</h3>
        <p>${formatPrix(p.prix)}</p>
        <div style="display:flex;gap:8px;align-items:center">
          <button data-id="${p.id}" class="btn">Ajouter</button>
          <a href="/produit.html?id=${p.id}" class="btn">Voir</a>
        </div>
      `;
      cont.appendChild(d);
    });

    cont.addEventListener('click', e=>{
      if(e.target.tagName === 'BUTTON'){
        const id = Number(e.target.dataset.id);
        let panier = JSON.parse(localStorage.getItem('panier')||'[]');
        panier.push(id);
        localStorage.setItem('panier', JSON.stringify(panier));
        alert('Produit ajouté au panier');
      }
    });
  });
}

if(document.getElementById('fiche')){
  const params = new URLSearchParams(location.search);
  const id = Number(params.get('id'));
  chargerProduits().then(list=>{
    const p = list.find(x=>x.id===id);
    const c = document.getElementById('fiche');
    if(!p){c.innerHTML='<p>Produit non trouvé</p>';return}
    c.innerHTML = `
      <div>
        <img src="${p.image}" alt="${p.nom}" style="max-width:100%">
      </div>
      <div>
        <h2>${p.nom}</h2>
        <p><strong>${formatPrix(p.prix)}</strong></p>
        <p>${p.description||''}</p>
        <button id="add" class="btn primary">Ajouter au panier</button>
      </div>
    `;
    document.getElementById('add').addEventListener('click', ()=>{
      let panier = JSON.parse(localStorage.getItem('panier')||'[]');
      panier.push(p.id);
      localStorage.setItem('panier', JSON.stringify(panier));
      alert('Ajouté au panier');
    });
  });
}
