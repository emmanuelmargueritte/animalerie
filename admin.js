const PASSWORD='admin123';
function loginAdmin(){
    if(document.getElementById('pass').value===PASSWORD){
        login.style.display='none';
        panel.style.display='block';
        load();
    } else alert('mauvais mdp');
}
function load(){
    fetch('data/produits.json').then(r=>r.json()).then(d=>{
        list.innerHTML='';
        d.forEach((p,i)=>{
            list.innerHTML+=`${p.nom} - ${p.prix} <button onclick='supp(${i})'>X</button><br>`;
        });
    });
}
function ajout(){
    fetch('/ajouter',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({nom:nom.value, prix:prix.value, image:image.value})}).then(load);
}
function supp(i){
    fetch('/supprimer',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({index:i})}).then(load);
}
