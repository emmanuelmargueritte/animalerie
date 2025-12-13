async function chargerProduits(){
  const res = await fetch('data/produits.json', { cache: 'no-store' });
  return await res.json();
}

function formatPrixCentimesXpf(x){
  return (x / 100).toFixed(0) + ' XPF';
}

function getCart(){
  return JSON.parse(localStorage.getItem('panier') || '[]');
}

function saveCart(cart){
  localStorage.setItem('panier', JSON.stringify(cart));
}

function removeOne(id){
  const cart = getCart();
  const index = cart.indexOf(id);
  if(index !== -1){
    cart.splice(index, 1);
    saveCart(cart);
  }
  render();
}

function removeAll(id){
  const cart = getCart().filter(x => x !== id);
  saveCart(cart);
  render();
}

function groupCounts(ids){
  const counts = {};
  ids.forEach(id => counts[id] = (counts[id] || 0) + 1);
  return counts;
}

async function render(){
  const produits = await chargerProduits();
  const cartIds = getCart();
  const cont = document.getElementById('panier');

  if(cartIds.length === 0){
    cont.innerHTML = '<p>Panier vide.</p>';
    return;
  }

  const counts = groupCounts(cartIds);
  let total = 0;

  cont.innerHTML = Object.keys(counts).map(id => {
    const p = produits.find(x => x.id === Number(id));
    if(!p) return '';

    const qte = counts[id];
    total += p.prix * qte;

    return `
      <div class="produit">
        <img src="${p.image}" alt="${p.nom}" style="width:90px">
        <h3>${p.nom}</h3>
        <p>Quantité : <strong>${qte}</strong></p>
        <p>${formatPrixCentimesXpf(p.prix)}</p>

        <div style="display:flex;gap:8px">
          <button class="btn" onclick="removeOne(${p.id})">➖</button>
          <button class="btn" onclick="removeAll(${p.id})">🗑️</button>
        </div>
      </div>
    `;
  }).join('') + `
    <p><strong>Total : ${formatPrixCentimesXpf(total)}</strong></p>
  `;
}

render();
