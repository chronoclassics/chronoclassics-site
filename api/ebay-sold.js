// api/ebay-sold.js
// Returns a random selection of 10 watches from the curated pool.
// Pool is sourced from ChronoClassics' real eBay listings.

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const POOL = [
  {
    brand: 'Rolex',
    model: 'ROLEX COSMOGRAPH DAYTONA 116520 White Dial 40mm · Full Set B&P',
    condition: 'Pre-Owned',
    price: '$22,950',
    url: 'https://www.ebay.com/itm/389788130722',
    image: 'https://i.ebayimg.com/images/g/uycAAeSwnQ1pnU6l/s-l500.jpg',
  },
  {
    brand: 'Cartier',
    model: 'CARTIER BALLON BLEU 36mm 18K Gold Factory Diamonds Automatic WE900651 · B&P',
    condition: 'Pre-Owned',
    price: '$13,995',
    url: 'https://www.ebay.com/itm/388917630376',
    image: 'https://i.ebayimg.com/images/g/vkIAAeSwyqlo5TZf/s-l500.jpg',
  },
  {
    brand: 'Rolex',
    model: 'ROLEX SEA-DWELLER 126600 43mm Red Letters Black Ceramic Steel · Box & Tags',
    condition: 'Pre-Owned',
    price: '$12,450',
    url: 'https://www.ebay.com/itm/389867848673',
    image: 'https://i.ebayimg.com/images/g/b3kAAeSw1rlp1-aZ/s-l500.jpg',
  },
  {
    brand: 'Rolex',
    model: 'ROLEX SUBMARINER DATE 116610LN 40mm Black Ceramic Bezel Stainless Steel · Box',
    condition: 'Pre-Owned',
    price: '$11,995',
    url: 'https://www.ebay.com/itm/389574727500',
    image: 'https://i.ebayimg.com/images/g/h7cAAeSwqaNphBkW/s-l500.jpg',
  },
  {
    brand: 'Rolex',
    model: 'ROLEX MILGAUSS 116400GV Oyster Perpetual 40mm Green Crystal · Box',
    condition: 'Pre-Owned',
    price: '$10,500',
    url: 'https://www.ebay.com/itm/389933345466',
    image: 'https://i.ebayimg.com/images/g/XFAAAeSwVqBp66ds/s-l500.jpg',
  },
  {
    brand: 'Rolex',
    model: 'ROLEX MILGAUSS 116400GV Oyster Perpetual 40mm Green Crystal · Box',
    condition: 'Pre-Owned',
    price: '$9,995',
    url: 'https://www.ebay.com/itm/389704125510',
    image: 'https://i.ebayimg.com/images/g/0jwAAeSwodJpgSd-/s-l500.jpg',
  },
  {
    brand: 'Jaeger-LeCoultre',
    model: 'JAEGER-LECOULTRE Master Ultra Thin Reserve de Marche Automatic Q1378420 · B&P',
    condition: 'Pre-Owned',
    price: '$6,095',
    url: 'https://www.ebay.com/itm/389199086804',
    image: 'https://i.ebayimg.com/images/g/V6cAAeSwo5ZpDC5W/s-l500.jpg',
  },
  {
    brand: 'Cartier',
    model: "CARTIER PANTHERE 27mm 2024 Stainless Steel Ladies Watch Ref. WSPN0007 · B&P",
    condition: 'Pre-Owned',
    price: '$5,695',
    url: 'https://www.ebay.com/itm/389872394381',
    image: 'https://i.ebayimg.com/images/g/8AEAAeSw-Bhp2S5E/s-l500.jpg',
  },
  {
    brand: 'Cartier',
    model: 'CARTIER BALLON BLEU 42mm WSBB0025 Automatic Blue Dial Crocodile Strap · B&P',
    condition: 'Pre-Owned',
    price: '$4,950',
    url: 'https://www.ebay.com/itm/389895410827',
    image: 'https://i.ebayimg.com/images/g/s2IAAeSwamJp4Cxa/s-l500.jpg',
  },
  {
    brand: 'Breitling',
    model: 'BREITLING OLD NAVITIMER D13322 Chronograph 18k Gold & Steel · Full Set',
    condition: 'Pre-Owned',
    price: '$4,695',
    url: 'https://www.ebay.com/itm/389887075896',
    image: 'https://i.ebayimg.com/images/g/rtkAAeSwajBp3YlI/s-l500.jpg',
  },
  {
    brand: 'Chopard',
    model: 'CHOPARD CASMIR Mother of Pearl 18K Gold & Steel Ladies Quartz Watch · Box',
    condition: 'Pre-Owned',
    price: '$3,895',
    url: 'https://www.ebay.com/itm/388820699714',
    image: 'https://i.ebayimg.com/images/g/cKgAAeSwe7pomRw9/s-l500.jpg',
  },
  {
    brand: 'Omega',
    model: 'OMEGA SPEEDMASTER Torino Olympic Games Collection 3836.70.36 MOP Dial · B&P',
    condition: 'Pre-Owned',
    price: '$3,495',
    url: 'https://www.ebay.com/itm/389317662175',
    image: 'https://i.ebayimg.com/images/g/k8gAAeSwFhRpLeeZ/s-l500.jpg',
  },
  {
    brand: 'Breitling',
    model: "BREITLING CHRONOMAT EVOLUTION A13356 44mm Automatic Men's Watch · Full Set",
    condition: 'Pre-Owned',
    price: '$3,195',
    url: 'https://www.ebay.com/itm/389890465628',
    image: 'https://i.ebayimg.com/images/g/X0sAAeSwCctp3ovc/s-l500.jpg',
  },
  {
    brand: 'Chronographe Suisse',
    model: 'CHRONOGRAPHE SUISSE 18K Rose Gold 38mm · Swiss Made Landeron · 1950s Manual',
    condition: 'Pre-Owned',
    price: '$2,295',
    url: 'https://www.ebay.com/itm/389554217389',
    image: 'https://i.ebayimg.com/images/g/iTwAAeSw8nNphR5B/s-l500.jpg',
  },
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const listings = shuffle(POOL).slice(0, 10);
  return res.status(200).json({ listings, source: 'static', total: POOL.length });
};
