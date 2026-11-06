/**
 * services/drinks.js — Bebidas de Deli-Combos (lista y precios reales entregados por el negocio)
 *
 * Cada bebida se vende sola (categorías de bebidas) y también aparece en el desplegable
 * "Bebidas" de los combos. Los envases de VIDRIO llevan $500 de envase porque todo pedido
 * en línea es para llevar: el precio ya viene sumado y se avisa en la nota.
 */
const { v4: uuidv4 } = require('uuid');

const GLASS_FEE = 500;

// [sección, nombre, precio base, banderas]  (v = envase de vidrio, a = licor)
const LIST = [
  ['Aguas', 'Agua Brisa limón pequeña', 2000],
  ['Aguas', 'Agua Brisa manzana pequeña', 2000],
  ['Aguas', 'Agua Brisa limón personal 600 ml', 3000],
  ['Aguas', 'Agua Brisa manzana personal 600 ml', 3000],
  ['Aguas', 'Agua Brisa', 2500],
  ['Aguas', 'Agua Cristal 600 ml', 2500],
  ['Aguas', 'Agua Cristal litro', 3500],

  ['Gaseosas y jugos', 'Coca-Cola 400 ml', 3500],
  ['Gaseosas y jugos', 'Coca-Cola Zero 400 ml', 3500],
  ['Gaseosas y jugos', 'Cuatro 400 ml', 3500],
  ['Gaseosas y jugos', 'Kola Román 400 ml', 3500],
  ['Gaseosas y jugos', 'Del Valle sabores surtidos 400 ml', 3500],
  ['Gaseosas y jugos', 'Cola y Pola lata', 4500],
  ['Gaseosas y jugos', 'Coca-Cola vidrio 250 ml', 2500, 'v'],
  ['Gaseosas y jugos', 'Cuatro vidrio 250 ml', 2500, 'v'],
  ['Gaseosas y jugos', 'Premio vidrio 250 ml', 2500, 'v'],
  ['Gaseosas y jugos', 'Colombiana vidrio 250 ml', 2500, 'v'],
  ['Gaseosas y jugos', 'Uva vidrio 250 ml', 2500, 'v'],
  ['Gaseosas y jugos', 'Manzana vidrio 250 ml', 2500, 'v'],
  ['Gaseosas y jugos', 'Naranjada vidrio 250 ml', 2500, 'v'],
  ['Gaseosas y jugos', 'Manzana 250 ml plástica', 2500],
  ['Gaseosas y jugos', 'Naranjada 250 ml plástica', 2500],
  ['Gaseosas y jugos', 'Uva 250 ml plástica', 2500],
  ['Gaseosas y jugos', 'Bretaña 300 ml', 4500],
  ['Gaseosas y jugos', 'Piña 350 ml', 3500],
  ['Gaseosas y jugos', 'Tamarindo 350 ml', 3500],
  ['Gaseosas y jugos', 'Hit mora 600 ml', 3500],
  ['Gaseosas y jugos', 'Hit mango 600 ml', 3500],
  ['Gaseosas y jugos', 'Hit naranja piña 600 ml', 3500],
  ['Gaseosas y jugos', 'Hit tropical 600 ml', 3500],
  ['Gaseosas y jugos', 'Hit lulo 600 ml', 3500],
  ['Gaseosas y jugos', 'Tutti Frutti mango', 2500],
  ['Gaseosas y jugos', 'Tutti Frutti mora', 2500],
  ['Gaseosas y jugos', 'Tutti Frutti avena', 2500],
  ['Gaseosas y jugos', 'Tutti Frutti guayaba', 2500],
  ['Gaseosas y jugos', 'Tutti Frutti lulo', 2500],

  ['Gaseosas grandes', 'Cola y Pola 1.5 L', 7000],
  ['Gaseosas grandes', 'Coca-Cola 1.5 L', 7000],
  ['Gaseosas grandes', 'Coca-Cola Zero 1.5 L', 7000],
  ['Gaseosas grandes', 'Cuatro 1.5 L', 7000],
  ['Gaseosas grandes', 'Del Valle 1.5 L', 7000],
  ['Gaseosas grandes', 'Premio 1.5 L', 7000],
  ['Gaseosas grandes', 'Uva 1.5 L', 7000],
  ['Gaseosas grandes', 'Naranjada 1.5 L', 7000],
  ['Gaseosas grandes', 'Canadá Dry 1.5 L', 7000],
  ['Gaseosas grandes', 'Manzana 1.5 L', 7000],
  ['Gaseosas grandes', 'Colombiana 1.5 L', 7000],
  ['Gaseosas grandes', 'Bretaña 1.5 L', 6000],
  ['Gaseosas grandes', 'Coca-Cola 2.5 L', 10000],
  ['Gaseosas grandes', 'Manzana 2.5 L', 9000],
  ['Gaseosas grandes', 'Naranjada 2.5 L', 9000],
  ['Gaseosas grandes', 'Uva 2.5 L', 9000],
  ['Gaseosas grandes', 'Premio mega 3 L', 12000],
  ['Gaseosas grandes', 'Cuatro mega 3 L', 12000],

  ['Energizantes, té e hidratantes', 'Monster lata', 10000],
  ['Energizantes, té e hidratantes', 'Red Bull sugar free', 8000],
  ['Energizantes, té e hidratantes', 'Red Bull original', 8000],
  ['Energizantes, té e hidratantes', 'Speed Max', 2500],
  ['Energizantes, té e hidratantes', 'Té Hatsu sabores surtidos', 8000],
  ['Energizantes, té e hidratantes', 'Mr Tea limón 400 ml', 4500],
  ['Energizantes, té e hidratantes', 'Mr Tea durazno 400 ml', 4500],
  ['Energizantes, té e hidratantes', 'Gatorade tropical', 4500],
  ['Energizantes, té e hidratantes', 'Gatorade maracuyá', 4500],
  ['Energizantes, té e hidratantes', 'Gatorade mandarina', 4500],

  ['Cervezas', 'Cerveza Mítica Tres Cordilleras', 4500, 'a'],
  ['Cervezas', 'Cerveza Águila', 4500, 'a'],
  ['Cervezas', 'Cerveza Pilsen', 4500, 'a'],
  ['Cervezas', 'Cerveza Heineken', 5000, 'a'],
  ['Cervezas', 'Cerveza Club Colombia latón', 6000, 'a'],
  ['Cervezas', 'Cerveza Póker latón', 6000, 'a']
];

const SECTIONS = [...new Set(LIST.map(r => r[0]))];
const GLASS_NOTE = `Incluye $${GLASS_FEE} de envase de vidrio (para llevar)`;

/** Bebidas ya con precio final, listas para usarse (sin ids) */
function drinks() {
  return LIST.map(([section, name, base, flags = '']) => ({
    section, name,
    price: base + (flags.includes('v') ? GLASS_FEE : 0),
    ...(flags.includes('v') ? { note: GLASS_NOTE } : {}),
    ...(flags.includes('a') ? { alcohol: true } : {})
  }));
}

/** Opciones del desplegable "Bebidas" de un combo (ids nuevos) */
function drinkOptions() {
  return drinks().map(d => ({ id: uuidv4(), name: d.name, price: d.price, section: d.section,
    ...(d.note ? { note: d.note } : {}), ...(d.alcohol ? { alcohol: true } : {}) }));
}

module.exports = { SECTIONS, drinks, drinkOptions, GLASS_NOTE };
