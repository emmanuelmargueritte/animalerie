const express=require('express');
const fs=require('fs');
const app=express();
app.use(express.json());
app.use(express.static('.'));
app.post('/ajouter',(req,res)=>{
    let d=JSON.parse(fs.readFileSync('data/produits.json'));
    d.push(req.body);
    fs.writeFileSync('data/produits.json',JSON.stringify(d,null,2));
    res.sendStatus(200);
});
app.post('/supprimer',(req,res)=>{
    let d=JSON.parse(fs.readFileSync('data/produits.json'));
    d.splice(req.body.index,1);
    fs.writeFileSync('data/produits.json',JSON.stringify(d,null,2));
    res.sendStatus(200);
});
app.listen(3000,()=>console.log('OK 3000'));
