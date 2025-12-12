if(document.getElementById('commande')){
  document.getElementById('commande').addEventListener('submit', async e=>{
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target).entries());
    const panier = JSON.parse(localStorage.getItem('panier')||'[]');
    const res = await fetch('/create-checkout-session',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({form, panier})
    });
    const js = await res.json();
    if(js.url) window.location = js.url;
    else document.getElementById('message').textContent = js.error || 'Erreur';
  });
}
