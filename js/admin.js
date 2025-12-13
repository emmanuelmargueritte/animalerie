const PASSWORD = 'admin123'; // Démo : à remplacer par une vraie auth serveur

const loginSection = document.getElementById('admin-login');
const panelSection = document.getElementById('admin-panel');
const loginMsg = document.getElementById('login-msg');

async function fetchProduits(){
  const res = await fetch('data/produits.json', { cache: 'no-store' });
  if(!res.ok) throw new Error('Impossible de charger produits.json');
  return await res.json();
}

function renderProduits(list){
  const cont = document.getElementById('produits-admin');
  cont.innerHTML = '';
  if(!list.length){
    cont.innerHTML = '<p>Aucun produit.</p>';
    return;
  }
  list.forEach((p, index)=>{
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
      <div class="left">
        <strong>${p.nom}</strong><br>
        Prix: ${(p.prix/100).toFixed(0)} XPF<br>
        Image: <code>${p.image}</code><br>
        ${p.description ? `<span class="muted">${p.description}</span>` : ''}
      </div>
      <div>
        <button class="btn" type="button" data-del="${index}">Supprimer</button>
      </div>
    `;
    cont.appendChild(div);
  });

  cont.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-del]');
    if(!btn) return;
    const index = Number(btn.dataset.del);
    if(!confirm('Supprimer ce produit ?')) return;
    await fetch('/supprimer', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ index })
    });
    await refresh();
  }, { once: true });
}

async function refresh(){
  const list = await fetchProduits();
  renderProduits(list);
}

document.getElementById('btn-login').addEventListener('click', async ()=>{
  const pass = document.getElementById('admin-pass').value;
  if(pass !== PASSWORD){
    loginMsg.textContent = 'Mot de passe incorrect.';
    return;
  }
  loginSection.classList.add('hidden');
  panelSection.classList.remove('hidden');
  loginMsg.textContent = '';
  await refresh();
});

document.getElementById('btn-refresh').addEventListener('click', refresh);

document.getElementById('form-ajout').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const nom = String(fd.get('nom')||'').trim();
  const prixXpf = Number(fd.get('prix')||0);
  const image = String(fd.get('image')||'').trim();
  const description = String(fd.get('description')||'').trim();

  if(!nom || !image || !Number.isFinite(prixXpf)){
    alert('Champs invalides.');
    return;
  }

  const produit = {
    id: Date.now(),
    nom,
    prix: Math.round(prixXpf * 100),
    image,
    description
  };

  await fetch('/ajouter', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(produit)
  });

  e.target.reset();
  await refresh();
});
