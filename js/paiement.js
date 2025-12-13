function getCartIds(){
  return JSON.parse(localStorage.getItem('panier') || '[]');
}

if(document.getElementById('commande')){
  document.getElementById('commande').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = document.getElementById('message');
    msg.textContent = 'Création de la session de paiement...';

    const form = Object.fromEntries(new FormData(e.target).entries());
    const panier = getCartIds();

    if(panier.length === 0){
      msg.textContent = 'Votre panier est vide.';
      return;
    }

    try{
      const res = await fetch('/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form, panier })
      });
      const js = await res.json();
      if(js.url){
        window.location = js.url;
      }else{
        msg.textContent = js.error || 'Erreur lors du paiement.';
      }
    }catch(err){
      console.error(err);
      msg.textContent = 'Erreur réseau.';
    }
  });
}
